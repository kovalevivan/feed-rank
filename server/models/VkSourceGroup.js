const mongoose = require('mongoose');

const VkSourceGroupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  sources: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VkSource'
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
  collection: 'vksourcegroups', 
  dbName: 'feedrank'  // Use the feedrank database
});

// Update the updatedAt field before save
VkSourceGroupSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('VkSourceGroup', VkSourceGroupSchema); 