const AvatarMemory = require('../models/AvatarMemory');
const ConversationSession = require('../models/ConversationSession');
const FamilyMember = require('../models/FamilyMember');
const EventHistory = require('../models/EventHistory');
const bedrockService = require('../services/bedrockService');

const hasAwsCredentials = process.env.AWS_ACCESS_KEY_ID && 
                           process.env.AWS_SECRET_ACCESS_KEY && 
                           process.env.AWS_REGION;

/**
 * Persist an interaction into AvatarMemory
 */
exports.storeMemory = async (homeId, user, question, response, context = {}, emotion = 'Normal', state = 'Speaking') => {
  try {
    const memory = await AvatarMemory.create({
      homeId,
      user,
      question,
      avatarResponse: response,
      contextUsed: context,
      emotionState: emotion,
      avatarState: state,
      timestamp: new Date()
    });
    return memory;
  } catch (err) {
    console.error('[Memory Engine] Failed to store interaction memory:', err.message);
    throw err;
  }
};

/**
 * Retrieve memories matching homeId and containing related keywords, filtered by optional family member
 */
exports.retrieveRelevantMemories = async (homeId, user, queryText) => {
  try {
    const query = { homeId };
    
    // Family member filtering
    if (user && user !== 'Owner' && user !== 'System' && user !== 'System Alert') {
      query.user = user;
    }

    // Keyword extraction from queryText
    const words = queryText.toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "")
      .split(/\s+/)
      .filter(w => w.length > 3);

    // Build keyword matching conditions
    if (words.length > 0) {
      const regexPatterns = words.map(w => new RegExp(w, 'i'));
      query.$or = [
        { question: { $in: regexPatterns } },
        { avatarResponse: { $in: regexPatterns } }
      ];
    }

    // Query historical records sorted by latest
    const memories = await AvatarMemory.find(query)
      .sort({ timestamp: -1 })
      .limit(10);
      
    return memories;
  } catch (err) {
    console.error('[Memory Engine] Failed to retrieve relevant memories:', err.message);
    return [];
  }
};

/**
 * Search history logs with structured filters
 */
exports.searchConversationHistory = async (homeId, filters = {}) => {
  try {
    const query = { homeId };

    if (filters.user) {
      query.user = new RegExp(filters.user, 'i');
    }

    if (filters.startDate || filters.endDate) {
      query.timestamp = {};
      if (filters.startDate) {
        query.timestamp.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.timestamp.$lte = new Date(filters.endDate);
      }
    }

    if (filters.emotionState) {
      query.emotionState = filters.emotionState;
    }

    if (filters.avatarState) {
      query.avatarState = filters.avatarState;
    }

    return await AvatarMemory.find(query).sort({ timestamp: -1 }).limit(50);
  } catch (err) {
    console.error('[Memory Engine] Failed to search history:', err.message);
    return [];
  }
};

/**
 * Summarize past interactions using Amazon Bedrock
 */
exports.summarizePastInteractions = async (homeId, user, question) => {
  try {
    const lowerQ = question.toLowerCase();
    let startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let timeLabel = "the last 7 days";

    if (lowerQ.includes('yesterday')) {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 1);
      startDate.setHours(0, 0, 0, 0);
      timeLabel = "yesterday";
    } else if (lowerQ.includes('today')) {
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      timeLabel = "today";
    }

    const query = { 
      homeId, 
      timestamp: { $gte: startDate } 
    };

    if (user && user !== 'Owner' && user !== 'System' && user !== 'System Alert') {
      query.user = user;
    }

    const keywords = ['water', 'motor', 'ac', 'light', 'study', 'balcony', 'bedroom'];
    const matchedKeywords = keywords.filter(kw => lowerQ.includes(kw));
    if (matchedKeywords.length > 0) {
      const regexes = matchedKeywords.map(kw => new RegExp(kw, 'i'));
      query.$or = [
        { question: { $in: regexes } },
        { avatarResponse: { $in: regexes } }
      ];
    }

    const memories = await AvatarMemory.find(query).sort({ timestamp: -1 }).limit(15);

    if (hasAwsCredentials && memories.length > 0) {
      try {
        const prompt = `You are GrihaMitra, the interactive smart home companion.
The user is asking: "${question}"
Below are the retrieved conversation and alert memory logs matching the period (${timeLabel}):
MEMORY RECORDS:
${JSON.stringify(memories.map(m => ({ user: m.user, question: m.question, response: m.avatarResponse, time: m.timestamp })), null, 2)}

Provide a natural, friendly summary in a single sentence (maximum 40 words) that directly answers their question about what happened or what was discussed.
If no direct answer is found in the logs, state what general activities were recorded.`;

        return await bedrockService.invokeModel(prompt, 150, 0.3);
      } catch (bedErr) {
        console.warn('[Memory Engine] Bedrock invocation failed. Falling back to local summarizer:', bedErr.message);
      }
    }

    if (memories.length === 0) {
      return `I don't recall any conversations or alerts fitting that description during ${timeLabel}.`;
    }

    const lastMemory = memories[0];
    const userPhrase = lastMemory.user === 'System Alert' ? 'I announced that' : `you asked me about "${lastMemory.question}" and I replied:`;
    return `Looking back at ${timeLabel}, my last interaction was when ${userPhrase} "${lastMemory.avatarResponse.replace(/नमस्ते दादीजी। |Hey there! |Hello. /g, '')}"`;

  } catch (err) {
    console.error('[Memory Engine] Summarize failed:', err.message);
    return `I experienced a memory retrieval error. Please try again.`;
  }
};

/**
 * Summarize active dialog history and update ConversationSession in MongoDB
 */
exports.summarizeConversation = async (sessionId, messages) => {
  if (!sessionId || !messages || messages.length === 0) {
    return 'No active conversation logs found.';
  }

  try {
    const session = await ConversationSession.findOne({ sessionId });
    if (!session) return 'Session not found.';

    const formattedHistory = messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
    const oldSummary = session.conversationSummary || 'No previous summary.';

    const prompt = `You are the conversation summarizer for GrihaMitra.
Merge and summarize the dialogue history below into a concise 1-2 sentence description of user preferences, patterns, or recurring topics.

EXISTING SUMMARY:
${oldSummary}

NEW DIALOGUE HISTORY:
${formattedHistory}

Provide a clean summary string without any markdown wraps or labels. Keep it under 50 words.`;

    const summaryText = await bedrockService.invokeModel(prompt, 150, 0.3);
    
    session.conversationSummary = summaryText;
    session.summaryUpdatedAt = new Date();
    await session.save();

    return summaryText;
  } catch (err) {
    console.error('[Memory Engine] Conversation summary failed:', err.message);
    throw err;
  }
};

/**
 * Summarize weekly home behavior logs
 */
exports.summarizeWeeklyBehavior = async (homeId) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const logs = await EventHistory.find({
      homeId,
      timestamp: { $gte: sevenDaysAgo }
    }).sort({ timestamp: -1 }).limit(30);

    if (logs.length === 0) {
      return 'No behavior patterns logged for this house in the past week.';
    }

    const formattedLogs = logs.map(l => `[${l.timestamp.toISOString()}] ${l.userName} turned ${l.action} the ${l.deviceName} in ${l.roomName}`).join('\n');
    const prompt = `Summarize the weekly smart home activity patterns of this household in a single friendly, supportive sentence.
Activity logs:
${formattedLogs}
Keep the summary concise and friendly. Under 45 words.`;

    return await bedrockService.invokeModel(prompt, 150, 0.3);
  } catch (err) {
    console.error('[Memory Engine] Weekly behavior summary failed:', err.message);
    throw err;
  }
};

/**
 * Summarize a family member's comfort rules evaluation
 */
exports.summarizeUserProfile = async (memberId) => {
  try {
    const member = await FamilyMember.findById(memberId);
    if (!member) throw new Error('Member not found');

    const prompt = `You are GrihaMitra. Summarize this smart home resident's habits and rules updates.
Resident Profile:
- Name: ${member.name}
- Role: ${member.role}
- Routine Profile: ${member.routineProfile}
- Preferences: AC Temp -> ${member.preferences?.tempPreference || 24}°C, Lighting -> ${member.preferences?.lightingStyle || 'Warm White'}
- Active Rooms: ${member.frequentlyUsedRooms?.join(', ') || 'N/A'}
- Active Devices: ${member.frequentlyUsedDevices?.join(', ') || 'N/A'}

Provide a single supportive sentence describing their active lifestyle and comfort preferences. Under 40 words.`;

    const summaryText = await bedrockService.invokeModel(prompt, 150, 0.3);

    if (member.aiEvaluationLogs && member.aiEvaluationLogs.length > 0) {
      const latestLog = member.aiEvaluationLogs[member.aiEvaluationLogs.length - 1];
      latestLog.summary = summaryText;
    } else {
      member.aiEvaluationLogs.push({
        evaluatedAt: new Date(),
        modeAtEvaluation: member.aiMode,
        changesMade: ['Initial profile compilation'],
        summary: summaryText
      });
    }

    await member.save();
    return summaryText;
  } catch (err) {
    console.error('[Memory Engine] User profile summary failed:', err.message);
    throw err;
  }
};
