const bedrockService = require('../services/bedrockService');

/**
 * Generate human explanation for a predictive decision / automated action
 */
exports.generateActionExplanation = async (userName, roomName, deviceName, predictedAction, confidence, evidence, featureContributions) => {
  const feat = featureContributions || { user: 20, room: 20, device: 20, time: 20, dayOfWeek: 20 };
  
  const prompt = `You are GrihaMitra, the smart explainability module of the Sapno Ka Ghar AI smart home.
Explain to the home resident why the AI predicted or executed this action.
Action Details:
- Target User: ${userName}
- Room: ${roomName}
- Device: ${deviceName}
- Prediction: ${predictedAction}
- Confidence: ${confidence}%
- Event History Evidence: ${evidence}
- Feature Contributions:
  * Current Time/Hour: ${feat.time || 20}%
  * Room Activity: ${feat.room || 20}%
  * User Identity: ${feat.user || 20}%
  * Device History: ${feat.device || 20}%
  * Day of Week: ${feat.dayOfWeek || 20}%

Explain this in a single friendly, human-like sentence. Be concise, clear, and reassuring. Keep it under 40 words.`;

  return await bedrockService.invokeModel(prompt, 150, 0.3);
};

/**
 * Generate explanation for a mined routine
 */
exports.generateRoutineExplanation = async (routineName, userName, triggerTime, triggerRoom, devices) => {
  const deviceList = devices.map(d => d.deviceName).join(', ');
  
  const prompt = `You are GrihaMitra. Explain to the resident why the AI generated this smart routine:
- Routine: ${routineName}
- Mined for Resident: ${userName}
- Trigger Time: ${triggerTime}
- Trigger Room: ${triggerRoom}
- Devices Controlled: ${deviceList}

Explain in a single friendly sentence why this routine is helpful and what behaviors it matches. Keep it under 45 words.`;

  return await bedrockService.invokeModel(prompt, 150, 0.3);
};

/**
 * Generate explanation for a family profile update
 */
exports.generateProfileExplanation = async (memberName, role, changesMade, summary) => {
  const changesText = changesMade && changesMade.length > 0 ? changesMade.join(', ') : 'refined behavior parameters';
  
  const prompt = `You are GrihaMitra. Explain why the AI updated the smart profile rules for a resident:
- Resident Name: ${memberName}
- Resident Role: ${role}
- Parameters Updated: ${changesText}
- Telemetry summary: ${summary}

Explain in a single friendly sentence why this adjustment matches their lifestyle and saves energy or increases comfort. Keep it under 45 words.`;

  return await bedrockService.invokeModel(prompt, 150, 0.3);
};
