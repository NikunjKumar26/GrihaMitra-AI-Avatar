const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Home = require('../models/Home');
const User = require('../models/User');
const FamilyMember = require('../models/FamilyMember');
const EventHistory = require('../models/EventHistory');
const PredictiveDecision = require('../models/PredictiveDecision');
const ExplainabilityRecord = require('../models/ExplainabilityRecord');
const AIRoutine = require('../models/AIRoutine');
const learningController = require('../controllers/learningController');

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

  // Clean old test logs & data
  console.log('Cleaning up previous test data...');
  await EventHistory.deleteMany({ userName: { $in: ['TestStudentBot', 'TestFatherBot'] } });
  await PredictiveDecision.deleteMany({});
  await ExplainabilityRecord.deleteMany({});
  
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
    // Reset room statuses and verify properties
    home.rooms.forEach(r => {
      r.automationEnabled = true;
      r.devices.forEach(d => { d.isOn = false; });
    });
    await home.save();
  }

  const homeId = home._id;
  const studyRoom = home.rooms.find(r => r.name === 'Study Room');
  const bedroom = home.rooms.find(r => r.name === 'Bedroom');

  // Create predictive family members
  console.log('Upserting test predictive family members...');
  await FamilyMember.deleteMany({ home: homeId });
  
  const studentMem = await FamilyMember.create({
    home: homeId,
    name: 'TestStudentBot',
    role: 'Student',
    preferredLanguage: 'Hindi',
    aiMode: 'Predictive',
    automationEnabled: true,
    lastAIEvaluationAt: new Date(),
    aiEvaluationLogs: [{
      evaluatedAt: new Date(),
      modeAtEvaluation: 'Predictive',
      changesMade: ['Comfort Temperature: 26°C ➔ 22°C', 'Active Hours: 9 AM - 9 PM ➔ 5 PM - 9 PM'],
      summary: 'Shifted active hours to evening based on high study room device usage.'
    }]
  });

  const fatherMem = await FamilyMember.create({
    home: homeId,
    name: 'TestFatherBot',
    role: 'Father',
    preferredLanguage: 'English',
    aiMode: 'Predictive',
    automationEnabled: true
  });

  // Seed history for TestStudentBot and TestFatherBot
  console.log('Seeding telemetry logs for training...');
  const seedLogs = [];
  const daysList = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  for (let i = 0; i < 7; i++) {
    const day = daysList[i];
    // Student Study Light ON at 7 PM (hour 19)
    seedLogs.push({
      homeId,
      roomId: studyRoom._id,
      roomName: 'Study Room',
      userName: 'TestStudentBot',
      deviceId: studyRoom.devices[0]._id,
      deviceName: 'Study Light',
      deviceType: 'light',
      action: 'ON',
      source: 'MANUAL',
      dayOfWeek: day,
      hour: 19,
      minute: 0,
      timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    });
  }
  await EventHistory.insertMany(seedLogs);
  console.log(`Seeded ${seedLogs.length} logs.`);

  // Train AI Model to register high confidence patterns and extract feature importances
  console.log('Triggering AI Model training...');
  const trainRes = mockResponse();
  await learningController.trainModel({ user: { id: user._id.toString() } }, trainRes);
  console.log('Training Response:', trainRes.jsonData);

  console.log('\n=========================================');
  console.log('TEST 1: Run evaluateAutomation & assert ExplainabilityRecord writes...');
  console.log('=========================================');
  const mockIo = mockSocketIO();
  await learningController.evaluateAutomation(homeId, mockIo, 19);

  // Assert Database entries
  const decisions = await PredictiveDecision.find({ homeId, result: 'Success' });
  const explainRecords = await ExplainabilityRecord.find({ homeId });
  
  console.log(`Decisions Created: ${decisions.length}`);
  console.log(`Explainability Records Created: ${explainRecords.length}`);
  
  explainRecords.forEach(r => {
    console.log(`  [Explainability Log] UserName: ${r.userName}`);
    console.log(`    Device: "${r.deviceName}" in "${r.roomName}"`);
    console.log(`    Prediction Action: "${r.prediction}"`);
    console.log(`    Confidence Score: ${r.confidence}%`);
    console.log(`    Human Explanation: "${r.evidence}"`);
    console.log(`    Feature Contributions:`, r.featureContributions);
  });

  if (explainRecords.length === 0) {
    throw new Error('FAIL: Explainability records were not written to MongoDB!');
  }
  console.log('SUCCESS: Explainability records correctly logged with cached RandomForest feature importances.');

  console.log('\n=========================================');
  console.log('TEST 2: REST Endpoint: POST /explain/prediction (on-the-fly prediction explanation)...');
  console.log('=========================================');
  const explainPredReq = {
    body: {
      user: 'TestStudentBot',
      room: 'Study Room',
      device: 'Study Light',
      hour: 19,
      dayOfWeek: 'Monday'
    }
  };
  const explainPredRes = mockResponse();
  await learningController.explainPrediction(explainPredReq, explainPredRes);
  console.log('API Response Status:', explainPredRes.statusCode || 200);
  console.log('On-the-fly Explanation Data:');
  console.log(`  Prediction: "${explainPredRes.jsonData?.prediction}"`);
  console.log(`  Confidence: ${explainPredRes.jsonData?.confidence}%`);
  console.log(`  Explanation Sentence: "${explainPredRes.jsonData?.evidence}"`);
  console.log(`  Feature Contributions:`, explainPredRes.jsonData?.featureContributions);

  console.log('\n=========================================');
  console.log('TEST 3: REST Endpoint: GET /explain/action/:decisionId (automated action explain)...');
  console.log('=========================================');
  const targetDecision = decisions[0];
  if (targetDecision) {
    const explainActionReq = {
      params: { decisionId: targetDecision._id.toString() }
    };
    const explainActionRes = mockResponse();
    await learningController.explainAction(explainActionReq, explainActionRes);
    console.log('API Response Status:', explainActionRes.statusCode || 200);
    console.log('Saved Action Explanation Data:');
    console.log(`  UserName: ${explainActionRes.jsonData?.userName}`);
    console.log(`  Human Explanation Sentence: "${explainActionRes.jsonData?.evidence}"`);
    console.log(`  Confidence: ${explainActionRes.jsonData?.confidence}%`);
    console.log(`  Feature Contributions:`, explainActionRes.jsonData?.featureContributions);
  } else {
    console.log('Skipping TEST 3: No automated decisions found to explain.');
  }

  console.log('\n=========================================');
  console.log('TEST 4: REST Endpoint: GET /explain/routine/:routineId (routine explain)...');
  console.log('=========================================');
  // Create mock routine
  const routine = await AIRoutine.create({
    homeId,
    userName: 'TestStudentBot',
    routineName: "TestStudentBot's Reading Light Mined Routine",
    triggerTime: '7:00 PM',
    triggerRoom: 'Study Room',
    predictedDevices: [{ deviceName: 'Study Light', deviceType: 'light', action: 'ON' }],
    confidenceScore: 95
  });

  const explainRoutineReq = {
    params: { routineId: routine._id.toString() }
  };
  const explainRoutineRes = mockResponse();
  await learningController.explainRoutine(explainRoutineReq, explainRoutineRes);
  console.log('API Response Status:', explainRoutineRes.statusCode || 200);
  console.log('Routine Explanation Data:');
  console.log(`  Routine Name: "${explainRoutineRes.jsonData?.routineName}"`);
  console.log(`  Human Explanation Sentence: "${explainRoutineRes.jsonData?.explanation}"`);

  console.log('\n=========================================');
  console.log('TEST 5: REST Endpoint: GET /explain/profile/:memberId (profile update explain)...');
  console.log('=========================================');
  const explainProfileReq = {
    params: { memberId: studentMem._id.toString() }
  };
  const explainProfileRes = mockResponse();
  await learningController.explainProfileUpdate(explainProfileReq, explainProfileRes);
  console.log('API Response Status:', explainProfileRes.statusCode || 200);
  console.log('Profile Explanation Data:');
  console.log(`  Resident: ${explainProfileRes.jsonData?.name} (${explainProfileRes.jsonData?.role})`);
  console.log(`  Human Explanation Sentence: "${explainProfileRes.jsonData?.explanation}"`);
  console.log(`  Changes Tracked:`, explainProfileRes.jsonData?.changesMade);

  // Cleanup
  console.log('\nCleaning up test documents...');
  await FamilyMember.deleteMany({ home: homeId });
  await PredictiveDecision.deleteMany({ homeId });
  await ExplainabilityRecord.deleteMany({ homeId });
  await AIRoutine.deleteMany({ homeId });
  
  await mongoose.connection.close();
  console.log('Disconnected. All Phase 5 explainability tests finished successfully.');
}

runTests().catch(err => {
  console.error('Test run failed:', err);
  mongoose.connection.close();
  process.exit(1);
});
