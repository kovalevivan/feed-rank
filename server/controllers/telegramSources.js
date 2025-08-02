const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const TelegramSource = require('../models/TelegramSource');
const telegramSourcesService = require('../services/telegram/sources');
const { updateSourceThreshold, getRecentPostsForAnalysis, calculateStatisticalThreshold, calculatePercentileThreshold } = require('../services/telegram/analytics');
const mongoose = require('mongoose');

// Get all Telegram sources
router.get('/', async (req, res) => {
  try {
    const sources = await TelegramSource.find()
      .sort({ name: 1 });
    
    res.json(sources);
  } catch (error) {
    console.error('Error getting Telegram sources:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get a specific Telegram source
router.get('/:id', async (req, res) => {
  try {
    console.log(`GET request for Telegram source with ID: ${req.params.id}`);
    
    // Special case for 'new' or 'undefined' route
    if (req.params.id === 'new' || req.params.id === 'undefined') {
      return res.status(400).json({ 
        message: 'Invalid request - this is a reserved identifier, not a valid source ID',
        details: 'You may be seeing this if your frontend routing is not correctly configured to handle special routes separately from existing source IDs'
      });
    }
    
    // Validate that ID is a valid ObjectId before querying
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid source ID format' });
    }
    
    const source = await TelegramSource.findById(req.params.id);
    
    if (!source) {
      return res.status(404).json({ message: 'Telegram source not found' });
    }
    
    res.json(source);
  } catch (error) {
    console.error(`Error getting Telegram source ${req.params.id}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create a new Telegram source
router.post(
  '/',
  [
    body('name').not().isEmpty().withMessage('Name is required'),
    body('chatId').optional(),
    body('username').optional(),
    body('thresholdType').optional().isIn(['auto', 'manual']).withMessage('Invalid threshold type'),
    body('manualThreshold').optional().isNumeric().withMessage('Manual threshold must be a number'),
    body('checkFrequency').optional().isNumeric().withMessage('Check frequency must be a number'),
    body('minViewsForViral').optional().isNumeric().withMessage('Minimum views must be a number'),
    // Viral detection settings
    body('viralDetectionMetric').optional().isIn(['views', 'reactions', 'comments', 'engagement_score']).withMessage('Invalid viral detection metric'),
    body('minReactionsForViral').optional().isNumeric().withMessage('Minimum reactions must be a number'),
    body('minCommentsForViral').optional().isNumeric().withMessage('Minimum comments must be a number'),
    body('minForwardsForViral').optional().isNumeric().withMessage('Minimum forwards must be a number'),
    body('reactionWeight').optional().isNumeric().withMessage('Reaction weight must be a number'),
    body('commentWeight').optional().isNumeric().withMessage('Comment weight must be a number'),
    body('forwardWeight').optional().isNumeric().withMessage('Forward weight must be a number'),
    body('thresholdMethod').optional().isIn(['statistical', 'percentile']).withMessage('Invalid threshold method'),
    body('statisticalMultiplier').optional().isNumeric().withMessage('Statistical multiplier must be a number')
  ],
  async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      console.log('Creating Telegram source with data:', req.body);
      let { 
        name, chatId, username, thresholdType, manualThreshold, checkFrequency, minViewsForViral,
        // Viral detection settings
        viralDetectionMetric, minReactionsForViral, minCommentsForViral, minForwardsForViral,
        reactionWeight, commentWeight, forwardWeight, thresholdMethod, statisticalMultiplier
      } = req.body;
      
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
          const chatInfo = await telegramSourcesService.getChatInfo(username);
          chatId = chatInfo.id;
          console.log('Resolved username to chatId:', chatId);
          
          // Update name with title if available and name wasn't explicitly provided
          if (chatInfo.title && (!req.body.name || req.body.name === username.substring(1))) {
            name = chatInfo.title;
            console.log('Updated name to:', name);
          }
        } catch (error) {
          console.error('Failed to resolve username:', error);
          return res.status(400).json({ 
            message: `Could not resolve channel ${username}. Make sure the bot has access to this channel.`,
            error: error.message
          });
        }
      }
      
      console.log('Processing source with ID:', chatId);
      
      // Check if source already exists
      const existingSource = await TelegramSource.findOne({ chatId });
      if (existingSource) {
        console.error('Source already exists with ID:', chatId);
        return res.status(400).json({ message: 'This Telegram channel/group is already added as a source' });
      }
      
      console.log('Source is new, creating record');
      
      // Get additional chat info
      let chatInfo;
      try {
        chatInfo = await telegramSourcesService.getChatInfo(chatId);
      } catch (error) {
        console.error('Failed to get chat info:', error);
        return res.status(400).json({ 
          message: 'Could not access the chat. Make sure the bot has access to this channel/group.',
          error: error.message
        });
      }
      
      // Create new source
      const newSource = new TelegramSource({
        name,
        chatId,
        username: username || `@${chatInfo.username}`,
        type: chatInfo.type,
        description: chatInfo.description,
        thresholdType: thresholdType || 'auto',
        manualThreshold: thresholdType === 'manual' ? manualThreshold : undefined,
        checkFrequency: checkFrequency || 60,
        minViewsForViral: minViewsForViral || 1000,
        // Viral detection settings
        viralDetectionMetric: viralDetectionMetric || 'reactions',
        minReactionsForViral: minReactionsForViral || 10,
        minCommentsForViral: minCommentsForViral || 5,
        minForwardsForViral: minForwardsForViral || 3,
        reactionWeight: reactionWeight || 1.0,
        commentWeight: commentWeight || 2.0,
        forwardWeight: forwardWeight || 3.0,
        thresholdMethod: thresholdMethod || 'statistical',
        statisticalMultiplier: statisticalMultiplier || 1.5,
        // Only add createdBy if req.user exists and has an _id
        ...(req.user && req.user._id ? { createdBy: req.user._id } : {})
      });
      
      // Save new source
      await newSource.save();
      console.log('Source saved successfully:', newSource._id);
      
      res.status(201).json(newSource);
    } catch (error) {
      console.error('Error creating Telegram source:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Update a Telegram source
router.put(
  '/:id',
  [
    body('name').optional(),
    body('username').optional(),
    body('active').optional().isBoolean().withMessage('Active must be boolean'),
    body('thresholdType').optional().isIn(['auto', 'manual']).withMessage('Invalid threshold type'),
    body('manualThreshold').optional().isNumeric().withMessage('Manual threshold must be a number'),
    body('checkFrequency').optional().isNumeric().withMessage('Check frequency must be a number'),
    body('minViewsForViral').optional().isNumeric().withMessage('Minimum views must be a number'),
    // Viral detection settings
    body('viralDetectionMetric').optional().isIn(['views', 'reactions', 'comments', 'engagement_score']).withMessage('Invalid viral detection metric'),
    body('minReactionsForViral').optional().isNumeric().withMessage('Minimum reactions must be a number'),
    body('minCommentsForViral').optional().isNumeric().withMessage('Minimum comments must be a number'),
    body('minForwardsForViral').optional().isNumeric().withMessage('Minimum forwards must be a number'),
    body('reactionWeight').optional().isNumeric().withMessage('Reaction weight must be a number'),
    body('commentWeight').optional().isNumeric().withMessage('Comment weight must be a number'),
    body('forwardWeight').optional().isNumeric().withMessage('Forward weight must be a number'),
    body('thresholdMethod').optional().isIn(['statistical', 'percentile']).withMessage('Invalid threshold method'),
    body('statisticalMultiplier').optional().isNumeric().withMessage('Statistical multiplier must be a number')
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
          message: 'Invalid request - "new" is a reserved identifier, not a valid source ID',
          details: 'You may be seeing this if your frontend routing is not correctly configured to handle the "new" route separately from existing source IDs'
        });
      }
      
      // Validate that ID is a valid ObjectId before querying
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: 'Invalid source ID format' });
      }
      
      // Find source
      let source = await TelegramSource.findById(req.params.id);
      if (!source) {
        return res.status(404).json({ message: 'Telegram source not found' });
      }
      
      const { 
        name, username, active, thresholdType, manualThreshold, checkFrequency, minViewsForViral,
        // Viral detection settings
        viralDetectionMetric, minReactionsForViral, minCommentsForViral, minForwardsForViral,
        reactionWeight, commentWeight, forwardWeight, thresholdMethod, statisticalMultiplier
      } = req.body;
      
      // Update fields
      if (name !== undefined) {
        source.name = name;
      }
      
      if (username !== undefined) {
        source.username = username;
      }
      
      if (active !== undefined) {
        source.active = active;
      }
      
      if (thresholdType !== undefined) {
        source.thresholdType = thresholdType;
      }
      
      if (manualThreshold !== undefined) {
        source.manualThreshold = manualThreshold;
      }
      
      if (checkFrequency !== undefined) {
        source.checkFrequency = Math.max(5, checkFrequency); // Minimum 5 minutes
      }
      
      if (minViewsForViral !== undefined) {
        source.minViewsForViral = minViewsForViral;
      }
      
      // Update viral detection settings
      if (viralDetectionMetric !== undefined) {
        source.viralDetectionMetric = viralDetectionMetric;
      }
      
      if (minReactionsForViral !== undefined) {
        source.minReactionsForViral = minReactionsForViral;
      }
      
      if (minCommentsForViral !== undefined) {
        source.minCommentsForViral = minCommentsForViral;
      }
      
      if (minForwardsForViral !== undefined) {
        source.minForwardsForViral = minForwardsForViral;
      }
      
      if (reactionWeight !== undefined) {
        source.reactionWeight = reactionWeight;
      }
      
      if (commentWeight !== undefined) {
        source.commentWeight = commentWeight;
      }
      
      if (forwardWeight !== undefined) {
        source.forwardWeight = forwardWeight;
      }
      
      if (thresholdMethod !== undefined) {
        source.thresholdMethod = thresholdMethod;
      }
      
      if (statisticalMultiplier !== undefined) {
        source.statisticalMultiplier = statisticalMultiplier;
      }
      
      // Save updated source
      await source.save();
      
      res.json(source);
    } catch (error) {
      console.error(`Error updating Telegram source ${req.params.id}:`, error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Delete a Telegram source
router.delete('/:id', async (req, res) => {
  try {
    // Special case for 'new' route
    if (req.params.id === 'new') {
      return res.status(400).json({ 
        message: 'Invalid request - "new" is a reserved identifier, not a valid source ID',
        details: 'You may be seeing this if your frontend routing is not correctly configured to handle the "new" route separately from existing source IDs'
      });
    }
    
    // Validate that ID is a valid ObjectId before querying
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid source ID format' });
    }
    
    const source = await TelegramSource.findById(req.params.id);
    
    if (!source) {
      return res.status(404).json({ message: 'Telegram source not found' });
    }
    
    await source.deleteOne();
    
    res.json({ message: 'Telegram source deleted' });
  } catch (error) {
    console.error(`Error deleting Telegram source ${req.params.id}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Test connection to a Telegram source
router.post('/test-connection', async (req, res) => {
  try {
    const { chatId, username } = req.body;
    
    if (!chatId && !username) {
      return res.status(400).json({ message: 'Either chatId or username is required' });
    }
    
    const identifier = chatId || username;
    const result = await telegramSourcesService.testConnection(identifier);
    
    if (result.success) {
      res.json({ 
        message: 'Connection successful',
        chat: result.chat
      });
    } else {
      res.status(400).json({ 
        message: 'Connection failed',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error testing Telegram connection:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Process posts from a specific source
router.post('/:id/process', async (req, res) => {
  try {
    // Validate that ID is a valid ObjectId before querying
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid source ID format' });
    }
    
    const source = await TelegramSource.findById(req.params.id);
    
    if (!source) {
      return res.status(404).json({ message: 'Telegram source not found' });
    }
    
    const result = await telegramSourcesService.processMessagesFromSource(source);
    
    res.json({
      message: 'Processing completed',
      processed: result.processed,
      created: result.created
    });
  } catch (error) {
    console.error(`Error processing Telegram source ${req.params.id}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get user's subscribed channels
router.get('/subscriptions/list', async (req, res) => {
  try {
    const subscriptions = await telegramSourcesService.getUserSubscriptions();
    res.json({
      subscriptions: subscriptions,
      total: subscriptions.length,
      message: subscriptions.length > 0 
        ? `Found ${subscriptions.length} subscribed channels/groups`
        : 'No subscriptions found. Make sure Telegram Client is set up.'
    });
  } catch (error) {
    console.error('Error getting user subscriptions:', error);
    res.status(500).json({ 
      message: 'Failed to get subscriptions', 
      error: error.message,
      help: 'Make sure Telegram Client API is properly configured. Run: node scripts/setup-telegram-client.js'
    });
  }
});

// Calculate threshold for a source (new or existing)
router.post('/calculate-threshold', async (req, res) => {
  try {
    const { chatId, username, thresholdMethod = 'statistical', statisticalMultiplier = 1.5, postsCount = 100, saveToSource = false } = req.body;
    
    if (!chatId) {
      return res.status(400).json({ message: 'Chat ID is required' });
    }
    
    // Validate method
    if (!['statistical', 'percentile'].includes(thresholdMethod)) {
      return res.status(400).json({ 
        message: 'Invalid threshold method. Must be "statistical" or "percentile"' 
      });
    }
    
    // Validate multiplier
    if (typeof statisticalMultiplier !== 'number' || statisticalMultiplier < 0.1 || statisticalMultiplier > 5) {
      return res.status(400).json({ 
        message: 'Invalid multiplier. Must be between 0.1 and 5.0' 
      });
    }
    
    console.log(`📊 Calculating threshold for chatId: ${chatId}${username ? ` (username: ${username})` : ''}`);
    
    // Get recent posts for analysis (now fetches directly from Telegram for new channels)
    const recentPosts = await getRecentPostsForAnalysis(chatId, postsCount);
    
    if (recentPosts.length === 0) {
      return res.status(400).json({ 
        message: 'No posts found for analysis. Make sure the channel has recent posts and is accessible.' 
      });
    }
    
    // Calculate threshold based on method
    let threshold;
    if (thresholdMethod === 'statistical') {
      threshold = calculateStatisticalThreshold(recentPosts, statisticalMultiplier);
    } else if (thresholdMethod === 'percentile') {
      // Use statisticalMultiplier as percentile value (e.g., 1.5 = 85th percentile, 2.0 = 90th percentile)
      // Convert multiplier to percentile: 1.0 = 80%, 1.5 = 85%, 2.0 = 90%, 2.5 = 95%, 3.0 = 97%
      const percentile = Math.min(97, Math.max(80, 75 + (statisticalMultiplier * 10)));
      threshold = calculatePercentileThreshold(recentPosts, percentile);
    } else {
      throw new Error(`Unknown threshold method: ${thresholdMethod}`);
    }
    
    // If saveToSource is true, try to find and update existing source
    if (saveToSource) {
      try {
        const existingSource = await TelegramSource.findOne({ chatId });
        if (existingSource) {
          console.log(`💾 Saving calculated threshold (${threshold}) to existing source: ${existingSource.name}`);
          
          // Update the source with calculated threshold and related data
          existingSource.calculatedThreshold = threshold;
          existingSource.thresholdMethod = thresholdMethod;
          existingSource.statisticalMultiplier = statisticalMultiplier;
          existingSource.lastPostsData = {
            postsAnalyzed: recentPosts.length,
            lastAnalysisDate: new Date(),
            thresholdMethod: thresholdMethod,
            multiplierUsed: thresholdMethod === 'statistical' ? statisticalMultiplier : null
          };
          
          await existingSource.save();
          console.log(`✅ Successfully updated threshold for source: ${existingSource.name}`);
        }
      } catch (saveError) {
        console.warn(`⚠️ Could not save threshold to existing source: ${saveError.message}`);
        // Continue with response even if save fails
      }
    }
    
    const responseData = {
      threshold,
      postsAnalyzed: recentPosts.length,
      method: thresholdMethod,
      multiplier: statisticalMultiplier,
      message: `Threshold calculated based on ${recentPosts.length} recent posts`
    };
    
    // Add percentile info for percentile method
    if (thresholdMethod === 'percentile') {
      const percentile = Math.min(97, Math.max(80, 75 + (statisticalMultiplier * 10)));
      responseData.percentile = percentile;
      responseData.message = `Threshold calculated using ${percentile}th percentile of ${recentPosts.length} recent posts`;
    }
    
    res.json(responseData);
    
  } catch (error) {
    console.error('Error calculating threshold:', error);
    res.status(500).json({ 
      message: 'Failed to calculate threshold', 
      error: error.message 
    });
  }
});

// Update threshold for a source (calculate based on recent posts)
router.post('/:id/update-threshold', async (req, res) => {
  try {
    // Validate that ID is a valid ObjectId before querying
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid source ID format' });
    }
    
    const { thresholdMethod = 'statistical', multiplier = 1.5 } = req.body;
    
    // Validate method
    if (!['statistical', 'percentile'].includes(thresholdMethod)) {
      return res.status(400).json({ 
        message: 'Invalid threshold method. Must be "statistical" or "percentile"' 
      });
    }
    
    // Validate multiplier
    if (typeof multiplier !== 'number' || multiplier < 0.1 || multiplier > 5) {
      return res.status(400).json({ 
        message: 'Invalid multiplier. Must be between 0.1 and 5.0' 
      });
    }
    
    const source = await TelegramSource.findById(req.params.id);
    if (!source) {
      return res.status(404).json({ message: 'Telegram source not found' });
    }
    
    console.log(`📊 Manual threshold update requested for ${source.name}`);
    
    const updatedSource = await updateSourceThreshold(req.params.id, thresholdMethod, multiplier);
    
    res.json({
      message: 'Threshold updated successfully',
      source: {
        id: updatedSource._id,
        name: updatedSource.name,
        calculatedThreshold: updatedSource.calculatedThreshold,
        thresholdMethod: updatedSource.thresholdMethod,
        statisticalMultiplier: updatedSource.statisticalMultiplier,
        lastPostsData: updatedSource.lastPostsData
      }
    });
  } catch (error) {
    console.error(`Error updating threshold for Telegram source ${req.params.id}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get threshold analysis for a source
router.get('/:id/threshold-analysis', async (req, res) => {
  try {
    // Validate that ID is a valid ObjectId before querying
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid source ID format' });
    }
    
    const source = await TelegramSource.findById(req.params.id);
    if (!source) {
      return res.status(404).json({ message: 'Telegram source not found' });
    }
    
    // Get recent posts for analysis
    const recentPosts = await getRecentPostsForAnalysis(req.params.id, 100);
    
    res.json({
      source: {
        id: source._id,
        name: source.name,
        viralDetectionMetric: source.viralDetectionMetric,
        thresholdType: source.thresholdType,
        calculatedThreshold: source.calculatedThreshold,
        manualThreshold: source.manualThreshold,
        thresholdMethod: source.thresholdMethod,
        statisticalMultiplier: source.statisticalMultiplier,
        lastPostsData: source.lastPostsData
      },
      recentPosts: {
        count: recentPosts.length,
        hasEnoughData: recentPosts.length >= 10,
        minRequiredPosts: 10
      },
      recommendations: {
        canCalculateThreshold: recentPosts.length >= 10,
        recommendedMethod: recentPosts.length >= 50 ? 'statistical' : 'percentile',
        message: recentPosts.length < 10 
          ? 'Need at least 10 posts for reliable threshold calculation'
          : `Can calculate threshold based on ${recentPosts.length} recent posts`
      }
    });
  } catch (error) {
    console.error(`Error getting threshold analysis for Telegram source ${req.params.id}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;