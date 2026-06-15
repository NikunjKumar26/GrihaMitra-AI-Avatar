const mongoose = require('mongoose');
const EventHistory = require('../models/EventHistory');
const Home = require('../models/Home');

// Helper to extract pagination and date filter queries
const getQueryFilters = (req) => {
  const { startDate, endDate } = req.query;
  const filter = {};

  if (startDate || endDate) {
    filter.timestamp = {};
    if (startDate) filter.timestamp.$gte = new Date(startDate);
    if (endDate) filter.timestamp.$lte = new Date(endDate);
  }

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  return { filter, page, limit, skip };
};

// Helper to check user access to a specific home
const checkHomeAccess = async (userId, homeId) => {
  const home = await Home.findOne({
    _id: homeId,
    $or: [
      { owner: userId },
      { 'members.user': userId, 'members.status': 'approved' }
    ]
  });
  return !!home;
};

// Helper to check user access to target user's history
const checkUserAccess = async (reqUserId, targetUserId) => {
  if (reqUserId.toString() === targetUserId.toString()) return true;

  // Check if reqUserId is the owner of a home containing targetUserId
  const isOwner = await Home.exists({
    owner: reqUserId,
    'members.user': targetUserId
  });
  if (isOwner) return true;

  // Check if reqUserId is an approved admin of a home containing targetUserId
  const isAdmin = await Home.exists({
    'members.user': reqUserId,
    'members.role': 'admin',
    'members.status': 'approved',
    $or: [
      { owner: targetUserId },
      { 'members.user': targetUserId }
    ]
  });
  return !!isAdmin;
};

// 1. Fetch Complete Home History
exports.getHomeHistory = async (req, res) => {
  try {
    const { homeId } = req.params;
    
    const hasAccess = await checkHomeAccess(req.user.id, homeId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this smart home history.' });
    }

    const { filter, page, limit, skip } = getQueryFilters(req);
    filter.homeId = homeId;

    // Filter by room, device, or user if provided in query strings
    if (req.query.roomId) filter.roomId = req.query.roomId;
    if (req.query.deviceId) filter.deviceId = req.query.deviceId;
    if (req.query.userId) filter.userId = req.query.userId;
    if (req.query.source) filter.source = req.query.source;

    const events = await EventHistory.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    const total = await EventHistory.countDocuments(filter);

    res.json({
      events,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalEvents: total
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 2. Fetch User History
exports.getUserHistory = async (req, res) => {
  try {
    const { userId } = req.params;

    const hasAccess = await checkUserAccess(req.user.id, userId);
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this member history.' });
    }

    const { filter, page, limit, skip } = getQueryFilters(req);
    filter.userId = userId;

    if (req.query.roomId) filter.roomId = req.query.roomId;
    if (req.query.deviceId) filter.deviceId = req.query.deviceId;

    const events = await EventHistory.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    const total = await EventHistory.countDocuments(filter);

    res.json({
      events,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalEvents: total
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 3. Fetch Room History
exports.getRoomHistory = async (req, res) => {
  try {
    const { roomId } = req.params;

    // Find home containing this room
    const home = await Home.findOne({ 'rooms._id': roomId });
    if (!home) {
      return res.status(404).json({ error: 'Room not found.' });
    }

    // Auth check
    const hasAccess = home.owner.toString() === req.user.id ||
      home.members.some(m => m.user && m.user.toString() === req.user.id && m.status === 'approved');
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this room history.' });
    }

    const { filter, page, limit, skip } = getQueryFilters(req);
    filter.roomId = roomId;

    if (req.query.deviceId) filter.deviceId = req.query.deviceId;
    if (req.query.userId) filter.userId = req.query.userId;

    const events = await EventHistory.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    const total = await EventHistory.countDocuments(filter);

    res.json({
      events,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalEvents: total
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 4. Fetch Device History
exports.getDeviceHistory = async (req, res) => {
  try {
    const { deviceId } = req.params;

    // Find home containing this device
    const home = await Home.findOne({ 'rooms.devices._id': deviceId });
    if (!home) {
      return res.status(404).json({ error: 'Device not found.' });
    }

    // Auth check
    const hasAccess = home.owner.toString() === req.user.id ||
      home.members.some(m => m.user && m.user.toString() === req.user.id && m.status === 'approved');
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied to this device history.' });
    }

    const { filter, page, limit, skip } = getQueryFilters(req);
    filter.deviceId = deviceId;

    if (req.query.userId) filter.userId = req.query.userId;

    const events = await EventHistory.find(filter)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(limit);

    const total = await EventHistory.countDocuments(filter);

    res.json({
      events,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalEvents: total
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// 5. Fetch Analytics
exports.getAnalytics = async (req, res) => {
  try {
    let homeId = req.params.homeId;

    // Resolve user's home if homeId is not specified
    if (!homeId) {
      const home = await Home.findOne({
        $or: [
          { owner: req.user.id },
          { 'members.user': req.user.id, 'members.status': 'approved' }
        ]
      });
      if (!home) {
        return res.status(404).json({ error: 'No associated smart home found.' });
      }
      homeId = home._id;
    } else {
      // Validate access to requested homeId
      const hasAccess = await checkHomeAccess(req.user.id, homeId);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied to this smart home analytics.' });
      }
    }

    // 1. Total events
    const totalEvents = await EventHistory.countDocuments({ homeId });

    // 2. Most active user
    const activeUsers = await EventHistory.aggregate([
      { $match: { homeId: new mongoose.Types.ObjectId(homeId) } },
      { $group: { _id: '$userId', userName: { $first: '$userName' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);
    const mostActiveUser = activeUsers.length > 0 ? { userId: activeUsers[0]._id, userName: activeUsers[0].userName, count: activeUsers[0].count } : null;

    // 3. Most active room
    const activeRooms = await EventHistory.aggregate([
      { $match: { homeId: new mongoose.Types.ObjectId(homeId) } },
      { $group: { _id: '$roomId', roomName: { $first: '$roomName' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);
    const mostActiveRoom = activeRooms.length > 0 ? { roomId: activeRooms[0]._id, roomName: activeRooms[0].roomName, count: activeRooms[0].count } : null;

    // 4. Most frequently used device
    const activeDevices = await EventHistory.aggregate([
      { $match: { homeId: new mongoose.Types.ObjectId(homeId) } },
      { $group: { _id: '$deviceId', deviceName: { $first: '$deviceName' }, deviceType: { $first: '$deviceType' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 }
    ]);
    const mostUsedDevice = activeDevices.length > 0 ? { deviceId: activeDevices[0]._id, deviceName: activeDevices[0].deviceName, deviceType: activeDevices[0].deviceType, count: activeDevices[0].count } : null;

    // 5. Daily activity count (past 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dailyLogs = await EventHistory.aggregate([
      { $match: { homeId: new mongoose.Types.ObjectId(homeId), timestamp: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Fill in dates with zero events in the last 7 days for visual continuity
    const dailyActivity = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const found = dailyLogs.find(log => log._id === dateStr);
      dailyActivity.push({
        date: dateStr,
        dayOfWeek: d.toLocaleDateString('en-US', { weekday: 'long' }),
        count: found ? found.count : 0
      });
    }

    // 6. Weekly activity count (past 4 weeks)
    const weeklyActivity = [];
    for (let i = 3; i >= 0; i--) {
      const startOfWeek = new Date();
      // Monday of the week i weeks ago
      startOfWeek.setDate(startOfWeek.getDate() - (startOfWeek.getDay() || 7) - (i * 7) + 1);
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      const count = await EventHistory.countDocuments({
        homeId,
        timestamp: { $gte: startOfWeek, $lte: endOfWeek }
      });

      const label = `${startOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endOfWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      weeklyActivity.push({
        weekLabel: label,
        count
      });
    }

    // 7. Activity by Day of Week (All-time helper)
    const dayOfWeekLogs = await EventHistory.aggregate([
      { $match: { homeId: new mongoose.Types.ObjectId(homeId) } },
      { $group: { _id: '$dayOfWeek', count: { $sum: 1 } } }
    ]);
    const dayOfWeekOrder = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekdayActivity = dayOfWeekOrder.map(day => {
      const found = dayOfWeekLogs.find(log => log._id === day);
      return {
        day,
        count: found ? found.count : 0
      };
    });

    res.json({
      homeId,
      totalEvents,
      mostActiveUser,
      mostActiveRoom,
      mostUsedDevice,
      dailyActivity,
      weeklyActivity,
      weekdayActivity
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
