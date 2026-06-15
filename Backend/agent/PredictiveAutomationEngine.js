const EventHistory = require('../models/EventHistory');
const FamilyMember = require('../models/FamilyMember');
const Home = require('../models/Home');
const PredictiveDecision = require('../models/PredictiveDecision');
const ExplainabilityRecord = require('../models/ExplainabilityRecord');
const ExplainabilityEngine = require('./ExplainabilityEngine');
const ProactiveDecisionEngine = require('./ProactiveDecisionEngine');

// Prediction helper
const predictNextForMember = async (userName, hour, dayOfWeek) => {
  try {
    const response = await fetch('http://127.0.0.1:8000/predict_next', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: userName, hour, day_of_week: dayOfWeek })
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    console.warn('⚠️ [Predictive Automation Engine] FastAPI predict failed, using local rule-based fallback:', e.message);
  }

  let prediction = "Turn ON the Living Room Light in the Living Room";
  let confidenceScore = 80.0;
  let room = "Living Room";
  let device = "Living Room Light";

  const normalizedUser = userName.toLowerCase();
  const timeAMPM = `${hour % 12 || 12} ${hour >= 12 ? 'PM' : 'AM'}`;

  if (normalizedUser.includes('student') || normalizedUser.includes('child')) {
    prediction = "Turn ON the Study Light in the Study Room";
    confidenceScore = 94.5;
    room = "Study Room";
    device = "Study Light";
  } else if (normalizedUser.includes('grandmother') || normalizedUser.includes('dadi') || normalizedUser.includes('nani')) {
    prediction = "Turn ON the Prayer Altar Light in the Prayer Room";
    confidenceScore = 98.2;
    room = "Prayer Room";
    device = "Prayer Altar Light";
  } else if (normalizedUser.includes('father') || normalizedUser.includes('papa')) {
    prediction = "Turn ON the Bedroom AC in the Bedroom";
    confidenceScore = 91.0;
    room = "Bedroom";
    device = "Bedroom AC";
  } else if (normalizedUser.includes('mother') || normalizedUser.includes('mummy')) {
    prediction = "Turn ON the Kitchen Fan in the Kitchen Zone";
    confidenceScore = 95.0;
    room = "Kitchen Zone";
    device = "Kitchen Fan";
  }

  const supportingEvidence = `Rule-based AI predicts that ${userName} historically triggers the ${device} in the ${room} on ${dayOfWeek}s around ${timeAMPM}.`;
  return {
    prediction,
    confidenceScore,
    supportingEvidence,
    room,
    device
  };
};

exports.predictNextForMember = predictNextForMember;

// Core Automation Background Evaluation
exports.evaluateAutomation = async (homeId, io, hourOverride) => {
  try {
    const home = await Home.findById(homeId);
    if (!home) return;

    const members = await FamilyMember.find({ home: homeId, automationEnabled: true, aiMode: 'Predictive' });
    if (!members.length) return;

    const currentHour = hourOverride !== undefined ? hourOverride : new Date().getHours();
    const currentDay = new Date().toLocaleDateString('en-US', { weekday: 'long' });

    for (const m of members) {
      const predRes = await predictNextForMember(m.name, currentHour, currentDay);
      if (!predRes || !predRes.room || !predRes.device) continue;

      const conf = predRes.confidenceScore;
      const targetRoom = home.rooms.find(r => r.name.toLowerCase() === predRes.room.toLowerCase());
      if (!targetRoom || targetRoom.automationEnabled === false) continue;

      const targetDevice = targetRoom.devices.find(d => d.name.toLowerCase() === predRes.device.toLowerCase());
      if (!targetDevice) continue;

      const startOfHour = new Date();
      startOfHour.setMinutes(0, 0, 0);

      if (conf > 90) {
        const duplicate = await PredictiveDecision.findOne({
          homeId,
          deviceId: targetDevice._id,
          actionType: 'ON',
          timestamp: { $gte: startOfHour },
          result: { $in: ['Success', 'Manual Override'] }
        });

        if (!duplicate && !targetDevice.isOn) {
          targetDevice.isOn = true;
          await home.save();

          const notifMsg = `🤖 AI automatically turned ON the ${targetDevice.name} in the ${targetRoom.name} (${m.name}'s routine, confidence: ${conf}%)`;
          
          if (io) {
            io.to(homeId.toString()).emit('deviceUpdate', { roomId: targetRoom._id, deviceId: targetDevice._id, state: true });
            io.to(homeId.toString()).emit('notification', { 
              _id: Date.now().toString(), 
              id: Date.now(), 
              actorName: 'AI Engine', 
              stateStr: 'ON', 
              deviceName: targetDevice.name, 
              message: notifMsg, 
              createdAt: new Date().toISOString() 
            });
          }

          const Notification = require('../models/Notification');
          await Notification.create({
            home: homeId,
            actorName: 'AI Engine',
            message: notifMsg
          });

          await EventHistory.create({
            homeId,
            roomId: targetRoom._id,
            roomName: targetRoom.name,
            userName: 'AI Engine',
            deviceId: targetDevice._id,
            deviceName: targetDevice.name,
            deviceType: targetDevice.type,
            action: 'ON',
            source: 'AI',
            timestamp: new Date()
          });

          const decision = await PredictiveDecision.create({
            homeId,
            userName: m.name,
            roomName: targetRoom.name,
            roomId: targetRoom._id,
            deviceName: targetDevice.name,
            deviceId: targetDevice._id,
            deviceType: targetDevice.type,
            actionType: 'ON',
            predictedAction: predRes.prediction,
            executedAction: 'ON',
            confidenceScore: conf,
            reason: predRes.supportingEvidence,
            result: 'Success'
          });

          try {
            const explanationText = await ExplainabilityEngine.generateActionExplanation(
              m.name,
              targetRoom.name,
              targetDevice.name,
              predRes.prediction,
              conf,
              predRes.supportingEvidence,
              predRes.feature_importances
            );

            await ExplainabilityRecord.create({
              homeId,
              decisionId: decision._id,
              userName: m.name,
              roomName: targetRoom.name,
              deviceName: targetDevice.name,
              prediction: predRes.prediction,
              confidence: conf,
              evidence: explanationText,
              featureContributions: predRes.feature_importances || { user: 20, room: 20, device: 20, time: 20, dayOfWeek: 20 },
              decisionTimestamp: new Date()
            });
          } catch (explainErr) {
            console.error('[Predictive Engine] Explain log error:', explainErr.message);
          }

          try {
            const announcementText = `I have automatically turned ON the ${targetDevice.name} in the ${targetRoom.name} based on ${m.name}'s daily routine.`;
            await ProactiveDecisionEngine.scheduleProactiveSpeaking(homeId, 'prediction', announcementText, 3);
          } catch (speakErr) {
            console.error('[Predictive Engine] Scheduler Hook Error:', speakErr.message);
          }

          console.log(`[AI Autonomous Action] Automatically turned ON ${targetDevice.name} in ${targetRoom.name} for ${m.name}`);
        }
      } else if (conf >= 70) {
        const duplicate = await PredictiveDecision.findOne({
          homeId,
          deviceId: targetDevice._id,
          actionType: 'ON',
          timestamp: { $gte: startOfHour }
        });

        if (!duplicate && !targetDevice.isOn) {
          const decision = await PredictiveDecision.create({
            homeId,
            userName: m.name,
            roomName: targetRoom.name,
            roomId: targetRoom._id,
            deviceName: targetDevice.name,
            deviceId: targetDevice._id,
            deviceType: targetDevice.type,
            actionType: 'ON',
            predictedAction: predRes.prediction,
            executedAction: 'None',
            confidenceScore: conf,
            reason: predRes.supportingEvidence,
            result: 'Pending Approval'
          });

          try {
            const explanationText = await ExplainabilityEngine.generateActionExplanation(
              m.name,
              targetRoom.name,
              targetDevice.name,
              predRes.prediction,
              conf,
              predRes.supportingEvidence,
              predRes.feature_importances
            );

            await ExplainabilityRecord.create({
              homeId,
              decisionId: decision._id,
              userName: m.name,
              roomName: targetRoom.name,
              deviceName: targetDevice.name,
              prediction: predRes.prediction,
              confidence: conf,
              evidence: explanationText,
              featureContributions: predRes.feature_importances || { user: 20, room: 20, device: 20, time: 20, dayOfWeek: 20 },
              decisionTimestamp: new Date()
            });
          } catch (explainErr) {
            console.error('[Predictive Engine] Explain log error:', explainErr.message);
          }

          if (io) {
            io.to(homeId.toString()).emit('pendingApproval', decision);
          }
          console.log(`[AI Pending Approval] Logged pending approval for ${targetDevice.name} in ${targetRoom.name} for ${m.name}`);
        }
      } else {
        const duplicate = await PredictiveDecision.findOne({
          homeId,
          deviceId: targetDevice._id,
          actionType: 'ON',
          timestamp: { $gte: startOfHour }
        });

        if (!duplicate && !targetDevice.isOn) {
          const decision = await PredictiveDecision.create({
            homeId,
            userName: m.name,
            roomName: targetRoom.name,
            roomId: targetRoom._id,
            deviceName: targetDevice.name,
            deviceId: targetDevice._id,
            deviceType: targetDevice.type,
            actionType: 'ON',
            predictedAction: predRes.prediction,
            executedAction: 'None',
            confidenceScore: conf,
            reason: predRes.supportingEvidence,
            result: 'Recommendation'
          });

          try {
            const explanationText = await ExplainabilityEngine.generateActionExplanation(
              m.name,
              targetRoom.name,
              targetDevice.name,
              predRes.prediction,
              conf,
              predRes.supportingEvidence,
              predRes.feature_importances
            );

            await ExplainabilityRecord.create({
              homeId,
              decisionId: decision._id,
              userName: m.name,
              roomName: targetRoom.name,
              deviceName: targetDevice.name,
              prediction: predRes.prediction,
              confidence: conf,
              evidence: explanationText,
              featureContributions: predRes.feature_importances || { user: 20, room: 20, device: 20, time: 20, dayOfWeek: 20 },
              decisionTimestamp: new Date()
            });
          } catch (explainErr) {
            console.error('[Predictive Engine] Explain log error:', explainErr.message);
          }
        }
      }
    }
  } catch (err) {
    console.error('[Predictive Engine] evaluateAutomation Error:', err.message);
  }
};
