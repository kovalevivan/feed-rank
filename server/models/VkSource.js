const mongoose = require('mongoose');

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
    lastAnalysisDate: { type: Date, default: null }
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