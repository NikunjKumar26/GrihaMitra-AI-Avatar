/**
 * Verification Script for GrihaMitraAgent Orchestrator
 */

const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from Backend/.env
dotenv.config({ path: path.join(__dirname, '../../Backend/.env') });

console.log('Testing GrihaMitra Agent Orchestrator loading...');

try {
  const GrihaMitraAgent = require(path.join(__dirname, '../../Backend/agent'));
  
  console.log('✓ GrihaMitra Agent successfully loaded!');
  console.log('Exposed Engines & Facades:');
  const keys = Object.keys(GrihaMitraAgent);
  keys.forEach(key => {
    console.log(`  - [Engine/Facade] ${key}: ${typeof GrihaMitraAgent[key] === 'object' ? 'Object' : typeof GrihaMitraAgent[key]}`);
  });

  // Verify that all 11 engines are present as properties
  const expectedEngines = [
    'ContextEngine',
    'MemoryEngine',
    'RoutineLearningEngine',
    'PredictiveAutomationEngine',
    'ExplainabilityEngine',
    'VoiceIntelligenceEngine',
    'AvatarIntelligenceEngine',
    'ProactiveDecisionEngine',
    'PlanningEngine',
    'VisionIntelligenceEngine',
    'KnowledgeEngine'
  ];

  let missing = false;
  expectedEngines.forEach(eng => {
    if (!GrihaMitraAgent[eng]) {
      console.error(`❌ Missing engine: ${eng}`);
      missing = true;
    } else {
      console.log(`  ✓ Engine validated: ${eng}`);
    }
  });

  if (missing) {
    console.error('❌ Validation Failed: Some engines are missing.');
    process.exit(1);
  }

  if (typeof GrihaMitraAgent.executeVoiceCommandPipeline !== 'function') {
    console.error('❌ Facade method executeVoiceCommandPipeline is missing or not a function!');
    process.exit(1);
  }

  console.log('✓ Facade method validated: executeVoiceCommandPipeline');
  console.log('\n🎉 ALL AGENT LOADING TESTS PASSED!');
  process.exit(0);
} catch (err) {
  console.error('❌ Failed to load GrihaMitra Agent:', err);
  process.exit(1);
}
