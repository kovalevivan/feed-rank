const mongoose = require('mongoose');

const MappingSchema = new mongoose.Schema({
  vkSource: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VkSource',
    required: function() {
      return !this.vkSourceGroup && !this.telegramSource; // Required if no group or telegram source is specified
    }
  },
  vkSourceGroup: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VkSourceGroup',
    required: function() {
      return !this.vkSource && !this.telegramSource; // Required if no source or telegram source is specified
    }
  },
  telegramSource: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TelegramSource',
    required: function() {
      return !this.vkSource && !this.vkSourceGroup; // Required if no VK source or group is specified
    }
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
}, { 
  collection: 'mappings', 
  dbName: 'feedrank'  // Use the feedrank database
});

// Update the unique index to account for VK sources, groups, and Telegram sources
MappingSchema.index(
  { 
    vkSource: 1, 
    vkSourceGroup: 1, 
    telegramSource: 1,
    telegramChannel: 1 
  }, 
  { 
    unique: true,
    partialFilterExpression: {
      $or: [
        { vkSource: { $exists: true, $ne: null } },
        { vkSourceGroup: { $exists: true, $ne: null } },
        { telegramSource: { $exists: true, $ne: null } }
      ]
    }
  }
);

// Update the updatedAt field before save
MappingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Validation to ensure exactly one source type is provided
MappingSchema.pre('validate', function(next) {
  const sources = [this.vkSource, this.vkSourceGroup, this.telegramSource].filter(Boolean);
  if (sources.length !== 1) {
    this.invalidate('source', 'Exactly one source type (vkSource, vkSourceGroup, or telegramSource) must be provided');
  }
  next();
});

module.exports = mongoose.model('Mapping', MappingSchema); 