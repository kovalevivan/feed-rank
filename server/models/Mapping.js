const mongoose = require('mongoose');

const MappingSchema = new mongoose.Schema({
  vkSource: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VkSource',
    required: function() {
      return !this.vkSourceGroup; // Required if no group is specified
    }
  },
  vkSourceGroup: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VkSourceGroup',
    required: function() {
      return !this.vkSource; // Required if no source is specified
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

// Update the unique index to account for both individual sources and groups
MappingSchema.index(
  { 
    vkSource: 1, 
    vkSourceGroup: 1, 
    telegramChannel: 1 
  }, 
  { 
    unique: true,
    partialFilterExpression: {
      $or: [
        { vkSource: { $exists: true, $ne: null } },
        { vkSourceGroup: { $exists: true, $ne: null } }
      ]
    }
  }
);

// Update the updatedAt field before save
MappingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Validation to ensure either vkSource or vkSourceGroup is provided, but not both
MappingSchema.pre('validate', function(next) {
  if ((this.vkSource && this.vkSourceGroup) || (!this.vkSource && !this.vkSourceGroup)) {
    this.invalidate('vkSource', 'Either vkSource OR vkSourceGroup must be provided, but not both');
  }
  next();
});

module.exports = mongoose.model('Mapping', MappingSchema); 