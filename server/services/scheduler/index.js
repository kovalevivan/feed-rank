const cron = require('node-cron');
const VkSource = require('../../models/VkSource');
const vkService = require('../vk');
const telegramService = require('../telegram');
const Post = require('../../models/Post');
const Mapping = require('../../models/Mapping');

// Store active cron jobs
const cronJobs = {};

const { getAllMappingsForSource } = require('../../utils/mappingUtils');

/**
 * Initializes the scheduler service
 */
const init = () => {
  console.log('Initializing scheduler service...');
  
  // Schedule job to check for new sources every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      await updateSourceSchedules();
    } catch (error) {
      console.error('Error updating source schedules:', error);
    }
  });
  
  // Schedule job to process manually approved posts every 10 minutes
  // Note: Viral posts are now auto-forwarded immediately when detected
  cron.schedule('*/10 * * * *', async () => {
    try {
      await processPendingPosts();
    } catch (error) {
      console.error('Error processing approved posts:', error);
    }
  });
  
  // Schedule job to check high dynamics posts every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      await processHighDynamicsPosts();
    } catch (error) {
      console.error('Error processing high dynamics posts:', error);
    }
  });
  
  // Initial setup of schedules
  updateSourceSchedules().catch(err => {
    console.error('Error in initial source schedule setup:', err);
  });
  
  console.log('Scheduler service initialized');
};

/**
 * Updates the schedules for all VK sources
 */
const updateSourceSchedules = async () => {
  try {
    // Get all active sources
    const sources = await VkSource.find({ active: true });
    
    const currentSourceIds = new Set();
    
    // Set up or update cron job for each source
    for (const source of sources) {
      const sourceId = source._id.toString();
      currentSourceIds.add(sourceId);
      
      // Calculate cron expression based on check frequency
      const cronExpression = calculateCronExpression(source.checkFrequency);
      
      // If job exists and frequency changed, destroy and recreate
      if (cronJobs[sourceId]) {
        if (cronJobs[sourceId].expression !== cronExpression) {
          cronJobs[sourceId].job.stop();
          delete cronJobs[sourceId];
        } else {
          // Job exists with same schedule, skip
          continue;
        }
      }
      
      // Create new cron job
      const job = cron.schedule(cronExpression, async () => {
        try {
          console.log(`Processing posts for source ${source.name} (${sourceId})...`);
          await vkService.processSourcePosts(sourceId);
        } catch (error) {
          console.error(`Error processing source ${sourceId}:`, error);
        }
      });
      
      // Store job reference
      cronJobs[sourceId] = {
        job,
        expression: cronExpression,
        frequency: source.checkFrequency
      };
      
      console.log(`Scheduled job for source ${source.name} (${sourceId}): ${cronExpression}`);
    }
    
    // Clean up removed or deactivated sources
    for (const jobId of Object.keys(cronJobs)) {
      if (!currentSourceIds.has(jobId)) {
        console.log(`Removing job for deleted or deactivated source ${jobId}`);
        cronJobs[jobId].job.stop();
        delete cronJobs[jobId];
      }
    }
    
    return {
      activeJobs: Object.keys(cronJobs).length,
      sources: sources.length
    };
  } catch (error) {
    console.error('Error updating source schedules:', error);
    throw error;
  }
};

/**
 * Calculates a cron expression based on check frequency in minutes
 * @param {number} frequencyMinutes - Check frequency in minutes
 * @returns {string} - Cron expression
 */
const calculateCronExpression = (frequencyMinutes) => {
  // Handle special cases
  if (frequencyMinutes <= 0) {
    return '0 * * * *'; // Default to hourly if invalid
  }
  
  if (frequencyMinutes < 60) {
    // For less than hourly, run every N minutes
    return `*/${frequencyMinutes} * * * *`;
  } else if (frequencyMinutes === 60) {
    // Hourly
    return '0 * * * *';
  } else if (frequencyMinutes % 60 === 0) {
    // Every N hours
    const hours = frequencyMinutes / 60;
    return `0 */${hours} * * *`;
  } else {
    // For other values, convert to approximate hours
    const hours = Math.round(frequencyMinutes / 60);
    return hours > 0 ? `0 */${hours} * * *` : '0 * * * *';
  }
};

/**
 * Processes manually approved posts for forwarding to Telegram
 */
const processPendingPosts = async () => {
  try {
    console.log('Processing manually approved posts for forwarding...');
    const result = await telegramService.processPendingPosts();
    console.log(`Processed ${result.processed} approved posts, forwarded ${result.forwarded}, errors: ${result.errors}`);
    return result;
  } catch (error) {
    console.error('Error processing approved posts:', error);
    throw error;
  }
};

/**
 * Manually triggers processing for a specific source
 * @param {string} sourceId - ID of the VK source to process
 */
const processSourceNow = async (sourceId) => {
  try {
    const result = await vkService.processSourcePosts(sourceId);
    return result;
  } catch (error) {
    console.error(`Error manually processing source ${sourceId}:`, error);
    throw error;
  }
};

/**
 * Process high dynamics posts for sources with experimental tracking
 */
const processHighDynamicsPosts = async () => {
  try {
    console.log('🚀 Checking for high dynamics posts...');
    
    // Get all active sources with experimental tracking enabled
    const sources = await VkSource.find({ 
      active: true, 
      experimentalViewTracking: true,
      'highDynamicsDetection.enabled': true 
    });
    
    if (sources.length === 0) {
      console.log('No sources with high dynamics detection enabled');
      return;
    }
    
    let highDynamicsCount = 0;
    
    for (const source of sources) {
      try {
        // Get recent posts that are not viral and not already sent as high dynamics
        const recentPosts = await Post.find({
          vkSource: source._id,
          isViral: false,
          wasHighDynamics: false,
          createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
        }).sort({ createdAt: -1 }).limit(50);
        
        for (const post of recentPosts) {
          // Check if post has high dynamics
          const dynamicsCheck = await vkService.checkHighDynamics(post, source);
          
          if (dynamicsCheck.isHighDynamics) {
            console.log(`🔥 High dynamics detected for post ${post.postId} from ${source.name} (${dynamicsCheck.growthRate.toFixed(2)} views/min)`);
            
            // Get mappings for this source
            const mappings = await getAllMappingsForSource(source._id.toString());
            
            // Forward to all mapped channels with high dynamics marker
            for (const mapping of mappings) {
              if (mapping.telegramChannel && mapping.telegramChannel.active) {
                try {
                  await telegramService.forwardPost(post, source, mapping.telegramChannel, {
                    isHighDynamics: true,
                    growthRate: dynamicsCheck.growthRate,
                    viewHistory: dynamicsCheck.history
                  });
                  
                  console.log(`✅ Forwarded high dynamics post ${post.postId} to channel ${mapping.telegramChannel.name}`);
                } catch (error) {
                  console.error(`Failed to forward high dynamics post ${post.postId} to channel ${mapping.telegramChannel.name}:`, error);
                }
              }
            }
            
            // Mark post as high dynamics sent
            post.wasHighDynamics = true;
            post.highDynamicsForwardedAt = new Date();
            await post.save();
            
            highDynamicsCount++;
          }
        }
      } catch (error) {
        console.error(`Error processing high dynamics for source ${source.name}:`, error);
      }
    }
    
    if (highDynamicsCount > 0) {
      console.log(`✨ Forwarded ${highDynamicsCount} high dynamics posts`);
    }
  } catch (error) {
    console.error('Error in processHighDynamicsPosts:', error);
  }
};

module.exports = {
  init,
  updateSourceSchedules,
  processPendingPosts,
  processSourceNow,
  processHighDynamicsPosts,
  getCronJobs: () => cronJobs
}; 