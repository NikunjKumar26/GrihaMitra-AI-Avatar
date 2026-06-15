const { PollyClient, SynthesizeSpeechCommand } = require('@aws-sdk/client-polly');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const AIUsageMetrics = require('../models/AIUsageMetrics');

const hasCredentials = process.env.AWS_ACCESS_KEY_ID && 
                       process.env.AWS_SECRET_ACCESS_KEY && 
                       process.env.AWS_REGION;

let clientInstance = null;

function getPollyClient() {
  if (!hasCredentials) {
    throw new Error('CRITICAL: AWS credentials missing in environment. Polly execution disabled.');
  }

  if (!clientInstance) {
    clientInstance = new PollyClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });
  }
  return clientInstance;
}

// Custom profiles mapping voice, language, and speed
const PROFILES = {
  Grandmother: {
    voiceId: 'Kajal', // Hindi Neural Female
    languageCode: 'hi-IN',
    rate: 'slow'
  },
  Father: {
    voiceId: 'Madhur', // Hindi Neural Male
    languageCode: 'hi-IN',
    rate: 'medium'
  },
  Mother: {
    voiceId: 'Kajal', // Hindi Neural Female
    languageCode: 'hi-IN',
    rate: 'medium'
  },
  Student: {
    voiceId: 'Joanna', // English Neural Female
    languageCode: 'en-US',
    rate: 'fast'
  },
  Default: {
    voiceId: 'Aditi', // standard or neural fallback
    languageCode: 'hi-IN',
    rate: 'medium'
  },
  // Direct voice name mappings
  Kajal: {
    voiceId: 'Kajal',
    languageCode: 'hi-IN',
    rate: 'medium'
  },
  Madhur: {
    voiceId: 'Madhur',
    languageCode: 'hi-IN',
    rate: 'medium'
  },
  Joanna: {
    voiceId: 'Joanna',
    languageCode: 'en-US',
    rate: 'medium'
  },
  Kendra: {
    voiceId: 'Kendra',
    languageCode: 'en-US',
    rate: 'medium'
  },
  Aditi: {
    voiceId: 'Aditi',
    languageCode: 'hi-IN',
    rate: 'medium'
  }
};

/**
 * Escapes characters that are reserved in XML/SSML
 */
function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

/**
 * Synthesize speech with Amazon Polly Neural engine
 */
exports.synthesize = async (text, role = 'Default') => {
  const polly = getPollyClient();
  const profile = PROFILES[role] || PROFILES.Default;

  const escapedText = escapeXml(text);
  const rateVal = profile.rate === 'slow' ? '80%' : profile.rate === 'fast' ? '120%' : '100%';
  const ssmlText = `<speak><prosody rate="${rateVal}">${escapedText}</prosody></speak>`;

  const input = {
    OutputFormat: 'mp3',
    Text: ssmlText,
    TextType: 'ssml',
    VoiceId: profile.voiceId,
    LanguageCode: profile.languageCode,
    Engine: 'neural'
  };

  const startTime = Date.now();
  const tempDir = path.join(__dirname, '../public/temp_audio');

  try {
    const command = new SynthesizeSpeechCommand(input);
    const response = await polly.send(command);
    const latency = Date.now() - startTime;

    // Convert AudioStream (readable stream / Uint8Array) into buffer
    const chunks = [];
    for await (const chunk of response.AudioStream) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);

    // Create public directory if not exists to store temporary streams
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Write file to temp directory (caching by text md5 hash to prevent duplicate charges)
    const textHash = crypto.createHash('md5').update(`${ssmlText}_${profile.voiceId}`).digest('hex');
    const filePath = path.join(tempDir, `${textHash}.mp3`);
    fs.writeFileSync(filePath, audioBuffer);

    // Polly Neural pricing is $16.00 per 1 million characters ($0.000016 per character)
    const charCount = text.length;
    const cost = charCount * 0.000016;

    // Log telemetry statistics
    AIUsageMetrics.create({
      serviceType: 'Polly',
      modelId: `${profile.voiceId} (Neural)`,
      charactersProcessed: charCount,
      latencyMs: latency,
      costEstimation: cost
    }).catch(err => console.error('[Telemetry] Polly Metrics write failed:', err.message));

    // Return readable stream of the cached file to maintain pipe structure compatibility
    return {
      fallback: false,
      audioStream: fs.createReadStream(filePath),
      filePath: `/temp_audio/${textHash}.mp3`
    };

  } catch (err) {
    // If neural fails, retry with standard engine as backup
    try {
      console.warn(`[Polly Neural Fail] Reverting to standard engine: ${err.message}`);
      input.Engine = 'standard';
      const command = new SynthesizeSpeechCommand(input);
      const response = await polly.send(command);
      const latency = Date.now() - startTime;

      const chunks = [];
      for await (const chunk of response.AudioStream) {
        chunks.push(chunk);
      }
      const audioBuffer = Buffer.concat(chunks);

      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const textHash = crypto.createHash('md5').update(`${ssmlText}_${profile.voiceId}_std`).digest('hex');
      const filePath = path.join(tempDir, `${textHash}.mp3`);
      fs.writeFileSync(filePath, audioBuffer);

      // Polly Standard pricing is $4.00 per 1 million characters ($0.000004 per character)
      const charCount = text.length;
      const cost = charCount * 0.000004;

      AIUsageMetrics.create({
        serviceType: 'Polly',
        modelId: `${profile.voiceId} (Standard)`,
        charactersProcessed: charCount,
        latencyMs: latency,
        costEstimation: cost
      }).catch(teleErr => console.error('[Telemetry] Polly standard metrics failed:', teleErr.message));

      return {
        fallback: false,
        audioStream: fs.createReadStream(filePath),
        filePath: `/temp_audio/${textHash}.mp3`
      };

    } catch (stdErr) {
      const latency = Date.now() - startTime;
      AIUsageMetrics.create({
        serviceType: 'Polly',
        modelId: profile.voiceId,
        latencyMs: latency,
        isError: true,
        errorMessage: stdErr.message
      }).catch(teleErr => console.error('[Telemetry] Polly write failed:', teleErr.message));

      throw stdErr;
    }
  }
};
