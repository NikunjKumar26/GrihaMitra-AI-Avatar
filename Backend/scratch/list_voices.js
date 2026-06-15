require('dotenv').config();
const { PollyClient, DescribeVoicesCommand } = require('@aws-sdk/client-polly');

async function listVoices() {
  try {
    const client = new PollyClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });

    const command = new DescribeVoicesCommand({});
    const response = await client.send(command);
    
    // Filter voices for hi-IN and en-IN
    const indianVoices = response.Voices.filter(v => v.LanguageCode === 'hi-IN' || v.LanguageCode === 'en-IN' || v.LanguageCode === 'en-US');
    console.log("Available Indian and US English Voices:");
    indianVoices.forEach(v => {
      console.log(`- Name: ${v.Name}, Lang: ${v.LanguageCode}, Gender: ${v.Gender}, Supported Engines: ${v.SupportedEngines.join(', ')}`);
    });
  } catch (err) {
    console.error("List voices failed:", err);
  }
}

listVoices();
