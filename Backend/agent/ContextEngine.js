const FamilyMember = require('../models/FamilyMember');
const EventHistory = require('../models/EventHistory');
const bedrockService = require('../services/bedrockService');

// Helper to resolve EventHistory queries for both online and offline profiles
const getMemberQuery = (member) => {
  const query = { homeId: member.home };
  if (member.user) {
    query.$or = [
      { userId: member.user },
      { userName: member.name }
    ];
  } else {
    query.userName = member.name;
  }
  return query;
};

/**
 * Sync Event History insights and update Member Profile automatically
 */
exports.syncAndGetContext = async (memberId, mockDays = null, forceEvaluate = false) => {
  try {
    const member = await FamilyMember.findById(memberId);
    if (!member) throw new Error('Family member profile not found.');

    const matchQuery = getMemberQuery(member);

    // Get oldest and newest event logs to compute actual telemetry span
    const oldestLog = await EventHistory.findOne(matchQuery).sort({ timestamp: 1 });
    const newestLog = await EventHistory.findOne(matchQuery).sort({ timestamp: -1 });

    if (!member.learningStartedAt) {
      member.learningStartedAt = oldestLog ? oldestLog.timestamp : member.createdAt || new Date();
    }

    const realDaysElapsed = Math.floor((Date.now() - new Date(member.learningStartedAt).getTime()) / (1000 * 60 * 60 * 24));
    let databaseTimeSpanDays = 0;
    if (oldestLog && newestLog) {
      const spanDiff = newestLog.timestamp.getTime() - oldestLog.timestamp.getTime();
      databaseTimeSpanDays = Math.floor(spanDiff / (1000 * 60 * 60 * 24));
    }

    const daysElapsed = mockDays !== null ? parseInt(mockDays) : Math.max(realDaysElapsed, databaseTimeSpanDays);
    const aiMode = daysElapsed >= 10 ? 'Predictive' : 'Learning';
    member.aiMode = aiMode;

    // Aggregations
    const roomsAgg = await EventHistory.aggregate([
      { $match: matchQuery },
      { $group: { _id: '$roomName', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 3 }
    ]);
    const frequentlyUsedRooms = roomsAgg.map(r => r._id);
    const mostVisitedRoom = frequentlyUsedRooms[0] || 'None';

    const devicesAgg = await EventHistory.aggregate([
      { $match: matchQuery },
      { $group: { _id: '$deviceName', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 3 }
    ]);
    const frequentlyUsedDevices = devicesAgg.map(d => d._id);
    const mostUsedDevice = frequentlyUsedDevices[0] || 'None';

    const hourAgg = await EventHistory.aggregate([
      { $match: matchQuery },
      { $group: { _id: '$hour', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);
    let mostActiveTime = 'None';
    let peakHour = 19;
    if (hourAgg.length > 0) {
      peakHour = hourAgg[0]._id;
      const ampm = peakHour >= 12 ? 'PM' : 'AM';
      const displayHr = peakHour % 12 || 12;
      mostActiveTime = `${displayHr} ${ampm}`;
    }

    const dayAgg = await EventHistory.aggregate([
      { $match: matchQuery },
      { $group: { _id: '$dayOfWeek', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);
    const peakDay = dayAgg.length > 0 ? dayAgg[0]._id : 'N/A';
    const dailyActivityPatterns = peakDay !== 'N/A'
      ? `Highly active on ${peakDay}s around ${mostActiveTime}.`
      : 'No historical pattern logged yet.';

    member.frequentlyUsedRooms = frequentlyUsedRooms;
    member.frequentlyUsedDevices = frequentlyUsedDevices;
    member.mostVisitedRoom = mostVisitedRoom;
    member.mostUsedDevice = mostUsedDevice;
    member.mostActiveTime = mostActiveTime;
    member.dailyActivityPatterns = dailyActivityPatterns;

    // Evaluation Logic
    let shouldEvaluate = false;
    let daysSinceLastMod = 999;

    if (aiMode === 'Predictive') {
      if (!member.lastAIEvaluationAt) {
        shouldEvaluate = true;
      } else {
        const msSinceLastEval = Date.now() - new Date(member.lastAIEvaluationAt).getTime();
        const realDaysSinceLastEval = Math.floor(msSinceLastEval / (1000 * 60 * 60 * 24));
        
        let dbDaysSinceLastEval = 0;
        if (newestLog) {
          const dbMsSinceLastEval = newestLog.timestamp.getTime() - new Date(member.lastAIEvaluationAt).getTime();
          dbDaysSinceLastEval = Math.floor(dbMsSinceLastEval / (1000 * 60 * 60 * 24));
        }
        daysSinceLastMod = Math.max(realDaysSinceLastEval, dbDaysSinceLastEval);
        
        if (daysSinceLastMod >= 10 || forceEvaluate) {
          shouldEvaluate = true;
        }
      }
    }

    if (shouldEvaluate) {
      const oldTemp = member.preferences?.tempPreference || 24;
      const oldActiveHours = member.activeHours || '9 AM - 9 PM';
      const oldLighting = member.preferences?.lightingStyle || 'Warm White';
      const oldRoutine = member.routineProfile || 'Dynamic Routine';

      const acEvents = await EventHistory.find({
        ...matchQuery,
        $or: [{ deviceType: 'ac' }, { deviceName: /ac/i }, { deviceName: /air conditioner/i }]
      });
      let avgTemp = null;
      if (acEvents.length > 0) {
        let tempSum = 0;
        let tempCount = 0;
        acEvents.forEach(e => {
          const match = e.action.match(/(\d+)\s*°?C/i) || e.action.match(/set\s+to\s+(\d+)/i) || e.action.match(/temperature\s+(\d+)/i);
          if (match) {
            const val = parseInt(match[1]);
            if (val >= 16 && val <= 30) {
              tempSum += val;
              tempCount++;
            }
          }
        });
        if (tempCount > 0) avgTemp = Math.round(tempSum / tempCount);
      }
      if (avgTemp !== null) member.preferences.tempPreference = avgTemp;

      const startHr = (peakHour - 1 + 24) % 24;
      const endHr = (peakHour + 3) % 24;
      const formatHr = (h) => {
        const ampm = h >= 12 ? 'PM' : 'AM';
        const hr = h % 12 || 12;
        return `${hr} ${ampm}`;
      };
      member.activeHours = `${formatHr(startHr)} - ${formatHr(endHr)}`;

      const lightEvents = await EventHistory.find({
        ...matchQuery,
        $or: [{ deviceType: 'light' }, { deviceName: /light/i }, { deviceName: /lamp/i }]
      });
      let predictedLighting = null;
      if (lightEvents.length > 0) {
        const stylesCount = {};
        lightEvents.forEach(e => {
          ['Warm White', 'Cool Focus', 'Ambient Sunset', 'Eco Dim'].forEach(style => {
            if (e.action.includes(style)) stylesCount[style] = (stylesCount[style] || 0) + 1;
          });
        });
        const sortedStyles = Object.entries(stylesCount).sort((a, b) => b[1] - a[1]);
        if (sortedStyles.length > 0) predictedLighting = sortedStyles[0][0];
      }
      if (predictedLighting) member.preferences.lightingStyle = predictedLighting;

      let predictedRoutine = 'Dynamic Routine';
      const topRoomLower = mostVisitedRoom.toLowerCase();
      if (topRoomLower.includes('kitchen') && member.role === 'Mother') predictedRoutine = 'Cooking Routine';
      else if (topRoomLower.includes('study') && member.role === 'Student') predictedRoutine = 'Study Routine';
      else if ((topRoomLower.includes('prayer') || topRoomLower.includes('mandir')) && member.role === 'Grandmother') predictedRoutine = 'Pooja Routine';
      else if ((topRoomLower.includes('office') || topRoomLower.includes('study')) && member.role === 'Father') predictedRoutine = 'Office Routine';
      member.routineProfile = predictedRoutine;

      const changesMade = [];
      if (oldTemp !== member.preferences.tempPreference) changesMade.push(`Temperature Preference: ${oldTemp}°C ➔ ${member.preferences.tempPreference}°C`);
      if (oldActiveHours !== member.activeHours) changesMade.push(`Active Hours: "${oldActiveHours}" ➔ "${member.activeHours}"`);
      if (oldLighting !== member.preferences.lightingStyle) changesMade.push(`Lighting Style: "${oldLighting}" ➔ "${member.preferences.lightingStyle}"`);
      if (oldRoutine !== member.routineProfile) changesMade.push(`Routine Profile: "${oldRoutine}" ➔ "${member.routineProfile}"`);

      member.lastAIEvaluationAt = new Date();
      member.aiEvaluationLogs.push({
        evaluatedAt: new Date(),
        modeAtEvaluation: aiMode,
        changesMade,
        summary: changesMade.length > 0 ? `AI automatically adjusted rules to align with logs: ${changesMade.join(', ')}` : `AI analyzed past 10 days of behavior. All comfort preferences are fully aligned; no overrides required.`
      });
    }

    await member.save();
    return {
      member,
      daysElapsed,
      realDaysElapsed,
      databaseTimeSpanDays,
      matchQuery
    };
  } catch (err) {
    console.error('[Context Engine] Sync failed:', err.message);
    throw err;
  }
};

/**
 * Generate a personalized daily routine summary using Bedrock
 */
exports.generatePersonalizedSummary = async (member, logs) => {
  const prompt = `You are GrihaMitra, the Smart Home AI engine.
Generate a friendly, warm, and personalized daily routine summary (max 3 sentences) for this household member:
MEMBER: Name: ${member.name}, Role: ${member.role}, Preferred Language: ${member.preferredLanguage}, Active Hours: ${member.activeHours}, Comfort Prefs: ${JSON.stringify(member.preferences)}

RECENT ACTIVITY LOGS:
${JSON.stringify(logs.map(l => ({ room: l.roomName, device: l.deviceName, action: l.action, time: l.timestamp })), null, 2)}

Highlight their typical room usage, frequent devices, peak active hours, and general household behavior. Keep it natural and concise.`;

  try {
    return await bedrockService.invokeModel(prompt, 300, 0.7);
  } catch (err) {
    console.error('[Context Engine] Summary generation failed:', err.message);
    throw err;
  }
};
