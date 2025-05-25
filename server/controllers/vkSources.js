const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const VkSource = require('../models/VkSource');
const Mapping = require('../models/Mapping');
const vkService = require('../services/vk');
const schedulerService = require('../services/scheduler');
const Post = require('../models/Post');

// Get all VK sources
router.get('/', async (req, res) => {
  try {
    const sources = await VkSource.find()
      .sort({ name: 1 });
    
    res.json(sources);
  } catch (error) {
    console.error('Error getting VK sources:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get a specific VK source
router.get('/:id', async (req, res) => {
  try {
    const source = await VkSource.findById(req.params.id);
    
    if (!source) {
      return res.status(404).json({ message: 'VK source not found' });
    }
    
    res.json(source);
  } catch (error) {
    console.error(`Error getting VK source ${req.params.id}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create a new VK source
router.post(
  '/',
  [
    body('name').not().isEmpty().withMessage('Name is required'),
    body('thresholdType').isIn(['auto', 'manual']).withMessage('Invalid threshold type'),
    body('thresholdMethod').optional().isIn(['average', 'statistical']).withMessage('Invalid threshold method'),
    body('manualThreshold').if(body('thresholdType').equals('manual')).isInt({ min: 1 }).withMessage('Manual threshold must be a positive number'),
    body('checkFrequency').isInt({ min: 5 }).withMessage('Check frequency must be at least 5 minutes'),
    body('postsToCheck').optional().isInt({ min: 10, max: 100 }).withMessage('Posts to check must be between 10 and 100')
  ],
  async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const { name, thresholdType, thresholdMethod, manualThreshold, checkFrequency, postsToCheck } = req.body;
      
      // Resolve group ID from name
      let groupId;
      try {
        groupId = await vkService.resolveGroupId(name);
      } catch (error) {
        // Check if this is a VK authentication error
        if (error.message.includes('VK_ACCESS_TOKEN') || error.message.includes('authenticate with VK API')) {
          return res.status(401).json({ 
            message: 'VK API authentication failed',
            error: 'Please configure your VK_ACCESS_TOKEN in the .env file.',
            details: error.message
          });
        }
        
        return res.status(400).json({ message: 'Failed to resolve VK group', error: error.message });
      }
      
      // Check if source already exists
      const existingSource = await VkSource.findOne({ groupId });
      if (existingSource) {
        return res.status(400).json({ message: 'This VK group is already added as a source' });
      }
      
      // Create new source
      const newSource = new VkSource({
        name,
        url: `https://vk.com/${name}`,
        groupId,
        thresholdType,
        thresholdMethod: thresholdMethod || 'statistical',
        manualThreshold: thresholdType === 'manual' ? manualThreshold : 0,
        checkFrequency: checkFrequency || 60, // Default to hourly
        postsToCheck: postsToCheck || 50, // Default to 50
        createdBy: req.user?._id // If authentication is implemented
      });
      
      // Save new source
      await newSource.save();
      
      // If auto threshold, calculate it
      if (thresholdType === 'auto') {
        // Don't await to avoid long response time
        vkService.updateSourceThreshold(newSource._id, newSource.thresholdMethod).catch(err => {
          console.error(`Error calculating threshold for new source ${newSource._id}:`, err);
        });
      }
      
      // Update scheduler (don't await)
      schedulerService.updateSourceSchedules().catch(err => {
        console.error('Error updating schedules after adding source:', err);
      });
      
      res.status(201).json(newSource);
    } catch (error) {
      // Check if this is a VK authentication error
      if (error.message && (error.message.includes('VK_ACCESS_TOKEN') || error.message.includes('authenticate with VK API'))) {
        return res.status(401).json({ 
          message: 'VK API authentication failed',
          error: 'Please configure your VK_ACCESS_TOKEN in the .env file.',
          details: error.message
        });
      }
      
      console.error('Error creating VK source:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Update a VK source
router.put(
  '/:id',
  [
    body('name').optional(),
    body('thresholdType').optional().isIn(['auto', 'manual']).withMessage('Invalid threshold type'),
    body('thresholdMethod').optional().isIn(['average', 'statistical']).withMessage('Invalid threshold method'),
    body('manualThreshold').if(body('thresholdType').equals('manual')).isInt({ min: 1 }).withMessage('Manual threshold must be a positive number'),
    body('checkFrequency').optional().isInt({ min: 5 }).withMessage('Check frequency must be at least 5 minutes'),
    body('postsToCheck').optional().isInt({ min: 10, max: 100 }).withMessage('Posts to check must be between 10 and 100'),
    body('active').optional().isBoolean().withMessage('Active must be boolean'),
    body('experimentalViewTracking').optional().isBoolean().withMessage('Experimental view tracking must be boolean')
  ],
  async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      // Find source
      let source = await VkSource.findById(req.params.id);
      if (!source) {
        return res.status(404).json({ message: 'VK source not found' });
      }
      
      const { name, thresholdType, thresholdMethod, manualThreshold, checkFrequency, postsToCheck, active, experimentalViewTracking } = req.body;
      
      // Update fields
      if (name !== undefined) {
        // If name changed, resolve new group ID
        if (name !== source.name) {
          try {
            const groupId = await vkService.resolveGroupId(name);
            source.groupId = groupId;
            source.url = `https://vk.com/${name}`;
          } catch (error) {
            // Check if this is a VK authentication error
            if (error.message.includes('VK_ACCESS_TOKEN') || error.message.includes('authenticate with VK API')) {
              return res.status(401).json({ 
                message: 'VK API authentication failed',
                error: 'Please configure your VK_ACCESS_TOKEN in the .env file.',
                details: error.message
              });
            }
            
            return res.status(400).json({ message: 'Failed to resolve VK group', error: error.message });
          }
        }
        source.name = name;
      }
      
      // Update threshold method if specified
      if (thresholdMethod !== undefined) {
        source.thresholdMethod = thresholdMethod;
        
        // If auto threshold and method changed, recalculate
        if (source.thresholdType === 'auto') {
          // Schedule recalculation (don't await)
          vkService.updateSourceThreshold(source._id, thresholdMethod).catch(err => {
            console.error(`Error calculating threshold for source ${source._id}:`, err);
          });
        }
      }
      
      if (thresholdType !== undefined) {
        source.thresholdType = thresholdType;
        
        // If switching to manual, set manual threshold
        if (thresholdType === 'manual' && manualThreshold !== undefined) {
          source.manualThreshold = manualThreshold;
        } 
        // If switching to auto, recalculate
        else if (thresholdType === 'auto') {
          // Schedule recalculation (don't await)
          vkService.updateSourceThreshold(source._id, source.thresholdMethod).catch(err => {
            console.error(`Error calculating threshold for source ${source._id}:`, err);
          });
        }
      } else if (source.thresholdType === 'manual' && manualThreshold !== undefined) {
        source.manualThreshold = manualThreshold;
      }
      
      if (checkFrequency !== undefined) {
        source.checkFrequency = checkFrequency;
      }
      
      if (postsToCheck !== undefined) {
        source.postsToCheck = postsToCheck;
      }
      
      if (active !== undefined) {
        source.active = active;
        
        // If source is deactivated, immediately stop its job
        if (active === false) {
          const sourceId = source._id.toString();
          const cronJobs = schedulerService.getCronJobs();
          if (cronJobs[sourceId]) {
            console.log(`Stopping scheduler job for deactivated source ${sourceId}`);
            cronJobs[sourceId].job.stop();
            delete cronJobs[sourceId];
          }
        }
      }
      
      if (experimentalViewTracking !== undefined) {
        source.experimentalViewTracking = experimentalViewTracking;
      }
      
      // Save updated source
      await source.save();
      
      // Update scheduler (don't await)
      schedulerService.updateSourceSchedules().catch(err => {
        console.error('Error updating schedules after updating source:', err);
      });
      
      res.json(source);
    } catch (error) {
      // Check if this is a VK authentication error
      if (error.message && (error.message.includes('VK_ACCESS_TOKEN') || error.message.includes('authenticate with VK API'))) {
        return res.status(401).json({ 
          message: 'VK API authentication failed',
          error: 'Please configure your VK_ACCESS_TOKEN in the .env file.',
          details: error.message
        });
      }
      
      console.error(`Error updating VK source ${req.params.id}:`, error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Delete a VK source
router.delete('/:id', async (req, res) => {
  try {
    const source = await VkSource.findById(req.params.id);
    
    if (!source) {
      return res.status(404).json({ message: 'VK source not found' });
    }
    
    // First, delete all mappings that reference this source
    await Mapping.deleteMany({ vkSource: req.params.id });
    
    // Also delete all posts from this source
    await Post.deleteMany({ vkSource: req.params.id });
    
    // Then delete the source
    await source.deleteOne();
    
    // Immediately stop the cron job if it exists
    const sourceId = req.params.id.toString();
    const cronJobs = schedulerService.getCronJobs();
    if (cronJobs[sourceId]) {
      console.log(`Stopping scheduler job for deleted source ${sourceId}`);
      cronJobs[sourceId].job.stop();
      delete cronJobs[sourceId];
    }
    
    // Update scheduler (don't await)
    schedulerService.updateSourceSchedules().catch(err => {
      console.error('Error updating schedules after deleting source:', err);
    });
    
    res.json({ message: 'VK source deleted' });
  } catch (error) {
    console.error(`Error deleting VK source ${req.params.id}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Calculate threshold for a source
router.post('/:id/calculate-threshold', 
  [
    body('thresholdMethod').optional().isIn(['average', 'statistical']).withMessage('Invalid threshold method'),
    body('postsCount').optional().isInt({ min: 50, max: 1000 }).withMessage('Posts count must be between 50 and 1000'),
    body('multiplier').optional().isFloat({ min: 0.5, max: 3.0 }).withMessage('Multiplier must be between 0.5 and 3.0')
  ],
  async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const source = await VkSource.findById(req.params.id);
      
      if (!source) {
        return res.status(404).json({ message: 'VK source not found' });
      }
      
      // Use provided method or fall back to source's current method
      const thresholdMethod = req.body.thresholdMethod || source.thresholdMethod || 'statistical';
      
      // Use provided posts count or default to 200
      const postsCount = req.body.postsCount || 200;
      
      // Carefully parse and validate multiplier value
      let multiplier;
      
      if (req.body.multiplier !== undefined) {
        // Explicitly provided in request - parse and validate
        multiplier = parseFloat(req.body.multiplier);
        if (isNaN(multiplier)) {
          console.warn(`Invalid multiplier value provided: ${req.body.multiplier}, using default`);
          multiplier = source.statisticalMultiplier || 1.5;
        }
      } else {
        // Not provided - use source value or default
        multiplier = source.statisticalMultiplier !== undefined ? source.statisticalMultiplier : 1.5;
      }
      
      console.log(`Threshold calculation request for source ${req.params.id} (${source.name}):`);
      console.log(`- Method: ${thresholdMethod}`);
      console.log(`- Request body multiplier: ${req.body.multiplier !== undefined ? req.body.multiplier : 'NOT PROVIDED'} (${typeof req.body.multiplier})`);
      console.log(`- Parsed multiplier: ${multiplier} (${typeof multiplier})`);
      console.log(`- Current source multiplier: ${source.statisticalMultiplier} (${typeof source.statisticalMultiplier})`);
      
      // Always store the multiplier in the source for future calculations
      if (multiplier !== undefined && !isNaN(multiplier)) {
        source.statisticalMultiplier = multiplier;
        console.log(`- Setting source.statisticalMultiplier = ${multiplier}`);
        // Save immediately to ensure it's persisted
        await source.save();
      } else {
        console.warn('Skipping statisticalMultiplier update due to invalid value');
      }
      
      // Fetch posts with the specified count
      const posts = await vkService.fetchPosts(source.groupId, postsCount);
      
      // Calculate detailed stats
      const detailedStats = vkService.calculateDetailedStats(posts);
      
      let calculatedThreshold;
      
      if (thresholdMethod === 'statistical') {
        // Calculate threshold with custom multiplier
        calculatedThreshold = Math.round(detailedStats.mean + (multiplier * detailedStats.standardDeviation));
        console.log(`Custom statistical threshold calculation: Mean = ${detailedStats.mean}, SD = ${detailedStats.standardDeviation}, Multiplier = ${multiplier}, Threshold = ${calculatedThreshold}`);
      } else {
        calculatedThreshold = detailedStats.mean;
      }
      
      // Store the threshold and additional data
      source.calculatedThreshold = calculatedThreshold;
      source.thresholdMethod = thresholdMethod;
      source.lastPostsData = {
        averageViews: detailedStats.mean,
        postsAnalyzed: posts.length,
        lastAnalysisDate: new Date(),
        thresholdMethod: thresholdMethod,
        multiplierUsed: thresholdMethod === 'statistical' ? multiplier : null,
        detailedStats: detailedStats
      };
      
      await source.save();
      
      // Return enhanced response with detailed stats
      const response = {
        sourceId: source._id,
        sourceName: source.name,
        thresholdType: source.thresholdType,
        thresholdMethod: thresholdMethod,
        calculatedThreshold: calculatedThreshold,
        effectiveThreshold: source.thresholdType === 'manual' ? source.manualThreshold : calculatedThreshold,
        postsAnalyzed: posts.length,
        multiplier: multiplier,
        statisticalMultiplier: source.statisticalMultiplier,
        lastPostsData: {
          multiplierUsed: source.lastPostsData?.multiplierUsed || null,
          lastAnalysisDate: source.lastPostsData?.lastAnalysisDate || null
        },
        detailedStats: detailedStats
      };
      
      console.log('Sending response with multiplier:', multiplier);
      res.json(response);
    } catch (error) {
      // Check if this is a VK authentication error
      if (error.message && (error.message.includes('VK_ACCESS_TOKEN') || error.message.includes('authenticate with VK API'))) {
        return res.status(401).json({ 
          message: 'VK API authentication failed',
          error: 'Please configure your VK_ACCESS_TOKEN in the .env file.',
          details: error.message
        });
      }
      
      console.error(`Error calculating threshold for VK source ${req.params.id}:`, error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Update threshold method for a source
router.post('/:id/threshold-method',
  [
    body('thresholdMethod').isIn(['average', 'statistical']).withMessage('Invalid threshold method'),
    body('multiplier').optional().isFloat({ min: 0.5, max: 3.0 }).withMessage('Multiplier must be between 0.5 and 3.0')
  ],
  async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const source = await VkSource.findById(req.params.id);
      
      if (!source) {
        return res.status(404).json({ message: 'VK source not found' });
      }
      
      const { thresholdMethod, multiplier } = req.body;
      
      // Update threshold method
      source.thresholdMethod = thresholdMethod;
      
      // Always update multiplier when using statistical method, even if not explicitly provided
      if (thresholdMethod === 'statistical') {
        // Use provided multiplier or fall back to existing one or default
        source.statisticalMultiplier = multiplier !== undefined ? multiplier : (source.statisticalMultiplier || 1.5);
      }
      
      // Recalculate if auto threshold
      if (source.thresholdType === 'auto') {
        const updatedSource = await vkService.updateSourceThreshold(
          source._id, 
          thresholdMethod, 
          thresholdMethod === 'statistical' ? (multiplier || source.statisticalMultiplier) : null
        );
        res.json(updatedSource);
      } else {
        // Just save the new method without recalculating
        await source.save();
        res.json(source);
      }
    } catch (error) {
      console.error(`Error updating threshold method for VK source ${req.params.id}:`, error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Process posts for a source now
router.post('/:id/process-now', async (req, res) => {
  try {
    const source = await VkSource.findById(req.params.id);
    
    if (!source) {
      return res.status(404).json({ message: 'VK source not found' });
    }
    
    const result = await schedulerService.processSourceNow(source._id);
    
    res.json(result);
  } catch (error) {
    // Check if this is a VK authentication error
    if (error.message && (error.message.includes('VK_ACCESS_TOKEN') || error.message.includes('authenticate with VK API'))) {
      return res.status(401).json({ 
        message: 'VK API authentication failed',
        error: 'Please configure your VK_ACCESS_TOKEN in the .env file.',
        details: error.message
      });
    }
    
    console.error(`Error processing posts for VK source ${req.params.id}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get threshold statistics for a source
router.get('/:id/threshold-stats', async (req, res) => {
  try {
    const source = await VkSource.findById(req.params.id);
    
    if (!source) {
      return res.status(404).json({ message: 'VK source not found' });
    }
    
    // Get detailed stats from the source
    const stats = {
      sourceId: source._id,
      sourceName: source.name,
      thresholdType: source.thresholdType,
      thresholdMethod: source.thresholdMethod,
      calculatedThreshold: source.calculatedThreshold,
      manualThreshold: source.manualThreshold,
      effectiveThreshold: source.thresholdType === 'manual' ? source.manualThreshold : source.calculatedThreshold,
      lastAnalysisDate: source.lastPostsData?.lastAnalysisDate || null,
      postsAnalyzed: source.lastPostsData?.postsAnalyzed || 0,
      // Send exact values from the database
      statisticalMultiplier: source.statisticalMultiplier,
      // Only default to 1.5 if no source values exist whatsoever
      multiplier: source.statisticalMultiplier !== undefined ? source.statisticalMultiplier : 1.5,
      multiplierUsed: source.lastPostsData?.multiplierUsed || source.statisticalMultiplier,
      detailedStats: source.lastPostsData?.detailedStats || {}
    };
    
    console.log('Sending threshold stats with multipliers:', {
      statisticalMultiplier: stats.statisticalMultiplier,
      multiplier: stats.multiplier,
      multiplierUsed: stats.multiplierUsed
    });
    
    res.json(stats);
  } catch (error) {
    console.error(`Error getting threshold stats for VK source ${req.params.id}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router; 