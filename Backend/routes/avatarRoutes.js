const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const avatarController = require('../controllers/avatarController');

// JWT Authorization middleware
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

// Secured endpoints
router.post('/create-session', auth, avatarController.createSession);
router.post('/start', auth, avatarController.startSession);
router.post('/speak', auth, avatarController.speak);
router.post('/stop', auth, avatarController.stopSession);
router.get('/status', auth, avatarController.status);
router.get('/analytics/usage', auth, avatarController.getUsageAnalytics);

module.exports = router;
