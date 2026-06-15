const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Home = require('../models/Home');
const User = require('../models/User');
const FamilyMember = require('../models/FamilyMember');
const AvatarMemory = require('../models/AvatarMemory');
const ConversationSession = require('../models/ConversationSession');
const PredictiveDecision = require('../models/PredictiveDecision');
const ExplainabilityRecord = require('../models/ExplainabilityRecord');
const avatarController = require('../controllers/avatarController');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sapnokaghar';

// Mock response object helper
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
  return res;
};

// Mock Socket.IO instance
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

async function runAvatarTests() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  // Clean old test objects
  await AvatarMemory.deleteMany({});
  await FamilyMember.deleteMany({ name: { $in: ['GrandmotherDadi', 'StudentNikki', 'ParentPapa'] } });
  
  // Find or create test owner user
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
          name: 'Living Room',
          devices: [
            { name: 'Living Room Light', type: 'light', isOn: false }
          ]
        }
      ]
    });
  }

  const homeId = home._id;

  // Seeding Family Profiles
  console.log('\n--- Seeding Family Profiles for personalities ---');
  const grandmother = await FamilyMember.create({
    home: homeId,
    name: 'GrandmotherDadi',
    role: 'Grandmother',
    preferredLanguage: 'Hindi',
    voiceProfile: 'Aditi'
  });
  const student = await FamilyMember.create({
    home: homeId,
    name: 'StudentNikki',
    role: 'Student',
    preferredLanguage: 'English',
    voiceProfile: 'Joanna'
  });
  const parent = await FamilyMember.create({
    home: homeId,
    name: 'ParentPapa',
    role: 'Father',
    preferredLanguage: 'English',
    voiceProfile: 'Kendra'
  });

  // Seeding Predictive decisions & Explanations to verify context aggregation
  await PredictiveDecision.create({
    homeId,
    userName: 'Nikunj Owner',
    roomId: home.rooms[0]._id,
    roomName: 'Living Room',
    deviceId: home.rooms[0].devices[0]._id,
    deviceName: 'Living Room Light',
    deviceType: 'light',
    actionType: 'ON',
    predictedAction: 'Turn ON Living Room Light',
    confidenceScore: 94,
    reason: 'Observed 28 similar actions during the last 30 days.',
    result: 'Success',
    timestamp: new Date()
  });

  await ExplainabilityRecord.create({
    homeId,
    userName: 'Nikunj Owner',
    roomName: 'Living Room',
    deviceName: 'Living Room Light',
    prediction: 'Turn ON Living Room Light',
    confidence: 94,
    evidence: 'Observed 28 similar actions during the last 30 days around this time.',
    featureContributions: { user: 30, room: 20, device: 20, time: 20, dayOfWeek: 10 },
    decisionTimestamp: new Date()
  });

  console.log('Seeded home context successfully.');

  // =========================================
  // TEST 1: Grandmother Mode Interaction (Hindi/Hinglish, Slower speed 0.75x)
  // =========================================
  console.log('\n=========================================');
  console.log('TEST 1: Grandmother Mode Personality Switching');
  console.log('=========================================');
  const grannyReq = {
    user: { id: user._id.toString() },
    body: {
      text: "Turn on Mandir Light",
      memberName: 'GrandmotherDadi',
      sessionId: 'session_granny_avatar'
    },
    io: mockSocketIO()
  };
  const grannyRes = mockResponse();

  await avatarController.interact(grannyReq, grannyRes);
  console.log('Grandmother Response Text:', grannyRes.jsonData.text);
  console.log('Voice Settings:', grannyRes.jsonData.voice, '| Speed Rate:', grannyRes.jsonData.speedRate);
  console.log('Language Detected:', grannyRes.jsonData.language);
  console.log('Emotion State:', grannyRes.jsonData.emotionState);

  if (grannyRes.jsonData.voice !== 'Aditi' || grannyRes.jsonData.speedRate !== 'slow') {
    throw new Error('FAIL: Grandmother voice profile or speed rate incorrect!');
  }
  console.log('SUCCESS: Grandmother mode speech parameters set correctly.');

  // =========================================
  // TEST 2: Student Mode Interaction (Energetic English, study assist)
  // =========================================
  console.log('\n=========================================');
  console.log('TEST 2: Student Mode Personality Switching');
  console.log('=========================================');
  const studentReq = {
    user: { id: user._id.toString() },
    body: {
      text: "Help me with my exam preparation routine",
      memberName: 'StudentNikki',
      sessionId: 'session_student_avatar'
    },
    io: mockSocketIO()
  };
  const studentRes = mockResponse();

  await avatarController.interact(studentReq, studentRes);
  console.log('Student Response Text:', studentRes.jsonData.text);
  console.log('Voice Settings:', studentRes.jsonData.voice, '| Speed Rate:', studentRes.jsonData.speedRate);
  console.log('Emotion State:', studentRes.jsonData.emotionState);

  if (studentRes.jsonData.voice !== 'Joanna' || studentRes.jsonData.speedRate !== 'medium') {
    throw new Error('FAIL: Student voice profile or speed rate incorrect!');
  }
  console.log('SUCCESS: Student mode speech parameters set correctly.');

  // =========================================
  // TEST 3: Parent Mode Interaction (Formal, direct)
  // =========================================
  console.log('\n=========================================');
  console.log('TEST 3: Parent Mode Personality Switching');
  console.log('=========================================');
  const parentReq = {
    user: { id: user._id.toString() },
    body: {
      text: "Give me the status of water pump",
      memberName: 'ParentPapa',
      sessionId: 'session_parent_avatar'
    },
    io: mockSocketIO()
  };
  const parentRes = mockResponse();

  await avatarController.interact(parentReq, parentRes);
  console.log('Parent Response Text:', parentRes.jsonData.text);
  console.log('Voice Settings:', parentRes.jsonData.voice, '| Speed Rate:', parentRes.jsonData.speedRate);
  console.log('Emotion State:', parentRes.jsonData.emotionState);

  if (parentRes.jsonData.voice !== 'Kendra' || parentRes.jsonData.speedRate !== 'medium') {
    throw new Error('FAIL: Parent voice profile or speed rate incorrect!');
  }
  console.log('SUCCESS: Parent mode speech parameters set correctly.');

  // =========================================
  // TEST 4: Emotion & State Heuristics
  // =========================================
  console.log('\n=========================================');
  console.log('TEST 4: Emotion Engine sentiment classification');
  console.log('=========================================');
  // Trigger Concerned alert
  const alertTestReq = {
    user: { id: user._id.toString() },
    body: {
      text: "Why did you turn on the water motor?",
      memberName: 'ParentPapa',
      sessionId: 'session_parent_avatar'
    },
    io: mockSocketIO()
  };
  const alertTestRes = mockResponse();
  await avatarController.interact(alertTestReq, alertTestRes);
  console.log('Explanation Query Emotion:', alertTestRes.jsonData.emotionState, '| State:', alertTestRes.jsonData.avatarState);
  if (alertTestRes.jsonData.avatarState !== 'Explaining') {
    throw new Error(`FAIL: Unexpected state for explanation query: expected Explaining, got ${alertTestRes.jsonData.avatarState}`);
  }
  console.log('SUCCESS: State resolved correctly to Explaining.');

  // =========================================
  // TEST 5: Proactive Verbal Notification Synthesis
  // =========================================
  console.log('\n=========================================');
  console.log('TEST 5: Proactive Notification announcements');
  console.log('=========================================');
  const ioMock = mockSocketIO();
  const alertReq = {
    user: { id: user._id.toString() },
    body: {
      alertType: 'security'
    },
    io: ioMock
  };
  const alertRes = mockResponse();

  await avatarController.proactiveNotification(alertReq, alertRes);
  console.log('Notification synthesized text:', alertRes.jsonData.text);
  console.log('Notification Emotion State:', alertRes.jsonData.emotionState, '| State:', alertRes.jsonData.avatarState);

  if (alertRes.jsonData.emotionState !== 'Alert' || alertRes.jsonData.avatarState !== 'Alerting') {
    throw new Error('FAIL: Proactive notification did not classify alert state correctly!');
  }
  // Check socket broadcast
  const emission = ioMock.emissions.find(e => e.event === 'avatarAlert');
  if (!emission || emission.data.alertType !== 'security') {
    throw new Error('FAIL: Socket event "avatarAlert" was not broadcasted!');
  }
  console.log('SUCCESS: Proactive notification and socket emissions validated successfully.');

  // =========================================
  // TEST 6: Avatar Dashboard Memory & Analytics
  // =========================================
  console.log('\n=========================================');
  console.log('TEST 6: Avatar Memory & Analytics queries');
  console.log('=========================================');
  // Get Memory
  const memReq = { user: { id: user._id.toString() } };
  const memRes = mockResponse();
  await avatarController.getMemory(memReq, memRes);
  console.log('Fetched memory logs count:', memRes.jsonData.length);
  if (memRes.jsonData.length < 3) {
    throw new Error('FAIL: Avatar Memory logs were not recorded successfully in MongoDB!');
  }

  // Get Analytics
  const analReq = { user: { id: user._id.toString() } };
  const analRes = mockResponse();
  await avatarController.getAnalytics(analReq, analRes);
  console.log('Analytics satisfactionScore:', analRes.jsonData.satisfactionScore + '%');
  console.log('Conversations count:', analRes.jsonData.totalConversations);
  console.log('Residents counts details:', analRes.jsonData.conversationsPerUser);
  console.log('Language distribution shares:', analRes.jsonData.languageDistribution);

  if (analRes.jsonData.totalConversations !== memRes.jsonData.length) {
    throw new Error('FAIL: Analytics counts do not match memory database length!');
  }
  console.log('SUCCESS: Analytics aggregation and database verification complete.');

  // Clean up
  await AvatarMemory.deleteMany({});
  await FamilyMember.deleteMany({ name: { $in: ['GrandmotherDadi', 'StudentNikki', 'ParentPapa'] } });

  console.log('\n=========================================');
  console.log('🎉 ALL GrihaMitra AI AVATAR TESTS PASSED 🎉');
  console.log('=========================================');
}

runAvatarTests()
  .then(() => {
    mongoose.connection.close();
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Test runner failed:', err);
    mongoose.connection.close();
    process.exit(1);
  });
