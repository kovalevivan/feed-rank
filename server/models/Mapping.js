const mongoose = require('mongoose');

const MappingSchema = new mongoose.Schema({
  sourceGroup: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SourceGroup',
    required: false // Not required to support legacy mappings
  },
  // Keep legacy fields for backward compatibility with existing mappings
  vkSource: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VkSource',
    required: false
  },
  vkSourceGroup: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VkSourceGroup',
    required: false
  },
  telegramSource: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TelegramSource',
    required: false
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

// Create unique index for sourceGroup + telegramChannel combination
MappingSchema.index(
  { 
    sourceGroup: 1,
    telegramChannel: 1 
  }, 
  { 
    unique: true,
    name: 'sourceGroup_telegramChannel_unique'
  }
);

// Keep legacy index for backward compatibility with existing mappings
MappingSchema.index(
  { 
    vkSource: 1, 
    vkSourceGroup: 1, 
    telegramSource: 1,
    telegramChannel: 1 
  }, 
  { 
    unique: true,
    sparse: true, // Only apply to documents that have these fields
    name: 'legacy_mapping_unique',
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
  // Check for new unified sourceGroup format
  const hasSourceGroup = Boolean(this.sourceGroup);
  
  // Check for legacy source fields
  const legacySources = [this.vkSource, this.vkSourceGroup, this.telegramSource].filter(Boolean);
  const hasLegacySources = legacySources.length > 0;
  
  // Either sourceGroup OR exactly one legacy source must be provided, but not both
  if (hasSourceGroup && hasLegacySources) {
    this.invalidate('source', 'Cannot use both sourceGroup and legacy source fields (vkSource, vkSourceGroup, telegramSource)');
  } else if (!hasSourceGroup && legacySources.length !== 1) {
    this.invalidate('source', 'Either sourceGroup must be provided, or exactly one legacy source type (vkSource, vkSourceGroup, or telegramSource) must be provided');
  } else if (!hasSourceGroup && !hasLegacySources) {
    this.invalidate('source', 'Either sourceGroup or one legacy source type must be provided');
  }
  
  next();
});

module.exports = mongoose.model('Mapping', MappingSchema); 