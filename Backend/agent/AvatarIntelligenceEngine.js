const heygenService = require('../services/heygenService');


const STATES = {
  LISTENING: 'Listening',
  THINKING: 'Thinking',
  SPEAKING: 'Speaking',
  EXPLAINING: 'Explaining',
  GREETING: 'Greeting',
  ALERTING: 'Alerting'
};

const EMOTIONS = {
  HAPPY: 'Happy',
  NORMAL: 'Normal',
  CONCERNED: 'Concerned',
  ALERT: 'Alert',
  CELEBRATION: 'Celebration'
};

/**
 * Determine dynamic emotion and state based on dialogue or notification context
 */
exports.determineEmotion = (context = {}) => {
  const { type, text = '', query = '', alertType = '', role = 'Default' } = context;
  
  let emotionState = EMOTIONS.NORMAL;
  let avatarState = STATES.SPEAKING;

  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();

  // 1. Notification severity mapping
  if (alertType || type === 'alert') {
    const alertId = alertType || type;
    if (alertId === 'security' || alertId === 'intrusion' || textLower.includes('intrusion') || textLower.includes('unauthorized')) {
      emotionState = EMOTIONS.ALERT;
      avatarState = STATES.ALERTING;
    } else if (alertId === 'power_failure' || alertId === 'water_tank' || alertId === 'low_water_level' || textLower.includes('failure') || textLower.includes('low')) {
      emotionState = EMOTIONS.CONCERNED;
      avatarState = STATES.ALERTING;
    } else {
      emotionState = EMOTIONS.CONCERNED;
      avatarState = STATES.ALERTING;
    }
    return { emotionState, avatarState };
  }

  // 2. Greetings
  if (queryLower.includes('hello') || queryLower.includes('hi') || queryLower.includes('namaste') || queryLower.includes('good morning') || queryLower.includes('pranam')) {
    emotionState = EMOTIONS.HAPPY;
    avatarState = STATES.GREETING;
    return { emotionState, avatarState };
  }

  // 3. Explanations
  if (queryLower.includes('why') || queryLower.includes('explain') || textLower.includes('because') || textLower.includes('therefore') || textLower.includes('observed')) {
    emotionState = EMOTIONS.NORMAL;
    avatarState = STATES.EXPLAINING;
    return { emotionState, avatarState };
  }

  // 4. Celebration or success cues
  if (textLower.includes('congratulations') || textLower.includes('crush') || textLower.includes('success') || textLower.includes('perfect') || textLower.includes('celebrate')) {
    emotionState = EMOTIONS.CELEBRATION;
    avatarState = STATES.SPEAKING;
    return { emotionState, avatarState };
  }

  // 5. General sentiment keyword matching
  if (textLower.includes('happy') || textLower.includes('glad') || textLower.includes('great') || textLower.includes('excellent') || textLower.includes('good')) {
    emotionState = EMOTIONS.HAPPY;
  } else if (textLower.includes('sorry') || textLower.includes('worry') || textLower.includes('unfortunately') || textLower.includes('danger') || textLower.includes('problem')) {
    emotionState = EMOTIONS.CONCERNED;
  }

  // 6. Personality context adjustment
  if (role === 'Grandmother' && emotionState === EMOTIONS.NORMAL) {
    // Warm tone defaults to happy
    emotionState = EMOTIONS.HAPPY;
  }

  return { emotionState, avatarState };
};

exports.STATES = STATES;
exports.EMOTIONS = EMOTIONS;

/**
 * Create a new HeyGen streaming avatar session
 */
exports.createAvatarSession = async (quality = 'medium', avatarName = 'Bryan_FitnessCoach_public', voiceConfig = {}) => {
  return await heygenService.createSession(quality, avatarName, voiceConfig);
};

/**
 * Start the HeyGen streaming avatar session
 */
exports.startAvatarSession = async (sessionId, sdpAnswer) => {
  return await heygenService.startSession(sessionId, sdpAnswer);
};

/**
 * Send a speech task to the HeyGen streaming avatar
 */
exports.speakWithAvatar = async (sessionId, text) => {
  return await heygenService.speak(sessionId, text);
};

/**
 * Stop the HeyGen streaming avatar session
 */
exports.stopAvatarSession = async (sessionId) => {
  return await heygenService.stopSession(sessionId);
};
