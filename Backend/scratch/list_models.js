require('dotenv').config();
const { BedrockClient, ListFoundationModelsCommand } = require('@aws-sdk/client-bedrock');

const client = new BedrockClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

async function run() {
  try {
    const command = new ListFoundationModelsCommand({});
    const response = await client.send(command);
    console.log('--- Bedrock Models List ---');
    const anthropicModels = response.modelSummaries.filter(m => m.providerName === 'Anthropic');
    console.log(`Found ${anthropicModels.length} Anthropic models:`);
    for (const model of anthropicModels) {
      console.log(`- Model Name: ${model.modelName}`);
      console.log(`  Model ID: ${model.modelId}`);
      console.log(`  Lifecycle: ${JSON.stringify(model.modelLifecycle || 'N/A')}`);
    }
  } catch (err) {
    console.error('Failed to list foundation models:', err);
  }
}

run();
