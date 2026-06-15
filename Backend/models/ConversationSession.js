const mongoose = require('mongoose');

const conversationSessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  homeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Home', required: true },
  user: { type: String, default: 'Owner' },
  messages: [
    {
      role: { type: String, enum: ['user', 'assistant'], required: true },
      content: { type: String, required: true },
      timestamp: { type: Date, default: Date.now }
    }
  ],
  contextWindow: { type: Number, default: 10 },
  conversationSummary: { type: String, default: "" },
  summaryUpdatedAt: { type: Date, default: null },
  totalMessages: { type: Number, default: 0 },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  averageResponseTime: { type: Number, default: 0 },
  sessionDuration: { type: String, default: '0 minutes' },
  averageConfidence: { type: Number, default: 0 },
  intentDistribution: { type: Map, of: Number, default: {} },
  mostUsedIntent: { type: String, default: '' },
  speakerDetected: { type: String, default: '' },
  speakerConfidence: { type: Number, default: 100 },
  languageDetected: { type: String, default: '' },
  memberRole: { type: String, default: '' },
  preferredLanguage: { type: String, default: '' },
  whisperModel: { type: String, default: '' },
  lastDevice: { type: String, default: '' },
  lastRoom: { type: String, default: '' },
  lastClarification: { type: String, default: '' },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ConversationSession', conversationSessionSchema);
