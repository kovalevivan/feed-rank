const express = require('express');
const router = express.Router();
const { query, param, body, validationResult } = require('express-validator');
const Post = require('../models/Post');
const Mapping = require('../models/Mapping');
const telegramService = require('../services/telegram');
const { getAllMappingsForSource } = require('../utils/mappingUtils');

// Get all posts with filtering
router.get('/', [
  query('vkSource').optional().isMongoId().withMessage('Invalid VK source ID'),
  query('telegramSource').optional().isMongoId().withMessage('Invalid Telegram source ID'),
  query('isViral').optional().isBoolean().withMessage('isViral must be a boolean'),
  query('status').optional().isIn(['pending', 'approved', 'rejected', 'forwarded']).withMessage('Invalid status'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], async (req, res) => {
  // Validate request
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
  try {
    const { vkSource, telegramSource, isViral, status, page = 1, limit = 20 } = req.query;
    
    // Build filter
    const filter = {};
    if (vkSource) filter.vkSource = vkSource;
    if (telegramSource) filter.telegramSource = telegramSource;
    if (isViral !== undefined) filter.isViral = isViral === 'true';
    if (status) filter.status = status;
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Get posts with pagination
    const posts = await Post.find(filter)
      .populate('vkSource')
      .populate('telegramSource')
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Filter out posts with deleted sources to prevent null reference errors
    const validPosts = posts.filter(post => post.vkSource || post.telegramSource);
    
    // Get total count
    const total = await Post.countDocuments(filter);
    
    res.json({
      posts: validPosts,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error getting posts:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get viral posts dashboard data
router.get('/dashboard', async (req, res) => {
  try {
    // Get counts by status
    const pendingCount = await Post.countDocuments({ isViral: true, status: 'pending' });
    const approvedCount = await Post.countDocuments({ isViral: true, status: 'approved' });
    const rejectedCount = await Post.countDocuments({ isViral: true, status: 'rejected' });
    const forwardedCount = await Post.countDocuments({ isViral: true, status: 'forwarded' });
    
    // Get total viral posts count
    const totalViralCount = await Post.countDocuments({ isViral: true });
    
    // Get total posts count
    const totalCount = await Post.countDocuments({});
    
    // Get recent viral posts
    const recentViralPosts = await Post.find({ isViral: true })
      .populate('vkSource')
      .populate('telegramSource')
      .sort({ publishedAt: -1 })
      .limit(5);
    
    // Filter out posts with deleted sources to prevent null reference errors
    const validRecentViralPosts = recentViralPosts.filter(post => post.vkSource || post.telegramSource);
    
    // Get top VK sources by viral post count
    const topVkSources = await Post.aggregate([
      { $match: { isViral: true, vkSource: { $ne: null } } },
      { $group: { _id: '$vkSource', count: { $sum: 1 }, sourceType: { $first: 'vk' } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    
    // Get top Telegram sources by viral post count
    const topTelegramSources = await Post.aggregate([
      { $match: { isViral: true, telegramSource: { $ne: null } } },
      { $group: { _id: '$telegramSource', count: { $sum: 1 }, sourceType: { $first: 'telegram' } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    
    // Populate sources
    await Post.populate(topVkSources, { path: '_id', model: 'VkSource' });
    await Post.populate(topTelegramSources, { path: '_id', model: 'TelegramSource' });
    
    // Combine and sort all sources
    const allTopSources = [...topVkSources, ...topTelegramSources]
      .filter(item => item._id)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    const validTopSources = allTopSources;
    
    res.json({
      counts: {
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        forwarded: forwardedCount,
        totalViral: totalViralCount,
        total: totalCount
      },
      recentViralPosts: validRecentViralPosts,
      topSources: validTopSources.map(item => ({
        source: item._id,
        count: item.count,
        sourceType: item.sourceType
      }))
    });
  } catch (error) {
    console.error('Error getting dashboard data:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get a specific post
router.get('/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('vkSource')
      .populate('telegramSource')
      .populate('forwardedTo.telegramChannel');
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    res.json(post);
  } catch (error) {
    console.error(`Error getting post ${req.params.id}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update post status (approve/reject)
router.put(
  '/:id/status',
  [
    param('id').isMongoId().withMessage('Invalid post ID'),
    body('status').isIn(['pending', 'approved', 'rejected']).withMessage('Invalid status')
  ],
  async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const { status } = req.body;
      
      // Find post and populate sources
      const post = await Post.findById(req.params.id)
        .populate('vkSource')
        .populate('telegramSource');
      if (!post) {
        return res.status(404).json({ message: 'Post not found' });
      }
      
      // If already forwarded, can't change status
      if (post.status === 'forwarded') {
        return res.status(400).json({ message: 'Cannot change status of already forwarded post' });
      }
      
      // Update status
      post.status = status;
      await post.save();
      
      // If approved, forward the post
      if (status === 'approved') {
        try {
          // Determine source type and get appropriate mappings
          let sourceId, sourceType, mappings;
          if (post.vkSource) {
            sourceId = post.vkSource.toString();
            sourceType = 'vk';
            mappings = await getAllMappingsForSource(sourceId, 'vk');
          } else if (post.telegramSource) {
            sourceId = post.telegramSource.toString();
            sourceType = 'telegram';
            mappings = await getAllMappingsForSource(sourceId, 'telegram');
          } else {
            throw new Error('Post has no valid source (VK or Telegram)');
          }
          
          // Forward to each channel
          const forwardResults = [];
          
          for (const mapping of mappings) {
            if (mapping.telegramChannel && mapping.telegramChannel.active) {
              try {
                // Pass the populated source data directly
                const sourceData = post.vkSource || post.telegramSource;
                const result = await telegramService.forwardPost(post, sourceData, mapping.telegramChannel);
                forwardResults.push({
                  channel: mapping.telegramChannel._id,
                  success: true,
                  messageId: result.telegramMessageId
                });
              } catch (error) {
                console.error(`Error forwarding post ${post._id} to channel ${mapping.telegramChannel._id}:`, error);
                forwardResults.push({
                  channel: mapping.telegramChannel._id,
                  success: false,
                  error: error.message
                });
              }
            }
          }
          
          // Reload post to get updated forwardedTo data
          const updatedPost = await Post.findById(req.params.id)
            .populate('vkSource')
            .populate('telegramSource')
            .populate('forwardedTo.telegramChannel');
          
          res.json({
            post: updatedPost,
            forwarded: forwardResults
          });
        } catch (error) {
          console.error(`Error processing forward for post ${req.params.id}:`, error);
          res.status(500).json({ message: 'Error forwarding post', error: error.message });
        }
      } else {
        // Just return the updated post for other status changes
        await post.populate('vkSource');
        await post.populate('telegramSource');
        await post.populate('forwardedTo.telegramChannel');
        
        res.json({ post });
      }
    } catch (error) {
      console.error(`Error updating post status ${req.params.id}:`, error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

// Bulk update post status
router.put(
  '/bulk/status',
  [
    body('ids').isArray().withMessage('ids must be an array'),
    body('ids.*').isMongoId().withMessage('All IDs must be valid'),
    body('status').isIn(['pending', 'approved', 'rejected']).withMessage('Invalid status')
  ],
  async (req, res) => {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const { ids, status } = req.body;
      
      // Update status for all posts that aren't yet forwarded
      const result = await Post.updateMany(
        { _id: { $in: ids }, status: { $ne: 'forwarded' } },
        { $set: { status } }
      );
      
      // If approved, handle forwarding
      if (status === 'approved') {
        // Get the posts that were updated
        const postsToForward = await Post.find({
          _id: { $in: ids },
          status: 'approved'
        });
        
        // Process each post asynchronously
        const forwardPromises = postsToForward.map(async (post) => {
          try {
            // Get mappings for this source (both individual and group mappings)
            const mappings = await getAllMappingsForSource(post.vkSource.toString());
            
            // Forward to each channel
            for (const mapping of mappings) {
              if (mapping.telegramChannel && mapping.telegramChannel.active) {
                try {
                  await telegramService.forwardPost(post, post.vkSource, mapping.telegramChannel);
                } catch (error) {
                  console.error(`Error forwarding post ${post._id} to channel ${mapping.telegramChannel._id}:`, error);
                }
              }
            }
            
            return {
              postId: post._id,
              success: true
            };
          } catch (error) {
            return {
              postId: post._id,
              success: false,
              error: error.message
            };
          }
        });
        
        // Wait for all to complete
        const forwardResults = await Promise.all(forwardPromises);
        
        res.json({
          updated: result.modifiedCount,
          forwarded: forwardResults
        });
      } else {
        // Just return the update count for other status changes
        res.json({
          updated: result.modifiedCount
        });
      }
    } catch (error) {
      console.error('Error bulk updating post status:', error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  }
);

module.exports = router; 