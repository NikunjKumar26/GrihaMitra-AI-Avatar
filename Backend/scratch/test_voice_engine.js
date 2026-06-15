const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Home = require('../models/Home');
const User = require('../models/User');
const FamilyMember = require('../models/FamilyMember');
const VoiceHistory = require('../models/VoiceHistory');
const ExplainabilityRecord = require('../models/ExplainabilityRecord');
const AIRoutine = require('../models/AIRoutine');
const familyController = require('../controllers/familyController');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/sapnokaghar';

// Helper mock response builder
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

// Helper mock Socket.IO builder
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

  // Clean old test logs
  console.log('Cleaning up previous test data...');
  await VoiceHistory.deleteMany({});
  await ExplainabilityRecord.deleteMany({});
  await AIRoutine.deleteMany({});

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
    // Reset AC and lights to false
    home.rooms.forEach(r => {
      r.devices.forEach(d => { d.isOn = false; });
    });
    await home.save();
  }

  const homeId = home._id;

  // Create test family member context
  await FamilyMember.deleteMany({ home: homeId });
  const student = await FamilyMember.create({
    home: homeId,
    name: 'Nikunj Student',
    role: 'Student',
    preferredLanguage: 'English',
    preferences: {
      tempPreference: 22
    }
  });

  // Seed mock explainability record for motor
  await ExplainabilityRecord.create({
    homeId,
    userName: 'Nikunj Student',
    roomName: 'Garden Area',
    deviceName: 'Water Motor',
    prediction: 'Turn ON Water Motor',
    confidence: 94,
    evidence: 'Turned ON the Water Motor because the morning garden watering cycle started and water levels were under 50%.',
    featureContributions: { user: 30, room: 10, device: 20, time: 30, dayOfWeek: 10 }
  });

  // Seed mock routine
  await AIRoutine.create({
    homeId,
    userName: 'Nikunj Student',
    routineName: 'Evening Study Setup',
    triggerTime: '6:00 PM',
    triggerRoom: 'Study Room',
    predictedDevices: [{ deviceName: 'Study Light', deviceType: 'light', action: 'ON' }],
    confidenceScore: 95
  });

  // Setup request template
  const baseReq = {
    user: { id: user._id.toString() },
    io: mockSocketIO()
  };

  console.log('\n=========================================');
  console.log('TEST 1: Speech synthesis (Text-to-Speech)...');
  console.log('=========================================');
  const ttsReq = {
    ...baseReq,
    body: { text: 'Welcome back to Sapno Ka Ghar!', voiceProfile: 'Aditi' }
  };
  const ttsRes = mockResponse();
  await familyController.synthesizeSpeech(ttsReq, ttsRes);
  console.log('TTS Response Fallback State:', ttsRes.jsonData?.fallback ? 'Local client-side fallback required' : 'Success Polly Audio stream');

  console.log('\n=========================================');
  console.log('TEST 2: Voice Command - Device Toggle (Control Intent)...');
  console.log('=========================================');
  const devReq = {
    ...baseReq,
    body: { text: 'Turn ON the Bedroom AC', memberName: 'Nikunj Student' }
  };
  const devRes = mockResponse();
  await familyController.voiceCommand(devReq, devRes);

  console.log('API Reply:', devRes.jsonData?.response);
  console.log('Detected Intent:', devRes.jsonData?.intent);
  console.log('Actuated State:', devRes.jsonData?.actuated);

  // Assert device was modified in DB
  const updatedHome = await Home.findById(homeId);
  const bedroom = updatedHome.rooms.find(r => r.name === 'Bedroom');
  const ac = bedroom.devices.find(d => d.name === 'Bedroom AC');
  console.log('Device state in DB (Bedroom AC isOn):', ac.isOn);
  if (!ac.isOn) {
    throw new Error('FAIL: Bedroom AC state was not toggled in database!');
  }
  
  // Assert socket events emitted
  console.log('Socket emissions triggered:', devReq.io.emissions.length);
  const hasUpdate = devReq.io.emissions.some(e => e.event === 'deviceUpdate');
  console.log('Has deviceUpdate broadcast:', hasUpdate);
  if (!hasUpdate) {
    throw new Error('FAIL: Socket.IO did not broadcast the deviceUpdate state toggle.');
  }

  console.log('\n=========================================');
  console.log('TEST 3: Voice Command - Decision Explain (Explain Intent)...');
  console.log('=========================================');
  const explainReq = {
    ...baseReq,
    body: { text: 'Why did you turn on the motor?', memberName: 'Nikunj Student' }
  };
  const explainRes = mockResponse();
  await familyController.voiceCommand(explainReq, explainRes);
  console.log('Detected Intent:', explainRes.jsonData?.intent);
  console.log('API Explanation Response:', explainRes.jsonData?.response);
  if (explainRes.jsonData?.intent !== 'explain') {
    throw new Error('FAIL: Intent was not classified as explain!');
  }

  console.log('\n=========================================');
  console.log('TEST 4: Voice Command - Sensor Query (Query Intent)...');
  console.log('=========================================');
  const sensorReq = {
    ...baseReq,
    body: { text: 'What is the water tank level?', memberName: 'Nikunj Student' }
  };
  const sensorRes = mockResponse();
  await familyController.voiceCommand(sensorReq, sensorRes);
  console.log('Detected Intent:', sensorRes.jsonData?.intent);
  console.log('API Sensor Response:', sensorRes.jsonData?.response);

  console.log('\n=========================================');
  console.log('TEST 5: Voice Command - Routine Query (Query Intent)...');
  console.log('=========================================');
  const routineReq = {
    ...baseReq,
    body: { text: 'What routines have you learned?', memberName: 'Nikunj Student' }
  };
  const routineRes = mockResponse();
  await familyController.voiceCommand(routineReq, routineRes);
  console.log('Detected Intent:', routineRes.jsonData?.intent);
  console.log('API Routine Response:', routineRes.jsonData?.response);

  console.log('\n=========================================');
  console.log('TEST 6: Voice Dashboard Endpoints & Analytics verification...');
  console.log('=========================================');
  const dashboardReq = { ...baseReq };
  const dashboardRes = mockResponse();
  await familyController.getVoiceDashboard(dashboardReq, dashboardRes);

  console.log('Dashboard History Entries count:', dashboardRes.jsonData?.history?.length);
  console.log('Dashboard Analytics Stats:');
  console.log('  Total Commands:', dashboardRes.jsonData?.analytics?.totalCommands);
  console.log('  Intent distribution:', dashboardRes.jsonData?.analytics?.intentDistribution);
  console.log('  Peak hour activity array:', dashboardRes.jsonData?.analytics?.hourlyActivity.slice(0, 24));
  console.log('  Top voice device commands counts:', dashboardRes.jsonData?.analytics?.deviceCounts);

  if (dashboardRes.jsonData?.analytics?.totalCommands !== 4) {
    throw new Error(`FAIL: Expected 4 saved voice logs, got ${dashboardRes.jsonData?.analytics?.totalCommands}`);
  }

  console.log('\n=========================================');
  console.log('SUCCESS: All Phase 6 Voice Engine backend tests passed successfully!');
  console.log('=========================================');

  await mongoose.connection.close();
}

runTests().catch(err => {
  console.error('Voice engine integration tests failed:', err);
  mongoose.connection.close();
  process.exit(1);
});
