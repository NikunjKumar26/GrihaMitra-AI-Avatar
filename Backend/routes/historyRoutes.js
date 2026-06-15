const express = require('express');
const router = express.Router();
const historyController = require('../controllers/historyController');
const jwt = require('jsonwebtoken');

// Middleware to protect routes using JWT
const auth = (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) return res.status(401).json({ error: 'No token, authorization denied.' });
  try {
    const decoded = jwt.verify(token.replace('Bearer ', ''), process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(400).json({ error: 'Token is not valid.' });
  }
};

// History search endpoints
router.get('/home/:homeId', auth, historyController.getHomeHistory);
router.get('/user/:userId', auth, historyController.getUserHistory);
router.get('/room/:roomId', auth, historyController.getRoomHistory);
router.get('/device/:deviceId', auth, historyController.getDeviceHistory);

// Analytics endpoints
router.get('/analytics', auth, historyController.getAnalytics);
router.get('/analytics/:homeId', auth, historyController.getAnalytics);

module.exports = router;
