const mongoose = require('mongoose');

const TelegramSourceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  chatId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  username: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['channel', 'group', 'supergroup'],
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  active: {
    type: Boolean,
    default: true
  },
  // Access status tracking
  accessStatus: {
    type: String,
    enum: ['active', 'access_denied', 'not_found', 'error'],
    default: 'active'
  },
  lastAccessError: {
    type: String,
    trim: true
  },
  lastAccessAttempt: {
    type: Date,
    default: Date.now
  },
  // Viral detection settings
  thresholdType: {
    type: String,
    enum: ['auto', 'manual'],
    default: 'auto'
  },
  manualThreshold: {
    type: Number,
    min: 0
  },
  calculatedThreshold: {
    type: Number,
    min: 0
  },
  // Threshold calculation method and settings
  thresholdMethod: {
    type: String,
    enum: ['statistical', 'percentile'],
    default: 'statistical'
  },
  statisticalMultiplier: {
    type: Number,
    default: 0.5,
    min: 0.1
  },
  // Analysis data from last threshold calculation
  lastPostsData: {
    postsAnalyzed: Number,
    lastAnalysisDate: Date,
    thresholdMethod: String,
    multiplierUsed: Number,
    detailedStats: {
      count: Number,
      mean: Number,
      median: Number,
      min: Number,
      max: Number,
      standardDeviation: Number,
      percentiles: {
        p25: Number,
        p50: Number,
        p75: Number,
        p90: Number,
        p95: Number,
        p99: Number
      }
    }
  },
  // Check frequency in minutes
  checkFrequency: {
    type: Number,
    default: 60,
    min: 5
  },
  // Statistics
  totalPosts: {
    type: Number,
    default: 0
  },
  viralPosts: {
    type: Number,
    default: 0
  },
  // Tracking
  lastChecked: {
    type: Date
  },
  lastPostId: {
    type: Number // Telegram message ID of the last processed message
  },
  // Engagement-based viral detection settings
  viralDetectionMetric: {
    type: String,
    enum: ['views', 'reactions', 'comments', 'engagement_score'],
    default: 'reactions'
  },
  minReactionsForViral: {
    type: Number,
    default: 10
  },
  minCommentsForViral: {
    type: Number,
    default: 5
  },
  minForwardsForViral: {
    type: Number,
    default: 3
  },
  // Legacy view-based setting (kept for backward compatibility)
  minViewsForViral: {
    type: Number,
    default: 1000
  },
  // Engagement score weights (for engagement_score metric)
  reactionWeight: {
    type: Number,
    default: 1.0,
    min: 0
  },
  commentWeight: {
    type: Number,
    default: 2.0,
    min: 0
  },
  forwardWeight: {
    type: Number,
    default: 3.0,
    min: 0
  },
  // Metadata
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
  collection: 'telegramsources'
});

// Update the updatedAt field before save
TelegramSourceSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for efficient queries
TelegramSourceSchema.index({ chatId: 1 });
TelegramSourceSchema.index({ active: 1 });
TelegramSourceSchema.index({ lastChecked: 1 });

module.exports = mongoose.model('TelegramSource', TelegramSourceSchema);
