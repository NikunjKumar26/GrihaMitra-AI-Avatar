/**
 * GrihaMitraAgent Central Orchestrator Facade
 * 
 * Central orchestration engine that integrates all 11 cognitive engines of the GrihaMitra Agent Layer.
 * Exposes individual engines as properties for backward compatibility with existing controllers,
 * while implementing unified pipelined workflows (like executeVoiceCommandPipeline) to route actions.
 */

const ContextEngine = require('./ContextEngine');
const MemoryEngine = require('./MemoryEngine');
const RoutineLearningEngine = require('./RoutineLearningEngine');
const PredictiveAutomationEngine = require('./PredictiveAutomationEngine');
const ExplainabilityEngine = require('./ExplainabilityEngine');
const VoiceIntelligenceEngine = require('./VoiceIntelligenceEngine');
const AvatarIntelligenceEngine = require('./AvatarIntelligenceEngine');
const ProactiveDecisionEngine = require('./ProactiveDecisionEngine');
const PlanningEngine = require('./PlanningEngine');
const VisionIntelligenceEngine = require('./VisionIntelligenceEngine');
const KnowledgeEngine = require('./KnowledgeEngine');

const FamilyMember = require('../models/FamilyMember');
const EventHistory = require('../models/EventHistory');
const PredictiveDecision = require('../models/PredictiveDecision');
const ExplainabilityRecord = require('../models/ExplainabilityRecord');
const VoiceHistory = require('../models/VoiceHistory');
const ConversationSession = require('../models/ConversationSession');
const AvatarMemory = require('../models/AvatarMemory');
const Home = require('../models/Home');

const bedrockService = require('../services/bedrockService');

const GrihaMitraAgent = {
  // Expose cognitive engines for modular access
  ContextEngine,
  MemoryEngine,
  RoutineLearningEngine,
  PredictiveAutomationEngine,
  ExplainabilityEngine,
  VoiceIntelligenceEngine,
  AvatarIntelligenceEngine,
  ProactiveDecisionEngine,
  PlanningEngine,
  VisionIntelligenceEngine,
  KnowledgeEngine,

  /**
   * Unified workflow piping Voice -> Context -> Memory -> Planning -> Action -> Explainability -> Avatar.
   * Resolves text or speech queries, triggers IoT device actions, provides visual/emotional cues, and synthesizes speech.
   */
  async executeVoiceCommandPipeline({
    text = '',
    audioData = null,
    sessionId = null,
    memberName = 'Owner',
    home,
    io = null,
    socketId = null
  }) {
    console.log(`🧠 [GrihaMitra Agent Orchestrator] Starting pipeline execution for member: ${memberName}`);
    
    if (!home) {
      throw new Error('Valid Home configuration object is required for the pipeline.');
    }

    const activeMemberName = memberName || 'Owner';
    const activeSessionId = sessionId || ProactiveDecisionEngine.getActiveSession(home._id) || 'default_session';

    // 1. Load or initialize Conversation Session
    let session = await ConversationSession.findOne({ sessionId: activeSessionId });
    if (!session) {
      try {
        session = new ConversationSession({
          sessionId: activeSessionId,
          homeId: home._id,
          user: activeMemberName,
          startTime: new Date()
        });
        await session.save();
      } catch (err) {
        if (err.code === 11000 || (err.message && err.message.includes('E11000'))) {
          session = await ConversationSession.findOne({ sessionId: activeSessionId });
        } else {
          throw err;
        }
      }
    }

    // 2. Transcription (Voice -> Text)
    let transcriptText = text || '';
    let whisperModelUsed = 'none';
    let whisperConfidence = 100;

    if (audioData) {
      const transcribeResult = await VoiceIntelligenceEngine.transcribeSpeech({ audioData });
      transcriptText = transcribeResult.text;
      whisperModelUsed = transcribeResult.model;
      whisperConfidence = transcribeResult.confidence;
    }

    if (!transcriptText.trim()) {
      throw new Error('Dialogue text input or audio transcription is empty.');
    }

    // 3. Duplicate Protection
    const lowerTranscript = transcriptText.trim().toLowerCase();
    const userMsgs = session.messages.filter(m => m.role === 'user').slice(-5).map(m => m.content.trim().toLowerCase());
    if (userMsgs.includes(lowerTranscript)) {
      console.log(`[Duplicate Protection] Blocked duplicate user command: "${transcriptText}"`);
      const lastAssistantMsg = session.messages.filter(m => m.role === 'assistant').slice(-1)[0]?.content || "Ji Dost, main ispar pehle hi kaam kar chuka hoon.";
      return {
        text: lastAssistantMsg,
        speechConfidence: 100,
        language: 'Mixed',
        emotionState: 'Normal',
        avatarState: 'Idle',
        voice: 'Aditi',
        speedRate: 'medium',
        audioFallback: false,
        audioStream: false,
        audioStreamBase64: null,
        heygenStatus: 'no_active_stream',
        actionPlan: null,
        actuated: null
      };
    }

    // 4. Resolve Family Member Context
    const members = await FamilyMember.find({ home: home._id });
    const activeMember = members.find(m => m.name.toLowerCase() === activeMemberName.toLowerCase());
    const memberRole = activeMember ? activeMember.role : 'Owner';

    // Build default personality configuration
    const personality = {
      role: memberRole,
      tone: 'Friendly, helpful, and professional',
      languageGuidelines: 'Respond in clear English.',
      style: 'Default',
      voice: 'Aditi',
      speedRate: 'medium'
    };

    // Personalize settings based on role
    if (activeMember) {
      if (activeMember.role === 'Grandmother') {
        personality.tone = 'Warm, highly respectful, maternal and caring';
        personality.languageGuidelines = 'Respond in warm Hindi or Hinglish (Hindi written in English text characters) to be easy for Grandmother to understand.';
        personality.style = 'Grandmother Mode';
        personality.voice = 'Aditi';
        personality.speedRate = 'slow';
      } else if (activeMember.role === 'Student') {
        personality.tone = 'Energetic, supportive, study assistant vibe';
        personality.languageGuidelines = 'Respond in enthusiastic English, offering help with scheduling, focus, and lighting.';
        personality.style = 'Student Mode';
        personality.voice = 'Joanna';
        personality.speedRate = 'medium';
      } else if (activeMember.role === 'Father' || activeMember.role === 'Mother') {
        personality.tone = 'Structured, formal, direct, safety and management focused';
        personality.languageGuidelines = 'Respond in formal English detailing smart home stats, devices, and schedules.';
        personality.style = 'Parent Mode';
        personality.voice = 'K Kajal'; // Kajal or Joanna
        personality.speedRate = 'medium';
      }
    }

    // 5. Memory Recall & Context Enrichment
    let recalledContext = '';
    try {
      recalledContext = await MemoryEngine.summarizePastInteractions(home._id, activeMemberName, transcriptText);
    } catch (memErr) {
      console.warn('⚠️ [Memory Engine] Recall failed:', memErr.message);
    }

    // Get active databases context
    const predictions = await PredictiveDecision.find({ homeId: home._id }).sort({ timestamp: -1 }).limit(5);
    const explainability = await ExplainabilityRecord.find({ homeId: home._id }).sort({ decisionTimestamp: -1 }).limit(5);
    const voiceHistory = await VoiceHistory.find({ homeId: home._id }).sort({ timestamp: -1 }).limit(5);

    const activeRooms = home.rooms.map(r => ({
      name: r.name,
      devices: r.devices.map(d => ({ name: d.name, isOn: d.isOn, type: d.type })),
      sensors: r.sensors ? r.sensors.map(s => ({ type: s.sensorType, value: s.value })) : []
    }));

    const homeContext = {
      homeName: home.houseName,
      roomsState: activeRooms,
      recentPredictions: predictions.map(p => ({ action: p.predictedAction, conf: p.confidenceScore, room: p.roomName, device: p.deviceName })),
      recentExplanations: explainability.map(e => ({ action: e.prediction, evidence: e.evidence, conf: e.confidence })),
      recentVoiceCommands: voiceHistory.map(v => v.transcript)
    };

    // 6. Knowledge Engine Query (Fallback to structured home/manual knowledge)
    let knowledgeAnswer = null;
    try {
      const knowledgeResult = await KnowledgeEngine.queryKnowledgeBase(transcriptText);
      if (knowledgeResult && knowledgeResult.confidence >= 0.8) {
        console.log(`📚 [Knowledge Engine] Matched query with confidence: ${knowledgeResult.confidence}`);
        knowledgeAnswer = knowledgeResult.answer;
      }
    } catch (keErr) {
      console.warn('⚠️ [Knowledge Engine] Retrieval failed:', keErr.message);
    }

    // 7. Planning Engine (Multi-Step Workflows generation)
    let actionPlan = null;
    try {
      actionPlan = await PlanningEngine.generateActionPlan(transcriptText, homeContext);
      console.log(`🧠 [Planning Engine] Generated action plan risk: ${actionPlan.riskLevel}`);
    } catch (peErr) {
      console.warn('⚠️ [Planning Engine] Plan generation failed:', peErr.message);
    }

    // 8. Direct command execution reasoning (Bedrock Converse logic)
    let replyText = '';
    let voiceResult = null;

    const lastRoom = session.lastRoom || '';
    const lastDevice = session.lastDevice || '';
    const lastClarification = session.lastClarification || '';

    if (knowledgeAnswer) {
      replyText = knowledgeAnswer;
    } else {
      try {
        // Query Voice Intelligence for intent parsing & device toggles mapping
        voiceResult = await VoiceIntelligenceEngine.processVoiceCommandAdvanced({
          text: transcriptText,
          memberName: activeMemberName,
          role: personality.role,
          contextHistory: recalledContext ? [{ role: 'assistant', content: recalledContext }] : [],
          members,
          routines: [],
          predictions,
          explanations: explainability,
          home,
          lastRoom,
          lastDevice,
          lastClarification
        });

        // Enforce confidence & clarification rules
        const intentConfidence = voiceResult.intentConfidence || 90;
        let finalResponse = voiceResult.response;
        
        if (intentConfidence >= 60 && intentConfidence <= 80) {
          if (lastClarification) {
            // Already asked a clarification! Max 1 clarification question. Request user to repeat.
            finalResponse = "Main samajh nahi paya. Kripya apna command poora aur saaf shabdon mein dohraayein.";
            voiceResult.toggleDevice = null;
            voiceResult.intent = 'general_chat';
          } else {
            // First clarification is allowed
            voiceResult.intent = 'clarification_required';
            voiceResult.toggleDevice = null;
          }
        } else if (intentConfidence < 60) {
          // Low confidence: Ask user to repeat
          finalResponse = "Main samajh nahi paya. Kripya dohraayein.";
          voiceResult.toggleDevice = null;
          voiceResult.intent = 'general_chat';
        }

        replyText = finalResponse;
      } catch (voiceErr) {
        console.error('⚠️ [Voice Intelligence] Bedrock command execution failed:', voiceErr.message);
        // Direct Bedrock prompt call as fallback
        const prompt = `You are GrihaMitra, the interactive smart home companion.
PERSONALITY: Role: ${personality.role}, Tone: ${personality.tone}, Language Guidelines: ${personality.languageGuidelines}
CONTEXT: ${JSON.stringify(homeContext)}
RECALLED MEMORY: "${recalledContext}"
USER COMMAND: "${transcriptText}"

Generate a helpful, friendly, natural reply in maximum 2 sentences. No markdown formatting.`;
        replyText = await bedrockService.invokeModel(prompt, 300, 0.6);
      }
    }

    if (!replyText) {
      replyText = "I processed your request, but I encountered an error formulating a detailed response.";
    }

    // 7. Direct/Automated Actions Execution & Socket Notifications
    let actuated = [];
    const toggleDevices = voiceResult?.toggleDevices || (voiceResult?.toggleDevice ? [voiceResult.toggleDevice] : []);

    if (Array.isArray(toggleDevices) && toggleDevices.length > 0) {
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
                await EventHistory.create({
                  homeId: home._id,
                  roomId: room._id,
                  roomName: room.name,
                  userName: activeMemberName,
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
        if (io) {
          for (const item of actuated) {
            io.to(home._id.toString()).emit('deviceUpdate', {
              roomId: item.roomId,
              deviceId: item.deviceId,
              state: item.state
            });
          }

          const deviceNamesStr = actuated.map(item => item.deviceName).join(', ');
          const stateString = actuated[0].state ? 'ON' : 'OFF';
          io.to(home._id.toString()).emit('notification', {
            _id: Date.now().toString(),
            id: Date.now(),
            actorName: activeMemberName,
            stateStr: stateString,
            deviceName: deviceNamesStr,
            message: `🔔 Command Pipeline: ${activeMemberName} turned ${stateString} the [${deviceNamesStr}]`
          });
        }

        // Explainability linkage (generate explainability logs automatically)
        try {
          const firstItem = actuated[0];
          const explanation = await ExplainabilityEngine.generateActionExplanation(
            activeMemberName,
            firstItem.roomName,
            actuated.map(item => item.deviceName).join(', '),
            firstItem.state ? 'ON' : 'OFF',
            95,
            `Direct user command pipeline request matching "${transcriptText}".`
          );

          await ExplainabilityRecord.create({
            homeId: home._id,
            userName: activeMemberName,
            roomName: firstItem.roomName,
            deviceName: actuated.map(item => item.deviceName).join(', '),
            prediction: firstItem.state ? 'ON' : 'OFF',
            evidence: `Direct user request pipeline executed.`,
            explanation,
            confidence: 95,
            decisionTimestamp: new Date()
          });
        } catch (expErr) {
          console.warn('⚠️ [Explainability Engine] Failed to record explanation:', expErr.message);
        }
      }
    }

    // 8. Emotion & State Classification
    const { emotionState, avatarState } = AvatarIntelligenceEngine.determineEmotion({
      text: replyText,
      query: transcriptText,
      role: personality.style
    });

    // 9. Send Avatar Streaming Command (HeyGen)
    let heygenStatus = 'no_active_stream';
    if (activeSessionId) {
      try {
        const hgSpeak = await AvatarIntelligenceEngine.speakWithAvatar(activeSessionId, replyText);
        heygenStatus = hgSpeak.success ? 'triggered' : 'failed';
      } catch (hgErr) {
        console.warn('⚠️ [Avatar Engine] HeyGen speak task failed:', hgErr.message);
        heygenStatus = 'failed';
      }
    }

    // 10. Voice Speech Synthesis Fallback (Polly)
    let pollyResult = { fallback: true, text: replyText };
    try {
      pollyResult = await VoiceIntelligenceEngine.synthesizeSpeechAdvanced({
        text: replyText,
        voiceId: personality.voice,
        speedRate: personality.speedRate
      });
    } catch (audErr) {
      console.error('⚠️ [Voice Engine] Polly synthesis failed:', audErr.message);
    }

    // 11. Memory Engine Storage
    try {
      await MemoryEngine.storeMemory(
        home._id,
        activeMemberName,
        transcriptText,
        replyText,
        { whisperModelUsed, whisperConfidence, heygenStatus, actionPlan },
        emotionState,
        avatarState
      );
    } catch (memStoreErr) {
      console.error('⚠️ [Memory Engine] Memory storage failed:', memStoreErr.message);
    }

    // 12. Broadcast Dialogue Events via Socket.IO
    if (io) {
      io.to(home._id.toString()).emit('avatarSpeak', {
        text: replyText,
        user: activeMemberName,
        emotionState,
        avatarState,
        speedRate: personality.speedRate,
        heygenStatus,
        socketId
      });
    }

    // 13. Save dialogue and resolved context parameters to database session
    try {
      session.messages.push({ role: 'user', content: transcriptText });
      session.messages.push({ role: 'assistant', content: replyText });
      session.totalMessages = (session.totalMessages || 0) + 2;

      if (voiceResult) {
        if (voiceResult.resolvedRoom) session.lastRoom = voiceResult.resolvedRoom;
        else if (voiceResult.toggleDevice?.roomName) session.lastRoom = voiceResult.toggleDevice.roomName;

        if (voiceResult.resolvedDevice) session.lastDevice = voiceResult.resolvedDevice;
        else if (voiceResult.toggleDevice?.deviceName) session.lastDevice = voiceResult.toggleDevice.deviceName;

        if (voiceResult.intent === 'clarification_required') {
          session.lastClarification = replyText;
        } else {
          session.lastClarification = '';
        }
      }
      await session.save();
    } catch (saveErr) {
      console.warn('⚠️ [Session Save Failed]:', saveErr.message);
    }

    return {
      text: replyText,
      speechConfidence: whisperConfidence,
      language: personality.style === 'Grandmother Mode' ? 'Hindi' : 'English',
      emotionState,
      avatarState,
      voice: personality.voice,
      speedRate: personality.speedRate,
      audioFallback: pollyResult.fallback,
      audioStream: pollyResult.audioStreamBase64 ? true : false,
      audioStreamBase64: pollyResult.audioStreamBase64 || null,
      heygenStatus,
      actionPlan,
      actuated
    };
  }
};

module.exports = GrihaMitraAgent;
