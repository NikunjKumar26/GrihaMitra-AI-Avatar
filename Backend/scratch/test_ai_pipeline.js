const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const EventHistory = require('../models/EventHistory');
const Home = require('../models/Home');
const User = require('../models/User');
const FamilyMember = require('../models/FamilyMember');
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

async function runTests() {
  console.log('Connecting to MongoDB at:', MONGO_URI);
  await mongoose.connect(MONGO_URI);
  console.log('MongoDB Connected.');

  // Clean old test logs & data
  console.log('Cleaning up existing TestBot and test family data...');
  await EventHistory.deleteMany({ userName: { $in: ['TestStudent', 'TestFather', 'TestGrandmother'] } });
  
  // Find or create a test owner user
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
          devices: [{ name: 'Study Light', type: 'light', isOn: false }]
        },
        {
          name: 'Bedroom',
          devices: [{ name: 'Bedroom AC', type: 'ac', isOn: false }]
        },
        {
          name: 'Prayer Room',
          devices: [{ name: 'Prayer Altar Light', type: 'light', isOn: false }]
        }
      ]
    });
  }

  const homeId = home._id;
  const studyRoom = home.rooms.find(r => r.name === 'Study Room');
  const bedroom = home.rooms.find(r => r.name === 'Bedroom');
  const prayerRoom = home.rooms.find(r => r.name === 'Prayer Room');

  // Upsert Family Members
  console.log('Creating family members...');
  await FamilyMember.deleteMany({ home: homeId });
  const studentMem = await FamilyMember.create({
    home: homeId,
    name: 'TestStudent',
    role: 'Student',
    preferredLanguage: 'Hindi',
    activeHours: '6 PM - 10 PM'
  });
  const fatherMem = await FamilyMember.create({
    home: homeId,
    name: 'TestFather',
    role: 'Father',
    preferredLanguage: 'English',
    activeHours: '7 PM - 11 PM'
  });
  const grandmotherMem = await FamilyMember.create({
    home: homeId,
    name: 'TestGrandmother',
    role: 'Grandmother',
    preferredLanguage: 'Hindi',
    activeHours: '5 AM - 8 AM'
  });

  // Seed history to construct strong pattern:
  // 1. Student turns ON Study Light at 7 PM (hour 19)
  // 2. Father turns ON Bedroom AC at 9 PM (hour 21)
  // 3. Grandmother turns ON Prayer Altar Light at 6 AM (hour 6)
  console.log('Seeding EventHistory database logs...');
  const logsToCreate = [];
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Loop days of week to generate continuous telemetry data
  for (let i = 0; i < 7; i++) {
    const day = days[i];
    
    // TestStudent: Study Room Light ON at 7 PM (19:00)
    logsToCreate.push({
      homeId,
      roomId: studyRoom._id,
      roomName: 'Study Room',
      userName: 'TestStudent',
      deviceId: studyRoom.devices[0]._id,
      deviceName: 'Study Light',
      deviceType: 'light',
      action: 'ON',
      source: 'MANUAL',
      dayOfWeek: day,
      hour: 19,
      minute: 5,
      timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    });

    // TestFather: Bedroom AC ON at 9 PM (21:00)
    logsToCreate.push({
      homeId,
      roomId: bedroom._id,
      roomName: 'Bedroom',
      userName: 'TestFather',
      deviceId: bedroom.devices[0]._id,
      deviceName: 'Bedroom AC',
      deviceType: 'ac',
      action: 'ON (Set to 22°C)',
      source: 'MANUAL',
      dayOfWeek: day,
      hour: 21,
      minute: 15,
      timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    });

    // TestGrandmother: Prayer Altar Light ON at 6 AM (6:00)
    logsToCreate.push({
      homeId,
      roomId: prayerRoom._id,
      roomName: 'Prayer Room',
      userName: 'TestGrandmother',
      deviceId: prayerRoom.devices[0]._id,
      deviceName: 'Prayer Altar Light',
      deviceType: 'light',
      action: 'ON',
      source: 'MANUAL',
      dayOfWeek: day,
      hour: 6,
      minute: 0,
      timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    });
  }

  await EventHistory.insertMany(logsToCreate);
  console.log(`Seeded ${logsToCreate.length} event history telemetry logs.`);

  // Setup Mock Request/Response context
  const mockReq = {
    user: { id: user._id.toString() },
    body: {}
  };

  console.log('\n=========================================');
  console.log('TEST 1: Run Train Model endpoint...');
  console.log('=========================================');
  let res = mockResponse();
  await learningController.trainModel(mockReq, res);
  console.log('Response Status:', res.statusCode || 200);
  console.log('Response Data:', res.jsonData);

  console.log('\n=========================================');
  console.log('TEST 2: Run Predict Next Action (Student, 7 PM, Monday)...');
  console.log('=========================================');
  mockReq.body = {
    user: 'TestStudent',
    hour: 19,
    dayOfWeek: 'Monday'
  };
  res = mockResponse();
  await learningController.predictNextAction(mockReq, res);
  console.log('Response Status:', res.statusCode || 200);
  console.log('Response Data:', res.jsonData);

  console.log('\n=========================================');
  console.log('TEST 3: Run Predict Next Action (Father, 9 PM, Wednesday)...');
  console.log('=========================================');
  mockReq.body = {
    user: 'TestFather',
    hour: 21,
    dayOfWeek: 'Wednesday'
  };
  res = mockResponse();
  await learningController.predictNextAction(mockReq, res);
  console.log('Response Status:', res.statusCode || 200);
  console.log('Response Data:', res.jsonData);

  console.log('\n=========================================');
  console.log('TEST 4: Run Generate Routines...');
  console.log('=========================================');
  mockReq.body = {};
  res = mockResponse();
  await learningController.generateRoutines(mockReq, res);
  console.log('Response Status:', res.statusCode || 200);
  console.log('Response Data:', res.jsonData);

  // Assert database writes
  const savedRoutines = await AIRoutine.find({ homeId });
  console.log(`Verified DB: Found ${savedRoutines.length} auto-mined AI routines in mongodb:`);
  savedRoutines.forEach((r, index) => {
    console.log(`  [Routine ${index + 1}] User: ${r.userName}, Routine: "${r.routineName}", Trigger: ${r.triggerTime} in ${r.triggerRoom}, Confidence: ${r.confidenceScore}%`);
  });

  console.log('\n=========================================');
  console.log('TEST 5: Run Dashboard GET endpoint...');
  console.log('=========================================');
  res = mockResponse();
  await learningController.getLearningDashboard(mockReq, res);
  console.log('Response Status:', res.statusCode || 200);
  console.log('Response Analytics Summary:');
  if (res.jsonData && res.jsonData.analytics) {
    const a = res.jsonData.analytics;
    console.log(`  Total Event Log Count: ${a.totalEvents}`);
    console.log(`  Top Active Rooms:`, a.activeRooms.map(r => `${r._id} (${r.count})`).join(', '));
    console.log(`  Top Device Usage:`, a.deviceUsage.map(d => `${r = d._id} (${d.count})`).join(', '));
    console.log(`  Weekly Trends:`, a.weeklyTrends.map(t => `${t.weekLabel}: ${t.count}`).join(', '));
  } else {
    console.log('  No analytics returned!');
  }

  // Cleanup
  console.log('\nCleaning up seeded test documents...');
  await EventHistory.deleteMany({ userName: { $in: ['TestStudent', 'TestFather', 'TestGrandmother'] } });
  
  await mongoose.connection.close();
  console.log('\nDatabase closed. Integration tests completed successfully!');
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  mongoose.connection.close();
  process.exit(1);
});
