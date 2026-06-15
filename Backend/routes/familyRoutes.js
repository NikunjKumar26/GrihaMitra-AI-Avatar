const express = require('express');
const router = express.Router();
const familyController = require('../controllers/familyController');
const jwt = require('jsonwebtoken');

// Auth middleware to protect routes
const auth = (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) return res.status(401).json({ error: 'No token, authorization denied' });
  try {
    const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(400).json({ error: 'Token is not valid' });
  }
};

const contextController = require('../controllers/contextController');

// Member management CRUD
router.get('/members', auth, familyController.getMembers);
router.post('/members', auth, familyController.createMember);
router.put('/members/:id', auth, familyController.updateMember);
router.delete('/members/:id', auth, familyController.deleteMember);

// Activity logs telemetry
router.post('/activity', auth, familyController.logActivity);

// AI Dashboard and analytics
router.get('/intelligence', auth, familyController.getIntelligence);

// Chat with assistant
router.post('/chat', auth, familyController.chatWithAssistant);

// Polly Text to speech output
router.post('/speech', auth, familyController.synthesizeSpeech);

// Speech to Text transcription
router.post('/speech-to-text', auth, familyController.speechToText);

// Voice Command Processing
router.post('/voice-command', auth, familyController.voiceCommand);

// Voice dashboard logs and analytics
router.get('/voice-dashboard', auth, familyController.getVoiceDashboard);

// Avatar Engine routes
const avatarController = require('../controllers/avatarController');
router.post('/avatar/interact', auth, avatarController.interact);
router.get('/avatar/memory', auth, avatarController.getMemory);
router.get('/avatar/analytics', auth, avatarController.getAnalytics);
router.post('/avatar/notify', auth, avatarController.proactiveNotification);

// Family Context Engine routes
router.get('/context/profile/:memberId', auth, contextController.syncAndGetContext);
router.put('/context/profile/:memberId', auth, contextController.updateContext);
router.get('/context/active-rooms/:memberId', auth, contextController.getActiveRooms);
router.get('/context/frequent-devices/:memberId', auth, contextController.getFrequentDevices);
router.get('/context/summary/:memberId', auth, contextController.getPersonalizedSummary);

module.exports = router;
