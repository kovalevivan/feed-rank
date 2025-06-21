const cron = require('node-cron');
const VkSource = require('../../models/VkSource');
const vkService = require('../vk');
const telegramService = require('../telegram');
const Post = require('../../models/Post');
const Mapping = require('../../models/Mapping');
const ViewHistory = require('../../models/ViewHistory');

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
  
  // Schedule job to check high dynamics posts every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    try {
      await processHighDynamicsPosts();
    } catch (error) {
      console.error('Error processing high dynamics posts:', error);
    }
  });
  
  // Schedule ViewHistory cleanup every 30 minutes to prevent memory issues
  cron.schedule('*/30 * * * *', async () => {
    try {
      await performViewHistoryCleanup();
    } catch (error) {
      console.error('Error performing ViewHistory cleanup:', error);
    }
  });
  
  // Schedule memory monitoring every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    try {
      await monitorMemoryUsage();
    } catch (error) {
      console.error('Error monitoring memory:', error);
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
      
      // Job scheduled for source
    }
    
    // Clean up removed or deactivated sources
    for (const jobId of Object.keys(cronJobs)) {
      if (!currentSourceIds.has(jobId)) {
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
    const result = await telegramService.processPendingPosts();
    if (result.forwarded > 0) {
      console.log(`✅ Forwarded ${result.forwarded} manually approved posts`);
    }
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
    // Get all active sources with experimental tracking enabled
    const sources = await VkSource.find({ 
      active: true, 
      experimentalViewTracking: true,
      'highDynamicsDetection.enabled': true 
    });
    
    if (sources.length === 0) {
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
                    viewHistory: dynamicsCheck.history,
                    timeRange: dynamicsCheck.timeRange
                  });
                  
                  console.log(`✅ Forwarded high dynamics post ${post.postId} to ${mapping.telegramChannel.name}`);
                } catch (error) {
                  console.error(`❌ Failed to forward high dynamics post ${post.postId} to ${mapping.telegramChannel.name}: ${error.message}`);
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

/**
 * Perform automated ViewHistory cleanup to prevent memory issues
 */
const performViewHistoryCleanup = async () => {
  try {
    console.log('🧹 Starting automated ViewHistory cleanup...');
    
    // Get initial count
    const initialCount = await ViewHistory.countDocuments();
    
    // Step 1: Remove entries older than 1 day (aggressive)
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const oldResult = await ViewHistory.deleteMany({
      timestamp: { $lt: oneDayAgo }
    });
    
    // Step 2: Limit total entries to 20,000 maximum
    const countAfterOld = await ViewHistory.countDocuments();
    const maxEntries = 20000;
    
    let excessResult = { deletedCount: 0 };
    if (countAfterOld > maxEntries) {
      const entriesToDelete = countAfterOld - maxEntries;
      const oldestEntries = await ViewHistory.find({})
        .sort({ timestamp: 1 })
        .limit(entriesToDelete)
        .select('_id');
      
      if (oldestEntries.length > 0) {
        const idsToDelete = oldestEntries.map(entry => entry._id);
        excessResult = await ViewHistory.deleteMany({
          _id: { $in: idsToDelete }
        });
      }
    }
    
    // Step 3: Remove low-value entries
    const lowValueResult = await ViewHistory.deleteMany({
      $or: [
        { growthRate: { $lte: 0 } },
        { viewDelta: { $lte: 0 } }
      ]
    });
    
    const finalCount = await ViewHistory.countDocuments();
    const totalCleaned = initialCount - finalCount;
    
    if (totalCleaned > 0) {
      console.log(`🧹 ViewHistory cleanup completed: ${totalCleaned} entries removed (${oldResult.deletedCount} old, ${excessResult.deletedCount} excess, ${lowValueResult.deletedCount} low-value)`);
      console.log(`📊 ViewHistory entries: ${initialCount} → ${finalCount}`);
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
      console.log('🗑️  Forced garbage collection');
    }
    
  } catch (error) {
    console.error('Error in ViewHistory cleanup:', error);
  }
};

/**
 * Monitor memory usage and trigger emergency cleanup if needed
 */
const monitorMemoryUsage = async () => {
  try {
    const memUsage = process.memoryUsage();
    const memUsageMB = {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    };
    
    // Get ViewHistory count
    const viewHistoryCount = await ViewHistory.countDocuments();
    
    // Log memory usage every hour (6 * 10 minutes)
    const shouldLog = Math.floor(Date.now() / (10 * 60 * 1000)) % 6 === 0;
    if (shouldLog) {
      console.log(`📊 Memory: RSS=${memUsageMB.rss}MB, Heap=${memUsageMB.heapUsed}/${memUsageMB.heapTotal}MB, ViewHistory=${viewHistoryCount} entries`);
    }
    
    // Warning thresholds
    if (memUsageMB.rss > 1200) { // 1.2GB
      console.warn(`⚠️  High memory usage detected: ${memUsageMB.rss}MB RSS, ${viewHistoryCount} ViewHistory entries`);
    }
    
    // Emergency cleanup triggers
    if (memUsageMB.rss > 1500 || viewHistoryCount > 25000) { // 1.5GB or 25k entries
      console.warn('🚨 EMERGENCY: Critical memory usage! Triggering immediate cleanup...');
      await performViewHistoryCleanup();
    }
    
  } catch (error) {
    console.error('Error monitoring memory:', error);
  }
};

module.exports = {
  init,
  updateSourceSchedules,
  processPendingPosts,
  processSourceNow,
  processHighDynamicsPosts,
  performViewHistoryCleanup,
  monitorMemoryUsage,
  getCronJobs: () => cronJobs
}; 