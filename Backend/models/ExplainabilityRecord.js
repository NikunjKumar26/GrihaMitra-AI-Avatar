const mongoose = require('mongoose');

const explainabilityRecordSchema = new mongoose.Schema({
  homeId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Home', 
    required: true 
  },
  decisionId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'PredictiveDecision' 
  },
  userName: { 
    type: String, 
    required: true 
  },
  roomName: { 
    type: String, 
    required: true 
  },
  deviceName: { 
    type: String, 
    required: true 
  },
  prediction: { 
    type: String, 
    required: true 
  },
  confidence: { 
    type: Number, 
    required: true 
  },
  evidence: { 
    type: String, 
    required: true 
  },
  featureContributions: {
    user: { type: Number, default: 20 },
    room: { type: Number, default: 20 },
    device: { type: Number, default: 20 },
    time: { type: Number, default: 20 },
    dayOfWeek: { type: Number, default: 20 }
  },
  relatedRoutine: { 
    type: String, 
    default: 'Dynamic Routine' 
  },
  decisionTimestamp: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('ExplainabilityRecord', explainabilityRecordSchema);
