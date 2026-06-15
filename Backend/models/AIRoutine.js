const mongoose = require('mongoose');

const aiRoutineSchema = new mongoose.Schema({
  homeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Home',
    required: true
  },
  userName: {
    type: String,
    required: true
  },
  routineName: {
    type: String,
    required: true
  },
  triggerTime: {
    type: String,
    required: true
  },
  triggerRoom: {
    type: String,
    required: true
  },
  predictedDevices: [{
    deviceName: {
      type: String,
      required: true
    },
    deviceType: {
      type: String,
      required: true
    },
    action: {
      type: String,
      required: true
    }
  }],
  confidenceScore: {
    type: Number,
    required: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('AIRoutine', aiRoutineSchema);
