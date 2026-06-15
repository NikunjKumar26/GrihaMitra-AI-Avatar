const mongoose = require('mongoose');

const familyMemberSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  role: { 
    type: String, 
    enum: ['Father', 'Mother', 'Grandmother', 'Student', 'Guest'], 
    required: true 
  },
  age: { 
    type: Number 
  },
  preferredLanguage: { 
    type: String, 
    default: 'English' 
  },
  voiceProfile: { 
    type: String, 
    default: 'Aditi' // Polly voice: Aditi, Raveena, Kajal, etc.
  },
  avatarImage: { 
    type: String, 
    default: '👨' // Standard emoji avatar based on role
  },
  routineProfile: { 
    type: String, 
    enum: ['Office Routine', 'Cooking Routine', 'Pooja Routine', 'Study Routine', 'Dynamic Routine'],
    default: 'Dynamic Routine'
  },
  preferences: {
    tempPreference: { type: Number, default: 24 },
    lightingStyle: { type: String, default: 'Warm White' },
    extraNotes: { type: String, default: '' }
  },
  activeHours: {
    type: String,
    default: '9 AM - 9 PM'
  },
  frequentlyUsedRooms: [{
    type: String
  }],
  frequentlyUsedDevices: [{
    type: String
  }],
  mostVisitedRoom: {
    type: String,
    default: ''
  },
  mostUsedDevice: {
    type: String,
    default: ''
  },
  mostActiveTime: {
    type: String,
    default: ''
  },
  dailyActivityPatterns: {
    type: String,
    default: ''
  },
  aiMode: {
    type: String,
    enum: ['Learning', 'Predictive'],
    default: 'Learning'
  },
  learningStartedAt: {
    type: Date,
    default: Date.now
  },
  lastAIEvaluationAt: {
    type: Date
  },
  aiEvaluationLogs: [{
    evaluatedAt: {
      type: Date,
      default: Date.now
    },
    modeAtEvaluation: String,
    changesMade: [String],
    summary: String
  }],
  automationEnabled: {
    type: Boolean,
    default: true
  },
  home: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Home', 
    required: true 
  }
}, { timestamps: true });

module.exports = mongoose.model('FamilyMember', familyMemberSchema);
