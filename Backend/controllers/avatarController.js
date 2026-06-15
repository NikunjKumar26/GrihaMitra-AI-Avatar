const Home = require('../models/Home');
const FamilyMember = require('../models/FamilyMember');
const PredictiveDecision = require('../models/PredictiveDecision');
const ExplainabilityRecord = require('../models/ExplainabilityRecord');
const VoiceHistory = require('../models/VoiceHistory');
const ConversationSession = require('../models/ConversationSession');
const AvatarMemory = require('../models/AvatarMemory');
const AvatarAnalytics = require('../models/AvatarAnalytics');
const Agent = require('../agent');
const mongoose = require('mongoose');
const AIUsageMetrics = require('../models/AIUsageMetrics');

const getRequesterHome = async (userId) => {
  return await Home.findOne({ owner: userId }) || await Home.findOne({ 'members.user': userId });
};

/**
 * Helper to update long-term telemetry inside AvatarAnalytics
 */
async function updateAnalytics(homeId, user, emotion, personality, language, textContent) {
  try {
    let analytics = await AvatarAnalytics.findOne({ homeId });
    if (!analytics) {
      analytics = new AvatarAnalytics({ homeId });
    }

    analytics.totalConversations += 1;
    analytics.lastUpdated = new Date();

    // 1. Update conversations per user
    const userIndex = analytics.conversationsPerUser.findIndex(u => u.user.toLowerCase() === user.toLowerCase());
    if (userIndex !== -1) {
      analytics.conversationsPerUser[userIndex].count += 1;
    } else {
      analytics.conversationsPerUser.push({ user, count: 1 });
    }

    // 2. Resolve most active user
    let maxCount = 0;
    let activeUser = 'None';
    analytics.conversationsPerUser.forEach(u => {
      if (u.count > maxCount) {
        maxCount = u.count;
        activeUser = u.user;
      }
    });
    analytics.mostActiveUser = activeUser;

    // 3. Track personality & emotion frequencies
    analytics.mostUsedPersonality = personality;
    analytics.mostTriggeredEmotion = emotion;

    // 4. Calculate speaking duration based on text length (avg 130 words per minute / 2.1 words per second)
    const wordCount = textContent.split(/\s+/).length;
    const estimatedSpeakingTime = Math.ceil(wordCount / 2.1);
    analytics.avatarSpeakingTime += estimatedSpeakingTime;

    // 5. Track average conversation turns (approximated)
    const totalMemories = await AvatarMemory.countDocuments({ homeId });
    analytics.averageConversationLength = Math.max(1, Math.round(totalMemories / 2));

    // 6. Track language distribution
    if (language === 'Hindi') {
      analytics.languageDistribution.Hindi += 1;
    } else if (language === 'Mixed') {
      analytics.languageDistribution.Mixed += 1;
    } else {
      analytics.languageDistribution.English += 1;
    }

    await analytics.save();
  } catch (err) {
    console.error('[Avatar Controller] Failed to update analytics:', err.message);
  }
}

// ----------------------------------------------------
// NEW Endpoints for Real HeyGen WebRTC Stream Management
// ----------------------------------------------------

/**
 * POST /api/avatar/create-session
 */
exports.createSession = async (req, res) => {
  try {
    const home = await getRequesterHome(req.user.id);
    if (!home) return res.status(404).json({ error: 'No Smart Home registered.' });

    const { quality = 'medium', avatarName = 'Bryan_FitnessCoach_public', memberName = 'Owner' } = req.body;

    // Resolve voice details from member role
    const members = await FamilyMember.find({ home: home._id });
    const activeMember = members.find(m => m.name.toLowerCase() === memberName.toLowerCase());

    const voiceConfig = {
      voiceId: 'e99d19a27e7d4dbda6221c0e290f2095', // Aditi
      rate: 1.0
    };

    if (activeMember) {
      if (activeMember.role === 'Grandmother') {
        voiceConfig.voiceId = '01a5d611807d4b47926b01a61c34a491'; // Simulated slow Hindi
        voiceConfig.rate = 0.8;
      } else if (activeMember.role === 'Student') {
        voiceConfig.voiceId = '1985984feded457b9d013b4f6551ac94'; // Energized English
        voiceConfig.rate = 1.0;
      } else if (activeMember.role === 'Father' || activeMember.role === 'Mother') {
        voiceConfig.voiceId = '2a106f851cb4454fa57270e5b721869e'; // Formal English
        voiceConfig.rate = 1.0;
      }
    }

    const sessionRes = await Agent.AvatarIntelligenceEngine.createAvatarSession(quality, avatarName, voiceConfig);

    if (sessionRes.success) {
      // Cache session mapping to track notifications
      Agent.ProactiveDecisionEngine.registerActiveSession(home._id, sessionRes.sessionId);
    }

    res.json(sessionRes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/avatar/start
 */
exports.startSession = async (req, res) => {
  try {
    const { sessionId, sdp } = req.body;
    if (!sessionId || !sdp) {
      return res.status(400).json({ error: 'sessionId and sdp answer are required.' });
    }

    const result = await Agent.AvatarIntelligenceEngine.startAvatarSession(sessionId, sdp);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/avatar/stop
 */
exports.stopSession = async (req, res) => {
  try {
    const home = await getRequesterHome(req.user.id);
    const { sessionId } = req.body;

    const targetSessionId = sessionId || (home ? Agent.ProactiveDecisionEngine.getActiveSession(home._id) : null);
    if (!targetSessionId) {
      return res.status(400).json({ error: 'No active session ID provided or found.' });
    }

    const result = await Agent.AvatarIntelligenceEngine.stopAvatarSession(targetSessionId);
    if (home) {
      Agent.ProactiveDecisionEngine.removeActiveSession(home._id);
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/avatar/status
 */
exports.status = async (req, res) => {
  try {
    const home = await getRequesterHome(req.user.id);
    if (!home) return res.status(404).json({ error: 'No Smart Home registered.' });

    const activeSessionId = Agent.ProactiveDecisionEngine.getActiveSession(home._id);
    res.json({
      active: !!activeSessionId,
      sessionId: activeSessionId || null,
      status: activeSessionId ? 'connected' : 'disconnected'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST /api/avatar/speak (Unified Pipeline Endpoint)
 */
exports.speak = async (req, res) => {
  try {
    const { text, audioData, sessionId, memberName, socketId } = req.body;
    
    const home = await getRequesterHome(req.user.id);
    if (!home) return res.status(404).json({ error: 'No Smart Home registered.' });
    
    const result = await Agent.executeVoiceCommandPipeline({
      text,
      audioData,
      sessionId,
      memberName,
      home,
      io: req.io,
      socketId
    });

    // Update telemetry analytics
    try {
      const personalityStyle = result.language === 'Hindi' ? 'Grandmother Mode' : 'Default';
      await updateAnalytics(home._id, memberName || 'Owner', result.emotionState, result.avatarState, result.language, result.text);
    } catch (anErr) {
      console.warn('⚠️ [Analytics Update Failed]:', anErr.message);
    }

    res.json(result);
  } catch (error) {
    console.error('[Speak Controller Error]:', error);
    res.status(500).json({ error: error.message });
  }
};

// ----------------------------------------------------
// Backward Compatible / Existing Endpoints
// ----------------------------------------------------

exports.interact = exports.speak;

exports.getMemory = async (req, res) => {
  try {
    const home = await getRequesterHome(req.user.id);
    if (!home) return res.status(404).json({ error: 'No Smart Home registered.' });
    
    const memories = await AvatarMemory.find({ homeId: home._id }).sort({ timestamp: -1 }).limit(50);
    res.json(memories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAnalytics = async (req, res) => {
  try {
    const home = await getRequesterHome(req.user.id);
    if (!home) return res.status(404).json({ error: 'No Smart Home registered.' });

    let analytics = await AvatarAnalytics.findOne({ homeId: home._id });
    
    // Compile fallback analytics if empty in DB
    if (!analytics) {
      const memories = await AvatarMemory.find({ homeId: home._id });
      const userCounts = {};
      memories.forEach(m => { userCounts[m.user] = (userCounts[m.user] || 0) + 1; });
      const conversationsPerUser = Object.entries(userCounts).map(([name, count]) => ({ user: name, count }));

      analytics = {
        totalConversations: memories.length,
        conversationsPerUser,
        mostActiveUser: memories[0]?.user || 'None',
        mostUsedPersonality: 'Default',
        mostTriggeredEmotion: 'Normal',
        avatarSpeakingTime: memories.length * 5,
        averageConversationLength: Math.max(1, Math.round(memories.length / 2)),
        averageConfidenceScore: 95,
        languageDistribution: { English: memories.length, Hindi: 0, Mixed: 0 }
      };
    }

    res.json(analytics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.proactiveNotification = async (req, res) => {
  try {
    const { alertType, details } = req.body;
    if (!alertType) return res.status(400).json({ error: 'Alert type is required.' });
    
    const home = await getRequesterHome(req.user.id);
    if (!home) return res.status(404).json({ error: 'No Smart Home registered.' });
    
    let announcementText = details || '';
    if (!announcementText) {
      if (alertType === 'water_tank') {
        announcementText = `System announcement. The water tank capacity has fallen to 15 percent. Turning on the water motor immediately.`;
      } else if (alertType === 'security') {
        announcementText = `Intrusion Warning! Unidentified motion detected near the balcony area. Sounding home sirens.`;
      } else if (alertType === 'power_failure') {
        announcementText = `Grid connection lost. Swapping smart home systems to backup battery invertor circuits. Please limit power usage.`;
      } else {
        announcementText = `Smart home update complete. All systems stable.`;
      }
    }
    
    // Call scheduler to handle throttling and priority queues
    await Agent.ProactiveDecisionEngine.scheduleProactiveSpeaking(home._id, alertType, announcementText, alertType === 'security' ? 1 : 2);
    
    res.json({
      success: true,
      text: announcementText,
      alertType
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getUsageAnalytics = async (req, res) => {
  try {
    const stats = await AIUsageMetrics.aggregate([
      {
        $group: {
          _id: '$serviceType',
          totalRequests: { $sum: 1 },
          totalInputTokens: { $sum: '$inputTokens' },
          totalOutputTokens: { $sum: '$outputTokens' },
          totalCharacters: { $sum: '$charactersProcessed' },
          totalCost: { $sum: '$costEstimation' },
          avgLatency: { $avg: '$latencyMs' },
          errorCount: {
            $sum: {
              $cond: [{ $eq: ['$isError', true] }, 1, 0]
            }
          }
        }
      }
    ]);

    const formattedStats = {
      Bedrock: { requests: 0, inputTokens: 0, outputTokens: 0, cost: 0, avgLatency: 0, errors: 0 },
      Polly: { requests: 0, characters: 0, cost: 0, avgLatency: 0, errors: 0 },
      totalCost: 0
    };

    stats.forEach(item => {
      if (item._id === 'Bedrock') {
        formattedStats.Bedrock = {
          requests: item.totalRequests,
          inputTokens: item.totalInputTokens,
          outputTokens: item.totalOutputTokens,
          cost: item.totalCost,
          avgLatency: Math.round(item.avgLatency || 0),
          errors: item.errorCount
        };
        formattedStats.totalCost += item.totalCost;
      } else if (item._id === 'Polly') {
        formattedStats.Polly = {
          requests: item.totalRequests,
          characters: item.totalCharacters,
          cost: item.totalCost,
          avgLatency: Math.round(item.avgLatency || 0),
          errors: item.errorCount
        };
        formattedStats.totalCost += item.totalCost;
      }
    });

    const logs = await AIUsageMetrics.find().sort({ timestamp: -1 }).limit(100);

    res.json({
      stats: formattedStats,
      logs
    });
  } catch (error) {
    console.error('[Avatar Usage Analytics Error]:', error);
    res.status(500).json({ error: error.message });
  }
};
