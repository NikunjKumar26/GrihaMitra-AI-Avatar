require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const homeRoutes = require('./routes/homeRoutes');
const familyRoutes = require('./routes/familyRoutes');
const historyRoutes = require('./routes/historyRoutes');
const learningRoutes = require('./routes/learningRoutes');
const avatarRoutes = require('./routes/avatarRoutes');
const Home = require('./models/Home');
const User = require('./models/User');
const Notification = require('./models/Notification'); // DB Integration for History
const FamilyMember = require('./models/FamilyMember');
const RoutineHistory = require('./models/RoutineHistory');
const EventHistory = require('./models/EventHistory');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT']
  },
  allowEIO3: true // Allow older clients (like ESP32 WebSockets library)
});

app.use(cors());
app.use(express.json());

// Attach socket.io instance to the express request object
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/home', homeRoutes);
app.use('/api/family', familyRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/learning', learningRoutes);
app.use('/api/avatar', avatarRoutes);

// MongoDB Connection
// Defaulting to MongoDB locally using env var
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sapnokaghar')
  .then(() => console.log('MongoDB Connected'))
  .catch((err) => console.log('MongoDB connection error:', err));

// WebSocket logic
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  socket.on('joinHome', ({ homeId }) => {
    socket.join(homeId);
    console.log(`Client joined home: ${homeId}`);
  });

  // Handle toggle requests
  socket.on('toggleDevice', async (data) => {
    const { homeId, roomId, deviceId, state, userName, userId } = data;
    
    try {
      const home = await Home.findById(homeId);
      if (home) {
        const room = home.rooms.id(roomId);
        if (room) {
          const device = room.devices.id(deviceId);
          if (device) {
            // Check for manual override of recent AI auto-execution (15-minute window)
            try {
              const PredictiveDecision = require('./models/PredictiveDecision');
              const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
              const contradictionAction = state ? 'OFF' : 'ON';
              const recentDecision = await PredictiveDecision.findOne({
                homeId,
                roomId,
                deviceId,
                result: 'Success',
                executedAction: contradictionAction,
                timestamp: { $gte: fifteenMinutesAgo },
                isOverride: { $ne: true }
              }).sort({ timestamp: -1 });

              if (recentDecision) {
                recentDecision.result = 'Manual Override';
                recentDecision.isOverride = true;
                recentDecision.overrideTime = new Date();
                recentDecision.reason = `User manually turned ${state ? 'ON' : 'OFF'} the device, overriding the AI's auto-${contradictionAction.toLowerCase()} trigger.`;
                await recentDecision.save();
                console.log(`[AI Override] Marked decision ${recentDecision._id} as Overridden by ${userName || 'User'}`);
              }
            } catch (overrideErr) {
              console.log('Error checking manual override in socket listener:', overrideErr.message);
            }

            // Generate precise Action String for DB
            const stateString = state ? 'ON' : 'OFF';
            const notifMsg = `🔔 ${userName} turned ${stateString} the ${device.name}`;
            
            // Fast Path: Immediately send transient popup to active clients
            io.to(homeId).emit('deviceUpdate', { roomId, deviceId, state });
            io.to(homeId).emit('notification', { _id: Date.now().toString(), id: Date.now(), actorName: userName, stateStr: stateString, deviceName: device.name, message: notifMsg, createdAt: new Date().toISOString() });

            // Apply DB Mutation and pause system for sync
            device.isOn = state;
            await home.save();
            
            // Step B: Save it permanently to the 24-hour log database
            await Notification.create({
              home: homeId,
              actorName: userName,
              message: notifMsg
            });

            // Log to RoutineHistory for family-aware intelligence
            try {
              let familyMember = await FamilyMember.findOne({ home: homeId, name: new RegExp(`^${userName}$`, 'i') });
              if (!familyMember) {
                familyMember = await FamilyMember.findOne({ home: homeId });
              }
              if (familyMember) {
                await RoutineHistory.create({
                  memberId: familyMember._id,
                  activity: `turned ${stateString} the ${device.name} in the ${room.name}`,
                  room: room.name,
                  device: device.name,
                  action: stateString
                });
              }
            } catch (historyErr) {
              console.log('Error logging family routine history:', historyErr.message);
            }

            // Log to EventHistory in the background for Phase 1 Event History System
            const logEventHistory = async () => {
              try {
                let resolvedUserId = userId || null;
                if (!resolvedUserId && userName) {
                  const familyMember = await FamilyMember.findOne({ home: homeId, name: new RegExp(`^${userName}$`, 'i') });
                  if (familyMember && familyMember.user) {
                    resolvedUserId = familyMember.user;
                  }
                }

                await EventHistory.create({
                  homeId,
                  roomId,
                  roomName: room.name,
                  userId: resolvedUserId,
                  userName: userName || 'System',
                  deviceId,
                  deviceName: device.name,
                  deviceType: device.type,
                  action: stateString,
                  source: 'MANUAL',
                  timestamp: new Date()
                });
              } catch (historyErr) {
                console.log('Error logging event history in background:', historyErr.message);
              }
            };

            // Run in the background (fire-and-forget) to keep actuation lightning fast
            logEventHistory();
          }
        }
      }
    } catch (err) {
      console.log('Error toggling device:', err.message);
    }
  });

  // Handle live temperature updates from Arduino
  socket.on('temperatureUpdate', (data) => {
    const { homeId, temperature } = data;
    // Broadcast the temperature to everyone connected to this home
    io.to(homeId).emit('temperatureUpdate', { temperature });
  });

  // Handle chat messages
  socket.on('sendChatMessage', async (data) => {
    const { homeId, senderId, senderName, text } = data;
    try {
      const Message = require('./models/Message');
      const newMessage = await Message.create({
        home: homeId,
        senderId,
        senderName,
        text
      });

      // Broadcast to everyone in the home
      io.to(homeId).emit('receiveChatMessage', newMessage);
    } catch (error) {
      console.log('Error sending chat message:', error.message);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Initialize the proactive speaking avatar scheduler
  const Agent = require('./agent');
  Agent.ProactiveDecisionEngine.initializeScheduler(io);
  
  // Start the background predictive automation loop (runs every 5 minutes)
  const learningController = require('./controllers/learningController');
  setInterval(async () => {
    try {
      console.log('🤖 [Background AI Loop] Evaluating predictive automation across all homes...');
      const Home = require('./models/Home');
      const homes = await Home.find({});
      for (const home of homes) {
        await learningController.evaluateAutomation(home._id, io);
      }
    } catch (err) {
      console.error('[Background AI Loop Error]:', err.message);
    }
  }, 5 * 60 * 1000); // 5 minutes
});

// Trigger nodemon restart after port cleanup
