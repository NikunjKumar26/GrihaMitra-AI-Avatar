const mongoose = require('mongoose');

const voiceHistorySchema = new mongoose.Schema({
  homeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Home', required: true },
  sessionId: { type: String, default: 'default_session' },
  user: { type: String, default: 'Owner' },
  transcript: { type: String, required: true },
  intent: { 
    type: String, 
    enum: [
      'control_device',
      'control_multiple_devices',
      'sensor_query',
      'routine_query',
      'prediction_query',
      'explain_action',
      'explain_routine',
      'explain_profile',
      'home_status_query',
      'automation_query',
      'greeting',
      'general_chat'
    ], 
    required: true 
  },
  response: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  
  // Upgraded production metrics
  speechConfidence: { type: Number, default: 100 },
  intentConfidence: { type: Number, default: 100 },
  responseConfidence: { type: Number, default: 100 },
  language: { type: String, default: 'English' }, // English, Hindi, Mixed
  processingTime: { type: Number, default: 0 }, // Total backend worker turn time in ms
  voiceUsed: { type: String, default: 'Aditi' },
  responseDuration: { type: Number, default: 0 }, // Audio playback duration in seconds
  generationTime: { type: Number, default: 0 }, // Polly synthesis time in ms
  whisperModel: { type: String, default: 'tiny' },
  speakerDetected: { type: String, default: '' },
  speakerConfidence: { type: Number, default: 100 },
  languageDetected: { type: String, default: '' },
  memberRole: { type: String, default: '' },
  preferredLanguage: { type: String, default: '' }
});

module.exports = mongoose.model('VoiceHistory', voiceHistorySchema);
