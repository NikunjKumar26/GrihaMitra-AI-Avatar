const mongoose = require('mongoose');

const eventHistorySchema = new mongoose.Schema({
  homeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Home',
    required: true
  },
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  roomName: {
    type: String,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  userName: {
    type: String,
    required: true
  },
  deviceId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
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
  },
  source: {
    type: String,
    enum: ['MANUAL', 'AI', 'SCHEDULE'],
    default: 'MANUAL',
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  },
  dayOfWeek: {
    type: String
  },
  hour: {
    type: Number
  },
  minute: {
    type: Number
  }
}, {
  timestamps: true
});

// Compound indexes to speed up pagination, sorting, and aggregation
eventHistorySchema.index({ homeId: 1, timestamp: -1 });
eventHistorySchema.index({ userId: 1, timestamp: -1 });
eventHistorySchema.index({ roomId: 1, timestamp: -1 });
eventHistorySchema.index({ deviceId: 1, timestamp: -1 });

// Pre-save middleware to automatically populate AI-related fields from timestamp
eventHistorySchema.pre('save', function() {
  const date = this.timestamp || new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  this.dayOfWeek = days[date.getDay()];
  this.hour = date.getHours();
  this.minute = date.getMinutes();
});

module.exports = mongoose.model('EventHistory', eventHistorySchema);
