require('dotenv').config();
const bedrockService = require('../services/bedrockService');
const mongoose = require('mongoose');

async function test() {
  const modelId = process.env.BEDROCK_MODEL_ID || 'amazon.nova-lite-v1:0';
  console.log('--- Testing Bedrock Production Client ---');
  console.log('Model ID:', modelId);
  
  if (process.env.MONGO_URI) {
    try {
      await mongoose.connect(process.env.MONGO_URI);
    } catch (dbErr) {
      // Quiet fail if DB connection fails for test run
    }
  }

  const startTime = Date.now();
  try {
    const prompt = 'Respond with "Bedrock connection is functional." and nothing else.';
    console.log('Invoking Bedrock...');
    const result = await bedrockService.invokeModel(prompt, 100, 0.7);
    const latency = Date.now() - startTime;
    console.log('Response:');
    console.log(result);
    console.log(`Latency: ${latency} ms`);
    console.log('SUCCESS');
  } catch (error) {
    console.log('Response:');
    console.log(`Error: ${error.message}`);
    const latency = Date.now() - startTime;
    console.log(`Latency: ${latency} ms`);
    console.log('FAILED');
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  }
}

test();
