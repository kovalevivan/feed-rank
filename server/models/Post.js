const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  // Source references - one of these should be set
  vkSource: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VkSource'
  },
  telegramSource: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TelegramSource'
  },
  // Original post identifier (VK post ID or Telegram message ID)
  postId: {
    type: String
  },
  originalPostId: {
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
  // Telegram-specific metrics
  forwardCount: {
    type: Number,
    default: 0
  },
  reactionCount: {
    type: Number,
    default: 0
  },
  commentCount: {
    type: Number,
    default: 0
  },
  replyCount: {
    type: Number,
    default: 0
  },
  attachments: [{
    type: {
      type: String,
      enum: ['photo', 'video', 'link', 'doc', 'document', 'audio', 'poll', 'other']
    },
    url: String,
    thumbnailUrl: String,
    // Telegram-specific fields
    fileId: String,
    fileName: String,
    mimeType: String,
    width: Number,
    height: Number,
    duration: Number
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

// Compound indexes for post uniqueness
PostSchema.index({ vkSource: 1, postId: 1 }, { unique: true, sparse: true });
PostSchema.index({ telegramSource: 1, originalPostId: 1 }, { unique: true, sparse: true });

// Validation: ensure either vkSource or telegramSource is set, but not both
PostSchema.pre('validate', function(next) {
  const hasVkSource = !!this.vkSource;
  const hasTelegramSource = !!this.telegramSource;
  
  if (!hasVkSource && !hasTelegramSource) {
    return next(new Error('Either vkSource or telegramSource must be set'));
  }
  
  if (hasVkSource && hasTelegramSource) {
    return next(new Error('Cannot have both vkSource and telegramSource set'));
  }
  
  // For VK posts, postId is required
  if (hasVkSource && !this.postId) {
    return next(new Error('postId is required for VK posts'));
  }
  
  next();
});

// Update the updatedAt field before save
PostSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Post', PostSchema); 