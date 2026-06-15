const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Home = require('../models/Home');
const User = require('../models/User');
const FamilyMember = require('../models/FamilyMember');
const VoiceHistory = require('../models/VoiceHistory');
const ConversationSession = require('../models/ConversationSession');
const QueueMetrics = require('../models/QueueMetrics');
const queueService = require('../services/queueService');
const familyController = require('../controllers/familyController');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sapnokaghar';

// Helper mock response
const mockResponse = () => {
  const res = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.jsonData = data;
    return res;
  };
  res.setHeader = (name, value) => {
    res.headers = res.headers || {};
    res.headers[name] = value;
  };
  return res;
};

// Helper mock Socket.IO
const mockSocketIO = () => {
  const io = {
    emissions: [],
    to: (room) => {
      return {
        emit: (event, data) => {
          io.emissions.push({ room, event, data });
        }
      };
    }
  };
  return io;
};

async function runTests() {
  console.log('Connecting to MongoDB at:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB Connected.');

  // Clean old logs
  console.log('Cleaning up previous test data...');
  await VoiceHistory.deleteMany({});
  await ConversationSession.deleteMany({});
  await FamilyMember.deleteMany({});
  await QueueMetrics.deleteMany({});

  // Find or create test owner
  let user = await User.findOne({ email: 'owner@example.com' });
  if (!user) {
    user = await User.create({
      name: 'Nikunj Owner',
      email: 'owner@example.com',
      password: 'dummy_hash_password',
      role: 'Owner',
      isVerified: true
    });
  }

  // Find or create test home
  let home = await Home.findOne({ owner: user._id });
  if (!home) {
    home = await Home.create({
      owner: user._id,
      houseName: 'Sapno Ka Ghar Test',
      uniqueHomeName: 'SapnoKaGhar_TestRoom',
      homeCode: '1234',
      rooms: [
        {
          name: 'Study Room',
          devices: [{ name: 'Study Light', type: 'light', isOn: false }],
          automationEnabled: true
        },
        {
          name: 'Bedroom',
          devices: [{ name: 'Bedroom AC', type: 'ac', isOn: false }],
          automationEnabled: true
        }
      ]
    });
  } else {
    home.rooms.forEach(r => {
      r.devices.forEach(d => { d.isOn = false; });
    });
    await home.save();
  }

  const homeId = home._id;

  // Create student profile
  const student = await FamilyMember.create({
    home: homeId,
    name: 'Nikunj Student',
    role: 'Student',
    preferredLanguage: 'English',
    voiceProfile: 'Joanna'
  });

  const baseReq = {
    user: { id: user._id.toString() },
    io: mockSocketIO()
  };

  console.log('\n=========================================');
  console.log('TEST 1: Faster-Whisper local offline transcription...');
  console.log('=========================================');
  const whisperService = require('../services/whisperService');
  const sttResult = await whisperService.transcribeSpeech({ mockText: 'Turn ON the Bedroom AC' });
  console.log('Transcript:', sttResult.text);
  console.log('Confidence:', sttResult.confidence, '%');
  console.log('Language detected:', sttResult.language);
  console.log('Processing time:', sttResult.processingTime, 'ms');

  if (sttResult.text !== 'Turn ON the Bedroom AC') {
    throw new Error('FAIL: Whisper transcription output text does not match mockText');
  }

  console.log('\n=========================================');
  console.log('TEST 2: Dialogue Caching and Amazon Bedrock Conversation Summarizer...');
  console.log('=========================================');
  // Seed a conversation session with 18 messages (9 turns)
  const sessionId = 'dialogue_summary_test_session';
  let session = await ConversationSession.create({
    sessionId,
    homeId,
    user: 'Nikunj Student',
    messages: Array.from({ length: 18 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `Dialogue line number ${i + 1}`
    })),
    totalMessages: 18
  });

  console.log('Initial messages in session:', session.messages.length);

  // Send a command to reach 20 messages, which should trigger conversation summary
  const cmdReq = {
    ...baseReq,
    body: { text: 'Turn ON the AC', memberName: 'Nikunj Student', sessionId }
  };
  const cmdRes = mockResponse();
  await familyController.voiceCommand(cmdReq, cmdRes);

  // Reload session from DB
  const updatedSession = await ConversationSession.findOne({ sessionId });
  console.log('Total messages count tracked:', updatedSession.totalMessages);
  console.log('Pruned messages count in session:', updatedSession.messages.length);
  console.log('Generated Summary:', updatedSession.conversationSummary);

  if (updatedSession.messages.length > 6) {
    throw new Error(`FAIL: Messages array not pruned. Length should be <= 6, got ${updatedSession.messages.length}`);
  }
  if (!updatedSession.conversationSummary) {
    throw new Error('FAIL: Conversation summary was not generated');
  }

  console.log('\n=========================================');
  console.log('TEST 3: Queue Metrics telemetry tracking...');
  console.log('=========================================');
  const metrics = await QueueMetrics.find({});
  console.log('Tracked queues count:', metrics.length);
  metrics.forEach(m => {
    console.log(`- Queue: ${m.queue} | Processed: ${m.jobsProcessed} | Latency: ${m.averageProcessingTime} ms`);
  });

  if (metrics.length === 0) {
    throw new Error('FAIL: No queue metrics saved in database');
  }

  console.log('\n=========================================');
  console.log('TEST 4: Redis production mode enforcement...');
  console.log('=========================================');
  // Simulate Production Mode
  process.env.NODE_ENV = 'production';
  console.log('Enforcing NODE_ENV = production');

  let prodError = null;
  try {
    // Should throw error if Redis is offline
    await queueService.dispatchVoicePipeline({
      text: 'Hello',
      memberName: 'Nikunj Student',
      sessionId: 'prod_test_session',
      homeId
    }, baseReq.io);
  } catch (err) {
    prodError = err;
    console.log('Successfully blocked execution in production mode:', err.message);
  }

  // Reset NODE_ENV
  process.env.NODE_ENV = 'development';

  if (!prodError) {
    throw new Error('FAIL: System did not block execution or throw error in production mode when Redis was offline');
  }

  console.log('\n=========================================');
  console.log('TEST 5: Upgraded Dashboard Telemetry Analytics endpoint...');
  console.log('=========================================');
  const dashRes = mockResponse();
  await familyController.getVoiceDashboard(baseReq, dashRes);

  console.log('Dashboard stats:');
  console.log('  Redis Status:', dashRes.jsonData?.analytics?.redisStatus);
  console.log('  Summary count:', dashRes.jsonData?.analytics?.summaryGenerationCount);
  console.log('  Queue metrics length:', dashRes.jsonData?.analytics?.queueMetrics?.length);

  if (dashRes.jsonData?.analytics?.redisStatus !== 'offline') {
    throw new Error(`FAIL: Redis should be reported as offline`);
  }
  if (dashRes.jsonData?.analytics?.summaryGenerationCount !== 1) {
    throw new Error(`FAIL: Expected 1 summary count, got ${dashRes.jsonData?.analytics?.summaryGenerationCount}`);
  }

  console.log('\n=========================================');
  console.log('SUCCESS: All production-readiness Voice Assistant tests passed!');
  console.log('=========================================');

  await mongoose.connection.close();
}

runTests().catch(err => {
  console.error('Production voice tests failed:', err);
  mongoose.connection.close();
  process.exit(1);
});
