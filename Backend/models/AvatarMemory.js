const mongoose = require('mongoose');

const avatarMemorySchema = new mongoose.Schema({
  homeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Home', required: true },
  user: { type: String, required: true },
  question: { type: String, required: true },
  avatarResponse: { type: String, required: true },
  contextUsed: { type: Object, default: {} },
  emotionState: { 
    type: String, 
    enum: ['Normal', 'Happy', 'Alert', 'Concerned', 'Greeting', 'Celebration'], 
    default: 'Normal' 
  },
  avatarState: { 
    type: String, 
    enum: ['Listening', 'Thinking', 'Speaking', 'Explaining', 'Alerting', 'Greeting'], 
    default: 'Speaking' 
  },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AvatarMemory', avatarMemorySchema);
