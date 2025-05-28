const mongoose = require('mongoose');

// Define a nested schema for detailed statistics
const DetailedStatsSchema = new mongoose.Schema({
  count: { type: Number, default: 0 },
  mean: { type: Number, default: 0 },
  median: { type: Number, default: 0 },
  min: { type: Number, default: 0 },
  max: { type: Number, default: 0 },
  standardDeviation: { type: Number, default: 0 },
  percentiles: {
    p25: { type: Number, default: 0 },
    p50: { type: Number, default: 0 },
    p75: { type: Number, default: 0 },
    p90: { type: Number, default: 0 },
    p95: { type: Number, default: 0 },
    p99: { type: Number, default: 0 }
  }
}, { _id: false });

const VkSourceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  url: {
    type: String,
    required: true,
    trim: true
  },
  groupId: {
    type: String,
    required: true,
    trim: true
  },
  thresholdType: {
    type: String,
    enum: ['auto', 'manual'],
    default: 'auto'
  },
  thresholdMethod: {
    type: String,
    enum: ['average', 'statistical'],
    default: 'statistical'
  },
  statisticalMultiplier: {
    type: Number,
    default: 1.5
  },
  manualThreshold: {
    type: Number,
    default: 0
  },
  calculatedThreshold: {
    type: Number,
    default: 0
  },
  checkFrequency: {
    type: Number,   // In minutes
    default: 60     // Default: hourly
  },
  postsToCheck: {
    type: Number,
    default: 50,    // Default: 50 posts
    min: 10,        // Minimum: 10 posts
    max: 100        // Maximum: 100 posts (VK API limit)
  },
  lastChecked: {
    type: Date,
    default: null
  },
  active: {
    type: Boolean,
    default: true
  },
  lastPostsData: {
    averageViews: { type: Number, default: 0 },
    postsAnalyzed: { type: Number, default: 0 },
    lastAnalysisDate: { type: Date, default: null },
    thresholdMethod: { type: String, default: 'statistical' },
    multiplierUsed: { type: Number, default: 1.5 },
    detailedStats: { type: DetailedStatsSchema, default: () => ({}) }
  },
  experimentalViewTracking: {
    type: Boolean,
    default: false
  },
  highDynamicsDetection: {
    enabled: {
      type: Boolean,
      default: true
    },
    growthRateThreshold: {
      type: Number,
      default: 30 // views per minute
    },
    minDataPoints: {
      type: Number,
      default: 4 // minimum view history entries needed
    }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { 
  collection: 'vksources', 
  dbName: 'feedrank'  // Use the feedrank database
});

// Update the updatedAt field before save
VkSourceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('VkSource', VkSourceSchema); 