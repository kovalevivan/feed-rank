const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const TelegramChannel = require('../models/TelegramChannel');
const telegramService = require('../services/telegram');
const mongoose = require('mongoose');

// Get all Telegram channels
router.get('/', async (req, res) => {
  try {
    const channels = await TelegramChannel.find()
      .sort({ name: 1 });
    
    res.json(channels);
  } catch (error) {
    console.error('Error getting Telegram channels:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get a specific Telegram channel
router.get('/:id', async (req, res) => {
  try {
    console.log(`GET request for Telegram channel with ID: ${req.params.id}`);
    
    // Special case for 'new' or 'undefined' route - this should never happen if routes are configured correctly
    if (req.params.id === 'new' || req.params.id === 'undefined') {
      return res.status(400).json({ 
        message: 'Invalid request - this is a reserved identifier, not a valid channel ID',
        details: 'You may be seeing this if your frontend routing is not correctly configured to handle special routes separately from existing channel IDs'
      });
    }
    
    // Validate that ID is a valid ObjectId before querying
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid channel ID format' });
    }
    
    const channel = await TelegramChannel.findById(req.params.id);
    
    if (!channel) {
      return res.status(404).json({ message: 'Telegram channel not found' });
    }
    
    res.json(channel);
  } catch (error) {
    console.error(`Error getting Telegram channel ${req.params.id}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create a new Telegram channel
router.post(
  '/',
  [
    body('name').not().isEmpty().withMessage('Name is required'),
    body('chatId').optional(),
    body('username').optional()
  ],
  async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      console.log('Creating Telegram channel with data:', req.body);
      let { name, chatId, username } = req.body;
      const bot = telegramService.getBot();
      
      if (!bot) {
        console.error('Telegram bot not initialized');
        return res.status(500).json({ message: 'Telegram bot not initialized' });
      }
      
      // At least one of chatId or username must be provided
      if (!chatId && !username) {
        console.error('Neither chatId nor username provided');
        return res.status(400).json({ message: 'Either chatId or username is required' });
      }
      
      console.log('Input validation passed');
      
      // If username is provided but no chatId, try to resolve it
      if (username && !chatId) {
        // Add @ prefix if not present
        if (!username.startsWith('@')) {
          username = '@' + username;
        }
        
        console.log('Attempting to resolve username:', username);
        try {
          // Try to get chat info by username
          const chat = await bot.getChat(username);
          chatId = chat.id.toString();
          console.log('Resolved username to chatId:', chatId);
          
          // Update name with title if available and name wasn't explicitly provided
          if (chat.title && (!req.body.name || req.body.name === username.substring(1))) {
            name = chat.title;
            console.log('Updated name to:', name);
          }
        } catch (error) {
          console.error('Failed to resolve username:', error);
          return res.status(400).json({ 
            message: `Could not resolve channel ${username}. Make sure the bot is an admin of the channel and the username is correct.`,
            error: error.message
          });
        }
      }
      
      console.log('Processing channel with ID:', chatId);
      
      // Check if channel already exists
      const existingChannel = await TelegramChannel.findOne({ chatId });
      if (existingChannel) {
        console.error('Channel already exists with ID:', chatId);
        return res.status(400).json({ message: 'This Telegram channel is already added' });
      }
      
      console.log('Channel is new, creating record');
      
      // Create new channel
      const newChannel = new TelegramChannel({
        name,
        chatId,
        username,
        // Only add createdBy if req.user exists and has an _id
        ...(req.user && req.user._id ? { createdBy: req.user._id } : {})
      });
      
      // Try to send a test message before saving
      console.log('Attempting to send test message to channel:', chatId);
      try {
        await bot.sendMessage(
          chatId,
          `✅ Successfully connected to FeedRank!\n\nThis channel is now configured to receive viral posts from VK public groups.`
        );
        console.log('Test message sent successfully');
      } catch (error) {
        console.error('Failed to send test message:', error);
        return res.status(400).json({ 
          message: 'Could not send a test message to the channel. Please make sure the bot is an admin of the channel with permission to post messages.',
          error: error.message
        });
      }
      
      // Save new channel
      await newChannel.save();
      console.log('Channel saved successfully:', newChannel._id);
      
      res.status(201).json(newChannel);
    } catch (error) {
      console.error('Error creating Telegram channel:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Update a Telegram channel
router.put(
  '/:id',
  [
    body('name').optional(),
    body('chatId').optional(),
    body('username').optional(),
    body('active').optional().isBoolean().withMessage('Active must be boolean')
  ],
  async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      // Special case for 'new' route
      if (req.params.id === 'new') {
        return res.status(400).json({ 
          message: 'Invalid request - "new" is a reserved identifier, not a valid channel ID',
          details: 'You may be seeing this if your frontend routing is not correctly configured to handle the "new" route separately from existing channel IDs'
        });
      }
      
      // Validate that ID is a valid ObjectId before querying
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: 'Invalid channel ID format' });
      }
      
      // Find channel
      let channel = await TelegramChannel.findById(req.params.id);
      if (!channel) {
        return res.status(404).json({ message: 'Telegram channel not found' });
      }
      
      const { name, chatId, username, active } = req.body;
      
      // Update fields
      if (name !== undefined) {
        channel.name = name;
      }
      
      if (chatId !== undefined) {
        // Check if new chatId already exists
        if (chatId !== channel.chatId) {
          const existingChannel = await TelegramChannel.findOne({ chatId });
          if (existingChannel) {
            return res.status(400).json({ message: 'This Telegram channel ID is already used' });
          }
        }
        channel.chatId = chatId;
      }
      
      if (username !== undefined) {
        channel.username = username;
      }
      
      if (active !== undefined) {
        channel.active = active;
      }
      
      // Save updated channel
      await channel.save();
      
      res.json(channel);
    } catch (error) {
      console.error(`Error updating Telegram channel ${req.params.id}:`, error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Delete a Telegram channel
router.delete('/:id', async (req, res) => {
  try {
    // Special case for 'new' route
    if (req.params.id === 'new') {
      return res.status(400).json({ 
        message: 'Invalid request - "new" is a reserved identifier, not a valid channel ID',
        details: 'You may be seeing this if your frontend routing is not correctly configured to handle the "new" route separately from existing channel IDs'
      });
    }
    
    // Validate that ID is a valid ObjectId before querying
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid channel ID format' });
    }
    
    const channel = await TelegramChannel.findById(req.params.id);
    
    if (!channel) {
      return res.status(404).json({ message: 'Telegram channel not found' });
    }
    
    await channel.deleteOne();
    
    res.json({ message: 'Telegram channel deleted' });
  } catch (error) {
    console.error(`Error deleting Telegram channel ${req.params.id}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Send test message to a channel
router.post('/:id/test', async (req, res) => {
  try {
    // Special case for 'new' route
    if (req.params.id === 'new') {
      return res.status(400).json({ 
        message: 'Invalid request - "new" is a reserved identifier, not a valid channel ID',
        details: 'You may be seeing this if your frontend routing is not correctly configured to handle the "new" route separately from existing channel IDs'
      });
    }
    
    // Validate that ID is a valid ObjectId before querying
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid channel ID format' });
    }
    
    const channel = await TelegramChannel.findById(req.params.id);
    
    if (!channel) {
      return res.status(404).json({ message: 'Telegram channel not found' });
    }
    
    // Send test message
    const bot = telegramService.getBot();
    if (!bot) {
      return res.status(500).json({ message: 'Telegram bot not initialized' });
    }
    
    await bot.sendMessage(
      channel.chatId,
      `🧪 Test message from FeedRank\n\nThis is a test message to verify that the bot can send messages to this channel.`
    );
    
    res.json({ message: 'Test message sent successfully' });
  } catch (error) {
    console.error(`Error sending test message to Telegram channel ${req.params.id}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router; 