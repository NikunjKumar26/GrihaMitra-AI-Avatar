const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Home = require('../models/Home');
const User = require('../models/User');
const FamilyMember = require('../models/FamilyMember');
const VoiceHistory = require('../models/VoiceHistory');
const ConversationSession = require('../models/ConversationSession');
const QueueMetrics = require('../models/QueueMetrics');
const whisperService = require('../services/whisperService');
const queueService = require('../services/queueService');
const familyController = require('../controllers/familyController');

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

async function testAvatarReadiness() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB.');

  // Clean old test objects
  await VoiceHistory.deleteMany({ user: 'TestAvatarUser' });
  await ConversationSession.deleteMany({ user: 'TestAvatarUser' });
  await FamilyMember.deleteMany({ name: 'TestAvatarUser' });
  await QueueMetrics.deleteMany({});

  // Fetch or create user
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

  // Fetch or create home
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

  // 1. Seed Family Member with personal preferences
  console.log('\n--- 1. Testing Speaker Personalization Layer ---');
  const familyMember = await FamilyMember.create({
    home: homeId,
    name: 'TestAvatarUser',
    role: 'Student',
    preferredLanguage: 'Mixed',
    voiceProfile: 'Aditi'
  });
  console.log('Family Member seeded:', familyMember.name, 'with role:', familyMember.role);

  // 2. Testing Whisper Model & Fallbacks
  console.log('\n--- 2. Testing Whisper STT Model & Fallbacks ---');
  // Scenario A: Online/Running Python FastAPI AI Service
  const onlineResult = await whisperService.transcribeSpeech({
    mockText: "Turn on the Living Room Light"
  });
  console.log('Online Transcribe response:', onlineResult);
  if (!onlineResult.model || onlineResult.text !== "Turn on the Living Room Light") {
    throw new Error('FAIL: Whisper STT response structure is invalid.');
  }

  // Scenario B: Offline fallbacks
  const originalUrl = process.env.AI_SERVICE_URL;
  process.env.AI_SERVICE_URL = 'http://127.0.0.1:9999'; // bogus URL
  const offlineResult = await whisperService.transcribeSpeech({
    mockText: "Turn on the Living Room Light"
  });
  process.env.AI_SERVICE_URL = originalUrl; // Restore
  console.log('Offline Transcribe response fallback:', offlineResult);
  if (offlineResult.model !== 'none') {
    throw new Error('FAIL: Whisper offline fallback did not report model as "none".');
  }
  console.log('SUCCESS: Whisper STT fallback works correctly.');

  // 3. Testing Queue health scoring and failure/success timestamp logging
  console.log('\n--- 3. Testing Queue Health Metrics & Scoring ---');
  // Reset SpeechToText metrics
  await QueueMetrics.deleteMany({ queue: 'SpeechToText' });
  
  // Job 1: Success, took 150ms
  await queueService.recordJobMetrics('SpeechToText', 150, false, false);
  let metrics = await QueueMetrics.findOne({ queue: 'SpeechToText' });
  console.log('After Success Job 1:');
  console.log('Jobs Processed:', metrics.jobsProcessed);
  console.log('Success Rate:', metrics.successRate + '%');
  console.log('Health Score:', metrics.queueHealthScore + '%');
  console.log('Last Successful Execution:', metrics.lastSuccessfulExecution);
  if (metrics.jobsProcessed !== 1 || metrics.failedJobs !== 0 || metrics.queueHealthScore !== 99) {
    throw new Error(`FAIL: Unexpected metrics values: Health should be 99%, got ${metrics.queueHealthScore}`);
  }

  // Job 2: Failure, took 200ms, retry logic triggered
  await queueService.recordJobMetrics('SpeechToText', 200, true, true, 'Model connection failed');
  metrics = await QueueMetrics.findOne({ queue: 'SpeechToText' });
  console.log('\nAfter Failed Job 2 (Retry):');
  console.log('Jobs Processed:', metrics.jobsProcessed);
  console.log('Failed Jobs:', metrics.failedJobs);
  console.log('Success Rate:', metrics.successRate + '%');
  console.log('Health Score:', metrics.queueHealthScore + '%');
  console.log('Last Failure Reason:', metrics.lastFailureReason);
  console.log('Last Failure At:', metrics.lastFailureAt);

  // Assert health formula correctness:
  // successRate = 50%
  // avgLatency = 175 ms
  // Health Score = 50 - (175 / 200) - (1 * 0.2) = 50 - 0.875 - 0.2 = 48.925 -> Math.round is 49%
  if (metrics.queueHealthScore !== 49) {
    throw new Error(`FAIL: Health score formula mismatch. Expected 49, got ${metrics.queueHealthScore}`);
  }
  console.log('SUCCESS: Health scoring and timestamps verified successfully.');

  // 4. Testing Session Metrics Calculations
  console.log('\n--- 4. Testing Session Metrics & Dialogues ---');
  const sessionId = 'session_avatar_test_' + Math.random().toString(36).substring(7);
  
  // Dispatch a mock conversation command
  const payload = {
    text: "Turn on the Living Room Light",
    memberName: "TestAvatarUser",
    sessionId: sessionId,
    homeId: homeId
  };
  
  console.log('Dispatching voice command to process synchronous fallback...');
  const result = await queueService.dispatchVoicePipeline(payload);
  console.log('Dispatch result:', result);

  // Retrieve updated session
  const session = await ConversationSession.findOne({ sessionId });
  if (!session) {
    throw new Error('FAIL: Conversation session was not created.');
  }
  
  console.log('Session user:', session.user);
  console.log('Speaker profile mapped in session:', session.speakerDetected, 'Role:', session.memberRole, 'Language:', session.preferredLanguage);
  console.log('Average Confidence:', session.averageConfidence + '%');
  console.log('Most used Intent:', session.mostUsedIntent);
  console.log('Session duration:', session.sessionDuration);
  console.log('Average response time:', session.averageResponseTime, 'ms');

  if (session.speakerDetected !== 'TestAvatarUser' || session.memberRole !== 'Student' || session.preferredLanguage !== 'Mixed') {
    throw new Error('FAIL: Speaker details were not mapped to the active profile in the session context.');
  }
  console.log('SUCCESS: Session metrics successfully populated.');

  // 5. Testing Expanded Voice Analytics Endpoint
  console.log('\n--- 5. Testing Voice Dashboard Analytics Output ---');
  const req = {
    user: { id: user._id.toString() }
  };
  const res = mockResponse();

  await familyController.getVoiceDashboard(req, res);
  
  const analytics = res.jsonData.analytics;
  console.log('Speaker Analytics:', analytics.speakerAnalytics);
  console.log('Session Analytics:', analytics.sessionAnalytics);
  console.log('Queue Analytics has elements:', analytics.queueMetrics.length);
  console.log('Speech Analytics modelUsage:', analytics.speechAnalytics.modelUsage);

  // Verify fields are present
  if (!analytics.speakerAnalytics || !analytics.sessionAnalytics || !analytics.speechAnalytics || !analytics.queueMetrics) {
    throw new Error('FAIL: Voice dashboard response is missing the upgraded analytics blocks.');
  }
  
  console.log('SUCCESS: Voice dashboard returns all upgraded analytics blocks.');

  // Clean up test logs
  await VoiceHistory.deleteMany({ user: 'TestAvatarUser' });
  await ConversationSession.deleteMany({ user: 'TestAvatarUser' });
  await FamilyMember.deleteMany({ name: 'TestAvatarUser' });
  await QueueMetrics.deleteMany({});

  console.log('\n=========================================');
  console.log('🎉 ALL AVATAR-READINESS TESTS PASSED 🎉');
  console.log('=========================================');
}

testAvatarReadiness()
  .then(() => {
    mongoose.connection.close();
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Test execution failed:', err);
    mongoose.connection.close();
    process.exit(1);
  });
