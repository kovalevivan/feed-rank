const mongoose = require('mongoose');

const SourceGroupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  // VK Sources
  vkSources: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VkSource'
  }],
  // Telegram Sources
  telegramSources: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TelegramSource'
  }],
  stopWords: [{
    type: String,
    trim: true
  }],
  active: {
    type: Boolean,
    default: true
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
  collection: 'sourcegroups'
});

// Update the updatedAt field before save
SourceGroupSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('SourceGroup', SourceGroupSchema);
