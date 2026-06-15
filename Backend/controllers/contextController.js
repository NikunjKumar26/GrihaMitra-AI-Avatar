const FamilyMember = require('../models/FamilyMember');
const EventHistory = require('../models/EventHistory');
const mongoose = require('mongoose');
const Agent = require('../agent');

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

// 1. Sync Event History insights and Get Profile
exports.syncAndGetContext = async (req, res) => {
  try {
    const { memberId } = req.params;
    const mockDays = req.query.mockDays ? parseInt(req.query.mockDays) : null;
    const forceEvaluate = req.query.forceEvaluate === 'true';

    const result = await Agent.ContextEngine.syncAndGetContext(memberId, mockDays, forceEvaluate);

    // Calculate modification counters
    let nextModificationInDays = 10;
    if (result.member.aiMode === 'Learning') {
      nextModificationInDays = 10 - result.daysElapsed;
    } else if (result.member.lastAIEvaluationAt) {
      const msSinceLastEval = Date.now() - new Date(result.member.lastAIEvaluationAt).getTime();
      const realDaysSinceLastEval = Math.floor(msSinceLastEval / (1000 * 60 * 60 * 24));
      nextModificationInDays = 10 - (realDaysSinceLastEval % 10);
    }

    const responseData = result.member.toObject();
    responseData.daysElapsed = result.daysElapsed;
    responseData.nextModificationInDays = Math.max(0, nextModificationInDays);
    responseData.realDaysElapsed = result.realDaysElapsed;
    responseData.databaseTimeSpanDays = result.databaseTimeSpanDays;

    res.json(responseData);
  } catch (error) {
    if (error.message === 'Family member profile not found.') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
};


// 2. Update Context Preferences
exports.updateContext = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { name, role, preferredLanguage, voiceProfile, routineProfile, activeHours, preferences } = req.body;

    const member = await FamilyMember.findById(memberId);
    if (!member) {
      return res.status(404).json({ error: 'Family member profile not found.' });
    }

    if (name) member.name = name;
    if (role) member.role = role;
    if (preferredLanguage) member.preferredLanguage = preferredLanguage;
    if (voiceProfile) member.voiceProfile = voiceProfile;
    if (routineProfile) member.routineProfile = routineProfile;
    if (activeHours) member.activeHours = activeHours;
    if (preferences) {
      member.preferences = { ...member.preferences, ...preferences };
    }

    await member.save();
    res.json(member);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 3. Get Room Frequency list
exports.getActiveRooms = async (req, res) => {
  try {
    const { memberId } = req.params;
    const member = await FamilyMember.findById(memberId);
    if (!member) {
      return res.status(404).json({ error: 'Family member profile not found.' });
    }

    const matchQuery = getMemberQuery(member);
    const rooms = await EventHistory.aggregate([
      { $match: matchQuery },
      { $group: { _id: '$roomName', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json(rooms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 4. Get Device Frequency list
exports.getFrequentDevices = async (req, res) => {
  try {
    const { memberId } = req.params;
    const member = await FamilyMember.findById(memberId);
    if (!member) {
      return res.status(404).json({ error: 'Family member profile not found.' });
    }

    const matchQuery = getMemberQuery(member);
    const devices = await EventHistory.aggregate([
      { $match: matchQuery },
      { $group: { _id: '$deviceName', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 5. Get Personalized Activity Summary (Generates habit routine descriptions)
exports.getPersonalizedSummary = async (req, res) => {
  try {
    const { memberId } = req.params;
    const member = await FamilyMember.findById(memberId);
    if (!member) {
      return res.status(404).json({ error: 'Family member profile not found.' });
    }

    const matchQuery = getMemberQuery(member);
    const logs = await EventHistory.find(matchQuery)
      .sort({ timestamp: -1 })
      .limit(20);

    const summary = await Agent.ContextEngine.generatePersonalizedSummary(member, logs);

    res.json({ summary });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
