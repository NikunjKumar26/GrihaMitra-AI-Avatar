const mongoose = require('mongoose');

const aiUsageMetricsSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now
  },
  serviceType: {
    type: String,
    enum: ['Bedrock', 'Polly', 'Whisper'],
    required: true
  },
  modelId: {
    type: String,
    required: true
  },
  requestCount: {
    type: Number,
    default: 1
  },
  inputTokens: {
    type: Number,
    default: 0
  },
  outputTokens: {
    type: Number,
    default: 0
  },
  charactersProcessed: {
    type: Number,
    default: 0
  },
  latencyMs: {
    type: Number,
    default: 0
  },
  isError: {
    type: Boolean,
    default: false
  },
  errorMessage: {
    type: String,
    default: ''
  },
  costEstimation: {
    type: Number,
    default: 0.0
  }
});

module.exports = mongoose.model('AIUsageMetrics', aiUsageMetricsSchema);
