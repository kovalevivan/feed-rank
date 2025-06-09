const { VK } = require('vk-io');
const VkSource = require('../../models/VkSource');
const Post = require('../../models/Post');
const Setting = require('../../models/Setting');
const ViewHistory = require('../../models/ViewHistory');
const { getAllMappingsForSource } = require('../../utils/mappingUtils');
const { getCombinedStopWords } = require('../../utils/stopWordsUtils');

// Initialize VK API client
let vk;

/**
 * Automatically forwards a viral post to all mapped Telegram channels
 * @param {Object} post - Post document
 * @param {Object} source - VK source document
 * @returns {Promise<Object>} - Forwarding results
 */
const autoForwardViralPost = async (post, source) => {
  try {
    // Import telegramService here to avoid circular dependency
    const telegramService = require('../telegram');
    
    // Get all mappings for this source (both individual and group mappings)
    const mappings = await getAllMappingsForSource(source._id.toString());
    
    if (mappings.length === 0) {
      console.log(`No mappings found for viral post ${post.postId} from source ${source.name}`);
      return { forwarded: 0, errors: 0 };
    }
    
    let forwardedCount = 0;
    let errorCount = 0;
    
    // Forward to each mapped channel
    for (const mapping of mappings) {
      if (mapping.telegramChannel && mapping.telegramChannel.active) {
        try {
          await telegramService.forwardPost(post, source, mapping.telegramChannel);
          forwardedCount++;
          console.log(`✅ Auto-forwarded viral post ${post.postId} to ${mapping.telegramChannel.name}`);
        } catch (error) {
          console.error(`❌ Failed to auto-forward viral post ${post.postId} to ${mapping.telegramChannel.name}: ${error.message}`);
          errorCount++;
        }
      }
    }
    
    // Update post status to forwarded if at least one forward was successful
    if (forwardedCount > 0) {
      post.status = 'forwarded';
      await post.save();
    }
    
    return { forwarded: forwardedCount, errors: errorCount };
  } catch (error) {
    console.error(`Error auto-forwarding viral post ${post.postId}:`, error);
    return { forwarded: 0, errors: 1 };
  }
};

/**
 * Validates that VK API credentials are properly configured
 * @throws {Error} If VK_ACCESS_TOKEN is missing or invalid
 */
const validateVkCredentials = () => {
  if (!process.env.VK_ACCESS_TOKEN) {
    throw new Error(
      'VK_ACCESS_TOKEN is missing. Please set up your VK credentials in the .env file. ' +
      'Run the script at server/scripts/get_vk_token.js for instructions.'
    );
  }
  
  // Initialize VK client if not already initialized
  if (!vk) {
    vk = new VK({
      token: process.env.VK_ACCESS_TOKEN
    });
  }
};

// Call validate on module load to check token and initialize client
try {
  validateVkCredentials();
  console.log('VK API client initialized successfully');
} catch (error) {
  console.warn('Warning:', error.message);
}

/**
 * Fetches posts from a VK public group
 * @param {string} groupId - VK group ID or name
 * @param {number} count - Number of posts to fetch, max 100
 * @returns {Promise<Array>} - Array of posts
 */
const fetchPosts = async (groupId, count = 100) => {
  try {
    validateVkCredentials();
    
    // Remove leading minus if present (group IDs in VK API are negative)
    const formattedGroupId = groupId.startsWith('-') ? groupId.substring(1) : groupId;
    
    const response = await vk.api.wall.get({
      owner_id: `-${formattedGroupId}`, // Negative ID for communities
      count: count,
      extended: 1 // Get extended info
    });
    
    return response.items;
  } catch (error) {
    // Check for auth errors
    if (error.code === 5) {
      console.error('VK API Authentication Error: Invalid or expired access token');
      throw new Error('Failed to authenticate with VK API. Please update your VK_ACCESS_TOKEN.');
    }
    
    console.error(`Error fetching posts from VK group ${groupId}:`, error);
    throw error;
  }
};

/**
 * Resolves a VK group name to its ID
 * @param {string} groupName - Name of the VK group
 * @returns {Promise<string>} - Group ID
 */
const resolveGroupId = async (groupName) => {
  try {
    validateVkCredentials();
    
    // Try multiple methods to resolve the group ID
    
    // Method 1: Direct getById - may not work for all groups
    try {
      const response = await vk.api.groups.getById({
        group_id: groupName
      });
      
      if (response && response.length > 0) {
        return response[0].id.toString();
      }
    } catch (error) {
              // Continue to next method
    }
    
    // Method 2: resolveScreenName for non-numeric IDs
    if (isNaN(groupName)) {
      try {
        const resolved = await vk.api.utils.resolveScreenName({
          screen_name: groupName
        });
        
        if (resolved && resolved.type === 'group') {
          return resolved.object_id.toString();
        }
      } catch (error) {
        // Continue to next method
      }
    }
    
    // Method 3: Try to access the group's wall
    try {
      let ownerId = groupName;
      
      // If numeric, format as negative number (community ID)
      if (!isNaN(groupName)) {
        ownerId = `-${groupName}`;
      } else {
        // Try to find ID via screen name first if not already done
        try {
          const resolved = await vk.api.utils.resolveScreenName({
            screen_name: groupName
          });
          if (resolved && resolved.type === 'group') {
            ownerId = `-${resolved.object_id}`;
          }
        } catch (e) {
          ownerId = groupName; // Keep original if resolution fails
        }
      }
      
      // Try to access wall
      const wallResult = await vk.api.wall.get({
        owner_id: ownerId,
        count: 1
      });
      
      if (wallResult && wallResult.count >= 0) {
        // Success, return the ID without the minus sign
        return ownerId.replace('-', '');
      }
    } catch (error) {
      // All methods failed
    }
    
    // If we get here, no method worked
    throw new Error(`Group "${groupName}" not found or not accessible`);
  } catch (error) {
    // Check for auth errors
    if (error.code === 5) {
      console.error('VK API Authentication Error: Invalid or expired access token');
      throw new Error('Failed to authenticate with VK API. Please update your VK_ACCESS_TOKEN.');
    }
    
    console.error(`Error resolving VK group "${groupName}":`, error);
    throw error;
  }
};

/**
 * Calculates detailed statistics for post views
 * @param {Array} posts - Array of VK posts
 * @returns {Object} - Detailed statistics for the posts
 */
const calculateDetailedStats = (posts) => {
  if (!posts || posts.length === 0) {
    return {
      count: 0,
      mean: 0,
      median: 0,
      min: 0,
      max: 0,
      standardDeviation: 0,
      percentiles: {
        p25: 0,
        p50: 0,
        p75: 0,
        p90: 0,
        p95: 0,
        p99: 0
      }
    };
  }
  
  // Extract view counts from posts
  const viewCounts = posts.map(post => post.views?.count || 0);
  
  // Sort for percentile calculations
  const sortedCounts = [...viewCounts].sort((a, b) => a - b);
  
  // Calculate mean (average)
  const mean = viewCounts.reduce((sum, count) => sum + count, 0) / viewCounts.length;
  
  // Calculate median (50th percentile)
  const median = calculatePercentile(sortedCounts, 50);
  
  // Min and max
  const min = sortedCounts[0];
  const max = sortedCounts[sortedCounts.length - 1];
  
  // Calculate standard deviation
  const squaredDifferences = viewCounts.map(count => {
    const diff = count - mean;
    return diff * diff;
  });
  
  const variance = squaredDifferences.reduce((sum, squared) => sum + squared, 0) / viewCounts.length;
  const standardDeviation = Math.sqrt(variance);
  
  // Calculate percentiles
  const p25 = calculatePercentile(sortedCounts, 25);
  const p75 = calculatePercentile(sortedCounts, 75);
  const p90 = calculatePercentile(sortedCounts, 90);
  const p95 = calculatePercentile(sortedCounts, 95);
  const p99 = calculatePercentile(sortedCounts, 99);
  
  return {
    count: posts.length,
    mean: Math.round(mean),
    median: Math.round(median),
    min,
    max,
    standardDeviation: Math.round(standardDeviation),
    percentiles: {
      p25: Math.round(p25),
      p50: Math.round(median),
      p75: Math.round(p75),
      p90: Math.round(p90),
      p95: Math.round(p95),
      p99: Math.round(p99)
    }
  };
};

/**
 * Calculates a percentile value from a sorted array
 * @param {Array} sortedArray - Sorted array of values
 * @param {number} percentile - Percentile to calculate (0-100)
 * @returns {number} - The percentile value
 */
const calculatePercentile = (sortedArray, percentile) => {
  if (sortedArray.length === 0) return 0;
  if (sortedArray.length === 1) return sortedArray[0];
  
  const index = (percentile / 100) * (sortedArray.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  
  if (lower === upper) return sortedArray[lower];
  
  const weight = index - lower;
  return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
};

/**
 * Calculates the average view count from posts
 * @param {Array} posts - Array of VK posts
 * @returns {number} - Average view count
 */
const calculateAverageViews = (posts) => {
  if (!posts || posts.length === 0) return 0;
  
  const totalViews = posts.reduce((sum, post) => {
    return sum + (post.views?.count || 0);
  }, 0);
  
  return Math.round(totalViews / posts.length);
};

/**
 * Calculates the threshold using mean + multiplier * standard deviation of view counts
 * This provides a more statistically sound way to identify viral posts
 * @param {Array} posts - Array of VK posts
 * @param {number} multiplier - Multiplier for standard deviation
 * @returns {number} - Calculated threshold
 */
const calculateStatisticalThreshold = (posts, multiplier) => {
  if (!posts || posts.length === 0) return 0;
  if (multiplier === undefined || multiplier === null) {
    console.error(`WARNING: No multiplier provided to calculateStatisticalThreshold, using default 1.5`);
    multiplier = 1.5;
  }
  
  // Get detailed statistics
  const stats = calculateDetailedStats(posts);
  
  // Calculate threshold as mean + multiplier * standard deviations
  const threshold = Math.round(stats.mean + (multiplier * stats.standardDeviation));
  
      // Statistical threshold calculated: Mean + (multiplier * SD)
  
  return threshold;
};

/**
 * Updates the calculated threshold for a VK source
 * @param {string} sourceId - VK source ID in our database
 * @param {string} thresholdMethod - Method to use for threshold calculation ('average' or 'statistical')
 * @param {number} multiplier - Multiplier for statistical threshold (default: 1.5)
 * @returns {Promise<Object>} - Updated VK source
 */
const updateSourceThreshold = async (sourceId, thresholdMethod = 'statistical', multiplier = 1.5) => {
  try {
    validateVkCredentials();
    
    const source = await VkSource.findById(sourceId);
    if (!source) throw new Error(`VK source with ID ${sourceId} not found`);
    
    // Fixed value of 200 posts for threshold calculation
    const postsForAverage = 200;
    const posts = await fetchPosts(source.groupId, postsForAverage);
    
    let calculatedThreshold;
    let detailedStats = calculateDetailedStats(posts);
    
    // Always update the statisticalMultiplier, even if not using statistical method
    // This ensures it's available if they switch methods later
    const usedMultiplier = multiplier || source.statisticalMultiplier || 1.5;
    source.statisticalMultiplier = usedMultiplier;
    
    if (thresholdMethod === 'statistical') {
      calculatedThreshold = calculateStatisticalThreshold(posts, usedMultiplier);
    } else {
      calculatedThreshold = calculateAverageViews(posts);
    }
    
    // Store the threshold and additional data
    source.calculatedThreshold = calculatedThreshold;
    source.thresholdMethod = thresholdMethod;
    source.lastPostsData = {
      averageViews: detailedStats.mean,
      postsAnalyzed: posts.length,
      lastAnalysisDate: new Date(),
      thresholdMethod: thresholdMethod,
      multiplierUsed: thresholdMethod === 'statistical' ? usedMultiplier : null,
      detailedStats: detailedStats // Store the detailed statistics
    };
    
    await source.save();
    
    return source;
  } catch (error) {
    console.error(`Error updating threshold for VK source ${sourceId}:`, error);
    throw error;
  }
};

/**
 * Processes posts from a VK source and identifies viral posts
 * @param {string} sourceId - VK source ID in our database
 * @returns {Promise<Object>} - Processing results
 */
const processSourcePosts = async (sourceId) => {
  try {
    validateVkCredentials();
    
    const source = await VkSource.findById(sourceId);
    if (!source) throw new Error(`VK source with ID ${sourceId} not found`);
    
    // Get threshold based on type
    const threshold = source.thresholdType === 'manual' 
      ? source.manualThreshold 
      : source.calculatedThreshold;
    
    if (threshold <= 0 && source.thresholdType === 'auto') {
      // Calculate threshold if not set, using statistical method by default
      const thresholdMethod = source.thresholdMethod || 'statistical';
      await updateSourceThreshold(sourceId, thresholdMethod);
    }
    
    // Fetch recent posts
    const postsToFetch = source.postsToCheck || 50;
    console.log(`Processing source ${sourceId}: Fetching ${postsToFetch} posts from VK group ${source.name} (ID: ${source.groupId})`);
    const posts = await fetchPosts(source.groupId, postsToFetch);
    
    // Get combined stop words (global + group-level)
    const stopWords = await getCombinedStopWords(sourceId);
    
    // Filter out posts containing stop words
    const filteredPosts = stopWords.length > 0 
      ? posts.filter(post => {
          if (!post.text) return true; // Keep posts without text
          
          const postText = post.text.toLowerCase();
          // Check if any stop word is in the post text
          return !stopWords.some(word => postText.includes(word));
        })
      : posts;
    
    if (posts.length - filteredPosts.length > 0) {
      console.log(`Filtered out ${posts.length - filteredPosts.length} posts containing stop words`);
    }
    
    let viralCount = 0;
    let updatedCount = 0;
    let createdCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let autoForwardedCount = 0;
    
    // Process each post
    for (const post of filteredPosts) {
      const postId = post.id.toString();
      const viewCount = post.views?.count || 0;
      const isViral = viewCount > threshold;
      
      // Create or update post in our database
      const postData = {
        postId: postId,
        text: post.text,
        viewCount,
        likeCount: post.likes?.count || 0,
        repostCount: post.reposts?.count || 0,
        isViral,
        thresholdUsed: threshold,
        originalPostUrl: `https://vk.com/wall-${source.groupId}_${post.id}`,
        publishedAt: new Date(post.date * 1000)
      };
      
      // Handle attachments
      if (post.attachments?.length > 0) {
        postData.attachments = post.attachments.map(att => {
          let attachment = {
            type: att.type
          };
          
          // Extract URLs based on attachment type
          if (att.type === 'photo') {
            // Get the largest photo
            const photos = att.photo.sizes || [];
            const largestPhoto = photos.sort((a, b) => (b.width || 0) - (a.width || 0))[0] || {};
            
            attachment.url = largestPhoto.url;
            
            // Get thumbnail
            const thumbnail = photos.find(p => p.type === 'x') || photos[0] || {};
            attachment.thumbnailUrl = thumbnail.url;
          } else if (att.type === 'video') {
            // Create the VK video URL
            attachment.url = `https://vk.com/video${att.video.owner_id}_${att.video.id}`;
            
            // Extract thumbnail
            attachment.thumbnailUrl = att.video.image?.length > 0 
              ? att.video.image[att.video.image.length - 1].url 
              : null;
              
            // Try to extract direct video URL
            // First check if direct URLs are provided in the API response
            if (att.video.files) {
              // Choose the best quality available
              const qualities = ['mp4_1080', 'mp4_720', 'mp4_480', 'mp4_360', 'mp4_240'];
              for (const quality of qualities) {
                if (att.video.files[quality]) {
                  attachment.directUrl = att.video.files[quality];
                  break;
                }
              }
            }
            
            // Include duration if available
            if (att.video.duration) {
              attachment.duration = att.video.duration;
            }
            
            // Include video title if available
            if (att.video.title) {
              attachment.title = att.video.title;
            }
          } else if (att.type === 'link') {
            attachment.url = att.link.url;
            attachment.thumbnailUrl = att.link.photo?.sizes?.length > 0 
              ? att.link.photo.sizes[0].url 
              : null;
          }
          
          return attachment;
        });
      }
      
      // First check if post already exists
      try {
        const existingPost = await Post.findOne({ vkSource: sourceId, postId: postId });
        
        if (existingPost) {
          // Check if post became viral (wasn't viral before but is now)
          const wasNotViral = !existingPost.isViral;
          const isNowViral = isViral;
          const becameViral = wasNotViral && isNowViral;
          
          // Update existing post
          existingPost.text = postData.text;
          existingPost.viewCount = postData.viewCount;
          existingPost.likeCount = postData.likeCount;
          existingPost.repostCount = postData.repostCount;
          existingPost.isViral = postData.isViral;
          existingPost.thresholdUsed = postData.thresholdUsed;
          
          if (postData.attachments && postData.attachments.length > 0) {
            existingPost.attachments = postData.attachments;
          }
          
          await existingPost.save();
          updatedCount++;
          
          if (isViral) viralCount++;
          
          // Auto-forward if post became viral and hasn't been forwarded yet
          if (becameViral && existingPost.status === 'pending') {
            const forwardResult = await autoForwardViralPost(existingPost, source);
            if (forwardResult.forwarded > 0) {
              autoForwardedCount++;
            }
          }
          
          // Track view history if experimental feature is enabled
          if (source.experimentalViewTracking) {
            await trackViewHistory(existingPost, source, viewCount);
          }
        } else {
          // Create new post
          const newPost = new Post({
            vkSource: sourceId,
            ...postData
          });
          
          await newPost.save();
          createdCount++;
          
          if (isViral) {
            viralCount++;
            
            // Auto-forward new viral posts
            const forwardResult = await autoForwardViralPost(newPost, source);
            if (forwardResult.forwarded > 0) {
              autoForwardedCount++;
            }
          }
          
          // Track initial view count if experimental feature is enabled
          if (source.experimentalViewTracking) {
            await trackViewHistory(newPost, source, viewCount);
          }
        }
      } catch (error) {
        console.error(`Error saving post ${postId} from source ${sourceId}:`, error);
        errorCount++;
        
        // If it's a duplicate key error, try to handle it specially
        if (error.name === 'MongoError' && error.code === 11000) {
          skippedCount++;
          console.warn(`Skipped duplicate post ${postId} from source ${sourceId}`);
        } else {
          errorCount++;
        }
      }
    }
    
    // Update last checked time
    source.lastChecked = new Date();
    await source.save();
    
    return {
      sourceId,
      postsProcessed: posts.length,
      created: createdCount,
      updated: updatedCount,
      skipped: skippedCount,
      errors: errorCount,
      viralPostsFound: viralCount,
      autoForwarded: autoForwardedCount,
      filteredByStopWords: posts.length - filteredPosts.length
    };
  } catch (error) {
    console.error(`Error processing posts for VK source ${sourceId}:`, error);
    throw error;
  }
};

/**
 * Extract owner and video IDs from a VK video URL
 * @param {string} url - VK video URL
 * @returns {Object|null} - Object with ownerId and videoId, or null if invalid URL
 */
const extractVideoIds = (url) => {
  if (!url) return null;
  
  // Try various formats of VK video URLs
  const patterns = [
    /video(-?\d+)_(\d+)/, // Standard format: video{owner_id}_{video_id}
    /video\/(-?\d+)_(\d+)/, // Alternative format: video/{owner_id}_{video_id}
    /video.php\?vid=(\d+)&owner_id=(-?\d+)/ // Old format: video.php?vid={video_id}&owner_id={owner_id}
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      // For the standard and alternative formats
      if (pattern === patterns[0] || pattern === patterns[1]) {
        return {
          ownerId: match[1],
          videoId: match[2]
        };
      }
      // For the old format (note the parameter order difference)
      else if (pattern === patterns[2]) {
        return {
          ownerId: match[2],
          videoId: match[1]
        };
      }
    }
  }
  
  return null;
};

/**
 * Get direct video URLs from VK API
 * @param {string} ownerId - Video owner ID
 * @param {string} videoId - Video ID
 * @param {string} accessKey - Access key (optional)
 * @returns {Promise<Object>} - Object with video data including direct URLs
 */
const getVideoUrls = async (ownerId, videoId, accessKey) => {
  try {
    validateVkCredentials();
    
    // Request video data from VK API
    const response = await vk.api.video.get({
      videos: `${ownerId}_${videoId}${accessKey ? '_' + accessKey : ''}`,
      extended: 1
    });
    
    if (!response.items || response.items.length === 0) {
      throw new Error('No video data returned from VK API');
    }
    
    const videoData = response.items[0];
    
    // Return relevant video data
    return {
      title: videoData.title || 'VK Video',
      duration: videoData.duration || 0,
      playerUrl: videoData.player,
      files: videoData.files || {},
      image: videoData.image && videoData.image.length > 0 
        ? videoData.image[videoData.image.length - 1].url 
        : null,
      directUrl: extractBestVideoUrl(videoData)
    };
  } catch (error) {
    console.error('Error getting video URLs:', error);
    return {
      playerUrl: `https://vk.com/video${ownerId}_${videoId}${accessKey ? '_' + accessKey : ''}`,
      directUrl: null
    };
  }
};

/**
 * Extract the best quality direct URL from video data
 * @param {Object} videoData - Video data from VK API
 * @returns {string|null} - Best quality direct URL or null
 */
const extractBestVideoUrl = (videoData) => {
  if (!videoData.files) return null;
  
  // VK provides multiple quality options, try to get the highest quality
  const qualities = ['mp4_1080', 'mp4_720', 'mp4_480', 'mp4_360', 'mp4_240'];
  
  for (const quality of qualities) {
    if (videoData.files[quality]) {
      return videoData.files[quality];
    }
  }
  
  return null;
};

/**
 * Track view history for a post
 * @param {Object} post - Post document
 * @param {Object} source - VK source document
 * @param {number} currentViewCount - Current view count
 */
const trackViewHistory = async (post, source, currentViewCount) => {
  try {
    // Get the last view history entry for this post
    const lastHistory = await ViewHistory.findOne({
      post: post._id,
      vkSource: source._id,
      postId: post.postId
    }).sort({ timestamp: -1 });
    
    // Calculate deltas
    let viewDelta = 0;
    let timeDeltaMinutes = 0;
    let growthRate = 0;
    
    if (lastHistory) {
      viewDelta = currentViewCount - lastHistory.viewCount;
      timeDeltaMinutes = (Date.now() - lastHistory.timestamp) / (1000 * 60); // Convert to minutes
      
      // Calculate growth rate (views per minute)
      if (timeDeltaMinutes > 0) {
        growthRate = viewDelta / timeDeltaMinutes;
      }
    }
    
    // Create new view history entry
    const viewHistory = new ViewHistory({
      post: post._id,
      vkSource: source._id,
      postId: post.postId,
      viewCount: currentViewCount,
      viewDelta,
      timeDeltaMinutes,
      growthRate
    });
    
    await viewHistory.save();
    
    // Clean up old entries (older than 4 days)
    await cleanupOldViewHistory();
    
  } catch (error) {
    console.error(`Error tracking view history for post ${post.postId}:`, error);
    // Don't throw - this is an experimental feature and shouldn't break main flow
  }
};

/**
 * Clean up view history entries older than 4 days
 */
const cleanupOldViewHistory = async () => {
  try {
    const fourDaysAgo = new Date();
    fourDaysAgo.setDate(fourDaysAgo.getDate() - 4);
    
    const result = await ViewHistory.deleteMany({
      timestamp: { $lt: fourDaysAgo }
    });
    
    // Cleanup completed silently
  } catch (error) {
    console.error('Error cleaning up old view history:', error);
    // Don't throw - cleanup is not critical
  }
};

/**
 * Get view history for a post
 * @param {string} postId - Post ID
 * @param {string} sourceId - VK source ID
 * @param {number} limit - Number of history entries to return
 * @returns {Promise<Array>} - Array of view history entries
 */
const getViewHistory = async (postId, sourceId, limit = 10) => {
  try {
    const history = await ViewHistory.find({
      postId,
      vkSource: sourceId
    })
    .sort({ timestamp: -1 })
    .limit(limit);
    
    return history;
  } catch (error) {
    console.error(`Error getting view history for post ${postId}:`, error);
    return [];
  }
};

/**
 * Check if a post has high view dynamics
 * @param {Object} post - Post document
 * @param {Object} source - VK source document
 * @returns {Promise<Object>} - Object with isHighDynamics flag and growth rate
 */
const checkHighDynamics = async (post, source) => {
  try {
    // Check if high dynamics detection is enabled
    if (!source.experimentalViewTracking || 
        !source.highDynamicsDetection || 
        !source.highDynamicsDetection.enabled) {
      return { isHighDynamics: false, growthRate: 0 };
    }
    
    const minDataPoints = source.highDynamicsDetection.minDataPoints || 4;
    const growthThreshold = source.highDynamicsDetection.growthRateThreshold || 30;
    
    // Get exactly minDataPoints entries from history
    const history = await ViewHistory.find({
      post: post._id,
      vkSource: source._id
    })
    .sort({ timestamp: -1 })
    .limit(minDataPoints);
    
    // Need exactly minDataPoints entries
    if (history.length < minDataPoints) {
      return { isHighDynamics: false, growthRate: 0 };
    }
    
    // Calculate average growth rate from the entries
    const avgGrowthRate = history.reduce((sum, entry) => sum + entry.growthRate, 0) / history.length;
    
    // Check if average growth rate is above threshold
    const hasHighDynamics = avgGrowthRate >= growthThreshold;
    
    if (!hasHighDynamics) {
      return { isHighDynamics: false, growthRate: 0 };
    }
    
    // Also check if post is not already viral and wasn't already sent as high dynamics
    const shouldSend = hasHighDynamics && 
                      !post.isViral && 
                      !post.wasHighDynamics &&
                      !post.highDynamicsForwardedAt;
    
    // Calculate time range of high dynamics
    const startTime = history[history.length - 1].timestamp;
    const endTime = history[0].timestamp;
    
    return { 
      isHighDynamics: shouldSend, 
      growthRate: avgGrowthRate,
      history: history,
      timeRange: {
        start: startTime,
        end: endTime,
        duration: (endTime - startTime) / 1000 / 60 // duration in minutes
      }
    };
  } catch (error) {
    console.error(`Error checking high dynamics for post ${post.postId}:`, error);
    return { isHighDynamics: false, growthRate: 0 };
  }
};

module.exports = {
  fetchPosts,
  resolveGroupId,
  calculateAverageViews,
  calculateStatisticalThreshold,
  calculateDetailedStats,
  updateSourceThreshold,
  processSourcePosts,
  extractVideoIds,
  getVideoUrls,
  extractBestVideoUrl,
  trackViewHistory,
  cleanupOldViewHistory,
  getViewHistory,
  checkHighDynamics
}; 