const mongoose = require('mongoose');

const ViewHistorySchema = new mongoose.Schema({
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true
  },
  vkSource: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VkSource',
    required: true
  },
  postId: {
    type: String,
    required: true
  },
  viewCount: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  },
  // Store the difference from previous check
  viewDelta: {
    type: Number,
    default: 0
  },
  // Store the time delta in minutes from previous check
  timeDeltaMinutes: {
    type: Number,
    default: 0
  },
  // Views per minute growth rate
  growthRate: {
    type: Number,
    default: 0
  }
}, { 
  collection: 'viewhistory', 
  dbName: 'feedrank'
});

// Compound index for efficient queries
ViewHistorySchema.index({ post: 1, timestamp: -1 });
ViewHistorySchema.index({ vkSource: 1, postId: 1, timestamp: -1 });
// Index for cleanup of old records
ViewHistorySchema.index({ timestamp: 1 });

module.exports = mongoose.model('ViewHistory', ViewHistorySchema); 