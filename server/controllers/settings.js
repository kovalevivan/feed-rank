const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Setting = require('../models/Setting');

// Get all settings
router.get('/', async (req, res) => {
  try {
    const settings = await Setting.find().sort({ category: 1, key: 1 });
    
    // Group by category
    const groupedSettings = settings.reduce((acc, setting) => {
      if (!acc[setting.category]) {
        acc[setting.category] = [];
      }
      
      // Don't expose sensitive values
      if (setting.isProtected) {
        acc[setting.category].push({
          ...setting.toObject(),
          value: '[PROTECTED]'
        });
      } else {
        acc[setting.category].push(setting);
      }
      
      return acc;
    }, {});
    
    res.json(groupedSettings);
  } catch (error) {
    console.error('Error getting settings:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get settings by category
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const settings = await Setting.find({ category }).sort({ key: 1 });
    
    // Don't expose sensitive values
    const safeSettings = settings.map(setting => {
      if (setting.isProtected) {
        return {
          ...setting.toObject(),
          value: '[PROTECTED]'
        };
      }
      return setting;
    });
    
    res.json(safeSettings);
  } catch (error) {
    console.error(`Error getting ${req.params.category} settings:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get a specific setting
router.get('/:key', async (req, res) => {
  try {
    const setting = await Setting.findOne({ key: req.params.key });
    
    if (!setting) {
      return res.status(404).json({ message: 'Setting not found' });
    }
    
    // Don't expose sensitive values
    if (setting.isProtected) {
      return res.json({
        ...setting.toObject(),
        value: '[PROTECTED]'
      });
    }
    
    res.json(setting);
  } catch (error) {
    console.error(`Error getting setting ${req.params.key}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create or update a setting
router.put(
  '/:key',
  [
    body('value').exists().withMessage('Value is required'),
    body('description').optional(),
    body('category').isIn(['vk', 'telegram', 'system', 'other']).withMessage('Invalid category'),
    body('isProtected').optional().isBoolean().withMessage('isProtected must be boolean')
  ],
  async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const { value, description, category, isProtected } = req.body;
      
      // Try to find existing setting
      let setting = await Setting.findOne({ key: req.params.key });
      
      if (setting) {
        // Update existing setting
        setting.value = value;
        
        if (description !== undefined) {
          setting.description = description;
        }
        
        if (category !== undefined) {
          setting.category = category;
        }
        
        if (isProtected !== undefined) {
          setting.isProtected = isProtected;
        }
      } else {
        // Create new setting
        setting = new Setting({
          key: req.params.key,
          value,
          description: description || '',
          category: category || 'other',
          isProtected: isProtected || false
        });
      }
      
      // Save setting
      await setting.save();
      
      // Don't expose sensitive values in response
      if (setting.isProtected) {
        return res.json({
          ...setting.toObject(),
          value: '[PROTECTED]'
        });
      }
      
      res.json(setting);
    } catch (error) {
      console.error(`Error updating setting ${req.params.key}:`, error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Delete a setting
router.delete('/:key', async (req, res) => {
  try {
    const setting = await Setting.findOne({ key: req.params.key });
    
    if (!setting) {
      return res.status(404).json({ message: 'Setting not found' });
    }
    
    await setting.deleteOne();
    
    res.json({ message: 'Setting deleted' });
  } catch (error) {
    console.error(`Error deleting setting ${req.params.key}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Initialize default settings
router.post('/initialize', async (req, res) => {
  try {
    const defaultSettings = [
      {
        key: 'vk.stop_words',
        value: [],
        description: 'List of words to filter out posts (comma-separated)',
        category: 'vk',
        isProtected: false
      },
      {
        key: 'system.auto_forward',
        value: false,
        description: 'Automatically forward viral posts without approval',
        category: 'system',
        isProtected: false
      },
      {
        key: 'telegram.notification_chat_id',
        value: '',
        description: 'Chat ID for system notifications',
        category: 'telegram',
        isProtected: false
      }
    ];
    
    // Create settings if they don't exist
    const results = await Promise.all(
      defaultSettings.map(async (setting) => {
        try {
          // Check if setting exists
          const existing = await Setting.findOne({ key: setting.key });
          
          if (!existing) {
            // Create new setting
            const newSetting = new Setting(setting);
            await newSetting.save();
            return { key: setting.key, created: true };
          }
          
          return { key: setting.key, created: false };
        } catch (error) {
          return { key: setting.key, created: false, error: error.message };
        }
      })
    );
    
    res.json({
      message: 'Default settings initialized',
      results
    });
  } catch (error) {
    console.error('Error initializing default settings:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router; 