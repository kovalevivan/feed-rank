const mongoose = require('mongoose');

const MappingSchema = new mongoose.Schema({
  vkSource: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VkSource',
    required: true
  },
  telegramChannel: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TelegramChannel',
    required: true
  },
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
});

// Compound index to ensure unique mapping
MappingSchema.index({ vkSource: 1, telegramChannel: 1 }, { unique: true });

// Update the updatedAt field before save
MappingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Mapping', MappingSchema); 