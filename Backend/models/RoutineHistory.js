const mongoose = require('mongoose');

const routineHistorySchema = new mongoose.Schema({
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FamilyMember',
    required: true
  },
  activity: {
    type: String,
    required: true
  },
  room: {
    type: String,
    default: ''
  },
  device: {
    type: String,
    default: ''
  },
  action: {
    type: String,
    default: ''
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('RoutineHistory', routineHistorySchema);
