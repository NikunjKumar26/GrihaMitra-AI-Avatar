const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const EventEmitter = require('events');
const mongoose = require('mongoose');

// GrihaMitra Agent Layer
const Agent = require('../agent');

// Models
const VoiceHistory = require('../models/VoiceHistory');
const ConversationSession = require('../models/ConversationSession');
const FamilyMember = require('../models/FamilyMember');
const AIRoutine = require('../models/AIRoutine');
const PredictiveDecision = require('../models/PredictiveDecision');
const ExplainabilityRecord = require('../models/ExplainabilityRecord');
const Home = require('../models/Home');
const QueueMetrics = require('../models/QueueMetrics');

// Global event bus to bridge HTTP requests with background worker completions
const jobEvents = new EventEmitter();

let connection = null;
let isRedisOffline = false;

// 1. Initialize Redis connection
try {
  const redisOptions = {
    maxRetriesPerRequest: null // Required by BullMQ
  };

  if (process.env.REDIS_URL) {
    connection = new Redis(process.env.REDIS_URL, redisOptions);
  } else {
    connection = new Redis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT) || 6379,
      ...redisOptions
    });
  }

  connection.on('error', (err) => {
    if (process.env.NODE_ENV === 'production') {
      console.error('CRITICAL [BullMQ Config] Redis connection failed in PRODUCTION mode. Blocking initialization:', err.message);
      process.exit(1);
    } else {
      if (!isRedisOffline) {
        console.warn('⚠️ [BullMQ Config] Redis is offline. Operating in synchronous fallback mode:', err.message);
        isRedisOffline = true;
      }
    }
  });
  connection.on('connect', () => {
    console.log('✔ [BullMQ Config] Connected to Redis. Decoupled asynchronous workers active.');
    isRedisOffline = false;
  });
} catch (err) {
  if (process.env.NODE_ENV === 'production') {
    console.error('CRITICAL [BullMQ Config] Failed to initialize Redis in PRODUCTION mode. Blocking initialization:', err.message);
    process.exit(1);
  }
  console.warn('⚠️ [BullMQ Config] Failed to initialize Redis. Operating in synchronous fallback mode:', err.message);
  isRedisOffline = true;
}

// Helper to check Redis health before adding jobs
const isOffline = () => isRedisOffline || !connection || connection.status !== 'ready';

exports.getRedisStatus = () => {
  return isOffline() ? 'offline' : 'online';
};

// 2. Define Queues
const sttQueue = connection ? new Queue('SpeechToText', { connection }) : null;
const bedrockQueue = connection ? new Queue('BedrockProcessing', { connection }) : null;
const pollyQueue = connection ? new Queue('PollyGeneration', { connection }) : null;
const analyticsQueue = connection ? new Queue('VoiceAnalytics', { connection }) : null;
const avatarQueue = connection ? new Queue('FutureAvatar', { connection }) : null;

const getQueueObject = (queueName) => {
  if (queueName === 'SpeechToText') return sttQueue;
  if (queueName === 'BedrockProcessing') return bedrockQueue;
  if (queueName === 'PollyGeneration') return pollyQueue;
  if (queueName === 'VoiceAnalytics') return analyticsQueue;
  if (queueName === 'FutureAvatar') return avatarQueue;
  return null;
};

// Metrics recording helper
const recordJobMetrics = async (queueName, processingTime, isFailed, isRetry = false, errMessage = '') => {
  try {
    let metrics = await QueueMetrics.findOne({ queue: queueName });
    if (!metrics) {
      metrics = new QueueMetrics({ queue: queueName });
    }
    
    metrics.jobsProcessed += 1;
    if (isFailed) {
      metrics.failedJobs += 1;
      metrics.lastFailureReason = errMessage || 'Execution error';
      metrics.lastFailureAt = new Date();
    } else {
      metrics.lastSuccessfulExecution = new Date();
    }
    
    if (isRetry) {
      metrics.retryCounts += 1;
    }
    
    if (processingTime > 0) {
      const totalTime = (metrics.averageProcessingTime * (metrics.jobsProcessed - 1)) + processingTime;
      metrics.averageProcessingTime = Math.round(totalTime / metrics.jobsProcessed);
    }
    
    const successRate = metrics.jobsProcessed > 0 
      ? parseFloat(((metrics.jobsProcessed - metrics.failedJobs) / metrics.jobsProcessed * 100).toFixed(1))
      : 100;
    metrics.successRate = successRate;
    
    let health = successRate - (metrics.averageProcessingTime / 200) - (metrics.retryCounts * 0.2);
    metrics.queueHealthScore = Math.max(0, Math.min(100, Math.round(health)));
    
    if (!isOffline()) {
      const queueObj = getQueueObject(queueName);
      if (queueObj) {
        const counts = await queueObj.getJobCounts('waiting', 'active', 'delayed');
        metrics.queueLength = counts.waiting + counts.active + counts.delayed;
        const workers = await queueObj.getWorkers();
        metrics.activeWorkers = workers.length || 1;
      }
    } else {
      metrics.queueLength = 0;
      metrics.activeWorkers = 0;
    }
    
    metrics.timestamp = new Date();
    await metrics.save();
  } catch (err) {
    console.error(`[Metrics Recording Error for ${queueName}]:`, err.message);
  }
};

exports.recordJobMetrics = recordJobMetrics;

// 3. Define Workers & Processing Actions

// STT Worker: Runs Whisper transcription
const processSTT = async (data) => {
  const result = await Agent.VoiceIntelligenceEngine.transcribeSpeech({
    audioData: data.audioData,
    mockText: data.text
  });
  return {
    transcript: result.text,
    speechConfidence: result.confidence,
    language: result.language,
    processingTime: result.processingTime,
    model: result.model
  };
};

// Bedrock Worker: Runs advanced intent classification, multi-turn memory fetch, context injection
const processBedrock = async (data) => {
  const startTime = Date.now();

  const home = await Home.findById(data.homeId);
  if (!home) throw new Error('Home not found');

  const members = await FamilyMember.find({ home: data.homeId });
  const routines = await AIRoutine.find({ homeId: data.homeId });
  const predictions = await PredictiveDecision.find({ homeId: data.homeId }).sort({ timestamp: -1 }).limit(10);
  const explanations = await ExplainabilityRecord.find({ homeId: data.homeId }).sort({ decisionTimestamp: -1 }).limit(10);

  // Retrieve ConversationSession context history
  let session = await ConversationSession.findOne({ sessionId: data.sessionId });
  if (!session) {
    try {
      session = new ConversationSession({
        sessionId: data.sessionId,
        homeId: data.homeId,
        user: data.memberName,
        startTime: new Date()
      });
      await session.save();
    } catch (err) {
      if (err.code === 11000 || (err.message && err.message.includes('E11000'))) {
        session = await ConversationSession.findOne({ sessionId: data.sessionId });
      } else {
        throw err;
      }
    }
  }

  // Personalization settings based on family member role
  const speakerProfile = members.find(m => m.name === data.memberName) || { role: 'Guest', preferredLanguage: 'English' };

  // Duplicate protection check
  const lowerTranscript = data.transcript.trim().toLowerCase();
  const userMsgs = session.messages.filter(m => m.role === 'user').slice(-5).map(m => m.content.trim().toLowerCase());
  if (userMsgs.includes(lowerTranscript)) {
    console.log(`[Queue Duplicate Protection] Blocked duplicate user command in queue: "${data.transcript}"`);
    const lastAssistantMsg = session.messages.filter(m => m.role === 'assistant').slice(-1)[0]?.content || "Ji Dost, main ispar pehle hi kaam kar chuka hoon.";
    return {
      intent: 'general_chat',
      response: lastAssistantMsg,
      toggleDevice: null,
      intentConfidence: 100,
      responseConfidence: 100,
      language: data.language,
      processingTime: data.processingTime + (Date.now() - startTime),
      speakerRole: speakerProfile.role,
      preferredLanguage: speakerProfile.preferredLanguage || 'English',
      model: data.model
    };
  }

  const lastRoom = session.lastRoom || '';
  const lastDevice = session.lastDevice || '';
  const lastClarification = session.lastClarification || '';

  // Construct context array from previous messages
  const contextWindowHistory = session.messages.slice(-10).map(m => ({
    role: m.role,
    content: m.content
  }));

  // Advanced Prompt processor with Multi-Turn dialogue awareness
  const result = await Agent.VoiceIntelligenceEngine.processVoiceCommandAdvanced({
    text: data.transcript,
    memberName: data.memberName,
    role: speakerProfile.role,
    contextHistory: contextWindowHistory,
    members,
    routines,
    predictions,
    explanations,
    home,
    lastRoom,
    lastDevice,
    lastClarification
  });

  // Check confidence metrics
  const intentConfidence = result.intentConfidence || 95;
  const responseConfidence = result.responseConfidence || 95;
  const averageConfidence = (data.speechConfidence + intentConfidence) / 2;

  let responseText = result.response;
  let toggleDevice = result.toggleDevice;

  if (intentConfidence >= 60 && intentConfidence <= 80) {
    if (lastClarification) {
      // Max 1 clarification question. Request user to repeat.
      responseText = "Main samajh nahi paya. Kripya apna command poora aur saaf shabdon mein dohraayein.";
      toggleDevice = null;
      result.intent = 'general_chat';
    } else {
      // First clarification is allowed
      result.intent = 'clarification_required';
      toggleDevice = null;
    }
  } else if (intentConfidence < 60) {
    // Low confidence: Ask user to repeat
    responseText = "Main samajh nahi paya. Kripya dohraayein.";
    toggleDevice = null;
    result.intent = 'general_chat';
  }

  // Update session parameters
  if (result.resolvedRoom) session.lastRoom = result.resolvedRoom;
  else if (toggleDevice?.roomName) session.lastRoom = toggleDevice.roomName;

  if (result.resolvedDevice) session.lastDevice = result.resolvedDevice;
  else if (toggleDevice?.deviceName) session.lastDevice = toggleDevice.deviceName;

  if (result.intent === 'clarification_required') {
    session.lastClarification = responseText;
  } else {
    session.lastClarification = '';
  }

  // Save dialogues in memory session
  session.messages.push({ role: 'user', content: data.transcript });
  session.messages.push({ role: 'assistant', content: responseText });
  
  // Increment total messages count
  session.totalMessages = (session.totalMessages || 0) + 2;

  // Speaker Metadata Personalization values mapping
  session.speakerDetected = data.memberName || 'Owner';
  session.speakerConfidence = 92; // speaker recognition confidence
  session.languageDetected = data.language || 'English';
  session.memberRole = speakerProfile.role;
  session.preferredLanguage = speakerProfile.preferredLanguage || 'English';
  session.whisperModel = data.model || 'tiny';

  // Calculate session duration and response time
  const now = new Date();
  const sessionStart = session.startTime || now;
  const diffMinutes = Math.max(1, Math.round((now.getTime() - sessionStart.getTime()) / 60000));
  session.sessionDuration = `${diffMinutes} minutes`;
  
  const totalResponses = session.messages.filter(m => m.role === 'assistant').length;
  const currentAvgResponseTime = session.averageResponseTime || 0;
  const newLatency = Date.now() - startTime;
  session.averageResponseTime = Math.round(((currentAvgResponseTime * (totalResponses - 1)) + newLatency) / totalResponses);

  // Update intent distribution map
  const intentDist = session.intentDistribution || new Map();
  const currentIntentCount = intentDist.get(result.intent) || 0;
  intentDist.set(result.intent, currentIntentCount + 1);
  session.intentDistribution = intentDist;

  // Find most used intent
  let maxCount = 0;
  let mostUsed = result.intent;
  for (const [key, val] of intentDist.entries()) {
    if (val > maxCount) {
      maxCount = val;
      mostUsed = key;
    }
  }
  session.mostUsedIntent = mostUsed;

  // Calculate average confidence
  const currentAvgConf = session.averageConfidence || 100;
  const turns = session.messages.length / 2;
  session.averageConfidence = Math.round(((currentAvgConf * (turns - 1)) + averageConfidence) / turns);

  // Conversation Summarization Engine: trigger summary every 20 messages
  if (session.messages.length >= 20) {
    try {
      const summaryText = await Agent.MemoryEngine.summarizeConversation(session.conversationSummary || session.sessionId, session.messages);
      session.conversationSummary = summaryText;
      session.summaryUpdatedAt = new Date();
      // Prune old dialogue messages to keep only the 4 most recent messages
      session.messages = session.messages.slice(-4);
      console.log(`💬 [Dialogue Caching] Trimmed context window. New summary: "${summaryText}"`);
    } catch (sumErr) {
      console.error('⚠️ [Dialogue Caching] Conversational summarization failed:', sumErr.message);
    }
  }

  await session.save();

  const elapsed = Date.now() - startTime;

  return {
    intent: result.intent,
    response: responseText,
    toggleDevice,
    toggleDevices: result.toggleDevices,
    intentConfidence,
    responseConfidence,
    language: data.language,
    processingTime: data.processingTime + elapsed, // Add time
    speakerRole: speakerProfile.role,
    preferredLanguage: speakerProfile.preferredLanguage || 'English',
    model: data.model
  };
};

// Polly Worker: Runs neural Polly text to speech conversion
const processPolly = async (data) => {
  const startTime = Date.now();
  
  // Map speaker profile roles to custom voices
  let voiceId = 'Aditi'; // Default Hindi/Indian English
  let speedRate = 'medium'; // Standard speed

  if (data.speakerRole === 'Father') {
    voiceId = 'Kajal'; // Hindi Neural Voice
  } else if (data.speakerRole === 'Student') {
    voiceId = 'Joanna'; // English Neural Voice
  } else if (data.speakerRole === 'Grandmother') {
    voiceId = 'Aditi'; // Hindi Neural Voice
    speedRate = 'slow'; // Slower speed rate
  }

  const result = await Agent.VoiceIntelligenceEngine.synthesizeSpeechAdvanced({
    text: data.response,
    voiceId,
    speedRate
  });

  const elapsed = Date.now() - startTime;

  return {
    ...data,
    voiceUsed: voiceId,
    generationTime: elapsed,
    responseDuration: result.duration || Math.round(data.response.split(' ').length * 0.4), // Est duration in seconds
    audioStreamBase64: result.audioStreamBase64,
    fallback: result.fallback
  };
};

// Analytics Worker: Saves VoiceHistory logs, broadcasts Socket.IO events, registers EventHistory
const processAnalytics = async (data, ioInstance) => {
  const startTime = Date.now();
  
  // Actuate device toggles in DB
  let actuated = [];
  const toggleDevices = data.toggleDevices || (data.toggleDevice ? [data.toggleDevice] : []);

  if (Array.isArray(toggleDevices) && toggleDevices.length > 0) {
    const home = await Home.findById(data.homeId);
    if (home) {
      for (const toggleItem of toggleDevices) {
        if (toggleItem && typeof toggleItem.roomName === 'string' && typeof toggleItem.deviceName === 'string') {
          const { roomName, deviceName, state } = toggleItem;
          const room = home.rooms.find(r => r.name && r.name.toLowerCase() === roomName.toLowerCase());
          if (room) {
            const matchingDevices = room.devices.filter(d => 
              d.name.toLowerCase() === deviceName.toLowerCase() || 
              d.type.toLowerCase() === deviceName.toLowerCase() ||
              (deviceName.toLowerCase() === 'all' || deviceName.toLowerCase() === 'everything') ||
              (deviceName.toLowerCase() === 'lights' && d.type.toLowerCase() === 'light') ||
              (deviceName.toLowerCase() === 'fans' && d.type.toLowerCase() === 'fan')
            );

            for (const device of matchingDevices) {
              if (device.isOn !== state) {
                device.isOn = state;
                actuated.push({ roomId: room._id, deviceId: device._id, deviceName: device.name, roomName: room.name, state });

                // Write EventHistory log
                const EventHistory = require('../models/EventHistory');
                await EventHistory.create({
                  homeId: home._id,
                  roomId: room._id,
                  roomName: room.name,
                  userName: data.memberName,
                  deviceId: device._id,
                  deviceName: device.name,
                  deviceType: device.type,
                  action: state ? 'ON' : 'OFF',
                  source: 'AI',
                  timestamp: new Date()
                });
              }
            }
          }
        }
      }

      if (actuated.length > 0) {
        await home.save();

        // Broadcast state changes via Socket.IO
        if (ioInstance) {
          for (const item of actuated) {
            ioInstance.to(home._id.toString()).emit('deviceUpdate', {
              roomId: item.roomId,
              deviceId: item.deviceId,
              state: item.state
            });
          }

          const deviceNamesStr = actuated.map(item => item.deviceName).join(', ');
          const stateString = actuated[0].state ? 'ON' : 'OFF';
          ioInstance.to(home._id.toString()).emit('notification', {
            _id: Date.now().toString(),
            id: Date.now(),
            actorName: data.memberName || 'Voice Assistant',
            stateStr: stateString,
            deviceName: deviceNamesStr,
            message: `🔔 Voice Command: ${data.memberName} turned ${stateString} the [${deviceNamesStr}]`
          });
        }
      }
    }
  }

  // Create VoiceHistory log record with full speaker personalization metadata
  const voiceLog = await VoiceHistory.create({
    homeId: data.homeId,
    sessionId: data.sessionId || 'default_session',
    user: data.memberName,
    transcript: data.transcript,
    intent: data.intent,
    response: data.response,
    speechConfidence: data.speechConfidence,
    intentConfidence: data.intentConfidence,
    responseConfidence: data.responseConfidence,
    language: data.language,
    processingTime: data.processingTime + (Date.now() - startTime),
    voiceUsed: data.voiceUsed,
    responseDuration: data.responseDuration,
    generationTime: data.generationTime,
    
    // Avatar Readiness Upgrade fields
    whisperModel: data.model || 'tiny',
    speakerDetected: data.memberName || 'Owner',
    speakerConfidence: 92,
    languageDetected: data.language || 'English',
    memberRole: data.speakerRole || 'Owner',
    preferredLanguage: data.preferredLanguage || 'English'
  });

  return {
    intent: data.intent,
    response: data.response,
    speechConfidence: data.speechConfidence,
    intentConfidence: data.intentConfidence,
    responseConfidence: data.responseConfidence,
    voiceLog,
    actuated,
    audioStreamBase64: data.audioStreamBase64,
    fallback: data.fallback
  };
};

// 4. Initialize BullMQ Workers (only if Redis is available)
if (connection) {
  new Worker('SpeechToText', async (job) => {
    const start = Date.now();
    try {
      const result = await processSTT(job.data);
      await recordJobMetrics('SpeechToText', Date.now() - start, false);
      await bedrockQueue.add('BedrockProcessingJob', {
        ...job.data,
        ...result
      });
    } catch (err) {
      await recordJobMetrics('SpeechToText', Date.now() - start, true, false, err.message);
      console.error('[STT Worker Error]:', err.message);
      jobEvents.emit(`failed:${job.data.correlationId}`, err);
    }
  }, { connection });

  new Worker('BedrockProcessing', async (job) => {
    const start = Date.now();
    try {
      const result = await processBedrock(job.data);
      await recordJobMetrics('BedrockProcessing', Date.now() - start, false);
      await pollyQueue.add('PollyGenerationJob', {
        ...job.data,
        ...result
      });
    } catch (err) {
      await recordJobMetrics('BedrockProcessing', Date.now() - start, true, false, err.message);
      console.error('[Bedrock Worker Error]:', err.message);
      jobEvents.emit(`failed:${job.data.correlationId}`, err);
    }
  }, { connection });

  new Worker('PollyGeneration', async (job) => {
    const start = Date.now();
    try {
      const result = await processPolly(job.data);
      await recordJobMetrics('PollyGeneration', Date.now() - start, false);
      await analyticsQueue.add('VoiceAnalyticsJob', {
        ...job.data,
        ...result
      });
    } catch (err) {
      await recordJobMetrics('PollyGeneration', Date.now() - start, true, false, err.message);
      console.error('[Polly Worker Error]:', err.message);
      jobEvents.emit(`failed:${job.data.correlationId}`, err);
    }
  }, { connection });

  new Worker('VoiceAnalytics', async (job) => {
    const start = Date.now();
    try {
      const ioInstance = global.ioInstance;
      const result = await processAnalytics(job.data, ioInstance);
      await recordJobMetrics('VoiceAnalytics', Date.now() - start, false);
      jobEvents.emit(`finished:${job.data.correlationId}`, result);
    } catch (err) {
      await recordJobMetrics('VoiceAnalytics', Date.now() - start, true, false, err.message);
      console.error('[Analytics Worker Error]:', err.message);
      jobEvents.emit(`failed:${job.data.correlationId}`, err);
    }
  }, { connection });
}

/**
 * Main entrance pipeline for processing voice queries. Decouples processing into BullMQ,
 * or runs synchronously if Redis is offline.
 */
exports.dispatchVoicePipeline = async (payload, ioInstance) => {
  const correlationId = new mongoose.Types.ObjectId().toString();
  
  // Attach ioInstance to global context for background worker accessibility
  global.ioInstance = ioInstance;

  // Fallback: If Redis is offline, process synchronously
  if (isOffline()) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL: Redis queue is offline. Voice command processing is disabled in production.');
    }
    console.log('🤖 [BullMQ Offline] Processing voice pipeline synchronously.');
    
    const sttStart = Date.now();
    let sttResult;
    try {
      sttResult = await processSTT(payload);
      await recordJobMetrics('SpeechToText', Date.now() - sttStart, false);
    } catch (err) {
      await recordJobMetrics('SpeechToText', Date.now() - sttStart, true, false, err.message);
      throw err;
    }

    const bedrockStart = Date.now();
    let bedrockResult;
    try {
      bedrockResult = await processBedrock({ ...payload, ...sttResult });
      await recordJobMetrics('BedrockProcessing', Date.now() - bedrockStart, false);
    } catch (err) {
      await recordJobMetrics('BedrockProcessing', Date.now() - bedrockStart, true, false, err.message);
      throw err;
    }

    const pollyStart = Date.now();
    let pollyResult;
    try {
      pollyResult = await processPolly({ ...payload, ...sttResult, ...bedrockResult });
      await recordJobMetrics('PollyGeneration', Date.now() - pollyStart, false);
    } catch (err) {
      await recordJobMetrics('PollyGeneration', Date.now() - pollyStart, true, false, err.message);
      throw err;
    }

    const analyticsStart = Date.now();
    let finalResult;
    try {
      finalResult = await processAnalytics({ ...payload, ...sttResult, ...bedrockResult, ...pollyResult }, ioInstance);
      await recordJobMetrics('VoiceAnalytics', Date.now() - analyticsStart, false);
    } catch (err) {
      await recordJobMetrics('VoiceAnalytics', Date.now() - analyticsStart, true, false, err.message);
      throw err;
    }

    return finalResult;
  }

  // Decoupled asynchronous pathway: Queue the request
  const resultPromise = new Promise((resolve, reject) => {
    const onFinished = (result) => {
      jobEvents.off(`failed:${correlationId}`, onFailed);
      resolve(result);
    };
    
    const onFailed = (err) => {
      jobEvents.off(`finished:${correlationId}`, onFinished);
      reject(err);
    };

    jobEvents.once(`finished:${correlationId}`, onFinished);
    jobEvents.once(`failed:${correlationId}`, onFailed);
  });

  // Timeout failsafe
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Voice processing task chain timed out after 30s')), 30000)
  );

  // Put initial job in the first queue (STT Queue)
  await sttQueue.add('stt-start-job', {
    ...payload,
    correlationId
  });

  return Promise.race([resultPromise, timeoutPromise]);
};
