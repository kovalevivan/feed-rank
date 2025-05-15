const mongoose = require('mongoose');

const TelegramChannelSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  chatId: {
    type: String,
    required: true,
    trim: true
  },
  username: {
    type: String,
    trim: true
  },
  active: {
    type: Boolean,
    default: true
  },
  postsForwarded: {
    type: Number,
    default: 0
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
  collection: 'telegramchannels', 
  dbName: 'feedrank'  // Use the feedrank database
});

// Update the updatedAt field before save
TelegramChannelSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('TelegramChannel', TelegramChannelSchema); 