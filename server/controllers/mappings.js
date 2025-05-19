const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Mapping = require('../models/Mapping');
const VkSource = require('../models/VkSource');
const TelegramChannel = require('../models/TelegramChannel');

// Get all mappings
router.get('/', async (req, res) => {
  try {
    let mappings = await Mapping.find()
      .populate('vkSource')
      .populate('telegramChannel')
      .sort({ createdAt: -1 });
    
    // Filter out mappings with deleted sources or channels
    const validMappings = mappings.filter(mapping => mapping.vkSource && mapping.telegramChannel);
    
    // If some mappings have invalid references, clean them up
    if (validMappings.length < mappings.length) {
      console.warn(`Found ${mappings.length - validMappings.length} mappings with deleted references`);
      
      // Optionally, we could automatically clean up these invalid mappings
      // This section can be uncommented if that's desired behavior
      /*
      const invalidMappingIds = mappings
        .filter(mapping => !mapping.vkSource || !mapping.telegramChannel)
        .map(mapping => mapping._id);
        
      if (invalidMappingIds.length > 0) {
        const deleteResult = await Mapping.deleteMany({ _id: { $in: invalidMappingIds } });
        console.log(`Deleted ${deleteResult.deletedCount} invalid mappings`);
      }
      */
      
      // Return the valid mappings only
      mappings = validMappings;
    }
    
    res.json(mappings);
  } catch (error) {
    console.error('Error getting mappings:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get mappings for a specific VK source
router.get('/vk-source/:sourceId', async (req, res) => {
  try {
    // First verify source exists
    const source = await VkSource.findById(req.params.sourceId);
    if (!source) {
      return res.status(404).json({ message: 'VK source not found' });
    }
    
    let mappings = await Mapping.find({ vkSource: req.params.sourceId })
      .populate('vkSource')
      .populate('telegramChannel')
      .sort({ createdAt: -1 });
    
    // Filter out mappings with deleted channels
    mappings = mappings.filter(mapping => mapping.telegramChannel);
    
    res.json(mappings);
  } catch (error) {
    console.error(`Error getting mappings for VK source ${req.params.sourceId}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get mappings for a specific Telegram channel
router.get('/telegram-channel/:channelId', async (req, res) => {
  try {
    // First verify channel exists
    const channel = await TelegramChannel.findById(req.params.channelId);
    if (!channel) {
      return res.status(404).json({ message: 'Telegram channel not found' });
    }
    
    let mappings = await Mapping.find({ telegramChannel: req.params.channelId })
      .populate('vkSource')
      .populate('telegramChannel')
      .sort({ createdAt: -1 });
    
    // Filter out mappings with deleted sources
    mappings = mappings.filter(mapping => mapping.vkSource);
    
    res.json(mappings);
  } catch (error) {
    console.error(`Error getting mappings for Telegram channel ${req.params.channelId}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get a specific mapping
router.get('/:id', async (req, res) => {
  try {
    const mapping = await Mapping.findById(req.params.id)
      .populate('vkSource')
      .populate('telegramChannel');
    
    if (!mapping) {
      return res.status(404).json({ message: 'Mapping not found' });
    }
    
    // Check if either the source or channel has been deleted
    if (!mapping.vkSource || !mapping.telegramChannel) {
      return res.status(400).json({ 
        message: 'Invalid mapping', 
        details: !mapping.vkSource ? 'VK source has been deleted' : 'Telegram channel has been deleted'
      });
    }
    
    res.json(mapping);
  } catch (error) {
    console.error(`Error getting mapping ${req.params.id}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create a new mapping
router.post(
  '/',
  [
    body('vkSource').isMongoId().withMessage('Valid VK source ID is required'),
    body('telegramChannel').isMongoId().withMessage('Valid Telegram channel ID is required'),
    body('active').optional().isBoolean().withMessage('Active must be boolean')
  ],
  async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const { vkSource, telegramChannel, active } = req.body;
      
      // Verify source and channel exist
      const source = await VkSource.findById(vkSource);
      if (!source) {
        return res.status(404).json({ message: 'VK source not found' });
      }
      
      const channel = await TelegramChannel.findById(telegramChannel);
      if (!channel) {
        return res.status(404).json({ message: 'Telegram channel not found' });
      }
      
      // Check if mapping already exists
      const existingMapping = await Mapping.findOne({
        vkSource,
        telegramChannel
      });
      
      if (existingMapping) {
        return res.status(400).json({ message: 'This mapping already exists' });
      }
      
      // Create new mapping
      const newMapping = new Mapping({
        vkSource,
        telegramChannel,
        active: active !== undefined ? active : true,
        createdBy: req.user?._id // If authentication is implemented
      });
      
      // Save new mapping
      await newMapping.save();
      
      // Populate response
      await newMapping.populate('vkSource');
      await newMapping.populate('telegramChannel');
      
      res.status(201).json(newMapping);
    } catch (error) {
      console.error('Error creating mapping:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Update a mapping
router.put(
  '/:id',
  [
    body('active').isBoolean().withMessage('Active must be boolean')
  ],
  async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      // Find mapping
      let mapping = await Mapping.findById(req.params.id);
      if (!mapping) {
        return res.status(404).json({ message: 'Mapping not found' });
      }
      
      const { active } = req.body;
      
      // Update active status
      mapping.active = active;
      
      // Save updated mapping
      await mapping.save();
      
      // Populate response
      await mapping.populate('vkSource');
      await mapping.populate('telegramChannel');
      
      res.json(mapping);
    } catch (error) {
      console.error(`Error updating mapping ${req.params.id}:`, error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Delete a mapping
router.delete('/:id', async (req, res) => {
  try {
    const mapping = await Mapping.findById(req.params.id);
    
    if (!mapping) {
      return res.status(404).json({ message: 'Mapping not found' });
    }
    
    await mapping.deleteOne();
    
    res.json({ message: 'Mapping deleted' });
  } catch (error) {
    console.error(`Error deleting mapping ${req.params.id}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create multiple mappings (batch)
router.post(
  '/batch',
  [
    body('vkSources').isArray().withMessage('vkSources must be an array'),
    body('vkSources.*').isMongoId().withMessage('Valid VK source IDs are required'),
    body('telegramChannels').isArray().withMessage('telegramChannels must be an array'),
    body('telegramChannels.*').isMongoId().withMessage('Valid Telegram channel IDs are required'),
    body('active').optional().isBoolean().withMessage('Active must be boolean')
  ],
  async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const { vkSources, telegramChannels, active } = req.body;
      
      // Verify all sources and channels exist
      const sources = await VkSource.find({ _id: { $in: vkSources } });
      if (sources.length !== vkSources.length) {
        return res.status(404).json({ message: 'One or more VK sources not found' });
      }
      
      const channels = await TelegramChannel.find({ _id: { $in: telegramChannels } });
      if (channels.length !== telegramChannels.length) {
        return res.status(404).json({ message: 'One or more Telegram channels not found' });
      }
      
      // Create mappings for all combinations
      const newMappings = [];
      const errors = [];
      
      for (const sourceId of vkSources) {
        for (const channelId of telegramChannels) {
          try {
            // Check if mapping already exists
            const existingMapping = await Mapping.findOne({
              vkSource: sourceId,
              telegramChannel: channelId
            });
            
            if (existingMapping) {
              errors.push({
                source: sourceId,
                channel: channelId,
                message: 'Mapping already exists'
              });
              continue;
            }
            
            // Create new mapping
            const newMapping = new Mapping({
              vkSource: sourceId,
              telegramChannel: channelId,
              active: active !== undefined ? active : true,
              createdBy: req.user?._id // If authentication is implemented
            });
            
            // Save new mapping
            await newMapping.save();
            
            // Add to result array
            newMappings.push(newMapping);
          } catch (error) {
            errors.push({
              source: sourceId,
              channel: channelId,
              message: error.message
            });
          }
        }
      }
      
      res.status(201).json({
        mappings: newMappings,
        created: newMappings.length,
        errors
      });
    } catch (error) {
      console.error('Error creating batch mappings:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

module.exports = router; 