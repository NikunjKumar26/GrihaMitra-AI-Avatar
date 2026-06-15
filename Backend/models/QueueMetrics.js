const mongoose = require('mongoose');

const queueMetricsSchema = new mongoose.Schema({
  queue: { type: String, required: true, unique: true },
  jobsProcessed: { type: Number, default: 0 },
  failedJobs: { type: Number, default: 0 },
  queueLength: { type: Number, default: 0 },
  averageProcessingTime: { type: Number, default: 0 },
  activeWorkers: { type: Number, default: 1 },
  retryCounts: { type: Number, default: 0 },
  lastFailureReason: { type: String, default: '' },
  lastFailureAt: { type: Date, default: null },
  lastSuccessfulExecution: { type: Date, default: null },
  queueHealthScore: { type: Number, default: 100 },
  successRate: { type: Number, default: 100 },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('QueueMetrics', queueMetricsSchema);
