const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Mapping = require('../models/Mapping');
const VkSource = require('../models/VkSource');
const TelegramChannel = require('../models/TelegramChannel');
const mongoose = require('mongoose');

// Get all mappings
router.get('/', async (req, res) => {
  try {
    const mappings = await Mapping.find()
      .populate('vkSource')
      .populate('vkSourceGroup')
      .populate('telegramChannel')
      .sort({ createdAt: -1 });
    
    res.json(mappings);
  } catch (error) {
    console.error('Error getting mappings:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get mappings for a specific VK source
router.get('/vk-source/:sourceId', async (req, res) => {
  try {
    const mappings = await Mapping.find({ vkSource: req.params.sourceId })
      .populate('vkSource')
      .populate('telegramChannel')
      .sort({ createdAt: -1 });
    
    res.json(mappings);
  } catch (error) {
    console.error(`Error getting mappings for VK source ${req.params.sourceId}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get mappings for a specific VK source group
router.get('/vk-source-group/:groupId', async (req, res) => {
  try {
    const mappings = await Mapping.find({ vkSourceGroup: req.params.groupId })
      .populate('vkSourceGroup')
      .populate('telegramChannel')
      .sort({ createdAt: -1 });
    
    res.json(mappings);
  } catch (error) {
    console.error(`Error getting mappings for VK source group ${req.params.groupId}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get mappings for a specific Telegram channel
router.get('/telegram-channel/:channelId', async (req, res) => {
  try {
    const mappings = await Mapping.find({ telegramChannel: req.params.channelId })
      .populate('vkSource')
      .populate('vkSourceGroup')
      .populate('telegramChannel')
      .sort({ createdAt: -1 });
    
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
      .populate('vkSourceGroup')
      .populate('telegramChannel');
    
    if (!mapping) {
      return res.status(404).json({ message: 'Mapping not found' });
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
      const { vkSource, vkSourceGroup, telegramChannel, active } = req.body;
      
      // Ensure either vkSource or vkSourceGroup is provided
      if ((!vkSource && !vkSourceGroup) || (vkSource && vkSourceGroup)) {
        return res.status(400).json({ message: 'Either vkSource OR vkSourceGroup must be provided, but not both' });
      }
      
      // Verify channel exists
      const channel = await TelegramChannel.findById(telegramChannel);
      if (!channel) {
        return res.status(404).json({ message: 'Telegram channel not found' });
      }
      
      // If vkSource is provided, verify it exists
      if (vkSource) {
        const source = await VkSource.findById(vkSource);
        if (!source) {
          return res.status(404).json({ message: 'VK source not found' });
        }
        
        // Check if mapping already exists for this source
        const existingMapping = await Mapping.findOne({
          vkSource,
          telegramChannel
        });
        
        if (existingMapping) {
          return res.status(400).json({ message: 'This mapping already exists' });
        }
      }
      
      // If vkSourceGroup is provided, verify it exists
      if (vkSourceGroup) {
        const sourceGroup = await mongoose.model('VkSourceGroup').findById(vkSourceGroup);
        if (!sourceGroup) {
          return res.status(404).json({ message: 'VK source group not found' });
        }
        
        // Check if mapping already exists for this group
        const existingMapping = await Mapping.findOne({
          vkSourceGroup,
          telegramChannel
        });
        
        if (existingMapping) {
          return res.status(400).json({ message: 'This mapping already exists' });
        }
      }
      
      // Create new mapping
      const newMapping = new Mapping({
        vkSource: vkSource || undefined,
        vkSourceGroup: vkSourceGroup || undefined,
        telegramChannel,
        active: active !== undefined ? active : true,
        createdBy: req.user?._id // If authentication is implemented
      });
      
      // Save new mapping
      await newMapping.save();
      
      // Populate response
      if (vkSource) {
        await newMapping.populate('vkSource');
      }
      if (vkSourceGroup) {
        await newMapping.populate('vkSourceGroup');
      }
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

// Create multiple mappings with source groups (batch)
router.post(
  '/batch-groups',
  [
    body('vkSourceGroups').isArray().withMessage('vkSourceGroups must be an array'),
    body('vkSourceGroups.*').isMongoId().withMessage('Valid VK source group IDs are required'),
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
      const { vkSourceGroups, telegramChannels, active } = req.body;
      
      // Verify all source groups and channels exist
      const groups = await mongoose.model('VkSourceGroup').find({ _id: { $in: vkSourceGroups } });
      if (groups.length !== vkSourceGroups.length) {
        return res.status(404).json({ message: 'One or more VK source groups not found' });
      }
      
      const channels = await TelegramChannel.find({ _id: { $in: telegramChannels } });
      if (channels.length !== telegramChannels.length) {
        return res.status(404).json({ message: 'One or more Telegram channels not found' });
      }
      
      // Create mappings for all combinations
      const newMappings = [];
      const errors = [];
      
      for (const groupId of vkSourceGroups) {
        for (const channelId of telegramChannels) {
          try {
            // Check if mapping already exists
            const existingMapping = await Mapping.findOne({
              vkSourceGroup: groupId,
              telegramChannel: channelId
            });
            
            if (existingMapping) {
              errors.push({
                group: groupId,
                channel: channelId,
                message: 'Mapping already exists'
              });
              continue;
            }
            
            // Create new mapping
            const newMapping = new Mapping({
              vkSourceGroup: groupId,
              telegramChannel: channelId,
              active: active !== undefined ? active : true,
              createdBy: req.user?._id
            });
            
            // Save new mapping
            await newMapping.save();
            
            // Add to result array
            newMappings.push(newMapping);
          } catch (error) {
            errors.push({
              group: groupId,
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
      console.error('Error creating batch mappings with groups:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

module.exports = router; 