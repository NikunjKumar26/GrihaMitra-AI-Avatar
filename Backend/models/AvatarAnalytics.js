const mongoose = require('mongoose');

const avatarAnalyticsSchema = new mongoose.Schema({
  homeId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Home', 
    required: true,
    unique: true
  },
  totalConversations: { 
    type: Number, 
    default: 0 
  },
  conversationsPerUser: [
    {
      user: { type: String, required: true },
      count: { type: Number, default: 0 }
    }
  ],
  mostActiveUser: { 
    type: String, 
    default: 'None' 
  },
  mostUsedPersonality: { 
    type: String, 
    default: 'Default' 
  },
  mostTriggeredEmotion: { 
    type: String, 
    default: 'Normal' 
  },
  avatarSpeakingTime: { 
    type: Number, 
    default: 0 // in seconds
  },
  averageConversationLength: { 
    type: Number, 
    default: 0 // in turns
  },
  averageConfidenceScore: { 
    type: Number, 
    default: 95 
  },
  languageDistribution: {
    English: { type: Number, default: 0 },
    Hindi: { type: Number, default: 0 },
    Mixed: { type: Number, default: 0 }
  },
  lastUpdated: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('AvatarAnalytics', avatarAnalyticsSchema);
