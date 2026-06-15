require('dotenv').config();
const VoiceIntelligenceEngine = require('../agent/VoiceIntelligenceEngine');

async function testSynthesis() {
  try {
    console.log("Synthesizing speech advanced...");
    const result = await VoiceIntelligenceEngine.synthesizeSpeechAdvanced({
      text: "Namaste, kaise hain aap? Main aapka smart assistant hoon.",
      voiceId: "Aditi",
      speedRate: "medium"
    });
    console.log("Result:", {
      fallback: result.fallback,
      voiceUsed: result.voiceUsed,
      duration: result.duration,
      audioStreamBase64Length: result.audioStreamBase64 ? result.audioStreamBase64.length : null
    });
  } catch (err) {
    console.error("Advanced synthesis failed with error:", err);
  }
}

testSynthesis();
