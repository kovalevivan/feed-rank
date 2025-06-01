const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  vkSource: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VkSource',
    required: true
  },
  postId: {
    type: String,
    required: true
  },
  text: {
    type: String,
    trim: true
  },
  viewCount: {
    type: Number,
    default: 0
  },
  likeCount: {
    type: Number,
    default: 0
  },
  repostCount: {
    type: Number,
    default: 0
  },
  attachments: [{
    type: {
      type: String,
      enum: ['photo', 'video', 'link', 'doc', 'audio', 'poll', 'other']
    },
    url: String,
    thumbnailUrl: String
  }],
  isViral: {
    type: Boolean,
    default: false
  },
  wasHighDynamics: {
    type: Boolean,
    default: false
  },
  highDynamicsForwardedAt: {
    type: Date,
    default: null
  },
  thresholdUsed: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'forwarded'],
    default: 'pending'
  },
  forwardedTo: [{
    telegramChannel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TelegramChannel'
    },
    telegramMessageId: String,
    forwardedAt: {
      type: Date,
      default: Date.now
    }
  }],
  originalPostUrl: {
    type: String
  },
  publishedAt: {
    type: Date
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
  collection: 'posts', 
  dbName: 'feedrank'  // Use the feedrank database
});

// Compound index for post uniqueness
PostSchema.index({ vkSource: 1, postId: 1 }, { unique: true });

// Update the updatedAt field before save
PostSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Post', PostSchema); 