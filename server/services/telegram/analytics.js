const TelegramSource = require('../../models/TelegramSource');
const Post = require('../../models/Post');

const getMetricValue = (post, viralDetectionMetric = 'reactions') => {
  switch (viralDetectionMetric) {
    case 'reactions':
      return post.reactionCount || 0;
    case 'comments':
      return post.commentCount || 0;
    case 'views':
      return post.viewCount || 0;
    case 'engagement_score':
    default: {
      const reactionScore = (post.reactionCount || 0) * 1.0;
      const commentScore = (post.commentCount || 0) * 2.0;
      const forwardScore = (post.forwardCount || 0) * 3.0;
      return reactionScore + commentScore + forwardScore;
    }
  }
};

/**
 * Calculate average engagement for posts
 * @param {Array} posts - Array of post objects
 * @returns {Number} - Average engagement score
 */
const calculateAverageEngagement = (posts, viralDetectionMetric = 'engagement_score') => {
  if (posts.length === 0) return 0;

  const totalMetric = posts.reduce((sum, post) => {
    return sum + getMetricValue(post, viralDetectionMetric);
  }, 0);

  return Math.round(totalMetric / posts.length);
};

/**
 * Calculate statistical threshold using standard deviation
 * @param {Array} posts - Array of post objects
 * @param {Number} multiplier - Multiplier for statistical threshold (default: 1.0)
 * @returns {Number} - Statistical threshold
 */
const calculateStatisticalThreshold = (posts, multiplier = 1.0, viralDetectionMetric = 'reactions') => {
  if (posts.length === 0) return 0;

  const metricValues = posts.map(post => getMetricValue(post, viralDetectionMetric));
  
  // Calculate mean
  const mean = metricValues.reduce((sum, value) => sum + value, 0) / metricValues.length;
  
  // Calculate standard deviation
  const variance = metricValues.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / metricValues.length;
  const stdDev = Math.sqrt(variance);
  
  // Threshold = mean + (multiplier * standard deviation)
  const threshold = Math.round(mean + (multiplier * stdDev));
  
  return Math.max(threshold, 5); // Minimum threshold of 5
};

/**
 * Calculate percentile threshold
 * @param {Array} posts - Array of post objects
 * @param {Number} percentile - Percentile value (e.g., 90 for 90th percentile, meaning top 10%)
 * @returns {Number} - Percentile threshold
 */
const calculatePercentileThreshold = (posts, percentile = 90, viralDetectionMetric = 'engagement_score') => {
  if (posts.length === 0) return 0;

  const metricValues = posts
    .map(post => getMetricValue(post, viralDetectionMetric))
    .sort((a, b) => a - b);
  
  // Calculate percentile index
  const index = Math.ceil((percentile / 100) * metricValues.length) - 1;
  const clampedIndex = Math.max(0, Math.min(index, metricValues.length - 1));
  
  const threshold = Math.round(metricValues[clampedIndex]);
  
  return Math.max(threshold, 5); // Minimum threshold of 5
};

/**
 * Calculate detailed statistics for posts
 * @param {Array} posts - Array of post objects
 * @returns {Object} - Detailed statistics
 */
const calculateDetailedStats = (posts, viralDetectionMetric = 'engagement_score') => {
  if (posts.length === 0) {
    return {
      count: 0,
      mean: 0,
      median: 0,
      stdDev: 0,
      min: 0,
      max: 0
    };
  }
  
  const metricValues = posts
    .map(post => getMetricValue(post, viralDetectionMetric))
    .sort((a, b) => a - b);

  const mean = metricValues.reduce((sum, score) => sum + score, 0) / metricValues.length;
  const median = metricValues.length % 2 === 0 
    ? (metricValues[metricValues.length / 2 - 1] + metricValues[metricValues.length / 2]) / 2
    : metricValues[Math.floor(metricValues.length / 2)];
  
  const variance = metricValues.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / metricValues.length;
  const stdDev = Math.sqrt(variance);
  
  return {
    count: posts.length,
    mean: Math.round(mean),
    median: Math.round(median),
    stdDev: Math.round(stdDev),
    min: metricValues[0] || 0,
    max: metricValues[metricValues.length - 1] || 0
  };
};

/**
 * Updates the calculated threshold for a Telegram source
 * @param {string} sourceId - Telegram source ID in our database
 * @param {string} thresholdMethod - Method to use for threshold calculation ('average' or 'statistical')
 * @param {number} multiplier - Multiplier for statistical threshold (default: 1.0)
 * @returns {Promise<Object>} - Updated Telegram source
 */
const updateSourceThreshold = async (sourceId, thresholdMethod = 'statistical', multiplier = 1.0) => {
  try {
    const source = await TelegramSource.findById(sourceId);
    if (!source) throw new Error(`Telegram source with ID ${sourceId} not found`);
    
    // Get recent posts for analysis (up to 200 posts)
    const postsForAnalysis = 200;
    const recentPosts = await getRecentPostsForAnalysis(sourceId, postsForAnalysis, null, source.viralDetectionMetric);
    
    if (recentPosts.length === 0) {
      console.warn(`No recent posts found for Telegram source ${sourceId}, using default threshold`);
      source.calculatedThreshold = 10; // Default threshold
      await source.save();
      return source;
    }
    
    let calculatedThreshold;
    let detailedStats = calculateDetailedStats(recentPosts, source.viralDetectionMetric);
    
    // Always update the statisticalMultiplier
    const usedMultiplier = multiplier || source.statisticalMultiplier || 1.0;
    source.statisticalMultiplier = usedMultiplier;
    
    if (thresholdMethod === 'statistical') {
      calculatedThreshold = calculateStatisticalThreshold(recentPosts, usedMultiplier, source.viralDetectionMetric);
    } else if (thresholdMethod === 'percentile') {
      const percentile = Math.min(97, Math.max(80, 75 + (usedMultiplier * 10)));
      calculatedThreshold = calculatePercentileThreshold(recentPosts, percentile, source.viralDetectionMetric);
    } else {
      calculatedThreshold = calculateAverageEngagement(recentPosts, source.viralDetectionMetric);
    }
    
    // Store the threshold and additional data
    source.calculatedThreshold = calculatedThreshold;
    source.thresholdMethod = thresholdMethod;
    source.lastPostsData = {
      averageEngagement: detailedStats.mean,
      postsAnalyzed: recentPosts.length,
      lastAnalysisDate: new Date(),
      thresholdMethod: thresholdMethod,
      multiplierUsed: thresholdMethod === 'statistical' ? usedMultiplier : null,
      detailedStats: detailedStats
    };
    
    await source.save();
    
    console.log(`📊 Updated threshold for Telegram source ${source.name}: ${calculatedThreshold} (method: ${thresholdMethod}, posts analyzed: ${recentPosts.length})`);
    
    return source;
  } catch (error) {
    console.error(`Error updating threshold for Telegram source ${sourceId}:`, error);
    throw error;
  }
};



/**
 * Get recent posts from a Telegram source for analysis
 * @param {string} sourceIdOrChatId - Telegram source ObjectId OR chatId string
 * @param {number} limit - Maximum number of posts to return (default: 100)
 * @returns {Promise<Array>} - Array of recent posts
 */
const getRecentPostsForAnalysis = async (sourceIdOrChatId, limit = 100, username = null, viralDetectionMetric = null) => {
  try {
    let query;
    
    // Check if it's a MongoDB ObjectId (24 hex characters) or a chatId (starts with -)
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(sourceIdOrChatId);
    const isChatId = sourceIdOrChatId.toString().startsWith('-');
    
    if (isObjectId) {
      // Query by telegramSource ObjectId (for existing sources)
      query = { telegramSource: sourceIdOrChatId };
    } else if (isChatId) {
      // For chatId, try to fetch directly from Telegram instead of database
      console.log(`📊 ChatId provided for analysis: ${sourceIdOrChatId} - fetching directly from Telegram`);
      const normalizedUsername = typeof username === 'string' && username.trim()
        ? username.trim().replace(/^@/, '')
        : null;
      const sourceLookupConditions = [{ chatId: sourceIdOrChatId }];
      if (normalizedUsername) {
        sourceLookupConditions.push(
          { username: normalizedUsername },
          { username: `@${normalizedUsername}` }
        );
      }

      const source = await TelegramSource.findOne({ $or: sourceLookupConditions });
      
      try {
        // Import client here to avoid circular dependency
        const { getMessagesForThresholdCalculation } = require('./client');

        // Fetch messages directly from Telegram
        const telegramPosts = await getMessagesForThresholdCalculation(
          sourceIdOrChatId,
          source?.username || normalizedUsername,
          limit
        );
        return telegramPosts.filter(post => getMetricValue(post, viralDetectionMetric || source?.viralDetectionMetric || 'engagement_score') > 0);
      } catch (error) {
        console.warn(`⚠️ Could not fetch messages directly from Telegram for ${sourceIdOrChatId}: ${error.message}`);
        console.log(`📊 Falling back to database posts for analysis...`);

        if (!source) {
          console.log(`📊 No matching source found for chatId ${sourceIdOrChatId}, database fallback unavailable`);
          return [];
        }

        const fallbackQuery = { telegramSource: source._id };
        const fallbackPosts = await Post.find(fallbackQuery)
          .sort({ publishedAt: -1 })
          .limit(limit)
          .select('reactionCount commentCount forwardCount viewCount text publishedAt originalPostId')
          .lean();
        
        console.log(`📊 Found ${fallbackPosts.length} posts in database for fallback analysis`);
        return fallbackPosts.filter(post => getMetricValue(post, viralDetectionMetric || source.viralDetectionMetric || 'engagement_score') > 0);
      }
    } else {
      throw new Error(`Invalid sourceIdOrChatId format: ${sourceIdOrChatId}`);
    }
    
    const recentPosts = await Post.find(query)
      .sort({ publishedAt: -1 }) // Sort by publish date, newest first
      .limit(limit)
      .select('reactionCount commentCount forwardCount viewCount text publishedAt originalPostId')
      .lean(); // Use lean() for better performance
    
    // Filter out posts with no engagement data
    const postsWithEngagement = recentPosts.filter(post => {
      return getMetricValue(post, viralDetectionMetric || 'engagement_score') > 0;
    });
    
    console.log(`📊 Retrieved ${postsWithEngagement.length} posts with engagement data out of ${recentPosts.length} total posts for analysis`);
    
    return postsWithEngagement;
  } catch (error) {
    console.error(`Error getting recent posts for analysis from ${sourceIdOrChatId}:`, error);
    throw error;
  }
};

module.exports = {
  updateSourceThreshold,
  getRecentPostsForAnalysis,
  calculateAverageEngagement,
  calculateStatisticalThreshold,
  calculatePercentileThreshold,
  calculateDetailedStats
};
