const mongoose = require('mongoose');
const AIRoutine = require('../models/AIRoutine');
const EventHistory = require('../models/EventHistory');
const FamilyMember = require('../models/FamilyMember');
const Home = require('../models/Home');
const PredictiveDecision = require('../models/PredictiveDecision');
const ExplainabilityRecord = require('../models/ExplainabilityRecord');
const Agent = require('../agent');

// Helper to locate homeId linked to the requester
const getRequesterHome = async (userId) => {
  let home = await Home.findOne({ owner: userId });
  if (!home) {
    home = await Home.findOne({ 'members.user': userId });
  }
  return home;
};

exports.trainModel = async (req, res) => {
  try {
    const data = await Agent.RoutineLearningEngine.trainModel(req.user.id);
    return res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.predictNextAction = async (req, res) => {
  try {
    const { user, hour, dayOfWeek } = req.body;
    if (!user || hour === undefined || !dayOfWeek) {
      return res.status(400).json({ error: 'User, hour, and dayOfWeek are required fields.' });
    }

    const data = await Agent.PredictiveAutomationEngine.predictNextForMember(user, hour, dayOfWeek);
    return res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


exports.generateRoutines = async (req, res) => {
  try {
    const data = await Agent.RoutineLearningEngine.generateRoutines(req.user.id);
    return res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// 4. Get AI Learning Dashboard Data
exports.getLearningDashboard = async (req, res) => {
  try {
    const home = await getRequesterHome(req.user.id);
    if (!home) return res.status(404).json({ error: 'No Smart Home registered to your active profile.' });

    const homeId = home._id;

    // 1. Fetch AI Generated Routines
    const routines = await AIRoutine.find({ homeId }).sort({ confidenceScore: -1 });

    // 2. Aggregate history statistics
    const totalEvents = await EventHistory.countDocuments({ homeId });

    // Group by Room
    const activeRooms = await EventHistory.aggregate([
      { $match: { homeId: new mongoose.Types.ObjectId(homeId) } },
      { $group: { _id: '$roomName', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // Group by User
    const activeUsers = await EventHistory.aggregate([
      { $match: { homeId: new mongoose.Types.ObjectId(homeId) } },
      { $group: { _id: '$userName', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // Group by Device
    const deviceUsage = await EventHistory.aggregate([
      { $match: { homeId: new mongoose.Types.ObjectId(homeId) } },
      { $group: { _id: '$deviceName', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);

    // Weekly learning trends (count of logs weekly over the past 4 weeks)
    const weeklyTrends = [];
    for (let i = 3; i >= 0; i--) {
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - (startOfWeek.getDay() || 7) - (i * 7) + 1);
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      const count = await EventHistory.countDocuments({
        homeId,
        timestamp: { $gte: startOfWeek, $lte: endOfWeek }
      });

      const label = `W-${3 - i}`;
      weeklyTrends.push({
        weekLabel: label,
        count
      });
    }

    res.json({
      routines,
      analytics: {
        totalEvents,
        activeRooms,
        activeUsers,
        deviceUsage,
        weeklyTrends
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.evaluateAutomation = async (homeId, io, hourOverride) => {
  return await Agent.PredictiveAutomationEngine.evaluateAutomation(homeId, io, hourOverride);
};
// Expose manual evaluation trigger endpoint
exports.triggerEvaluation = async (req, res) => {
  try {
    const home = await getRequesterHome(req.user.id);
    if (!home) return res.status(404).json({ error: 'No Smart Home registered to your active profile.' });

    await exports.evaluateAutomation(home._id, req.io);
    res.json({ status: 'SUCCESS', message: 'AI Predictive automation evaluation triggered.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Expose automation dashboard details
exports.getAutomationDashboard = async (req, res) => {
  try {
    const home = await getRequesterHome(req.user.id);
    if (!home) return res.status(404).json({ error: 'No Smart Home registered to your active profile.' });

    const homeId = home._id;

    // Fetch override stats
    const totalDecisions = await PredictiveDecision.countDocuments({
      homeId,
      result: { $in: ['Success', 'Manual Override'] }
    });

    const overrideCount = await PredictiveDecision.countDocuments({
      homeId,
      result: 'Manual Override'
    });

    const successRate = totalDecisions > 0 ? Math.round(((totalDecisions - overrideCount) / totalDecisions) * 100) : 100;

    // Fetch recent automated actions
    const automatedActions = await PredictiveDecision.find({
      homeId,
      result: { $in: ['Success', 'Manual Override'] }
    }).sort({ timestamp: -1 }).limit(20);

    // Fetch pending approvals
    const pendingApprovals = await PredictiveDecision.find({
      homeId,
      result: 'Pending Approval'
    }).sort({ timestamp: -1 });

    // Fetch active predictions for the current hour
    const currentHour = new Date().getHours();
    const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const members = await FamilyMember.find({ home: homeId });
    
    const activePredictions = [];
    for (const m of members) {
      if (m.aiMode === 'Predictive' && m.automationEnabled) {
        const pred = await Agent.PredictiveAutomationEngine.predictNextForMember(m.name, currentHour, currentDay);
        activePredictions.push({
          userName: m.name,
          role: m.role,
          prediction: pred.prediction,
          confidence: pred.confidenceScore,
          room: pred.room,
          device: pred.device,
          supportingEvidence: pred.supportingEvidence
        });
      }
    }

    // Map room overrides list
    const rooms = home.rooms.map(r => ({
      roomId: r._id,
      name: r.name,
      automationEnabled: r.automationEnabled !== false
    }));

    // Map member overrides list
    const memberOverrides = members.map(m => ({
      memberId: m._id,
      name: m.name,
      role: m.role,
      automationEnabled: m.automationEnabled !== false
    }));

    res.json({
      activePredictions,
      automatedActions,
      pendingApprovals,
      rooms,
      members: memberOverrides,
      statistics: {
        totalDecisions,
        overrideCount,
        successRate
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Handle Approval / Rejection Feedback
exports.handleFeedback = async (req, res) => {
  try {
    const { decisionId, response } = req.body;
    if (!decisionId || !response) {
      return res.status(400).json({ error: 'decisionId and response are required.' });
    }

    const decision = await PredictiveDecision.findById(decisionId);
    if (!decision) return res.status(404).json({ error: 'AI decision log not found.' });

    const home = await Home.findById(decision.homeId);
    if (!home) return res.status(404).json({ error: 'Home not found.' });

    if (response === 'Approved') {
      const room = home.rooms.id(decision.roomId);
      if (room) {
        const device = room.devices.id(decision.deviceId);
        if (device && !device.isOn) {
          device.isOn = true;
          await home.save();

          const notifMsg = `🤖 AI execution APPROVED: Turned ON the ${device.name} in the ${room.name} (${decision.userName}'s routine)`;

          // Broadcast state and notify clients
          if (req.io) {
            req.io.to(decision.homeId.toString()).emit('deviceUpdate', { roomId: decision.roomId, deviceId: decision.deviceId, state: true });
            req.io.to(decision.homeId.toString()).emit('notification', { 
              _id: Date.now().toString(), 
              id: Date.now(), 
              actorName: 'AI Engine', 
              stateStr: 'ON', 
              deviceName: device.name, 
              message: notifMsg, 
              createdAt: new Date().toISOString() 
            });
          }

          // Write to DB Notifications
          const Notification = require('../models/Notification');
          await Notification.create({
            home: decision.homeId,
            actorName: 'AI Engine',
            message: notifMsg
          });

          // Log to EventHistory
          await EventHistory.create({
            homeId: decision.homeId,
            roomId: decision.roomId,
            roomName: room.name,
            userName: 'AI Engine (Approved)',
            deviceId: decision.deviceId,
            deviceName: device.name,
            deviceType: device.type,
            action: 'ON',
            source: 'AI',
            timestamp: new Date()
          });
        }
      }

      decision.result = 'Success';
      decision.executedAction = decision.actionType;
      await decision.save();

    } else if (response === 'Rejected') {
      decision.result = 'Rejected';
      decision.executedAction = 'None';
      await decision.save();
    } else {
      return res.status(400).json({ error: 'Invalid response action.' });
    }

    res.json({ status: 'SUCCESS', message: `AI Automation prediction successfully ${response.toLowerCase()}.` });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Toggle Room Automation settings
exports.toggleRoomAutomation = async (req, res) => {
  try {
    const { roomId, enabled } = req.body;
    if (!roomId || enabled === undefined) {
      return res.status(400).json({ error: 'roomId and enabled fields are required.' });
    }

    const home = await getRequesterHome(req.user.id);
    if (!home) return res.status(404).json({ error: 'No Smart Home registered to your active profile.' });

    const room = home.rooms.id(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found in home.' });

    room.automationEnabled = enabled;
    await home.save();

    res.json({ status: 'SUCCESS', message: `AI Automation for room "${room.name}" set to ${enabled}.` });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Toggle Member Automation settings
exports.toggleMemberAutomation = async (req, res) => {
  try {
    const { memberId, enabled } = req.body;
    if (!memberId || enabled === undefined) {
      return res.status(400).json({ error: 'memberId and enabled fields are required.' });
    }

    const member = await FamilyMember.findById(memberId);
    if (!member) return res.status(404).json({ error: 'Family member profile not found.' });

    member.automationEnabled = enabled;
    await member.save();

    res.json({ status: 'SUCCESS', message: `AI Automation for member "${member.name}" set to ${enabled}.` });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 1. Explain Prediction on the fly
exports.explainPrediction = async (req, res) => {
  try {
    const { user, room, device, hour, dayOfWeek } = req.body;
    if (!user || !room || !device || hour === undefined || !dayOfWeek) {
      return res.status(400).json({ error: 'user, room, device, hour, and dayOfWeek are required.' });
    }

    // Call FastAPI predict_next to get confidence and evidence
    const predRes = await predictNextForMember(user, hour, dayOfWeek);
    const confidence = predRes.confidenceScore;
    const evidence = predRes.supportingEvidence;
    const feat = predRes.feature_importances;

    // Generate human friendly sentence
    const explanationText = await explainService.generateActionExplanation(
      user,
      room,
      device,
      predRes.prediction,
      confidence,
      evidence,
      feat
    );

    res.json({
      userName: user,
      roomName: room,
      deviceName: device,
      prediction: predRes.prediction,
      confidence,
      evidence: explanationText,
      featureContributions: feat,
      decisionTimestamp: new Date()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 2. Explain automated action (using saved ExplainabilityRecord or generating on-the-fly)
exports.explainAction = async (req, res) => {
  try {
    const { decisionId } = req.params;
    let record = await ExplainabilityRecord.findOne({ decisionId });
    
    if (!record) {
      // Fallback: Generate it dynamically if not logged yet
      const decision = await PredictiveDecision.findById(decisionId);
      if (!decision) return res.status(404).json({ error: 'AI decision log not found.' });

      const explanationText = await explainService.generateActionExplanation(
        decision.userName,
        decision.roomName,
        decision.deviceName,
        decision.predictedAction,
        decision.confidenceScore,
        decision.reason,
        null // Use default equal contributions
      );

      record = await ExplainabilityRecord.create({
        homeId: decision.homeId,
        decisionId: decision._id,
        userName: decision.userName,
        roomName: decision.roomName,
        deviceName: decision.deviceName,
        prediction: decision.predictedAction,
        confidence: decision.confidenceScore,
        evidence: explanationText,
        featureContributions: { user: 20, room: 20, device: 20, time: 20, dayOfWeek: 20 },
        decisionTimestamp: decision.timestamp
      });
    }

    res.json(record);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 3. Explain mined routine
exports.explainRoutine = async (req, res) => {
  try {
    const { routineId } = req.params;
    const routine = await AIRoutine.findById(routineId);
    if (!routine) return res.status(404).json({ error: 'AI Routine not found.' });

    const explanationText = await explainService.generateRoutineExplanation(
      routine.routineName,
      routine.userName,
      routine.triggerTime,
      routine.triggerRoom,
      routine.predictedDevices
    );

    res.json({
      routineId,
      routineName: routine.routineName,
      userName: routine.userName,
      explanation: explanationText,
      confidence: routine.confidenceScore,
      devices: routine.predictedDevices,
      triggerTime: routine.triggerTime,
      triggerRoom: routine.triggerRoom
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 4. Explain family profile update
exports.explainProfileUpdate = async (req, res) => {
  try {
    const { memberId } = req.params;
    const member = await FamilyMember.findById(memberId);
    if (!member) return res.status(404).json({ error: 'Family member profile not found.' });

    // Fetch latest change from evaluation logs
    const latestLog = member.aiEvaluationLogs && member.aiEvaluationLogs.length > 0 
      ? member.aiEvaluationLogs[member.aiEvaluationLogs.length - 1] 
      : null;

    let changes = ['Comfort Preferences'];
    let summary = 'Observations of daily device usage times and room visits.';
    if (latestLog) {
      changes = latestLog.changesMade;
      summary = latestLog.summary;
    }

    const explanationText = await explainService.generateProfileExplanation(
      member.name,
      member.role,
      changes,
      summary
    );

    res.json({
      memberId,
      name: member.name,
      role: member.role,
      explanation: explanationText,
      changesMade: changes,
      summary,
      lastEvaluated: latestLog ? latestLog.evaluatedAt : member.lastAIEvaluationAt || member.updatedAt
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
