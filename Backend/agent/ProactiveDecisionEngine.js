const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const AvatarIntelligenceEngine = require('./AvatarIntelligenceEngine');
const MemoryEngine = require('./MemoryEngine');

const redisConfig = {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null
};

let proactiveQueue = null;
let proactiveWorker = null;
let ioInstance = null;
let isRedisOffline = false;

// Simple memory cache mapping homeId -> activeSessionId
const activeSessions = new Map();

exports.registerActiveSession = (homeId, sessionId) => {
  activeSessions.set(homeId.toString(), sessionId);
};

exports.getActiveSession = (homeId) => {
  return activeSessions.get(homeId.toString());
};

exports.removeActiveSession = (homeId) => {
  activeSessions.delete(homeId.toString());
};

/**
 * Initialize Proactive Speaking Scheduler
 */
exports.initializeScheduler = (io) => {
  ioInstance = io;
  
  try {
    const connection = new Redis(redisConfig);
    
    connection.on('error', (err) => {
      if (!isRedisOffline) {
        console.warn('⚠️ [Proactive Decision Engine] Redis offline. Falling back to synchronous schedule execution:', err.message);
        isRedisOffline = true;
      }
    });

    connection.on('connect', () => {
      console.log('✔ [Proactive Decision Engine] Connected to Redis. Proactive scheduler worker active.');
      isRedisOffline = false;
    });

    proactiveQueue = new Queue('ProactiveSpeech', { connection });
    proactiveQueue.on('error', (err) => {
      if (!isRedisOffline) {
        console.warn('⚠️ [Proactive Decision Engine Queue] Redis connection error:', err.message);
        isRedisOffline = true;
      }
    });

    proactiveWorker = new Worker('ProactiveSpeech', async (job) => {
      await processProactiveSpeechJob(job.data);
    }, { connection, concurrency: 1 });

    proactiveWorker.on('error', (err) => {
      if (!isRedisOffline) {
        console.warn('⚠️ [Proactive Decision Engine Worker] Redis connection error:', err.message);
        isRedisOffline = true;
      }
    });

    proactiveWorker.on('failed', (job, err) => {
      console.error(`❌ [Proactive Decision Engine] Job ${job?.id} failed:`, err.message);
    });

  } catch (err) {
    console.warn('⚠️ [Proactive Decision Engine] Failed to connect Redis. Running in synchronous fallback mode:', err.message);
    isRedisOffline = true;
  }
};

/**
 * Throttling thresholds based on alert priorities
 */
const THROTTLE_WINDOWS = {
  security: 30 * 1000,          // 30 seconds for security alerts
  water_tank: 3 * 60 * 1000,     // 3 minutes for water tank alerts
  power_failure: 3 * 60 * 1000,  // 3 minutes for power failure warnings
  routine: 10 * 60 * 1000,       // 10 minutes for routine/predictive reminders
  prediction: 10 * 60 * 1000
};

/**
 * Evaluate throttling & trigger proactive speech task
 */
async function processProactiveSpeechJob(data) {
  const { homeId, alertType, details } = data;
  const AvatarMemory = require('../models/AvatarMemory');
  
  try {
    const window = THROTTLE_WINDOWS[alertType] || 5 * 60 * 1000;
    const cutoffTime = new Date(Date.now() - window);
    
    const duplicate = await AvatarMemory.findOne({
      homeId,
      user: 'System Alert',
      question: `Proactive Alert: ${alertType}`,
      timestamp: { $gte: cutoffTime }
    });

    if (duplicate) {
      console.log(`[Proactive Throttled] Skipped announcement "${details}" to avoid flooding (Window: ${window / 1000}s).`);
      return;
    }

    const { emotionState, avatarState } = AvatarIntelligenceEngine.determineEmotion({ alertType, text: details });

    const activeSessionId = activeSessions.get(homeId.toString());
    let heygenStatus = 'no_active_stream';
    if (activeSessionId) {
      const hgRes = await AvatarIntelligenceEngine.speakWithAvatar(activeSessionId, details);
      heygenStatus = hgRes.success ? 'triggered' : 'failed';
    }

    if (ioInstance) {
      ioInstance.to(homeId.toString()).emit('avatarAlert', {
        text: details,
        alertType,
        emotionState,
        avatarState,
        heygenStatus
      });
    }

    await MemoryEngine.storeMemory(
      homeId,
      'System Alert',
      `Proactive Alert: ${alertType}`,
      details,
      { alertType, heygenStatus },
      emotionState,
      avatarState
    );

    console.log(`📢 [Proactive Announcement]: "${details}" (HeyGen status: ${heygenStatus})`);
  } catch (err) {
    console.error('[Proactive Decision Engine Error]:', err.message);
  }
}

/**
 * Schedule a proactive announcement
 */
exports.scheduleProactiveSpeaking = async (homeId, alertType, details, priority = 3) => {
  const jobData = {
    homeId: homeId.toString(),
    alertType,
    details
  };

  const isOffline = isRedisOffline || !proactiveQueue;

  if (isOffline) {
    setTimeout(async () => {
      await processProactiveSpeechJob(jobData);
    }, 50);
  } else {
    try {
      await proactiveQueue.add('ProactiveSpeechJob', jobData, {
        attempts: 3,
        backoff: 5000, 
        priority: priority
      });
    } catch (err) {
      console.warn('⚠️ [Proactive Decision Engine] Failed to add BullMQ job, running synchronous:', err.message);
      await processProactiveSpeechJob(jobData);
    }
  }
};
