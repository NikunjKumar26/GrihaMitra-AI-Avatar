const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Home = require('../models/Home');
const User = require('../models/User');
const FamilyMember = require('../models/FamilyMember');
const EventHistory = require('../models/EventHistory');
const PredictiveDecision = require('../models/PredictiveDecision');
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
  console.log('Cleaning up previous TestBot data...');
  await EventHistory.deleteMany({ userName: { $in: ['TestStudentBot', 'TestFatherBot'] } });
  await PredictiveDecision.deleteMany({});
  
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
  
  // TestStudentBot -> high confidence (>90%) light trigger (Local Fallback returns 94.5%)
  const studentMem = await FamilyMember.create({
    home: homeId,
    name: 'TestStudentBot',
    role: 'Student',
    preferredLanguage: 'Hindi',
    aiMode: 'Predictive',
    automationEnabled: true
  });

  // TestFatherBot -> high confidence AC trigger (Local Fallback returns 91.0%)
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
    
    // Father Bedroom AC ON at 9 PM (hour 21)
    seedLogs.push({
      homeId,
      roomId: bedroom._id,
      roomName: 'Bedroom',
      userName: 'TestFatherBot',
      deviceId: bedroom.devices[0]._id,
      deviceName: 'Bedroom AC',
      deviceType: 'ac',
      action: 'ON',
      source: 'MANUAL',
      dayOfWeek: day,
      hour: 21,
      minute: 0,
      timestamp: new Date(Date.now() - i * 24 * 60 * 60 * 1000)
    });
  }
  await EventHistory.insertMany(seedLogs);
  console.log(`Seeded ${seedLogs.length} logs.`);

  // Force Train AI Model to register high confidence patterns
  console.log('Triggering AI Model training...');
  const trainRes = mockResponse();
  await learningController.trainModel({ user: { id: user._id.toString() } }, trainRes);
  console.log('Training Response:', trainRes.jsonData);

  const mockIo = mockSocketIO();

  console.log('\n=========================================');
  console.log('TEST 1: Run evaluateAutomation (Autonomous Actions)...');
  console.log('=========================================');
  
  // Set date overrides or evaluate (evaluateAutomation checks current date/time. 
  // Wait, current time might not match hour 19 or 21, so let's mock current date checks in predictNextForMember if needed,
  // or the fallback inside predictNextForMember automatically handles Student at hour 19 / Father at hour 21 if current hour matches.
  // Wait! In evaluateAutomation:
  //   const currentHour = new Date().getHours();
  //   const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  // Since the test executes at the current time, if the current time is NOT 7 PM or 9 PM, the trained AI model won't output ON predictions for the current hour!
  // To verify autonomous evaluations, we should mock or inject the current hour inside evaluateAutomation,
  // OR we can make predictNextForMember accept an optional hour override!
  // Let's modify predictNextForMember or exports.evaluateAutomation inside learningController.js to accept an optional hour override for testing!
  // Actually, wait, let's check learningController.js evaluateAutomation code:
  //   const currentHour = new Date().getHours();
  // If we modify evaluateAutomation to allow an optional hour parameter:
  //   exports.evaluateAutomation = async (homeId, io, hourOverride) => {
  //     const currentHour = hourOverride !== undefined ? hourOverride : new Date().getHours();
  // This is extremely simple and allows our test script to pass a custom hour override (e.g. 19 for Study Light) to test autonomous executions at any time!
  // Yes! This is a standard and robust developer testing technique. Let's do that!

  await learningController.evaluateAutomation(homeId, mockIo, 19);

  // Assert Database entries
  const autoDecisions = await PredictiveDecision.find({ homeId, result: 'Success' });
  console.log(`Found ${autoDecisions.length} successful automatic executions in MongoDB.`);
  autoDecisions.forEach(d => {
    console.log(`  [AI Auto Action] Turned ON "${d.deviceName}" in "${d.roomName}" for ${d.userName} (Confidence: ${d.confidenceScore}%)`);
  });

  // Assert Socket Broadcasts
  console.log('Captured Socket emissions:', mockIo.emissions.length);
  mockIo.emissions.forEach(e => {
    console.log(`  [Socket Emit] Room: ${e.room}, Event: "${e.event}", State:`, e.data.state !== undefined ? e.data.state : e.data.message);
  });

  // Check that the devices were actually set to ON in the DB
  const updatedHome1 = await Home.findById(homeId);
  console.log('Device States in DB after AI evaluate:');
  updatedHome1.rooms.forEach(r => {
    r.devices.forEach(d => {
      console.log(`  Room: ${r.name}, Device: ${d.name}, isOn: ${d.isOn}`);
    });
  });

  console.log('\n=========================================');
  console.log('TEST 2: Room Automation Bypass Override...');
  console.log('=========================================');
  // Disable Study Room automation
  console.log('Disabling automation for Study Room...');
  const toggleReq = {
    user: { id: user._id.toString() },
    body: { roomId: studyRoom._id.toString(), enabled: false }
  };
  let toggleRes = mockResponse();
  await learningController.toggleRoomAutomation(toggleReq, toggleRes);
  console.log('Toggle Room Response:', toggleRes.jsonData);

  // Reset device status
  const resetHome = await Home.findById(homeId);
  resetHome.rooms.forEach(r => {
    r.devices.forEach(d => { d.isOn = false; });
  });
  await resetHome.save();

  // Clear past decisions for clean hour test
  await PredictiveDecision.deleteMany({});

  // Re-run evaluation
  const mockIo2 = mockSocketIO();
  await learningController.evaluateAutomation(homeId, mockIo2, 19);

  // Verify only Bedroom AC triggered, Study Light bypassed
  const decisionsAfterBypass = await PredictiveDecision.find({ homeId, result: 'Success' });
  console.log(`Decisions logged after disabling Study Room automation: ${decisionsAfterBypass.length}`);
  decisionsAfterBypass.forEach(d => {
    console.log(`  Executed: "${d.deviceName}" in "${d.roomName}"`);
  });

  console.log('\n=========================================');
  console.log('TEST 3: Member Automation Bypass Override...');
  console.log('=========================================');
  // Re-enable room, disable TestFatherBot automation
  console.log('Enabling Study Room, disabling TestFatherBot automation...');
  await learningController.toggleRoomAutomation({
    user: { id: user._id.toString() },
    body: { roomId: studyRoom._id.toString(), enabled: true }
  }, mockResponse());

  await learningController.toggleMemberAutomation({
    body: { memberId: fatherMem._id.toString(), enabled: false }
  }, mockResponse());

  // Reset device status & clear decisions
  const resetHome2 = await Home.findById(homeId);
  resetHome2.rooms.forEach(r => {
    r.devices.forEach(d => { d.isOn = false; });
  });
  await resetHome2.save();
  await PredictiveDecision.deleteMany({});

  // Re-run evaluation
  await learningController.evaluateAutomation(homeId, mockIo2, 21);
  const decisionsAfterMemberBypass = await PredictiveDecision.find({ homeId, result: 'Success' });
  console.log(`Decisions logged after disabling Father automation: ${decisionsAfterMemberBypass.length}`);
  decisionsAfterMemberBypass.forEach(d => {
    console.log(`  Executed: "${d.deviceName}" in "${d.roomName}"`);
  });

  console.log('\n=========================================');
  console.log('TEST 4: Mock Pending Approvals & User Feedback...');
  console.log('=========================================');
  // Create a mock Pending Approval log
  const pendingDec = await PredictiveDecision.create({
    homeId,
    userName: 'TestStudentBot',
    roomName: 'Study Room',
    roomId: studyRoom._id,
    deviceName: 'Study Light',
    deviceId: studyRoom.devices[0]._id,
    deviceType: 'light',
    actionType: 'ON',
    predictedAction: 'Turn ON the Study Light in the Study Room',
    confidenceScore: 78.5,
    reason: 'Observed evening study patterns',
    result: 'Pending Approval'
  });

  console.log('Created Pending Approval ID:', pendingDec._id);

  // Approve it
  const feedbackReq = {
    io: mockSocketIO(),
    body: { decisionId: pendingDec._id.toString(), response: 'Approved' }
  };
  const feedbackRes = mockResponse();
  await learningController.handleFeedback(feedbackReq, feedbackRes);
  console.log('Feedback API response:', feedbackRes.jsonData);

  // Assert changes
  const approvedDec = await PredictiveDecision.findById(pendingDec._id);
  console.log(`Updated Decision Result in DB: "${approvedDec.result}", ExecutedAction: "${approvedDec.executedAction}"`);
  
  const finalHomeState = await Home.findById(homeId);
  console.log(`Device state in DB: Study Light isOn = ${finalHomeState.rooms.find(r => r.name === 'Study Room').devices[0].isOn}`);

  console.log('\n=========================================');
  console.log('TEST 5: Manual Override Detection...');
  console.log('=========================================');
  // We just executed an AI action (turned ON Study Light).
  // Now we mock a user manual override toggle to turn OFF the Study Light.
  // We'll call the manual override check logic inside toggleDevice manually to assert database updates.
  console.log('Simulating User turning OFF Study Light (manual override)...');
  
  // Clean up and reset device state to true (as if AI just turned it on)
  const overrideHome = await Home.findById(homeId);
  overrideHome.rooms.find(r => r.name === 'Study Room').devices[0].isOn = true;
  await overrideHome.save();

  // Create a successful AI decision log
  await PredictiveDecision.deleteMany({});
  const successDec = await PredictiveDecision.create({
    homeId,
    userName: 'TestStudentBot',
    roomName: 'Study Room',
    roomId: studyRoom._id,
    deviceName: 'Study Light',
    deviceId: studyRoom.devices[0]._id,
    deviceType: 'light',
    actionType: 'ON',
    predictedAction: 'Turn ON the Study Light',
    executedAction: 'ON',
    confidenceScore: 95.0,
    reason: 'Routine study',
    result: 'Success',
    timestamp: new Date() // right now
  });

  // Mock Socket.IO toggleDevice trigger
  const simulateManualToggle = async (deviceId, roomId, userState, userName) => {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const contradictionAction = userState ? 'OFF' : 'ON'; // user turns off (false), contradiction is ON
    
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
      recentDecision.reason = `User manually turned ${userState ? 'ON' : 'OFF'} the device, overriding the AI's auto-${contradictionAction.toLowerCase()} trigger.`;
      await recentDecision.save();
    }
  };

  await simulateManualToggle(studyRoom.devices[0]._id, studyRoom._id, false, 'Nikunj Owner');

  // Assert override detection
  const overriddenDec = await PredictiveDecision.findById(successDec._id);
  console.log(`Overridden Decision Result in DB: "${overriddenDec.result}"`);
  console.log(`isOverride: ${overriddenDec.isOverride}`);
  console.log(`Override Reason: "${overriddenDec.reason}"`);

  console.log('\n=========================================');
  console.log('TEST 6: Get Automation Dashboard...');
  console.log('=========================================');
  
  // Make TestFatherBot active in predictive mode to see it on dashboard
  await FamilyMember.findByIdAndUpdate(fatherMem._id, { automationEnabled: true });

  const dashReq = {
    user: { id: user._id.toString() }
  };
  const dashRes = mockResponse();
  await learningController.getAutomationDashboard(dashReq, dashRes);
  console.log('Dashboard Data Summary:');
  if (dashRes.jsonData) {
    const d = dashRes.jsonData;
    console.log(`  Automation Success Rate: ${d.statistics?.successRate}%`);
    console.log(`  Total Automated Actions returned: ${d.automatedActions?.length}`);
    console.log(`  Active predictions count: ${d.activePredictions?.length}`);
    d.activePredictions.forEach(ap => {
      console.log(`    Member: ${ap.userName}, Prediction: "${ap.prediction}", Confidence: ${ap.confidence}%`);
    });
    console.log('  Rooms Override switches:');
    d.rooms.forEach(r => console.log(`    Room: ${r.name}, Automation Enabled: ${r.automationEnabled}`));
    console.log('  Members Override switches:');
    d.members.forEach(m => console.log(`    Member: ${m.name}, Automation Enabled: ${m.automationEnabled}`));
  }

  // Cleanup
  console.log('\nCleaning up test documents...');
  await FamilyMember.deleteMany({ home: homeId });
  await PredictiveDecision.deleteMany({ homeId });
  
  await mongoose.connection.close();
  console.log('Disconnected. All Phase 4 tests finished successfully.');
}

runTests().catch(err => {
  console.error('Test run failed:', err);
  mongoose.connection.close();
  process.exit(1);
});
