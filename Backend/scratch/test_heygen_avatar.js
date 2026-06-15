const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Home = require('../models/Home');
const User = require('../models/User');
const FamilyMember = require('../models/FamilyMember');
const AvatarMemory = require('../models/AvatarMemory');
const AvatarAnalytics = require('../models/AvatarAnalytics');
const avatarController = require('../controllers/avatarController');
const avatarMemoryService = require('../services/avatarMemoryService');
const emotionEngine = require('../services/emotionEngine');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sapnokaghar';

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

async function testHeygenAvatar() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB.');

  // Clean old test objects
  await AvatarMemory.deleteMany({ user: 'TestHeygenUser' });
  await AvatarAnalytics.deleteMany({});
  await FamilyMember.deleteMany({ name: 'TestHeygenUser' });

  // Get or create test user
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

  // Get or create test home
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

  // Create test family member (Grandmother)
  const familyMember = await FamilyMember.create({
    home: homeId,
    name: 'TestHeygenUser',
    role: 'Grandmother',
    preferredLanguage: 'Hindi',
    voiceProfile: 'Aditi'
  });

  console.log('\n--- 1. Testing HeyGen Session Creation Endpoint ---');
  let req = {
    user: { id: user._id.toString() },
    body: { quality: 'medium', avatarName: 'Bryan_FitnessCoach_public', memberName: 'TestHeygenUser' }
  };
  let res = mockResponse();

  await avatarController.createSession(req, res);
  console.log('Create Session Result:', res.jsonData);
  if (!res.jsonData.success || !res.jsonData.sessionId || !res.jsonData.sdp) {
    throw new Error('FAIL: Create session endpoint response structure is invalid.');
  }
  const sessionId = res.jsonData.sessionId;
  const isMock = res.jsonData.isMock;
  console.log('SUCCESS: Create Session returned Session ID:', sessionId, 'isMock:', isMock);

  console.log('\n--- 2. Testing HeyGen Start Session Endpoint ---');
  req = {
    user: { id: user._id.toString() },
    body: { sessionId, sdp: { type: 'answer', sdp: 'v=0\no=- 1234 2 IN IP4 127.0.0.1...' } }
  };
  res = mockResponse();
  await avatarController.startSession(req, res);
  console.log('Start Session Result:', res.jsonData);
  if (!res.jsonData.success) {
    throw new Error('FAIL: Start session endpoint returned failure status.');
  }
  console.log('SUCCESS: Start Session completed successfully.');

  console.log('\n--- 3. Testing Emotion mapping rules from emotionEngine ---');
  const contextNormal = emotionEngine.determineEmotion({ text: 'The water tank capacity is optimal.', query: 'What is the level?' });
  console.log('Emotion Normal context:', contextNormal);
  if (contextNormal.emotionState !== 'Normal' || contextNormal.avatarState !== 'Speaking') {
    throw new Error('FAIL: Normal emotion mapping is incorrect.');
  }

  const contextAlert = emotionEngine.determineEmotion({ alertType: 'security', text: 'Intrusion Alert near the Balcony!' });
  console.log('Emotion Alert context:', contextAlert);
  if (contextAlert.emotionState !== 'Alert' || contextAlert.avatarState !== 'Alerting') {
    throw new Error('FAIL: Security Alert emotion mapping is incorrect.');
  }

  const contextConcern = emotionEngine.determineEmotion({ alertType: 'water_tank', text: 'Water level is critically low.' });
  console.log('Emotion Concern context:', contextConcern);
  if (contextConcern.emotionState !== 'Concerned' || contextConcern.avatarState !== 'Alerting') {
    throw new Error('FAIL: Low water level emotion mapping is incorrect.');
  }
  console.log('SUCCESS: Emotion mapping rules verified.');

  console.log('\n--- 4. Testing Speak / Dialogue Pipeline ---');
  req = {
    user: { id: user._id.toString() },
    body: {
      text: "Is everything safe in the balcony area?",
      sessionId: sessionId,
      memberName: "TestHeygenUser",
      runBedrock: false // using offline mock templates
    }
  };
  res = mockResponse();
  await avatarController.speak(req, res);
  console.log('Speak Result:', res.jsonData);
  if (!res.jsonData.text || !res.jsonData.emotionState || !res.jsonData.avatarState) {
    throw new Error('FAIL: Speak endpoint output is invalid.');
  }
  console.log('SUCCESS: Dialogue processing completed.');

  console.log('\n--- 5. Asserting Memory persists in DB ---');
  const memoryLogs = await AvatarMemory.find({ user: 'TestHeygenUser' });
  console.log('Persisted memory counts:', memoryLogs.length);
  if (memoryLogs.length === 0) {
    throw new Error('FAIL: Avatar Memory was not persisted.');
  }
  console.log('Memory question:', memoryLogs[0].question);
  console.log('Memory answer:', memoryLogs[0].avatarResponse);
  console.log('SUCCESS: AvatarMemory persists successfully.');

  console.log('\n--- 6. Testing Semantic Memory Recall & Summarizer ---');
  const summaryText = await avatarMemoryService.summarizePastInteractions(homeId, 'TestHeygenUser', 'What did you say yesterday?');
  console.log('Semantic summary response:', summaryText);
  if (!summaryText) {
    throw new Error('FAIL: Summarizer returned empty context.');
  }
  console.log('SUCCESS: Semantic summaries compiled successfully.');

  console.log('\n--- 7. Asserting Long-term Telemetry Analytics update ---');
  const analyticsData = await AvatarAnalytics.findOne({ homeId });
  console.log('Compiled Analytics:', analyticsData);
  if (!analyticsData || analyticsData.totalConversations !== 1 || analyticsData.mostActiveUser !== 'TestHeygenUser') {
    throw new Error('FAIL: Telemetry analytics were not compiled.');
  }
  console.log('SUCCESS: Analytics compiled successfully.');

  console.log('\n--- 8. Testing Session stop endpoint ---');
  req = {
    user: { id: user._id.toString() },
    body: { sessionId }
  };
  res = mockResponse();
  await avatarController.stopSession(req, res);
  console.log('Stop Session Result:', res.jsonData);
  if (!res.jsonData.success) {
    throw new Error('FAIL: Stop session endpoint failed.');
  }
  console.log('SUCCESS: HeyGen session terminated.');

  // Cleanup
  await AvatarMemory.deleteMany({ user: 'TestHeygenUser' });
  await AvatarAnalytics.deleteMany({});
  await FamilyMember.deleteMany({ name: 'TestHeygenUser' });

  console.log('\n=========================================');
  console.log('🎉 ALL HEYGEN INTEGRATION TESTS PASSED 🎉');
  console.log('=========================================');
}

testHeygenAvatar()
  .then(() => {
    mongoose.connection.close();
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Test execution failed:', err);
    mongoose.connection.close();
    process.exit(1);
  });
