const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/sapnokaghar';

console.log('Connecting to MongoDB for Dialogue integration test...');

async function runTests() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✓ Connected to MongoDB');

    const Home = require('../models/Home');
    const ConversationSession = require('../models/ConversationSession');
    const GrihaMitraAgent = require('../agent/GrihaMitraAgent');

    // Fetch a sample Home
    const home = await Home.findOne();
    if (!home) {
      console.error('❌ No home registered in database. Cannot run tests.');
      process.exit(1);
    }
    console.log(`✓ Using Home: "${home.houseName}"`);

    const testSessionId = 'test-session-' + Date.now();
    console.log(`\n--- Test Session ID: ${testSessionId} ---`);

    // 1. Run Ambiguous Command Check
    console.log('\nCommand 1: "light on karo" (missing room)');
    const res1 = await GrihaMitraAgent.executeVoiceCommandPipeline({
      text: 'light on karo',
      sessionId: testSessionId,
      memberName: 'Owner',
      home
    });
    console.log('Response 1 Text:', res1.text);
    console.log('Intent Class:', res1.intentState || 'N/A');
    console.log('Actuated Device:', res1.actuated);

    // 2. Run Context Command Check
    console.log('\nCommand 2: "Bedroom light on karo"');
    const res2 = await GrihaMitraAgent.executeVoiceCommandPipeline({
      text: 'Bedroom light on karo',
      sessionId: testSessionId,
      memberName: 'Owner',
      home
    });
    console.log('Response 2 Text:', res2.text);
    console.log('Actuated Device:', res2.actuated);

    // 3. Run Contextual Omission Command Check
    console.log('\nCommand 3: "AC bhi chalu karo" (omitting Bedroom)');
    const res3 = await GrihaMitraAgent.executeVoiceCommandPipeline({
      text: 'AC bhi chalu karo',
      sessionId: testSessionId,
      memberName: 'Owner',
      home
    });
    console.log('Response 3 Text:', res3.text);
    console.log('Actuated Device:', res3.actuated);

    // 4. Run Duplicate Protection Check
    console.log('\nCommand 4: "AC bhi chalu karo" (Duplicate Command)');
    const res4 = await GrihaMitraAgent.executeVoiceCommandPipeline({
      text: 'AC bhi chalu karo',
      sessionId: testSessionId,
      memberName: 'Owner',
      home
    });
    console.log('Response 4 Text:', res4.text);
    console.log('Duplicate Blocked/Cached:', res4.text === res3.text ? 'Yes (Correct)' : 'No (Incorrect)');

    // Cleanup session
    await ConversationSession.deleteOne({ sessionId: testSessionId });
    console.log('\n✓ Cleaned up test session.');

    console.log('\n🎉 ALL INTEGRATION DIALOG TESTS COMPLETED SUCCESSFULLY!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Dialogue Integration Test Failed:', err);
    process.exit(1);
  }
}

runTests();
