const bedrockService = require('../services/bedrockService');
const pollyService = require('../services/pollyService');
const fs = require('fs');
const path = require('path');

/**
 * Perform Whisper Speech-To-Text transcription by querying the Python FastAPI AI Service.
 */
exports.transcribeSpeech = async ({ audioData, mockText }) => {
  const startTime = Date.now();
  try {
    const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://127.0.0.1:8000';
    const response = await fetch(`${aiServiceUrl}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioData, mockText })
    });
    
    if (response.ok) {
      const data = await response.json();
      return {
        text: data.text,
        confidence: data.confidence,
        language: data.language,
        processingTime: data.processingTime,
        model: data.model || 'tiny'
      };
    } else {
      throw new Error(`AI Service returned status ${response.status}`);
    }
  } catch (err) {
    console.warn('⚠️ [Voice Intelligence Engine] Python AI Service failed or offline, using local fallback:', err.message);
    const elapsed = Date.now() - startTime;
    const text = mockText || "Turn on the Bedroom AC";
    return {
      text,
      confidence: 90,
      language: detectLanguage(text),
      processingTime: elapsed,
      model: 'none'
    };
  }
};

function detectLanguage(text) {
  const clean = text.toLowerCase();
  const hindiWords = ['namaste', 'ghar', 'kamra', 'chaalu', 'band', 'kijiye', 'karo', 'kya', 'kyun', 'chalao', 'garam', 'thanda', 'dadi', 'nani', 'papa', 'pitaji', 'mataji'];
  const hasHindi = hindiWords.some(w => clean.includes(w)) || /[\u0900-\u097F]/.test(text); 
  if (hasHindi) {
    const hasEnglish = ['on', 'off', 'ac', 'light', 'fan', 'temperature'].some(w => clean.includes(w));
    return hasEnglish ? 'Mixed' : 'Hindi';
  }
  return 'English';
}

/**
 * Advanced Polly Text-to-Speech synthesis supporting SSML speed rate and voice buffers
 */
exports.synthesizeSpeechAdvanced = async ({ text, voiceId = 'Aditi', speedRate = 'medium' }) => {
  const startTime = Date.now();
  try {
    let role = 'Default';
    if (voiceId === 'Joanna') role = 'Student';
    else if (voiceId === 'Madhur') role = 'Father';
    else if (voiceId === 'Kajal') {
      role = (speedRate === 'slow') ? 'Grandmother' : 'Mother';
    } else if (speedRate === 'slow') {
      role = 'Grandmother';
    } else if (voiceId) {
      role = voiceId;
    }

    const result = await pollyService.synthesize(text, role);
    const fullPath = path.join(__dirname, '../public', result.filePath);
    const buffer = fs.readFileSync(fullPath);
    const audioStreamBase64 = buffer.toString('base64');
    const elapsed = Date.now() - startTime;

    return {
      fallback: false,
      audioStreamBase64,
      voiceUsed: voiceId,
      generationTime: elapsed,
      duration: Math.max(Math.round(buffer.length / 16000), 1)
    };
  } catch (error) {
    console.error('[Voice Intelligence Engine] Synthesis error:', error);
    return { fallback: true, text, voiceUsed: voiceId, generationTime: 0, duration: 0, audioStreamBase64: null };
  }
};

/**
 * Advanced Bedrock prompt executing 12 classes of intent classification and multi-turn dialog memory
 */
exports.processVoiceCommandAdvanced = async ({
  text,
  memberName,
  role,
  contextHistory,
  members,
  routines,
  predictions,
  explanations,
  home,
  lastRoom = '',
  lastDevice = '',
  lastClarification = ''
}) => {
  const deviceStatus = home.rooms.map(r => ({
    roomName: r.name,
    devices: r.devices.map(d => ({ name: d.name, type: d.type, isOn: d.isOn }))
  }));

  const mockSensors = {
    waterTankLevel: 78,
    indoorTemperature: 24,
    outdoorTemperature: 32
  };

  const prompt = `You are GrihaMitra, the friendly and conversational smart home AI companion for "Sapno Ka Ghar".
You are conversing with: ${memberName} (Role: ${role})

LATEST USER VOICE MESSAGE: "${text}"

PREVIOUS QUESTIONS/CLARIFICATIONS (If any):
- Last Clarification Asked: "${lastClarification || 'None'}"

CONTEXT MEMORY:
- Last Room Interacted: "${lastRoom || 'None'}"
- Last Device Interacted: "${lastDevice || 'None'}"

ROLE-BASED TONE & NATURAL LANGUAGE CONSTRAINTS:
1. Always respond in natural Indian Hindi/Hinglish (written in English characters for ease of TTS conversion) unless role is Student (who prefers English).
2. Do NOT start every response with "Ji Malik Ji", "Haan Nikunj", or "Ji Dost". Keep response openings diverse, direct, and natural. Avoid repeating the same respect prefixes or starting words. Keep respect phrases subtle or omit them entirely to prevent repetitive speech.
   - E.g. Good: "Kitchen ki light on kar di gayi hai."
   - E.g. Good: "Ghar ka water tank abhi 78 percent bhara hai."
   - E.g. Good: "Maine living room ka AC off kar diya hai."
3. Strictly AVOID broken translation/passive phrases like "Ji main Smart TV ko on kar diya gaya hai." or "Kaunsi device?" or "Kaunsi light?". Make the response flow naturally.

HOME CONFIGURATION DATA:
- Active Devices: ${JSON.stringify(deviceStatus, null, 2)}
- Active Sensors: ${JSON.stringify(mockSensors, null, 2)}

INSTRUCTIONS & INTENT RESOLUTION:
1. Classify the user's latest command into one of these intents:
   - control_device (toggles state of one device)
   - control_multiple_devices (toggles state of multiple devices)
   - sensor_query (asking about temperatures or water tank level)
   - routine_query (asking about learned routines)
   - prediction_query (asking about what will happen next)
   - explain_action (asking why a device was turned on/off)
   - explain_routine (asking why a routine was mined)
   - explain_profile (asking why a profile was adjusted)
   - home_status_query (general question about appliance states)
   - automation_query (asking if automated prediction is enabled)
   - greeting (hello, hi, namaste, Dost, wake word trigger)
   - general_chat (random conversation)
   - clarification_required (when command is ambiguous and room/device is missing and not in context memory)
2. Context Resolution: If the user commands a device change (like setting temperature or toggling) but omits the room or device name:
   - Check Context Memory (Last Room, Last Device).
   - If they are applicable (e.g. User: "Temperature 22 kar do", Last Room: "Bedroom", Last Device: "AC"), resolve them automatically and execute the action (e.g. roomName: "Bedroom", deviceName: "Bedroom AC", state: true or settings)!
3. Clarification Resolution: If the last clarification asked was e.g. "Kaunse room ki light on karni hai?" and the user's latest message is "Kitchen", resolve this as "control_device" on the Kitchen Light!
4. Confidence Scoring Rules:
   - If user request is clear, output intentConfidence and responseConfidence > 80.
   - If user request is ambiguous (e.g. multiple matching devices, room/device not specified and not in context memory), output confidence between 60 and 80, and set "intent" to "clarification_required". Make the "response" a SINGLE, friendly clarification question (no repeated or nested questions).
   - If user request is completely unintelligible (confidence < 60), output confidence < 60, and set the response to ask the user to repeat.
5. Multiple Device Control: If the intent is "control_multiple_devices" (e.g. turn off all lights, turn on kitchen light and fan), populate "toggleDevices" as an array of all devices to be changed. For single device commands, populate both "toggleDevice" (as a single object) and "toggleDevices" (as an array with a single item) for backwards compatibility.

Format your response STRICTLY as a raw JSON object. Do not wrap in markdown or include text outside the JSON:
{
  "intent": "control_device" | "control_multiple_devices" | "sensor_query" | "routine_query" | "prediction_query" | "explain_action" | "explain_routine" | "explain_profile" | "home_status_query" | "automation_query" | "greeting" | "general_chat" | "clarification_required",
  "response": "Concise spoken reply matching natural Hindi/Hinglish constraints (max 2 sentences).",
  "toggleDevice": {
    "roomName": "string",
    "deviceName": "string",
    "state": boolean
  } | null,
  "toggleDevices": [
    {
      "roomName": "string",
      "deviceName": "string",
      "state": boolean
    }
  ] | null,
  "intentConfidence": number,
  "responseConfidence": number,
  "resolvedRoom": "string or null",
  "resolvedDevice": "string or null"
}`;

  try {
    const responseText = await bedrockService.invokeModel(prompt, 600, 0.2);
    
    const jsonStart = responseText.indexOf('{');
    const jsonEnd = responseText.lastIndexOf('}');
    if (jsonStart !== -1 && jsonEnd !== -1) {
      const cleanedJson = responseText.substring(jsonStart, jsonEnd + 1);
      return JSON.parse(cleanedJson);
    }
    throw new Error("Invalid LLM response format: No JSON object found.");
  } catch (err) {
    console.error('[Voice Intelligence Engine] Bedrock API failed:', err.message);
    throw err;
  }
};
