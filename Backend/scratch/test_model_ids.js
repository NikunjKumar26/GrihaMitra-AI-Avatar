require('dotenv').config();
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

const models = [
  'anthropic.claude-3-sonnet-20240229-v1:0',
  'us.anthropic.claude-3-sonnet-20240229-v1:0',
  'anthropic.claude-3-opus-20240229-v1:0',
  'us.anthropic.claude-3-opus-20240229-v1:0',
  'anthropic.claude-3-5-haiku-20241022-v1:0',
  'us.anthropic.claude-3-5-haiku-20241022-v1:0'
];

async function checkModels() {
  console.log('Region:', process.env.AWS_REGION || 'us-east-1');
  for (const modelId of models) {
    console.log(`\nChecking model ID: ${modelId}...`);
    try {
      const payload = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 20,
        messages: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }]
      };
      const command = new InvokeModelCommand({
        modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload)
      });
      const response = await client.send(command);
      console.log(`✔ SUCCESS: ${modelId} is accessible!`);
      const body = JSON.parse(new TextDecoder().decode(response.body));
      console.log(`Response text: "${body.content[0].text.trim()}"`);
    } catch (err) {
      console.log(`❌ FAILED: ${modelId} - Error: ${err.name} (${err.message})`);
    }
  }
}

checkModels();
