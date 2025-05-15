const { VK } = require('vk-io');
const VkSource = require('../../models/VkSource');
const Post = require('../../models/Post');

// Initialize VK API client
let vk;

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
      console.log(`Method 1 (getById) failed for "${groupName}": ${error.message}`);
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
        console.log(`Method 2 (resolveScreenName) failed for "${groupName}": ${error.message}`);
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
      console.log(`Method 3 (wall.get) failed for "${groupName}": ${error.message}`);
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
 * Updates the calculated threshold for a VK source
 * @param {string} sourceId - VK source ID in our database
 * @returns {Promise<Object>} - Updated VK source
 */
const updateSourceThreshold = async (sourceId) => {
  try {
    validateVkCredentials();
    
    const source = await VkSource.findById(sourceId);
    if (!source) throw new Error(`VK source with ID ${sourceId} not found`);
    
    const posts = await fetchPosts(source.groupId, 200);
    const averageViews = calculateAverageViews(posts);
    
    source.calculatedThreshold = averageViews;
    source.lastPostsData = {
      averageViews,
      postsAnalyzed: posts.length,
      lastAnalysisDate: new Date()
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
      // Calculate threshold if not set
      await updateSourceThreshold(sourceId);
    }
    
    // Fetch recent posts
    const posts = await fetchPosts(source.groupId, 50);
    let viralCount = 0;
    
    // Process each post
    for (const post of posts) {
      const viewCount = post.views?.count || 0;
      const isViral = viewCount > threshold;
      
      // Create or update post in our database
      const postData = {
        postId: post.id.toString(),
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
            attachment.url = `https://vk.com/video${att.video.owner_id}_${att.video.id}`;
            attachment.thumbnailUrl = att.video.image?.length > 0 
              ? att.video.image[att.video.image.length - 1].url 
              : null;
          } else if (att.type === 'link') {
            attachment.url = att.link.url;
            attachment.thumbnailUrl = att.link.photo?.sizes?.length > 0 
              ? att.link.photo.sizes[0].url 
              : null;
          }
          
          return attachment;
        });
      }
      
      // Try to find existing post or create new one
      try {
        await Post.findOneAndUpdate(
          { vkSource: sourceId, postId: postData.postId },
          { vkSource: sourceId, ...postData },
          { upsert: true, new: true }
        );
        
        if (isViral) viralCount++;
      } catch (error) {
        console.error(`Error saving post ${post.id} from source ${sourceId}:`, error);
      }
    }
    
    // Update last checked time
    source.lastChecked = new Date();
    await source.save();
    
    return {
      sourceId,
      postsProcessed: posts.length,
      viralPostsFound: viralCount
    };
  } catch (error) {
    console.error(`Error processing posts for VK source ${sourceId}:`, error);
    throw error;
  }
};

module.exports = {
  fetchPosts,
  resolveGroupId,
  calculateAverageViews,
  updateSourceThreshold,
  processSourcePosts
}; 