require('dotenv').config();
const { PollyClient, SynthesizeSpeechCommand } = require('@aws-sdk/client-polly');

console.log("AWS_ACCESS_KEY_ID:", process.env.AWS_ACCESS_KEY_ID);
console.log("AWS_SECRET_ACCESS_KEY:", process.env.AWS_SECRET_ACCESS_KEY ? "EXISTS" : "MISSING");
console.log("AWS_REGION:", process.env.AWS_REGION);

async function testPolly() {
  try {
    const client = new PollyClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });

    const command = new SynthesizeSpeechCommand({
      OutputFormat: 'mp3',
      Text: '<speak>Ji Dost, kaise hain aap?</speak>',
      TextType: 'ssml',
      VoiceId: 'Aditi',
      LanguageCode: 'hi-IN',
      Engine: 'standard'
    });

    console.log("Sending command to Amazon Polly...");
    const response = await client.send(command);
    console.log("Success! Polly response received.");
    console.log("AudioStream is type:", typeof response.AudioStream);
  } catch (err) {
    console.error("Polly test failed with error:", err);
  }
}

testPolly();
