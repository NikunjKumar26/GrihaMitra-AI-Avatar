const express = require('express');
const router = express.Router();
const learningController = require('../controllers/learningController');
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

// Routing endpoints
router.post('/train', auth, learningController.trainModel);
router.post('/generate-routines', auth, learningController.generateRoutines);
router.post('/predict-next', auth, learningController.predictNextAction);
router.get('/dashboard', auth, learningController.getLearningDashboard);
router.get('/automation-dashboard', auth, learningController.getAutomationDashboard);
router.post('/feedback', auth, learningController.handleFeedback);
router.post('/toggle-room-automation', auth, learningController.toggleRoomAutomation);
router.post('/toggle-member-automation', auth, learningController.toggleMemberAutomation);
router.post('/evaluate', auth, learningController.triggerEvaluation);
router.post('/explain/prediction', auth, learningController.explainPrediction);
router.get('/explain/action/:decisionId', auth, learningController.explainAction);
router.get('/explain/routine/:routineId', auth, learningController.explainRoutine);
router.get('/explain/profile/:memberId', auth, learningController.explainProfileUpdate);

module.exports = router;
