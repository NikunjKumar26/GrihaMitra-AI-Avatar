const FamilyMember = require('../models/FamilyMember');
const RoutineHistory = require('../models/RoutineHistory');
const Home = require('../models/Home');
const bedrockService = require('../services/bedrockService');
const pollyService = require('../services/pollyService');
const VoiceHistory = require('../models/VoiceHistory');
const AIRoutine = require('../models/AIRoutine');
const PredictiveDecision = require('../models/PredictiveDecision');
const ExplainabilityRecord = require('../models/ExplainabilityRecord');
const queueService = require('../services/queueService');

// Helper to locate homeId linked to the requester
const getRequesterHome = async (userId) => {
  let home = await Home.findOne({ owner: userId });
  if (!home) {
    home = await Home.findOne({ 'members.user': userId });
  }
  return home;
};

// 1. Get all Family Members for the home
exports.getMembers = async (req, res) => {
  try {
    const home = await getRequesterHome(req.user.id);
    if (!home) return res.status(404).json({ error: 'No Smart Home registered to your active profile.' });

    const members = await FamilyMember.find({ home: home._id });
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 2. Add Family Member
exports.createMember = async (req, res) => {
  try {
    const home = await getRequesterHome(req.user.id);
    if (!home) return res.status(404).json({ error: 'No Smart Home registered to your active profile.' });

    const { name, role, age, preferredLanguage, voiceProfile, avatarImage, routineProfile, preferences, user } = req.body;
    
    if (!name || !role) {
      return res.status(400).json({ error: 'Name and role are required fields.' });
    }

    const newMember = new FamilyMember({
      name,
      user: user || undefined,
      role,
      age,
      preferredLanguage,
      voiceProfile,
      avatarImage: avatarImage || getDefaultAvatar(role),
      routineProfile: routineProfile || getDefaultRoutine(role),
      preferences,
      home: home._id
    });

    await newMember.save();
    
    // Automatically log creation event in history
    await RoutineHistory.create({
      memberId: newMember._id,
      activity: `Enrolled in Family System: Specified role as '${role}'`,
      room: 'System Configuration',
      action: 'ADD_PROFILE'
    });

    res.status(201).json(newMember);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 3. Edit Family Member
exports.updateMember = async (req, res) => {
  try {
    const { id } = req.params;
    const home = await getRequesterHome(req.user.id);
    if (!home) return res.status(404).json({ error: 'No Smart Home registered to your active profile.' });

    const member = await FamilyMember.findOne({ _id: id, home: home._id });
    if (!member) return res.status(404).json({ error: 'Family profile not found.' });

    const { name, role, age, preferredLanguage, voiceProfile, avatarImage, routineProfile, preferences, user } = req.body;

    if (name) member.name = name;
    if (user !== undefined) member.user = user || null;
    if (role) {
      member.role = role;
      member.avatarImage = avatarImage || getDefaultAvatar(role);
    }
    if (age !== undefined) member.age = age;
    if (preferredLanguage) member.preferredLanguage = preferredLanguage;
    if (voiceProfile) member.voiceProfile = voiceProfile;
    if (routineProfile) member.routineProfile = routineProfile;
    if (preferences) {
      member.preferences = { ...member.preferences, ...preferences };
    }

    await member.save();

    // Log update event in history
    await RoutineHistory.create({
      memberId: member._id,
      activity: `Updated profile details: Confirmed language as '${member.preferredLanguage}'`,
      room: 'System Configuration',
      action: 'UPDATE_PROFILE'
    });

    res.json(member);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 4. Delete Family Member
exports.deleteMember = async (req, res) => {
  try {
    const { id } = req.params;
    const home = await getRequesterHome(req.user.id);
    if (!home) return res.status(404).json({ error: 'No Smart Home registered to your active profile.' });

    const member = await FamilyMember.findOneAndDelete({ _id: id, home: home._id });
    if (!member) return res.status(404).json({ error: 'Family profile not found.' });

    // Clean up corresponding routine logs
    await RoutineHistory.deleteMany({ memberId: id });

    res.json({ message: `Successfully deleted profile for member: ${member.name}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 5. Manual Logging Endpoint
exports.logActivity = async (req, res) => {
  try {
    const { memberId, activity, room, device, action } = req.body;
    if (!memberId || !activity) {
      return res.status(400).json({ error: 'MemberId and activity description are required.' });
    }

    const log = await RoutineHistory.create({
      memberId,
      activity,
      room: room || 'Smart Home',
      device: device || 'System Sensor',
      action: action || 'TOGGLE'
    });

    res.status(201).json(log);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 6. Get Family Intelligence Dashboard Data
exports.getIntelligence = async (req, res) => {
  try {
    const home = await getRequesterHome(req.user.id);
    if (!home) return res.status(404).json({ error: 'No Smart Home registered to your active profile.' });

    // Grab all members in the household
    const members = await FamilyMember.find({ home: home._id });
    
    // Grab all member IDs for filter queries
    const memberIds = members.map(m => m._id);

    // Fetch recent logs sorted by newest, limit to recent 40 logs
    const logs = await RoutineHistory.find({ memberId: { $in: memberIds } })
      .populate('memberId', 'name role avatarImage preferredLanguage')
      .sort({ timestamp: -1 })
      .limit(40);

    // Generate family routine insights via Bedrock
    const prompt = `You are GrihaMitra, the central smart home AI of the Sapno Ka Ghar household.
Analyze the following household members and their recent smart routine logs to generate actionable "Family Intelligence Insights" (maximum 2-3 sentences). Focus on:
1. Daily pattern updates.
2. Comfort and temperature preferences.
3. Suggesting helpful routines or automation optimizations.
4. Energy-saving recommendations.

FAMILY MEMBERS:
${JSON.stringify(members.map(m => ({ name: m.name, role: m.role, preferences: m.preferences })), null, 2)}

RECENT ROUTINE LOGS:
${JSON.stringify(logs.map(l => ({ memberName: l.memberId?.name, taskName: l.taskName, status: l.status, time: l.timestamp })), null, 2)}

Provide a friendly, insightful summary. Avoid any markdown formatting.`;

    const intelligence = await bedrockService.invokeModel(prompt, 300, 0.7);
    
    res.json({
      members,
      logs,
      intelligence
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 7. Polly Text-To-Speech Endpoint
exports.synthesizeSpeech = async (req, res) => {
  try {
    const { text, voiceProfile } = req.body;
    if (!text) return res.status(400).json({ error: 'Text prompt is required.' });

    const voice = voiceProfile || 'Aditi';
    const result = await pollyService.synthesize(text, voice);

    if (result.fallback) {
      // Return details instructing the frontend to use local Web Speech API fallback
      return res.json({ fallback: true, text });
    }

    // Set appropriate response headers for audio stream streaming
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Transfer-Encoding', 'chunked');
    
    // Pipe the audio stream bytes to response
    result.audioStream.pipe(res);
  } catch (error) {
    console.error('[Family Controller] TTS error:', error);
    res.status(500).json({ error: error.message });
  }
};

// 8. Chat with GrihaMitra Assistant
exports.chatWithAssistant = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Message text is required.' });

    const home = await getRequesterHome(req.user.id);
    if (!home) return res.status(404).json({ error: 'No Smart Home registered to your active profile.' });

    // Fetch members and recent logs to provide context
    const members = await FamilyMember.find({ home: home._id });
    const memberIds = members.map(m => m._id);
    const logs = await RoutineHistory.find({ memberId: { $in: memberIds } })
      .populate('memberId', 'name role avatarImage')
      .sort({ timestamp: -1 })
      .limit(10);

    // Query Bedrock to converse with family member
    const prompt = `You are GrihaMitra, the interactive smart home AI assistant of the Sapno Ka Ghar household.
A family member is chatting with you. Below are details of the household members and their recent smart routine activity:

HOUSEHOLD MEMBERS:
${JSON.stringify(members.map(m => ({ name: m.name, role: m.role, preferences: m.preferences })), null, 2)}

RECENT ROUTINE LOGS:
${JSON.stringify(logs.map(l => ({ memberName: l.memberId?.name, taskName: l.taskName, status: l.status, time: l.timestamp })), null, 2)}

USER MESSAGE: "${text}"

Generate a natural, helpful, and concise response (maximum 2-3 sentences) addressing their message. Do not include markdown styling.`;

    const reply = await bedrockService.invokeModel(prompt, 300, 0.7);
    res.json({ reply });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 9. Speech to Text Transcription
exports.speechToText = async (req, res) => {
  try {
    const { audio, mockText } = req.body;
    // Real Whisper STT can be integrated here if audio is sent.
    // For zero-latency local fallback, we return the parsed mockText or a default speech command.
    const text = mockText || "Turn on the bedroom light";
    res.json({ text });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 10. Voice Command Processing & Conversational Query Handling
exports.voiceCommand = async (req, res) => {
  try {
    const { text, audioData, sessionId, memberName } = req.body;
    
    // Check if we have either a text input or audio data
    if (!text && !audioData) {
      return res.status(400).json({ error: 'Command text or speech audio is required.' });
    }

    const home = await getRequesterHome(req.user.id);
    if (!home) return res.status(404).json({ error: 'No Smart Home registered to your active profile.' });

    // Generate a default session ID if not sent
    const activeSessionId = sessionId || `session_${home._id}`;

    // Dispatch to background processing queues
    const result = await queueService.dispatchVoicePipeline({
      text,
      audioData,
      sessionId: activeSessionId,
      memberName: memberName || 'Owner',
      homeId: home._id
    }, req.io);

    res.json(result);
  } catch (error) {
    console.error('[Voice Command Controller Error]:', error);
    res.status(500).json({ error: error.message });
  }
};

// 11. Get Voice History & Dashboard Analytics
exports.getVoiceDashboard = async (req, res) => {
  try {
    const home = await getRequesterHome(req.user.id);
    if (!home) return res.status(404).json({ error: 'No Smart Home registered to your active profile.' });

    // Fetch last 100 voice records
    const history = await VoiceHistory.find({ homeId: home._id }).sort({ timestamp: -1 }).limit(100);

    // Compute advanced voice analytics in memory
    const intents = {
      control_device: 0,
      control_multiple_devices: 0,
      sensor_query: 0,
      routine_query: 0,
      prediction_query: 0,
      explain_action: 0,
      explain_routine: 0,
      explain_profile: 0,
      home_status_query: 0,
      automation_query: 0,
      greeting: 0,
      general_chat: 0
    };

    const hourlyActivity = Array(24).fill(0);
    const deviceCounts = {};
    const sessions = {};
    const questionCounts = {};
    const userCounts = {};
    const languages = { English: 0, Hindi: 0, Mixed: 0 };
    let successCount = 0;

    history.forEach(item => {
      // Intent distribution counts
      if (intents[item.intent] !== undefined) {
        intents[item.intent]++;
      }

      // Track hourly activity frequency
      if (item.timestamp) {
        const hr = new Date(item.timestamp).getHours();
        hourlyActivity[hr]++;
      }

      // Session tracking for conversations count and session lengths
      const sid = item.sessionId || 'default';
      if (!sessions[sid]) {
        sessions[sid] = [];
      }
      sessions[sid].push(item);

      // Question frequency
      if (item.transcript) {
        questionCounts[item.transcript] = (questionCounts[item.transcript] || 0) + 1;
      }

      // User activity
      const usr = item.user || 'Owner';
      userCounts[usr] = (userCounts[usr] || 0) + 1;

      // Language distribution
      if (languages[item.language] !== undefined) {
        languages[item.language]++;
      }

      // Speech + Intent average confidence check for Success Rate
      const avgConf = ((item.speechConfidence || 100) + (item.intentConfidence || 100)) / 2;
      if (avgConf >= 75) {
        successCount++;
      }

      // Identify target devices from transcript
      const cleanText = item.transcript.toLowerCase();
      let deviceNameMatched = null;
      if (cleanText.includes('light')) deviceNameMatched = 'Light';
      else if (cleanText.includes('fan')) deviceNameMatched = 'Fan';
      else if (cleanText.includes('ac') || cleanText.includes('air')) deviceNameMatched = 'Air Conditioner';
      else if (cleanText.includes('motor')) deviceNameMatched = 'Water Motor';
      else if (cleanText.includes('pump')) deviceNameMatched = 'Garden Pump';

      if (deviceNameMatched) {
        deviceCounts[deviceNameMatched] = (deviceCounts[deviceNameMatched] || 0) + 1;
      }
    });

    const sessionKeys = Object.keys(sessions);
    const totalConversations = sessionKeys.length;
    let totalMessages = 0;
    sessionKeys.forEach(sid => {
      totalMessages += sessions[sid].length;
    });

    const averageSessionLength = totalConversations > 0 ? parseFloat((totalMessages / totalConversations).toFixed(1)) : 0;
    const mostCommonIntents = Object.entries(intents)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(e => ({ intent: e[0], count: e[1] }));

    const mostAskedQuestions = Object.entries(questionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(e => e[0]);

    const mostActiveUsers = Object.entries(userCounts)
      .sort((a, b) => b[1] - a[1])
      .map(e => ({ name: e[0], count: e[1] }));

    const voiceSuccessRate = history.length > 0 ? Math.round((successCount / history.length) * 100) : 100;

    const QueueMetrics = require('../models/QueueMetrics');
    const queueMetrics = await QueueMetrics.find({});

    const redisStatus = queueService.getRedisStatus();

    const ConversationSession = require('../models/ConversationSession');
    const summaryGenerationCount = await ConversationSession.countDocuments({
      homeId: home._id,
      conversationSummary: { $ne: "" }
    });

    const modelUsage = { tiny: 0, base: 0, small: 0, none: 0 };
    let totalConfidence = 0;
    
    history.forEach(item => {
      const m = item.whisperModel || 'tiny';
      if (modelUsage[m] !== undefined) {
        modelUsage[m]++;
      } else {
        modelUsage[m] = 1;
      }
      
      const avgItemConf = ((item.speechConfidence || 100) + (item.intentConfidence || 100)) / 2;
      totalConfidence += avgItemConf;
    });

    const averageConfidence = history.length > 0 ? Math.round(totalConfidence / history.length) : 95;
    const longestSession = sessionKeys.length > 0 ? Math.max(...Object.values(sessions).map(s => s.length)) : 0;
    const mostUsedIntent = mostCommonIntents.length > 0 ? mostCommonIntents[0].intent : 'general_chat';
    
    const conversationsPerUser = Object.entries(userCounts).map(([name, count]) => ({ name, count }));
    const mostActiveUser = conversationsPerUser.length > 0 ? conversationsPerUser.sort((a,b) => b.count - a.count)[0].name : 'Owner';
    
    // Speaker confidence trends
    const speakerConfidenceTrends = history.slice(0, 10).reverse().map(item => ({
      label: item.user,
      value: item.speakerConfidence || 92,
      timestamp: item.timestamp
    }));

    // Speech confidence trends
    const confidenceTrends = history.slice(0, 10).reverse().map(item => ({
      label: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      value: item.speechConfidence || 95,
      timestamp: item.timestamp
    }));

    // Processing latency trends
    const latencyTrends = history.slice(0, 10).reverse().map(item => ({
      label: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      value: item.processingTime || 0,
      timestamp: item.timestamp
    }));

    const speakerAnalytics = {
      mostActiveUser,
      conversationsPerUser,
      languageDistribution: languages,
      speakerConfidenceTrends
    };

    const sessionAnalytics = {
      averageSessionLength,
      longestSession,
      mostUsedIntent,
      averageConfidence
    };

    const speechAnalytics = {
      modelUsage,
      languageDetectionDistribution: languages,
      confidenceTrends,
      latencyTrends
    };

    const analytics = {
      totalCommands: history.length,
      totalConversations,
      averageSessionLength,
      intentDistribution: intents,
      mostCommonIntents,
      mostAskedQuestions,
      mostActiveUsers,
      languageDistribution: languages,
      voiceSuccessRate,
      hourlyActivity,
      deviceCounts,
      redisStatus,
      queueMetrics,
      summaryGenerationCount,
      speakerAnalytics,
      sessionAnalytics,
      speechAnalytics
    };

    res.json({
      history,
      analytics
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Helper defaults
function getDefaultAvatar(role) {
  if (role === 'Father') return '👨';
  if (role === 'Mother') return '👩';
  if (role === 'Grandmother') return '👵';
  if (role === 'Student') return '🧑‍🎓';
  return '👤';
}

function getDefaultRoutine(role) {
  if (role === 'Father') return 'Office Routine';
  if (role === 'Mother') return 'Cooking Routine';
  if (role === 'Grandmother') return 'Pooja Routine';
  if (role === 'Student') return 'Study Routine';
  return 'Dynamic Routine';
}
