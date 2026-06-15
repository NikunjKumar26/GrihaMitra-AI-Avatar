const mongoose = require('mongoose');

const predictiveDecisionSchema = new mongoose.Schema({
  homeId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Home', 
    required: true 
  },
  userName: { 
    type: String, 
    required: true 
  },
  roomName: { 
    type: String, 
    required: true 
  },
  roomId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true 
  },
  deviceName: { 
    type: String, 
    required: true 
  },
  deviceId: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true 
  },
  deviceType: { 
    type: String, 
    required: true 
  },
  actionType: { 
    type: String, 
    enum: ['ON', 'OFF'], 
    required: true 
  },
  predictedAction: { 
    type: String, 
    required: true 
  },
  executedAction: { 
    type: String, 
    default: 'None' 
  },
  confidenceScore: { 
    type: Number, 
    required: true 
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  },
  reason: { 
    type: String, 
    required: true 
  },
  result: { 
    type: String, 
    enum: ['Success', 'Pending Approval', 'Rejected', 'Manual Override', 'Recommendation'], 
    required: true 
  },
  isOverride: { 
    type: Boolean, 
    default: false 
  },
  overrideTime: { 
    type: Date 
  }
});

module.exports = mongoose.model('PredictiveDecision', predictiveDecisionSchema);
