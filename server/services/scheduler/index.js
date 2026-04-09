const cron = require('node-cron');
const VkSource = require('../../models/VkSource');
const TelegramSource = require('../../models/TelegramSource');
const vkService = require('../vk');
const telegramService = require('../telegram');
const telegramSourcesService = require('../telegram/sources');
const telegramAnalyticsService = require('../telegramAnalytics');
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
  
  // Schedule job to process manually approved posts every 10 minutes - TEMPORARILY DISABLED FOR TESTING
  // Note: Viral posts are now auto-forwarded immediately when detected
  if (false) {
    cron.schedule('*/10 * * * *', async () => {
      try {
        await processPendingPosts();
      } catch (error) {
        console.error('Error processing approved posts:', error);
      }
    });
  }
  
  // Schedule job to check high dynamics posts every 15 minutes - TEMPORARILY DISABLED FOR TESTING
  if (false) {
    cron.schedule('*/15 * * * *', async () => {
      try {
        await processHighDynamicsPosts();
      } catch (error) {
        console.error('Error processing high dynamics posts:', error);
      }
    });
  }
  
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

  // Maintain denser analytics snapshots for Telegram sources with slower polling.
  cron.schedule('*/15 * * * *', async () => {
    try {
      await refreshTelegramAnalyticsSnapshots();
    } catch (error) {
      console.error('Error refreshing Telegram analytics snapshots:', error);
    }
  });
  
  // Schedule weekly threshold recalculation for all VK sources
  // Runs every Sunday at 3:00 AM
  cron.schedule('0 3 * * 0', async () => {
    try {
      console.log('📊 Starting weekly threshold recalculation...');
      await recalculateAllVkThresholds();
    } catch (error) {
      console.error('Error in weekly threshold recalculation:', error);
    }
  });
  
  // Initial setup of schedules
  updateSourceSchedules().catch(err => {
    console.error('Error in initial source schedule setup:', err);
  });
  
  console.log('Scheduler service initialized');
  console.log('📅 Weekly threshold recalculation scheduled: Every Sunday at 3:00 AM');
};

/**
 * Updates the schedules for all VK and Telegram sources
 */
const updateSourceSchedules = async () => {
  try {
    // Get all active VK sources
    const vkSources = await VkSource.find({ active: true });
    
    // Get all active Telegram sources  
    const telegramSources = await TelegramSource.find({ active: true });
    
    const currentSourceIds = new Set();
    
    // Process VK sources
    for (const source of vkSources) {
      const sourceId = `vk_${source._id.toString()}`;
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
      
      // Create new cron job for VK source
      const job = cron.schedule(cronExpression, async () => {
        try {
          await vkService.processSourcePosts(source._id.toString());
        } catch (error) {
          console.error(`Error processing VK source ${source._id}:`, error);
        }
      });
      
      // Store job reference
      cronJobs[sourceId] = {
        job,
        expression: cronExpression,
        frequency: source.checkFrequency,
        type: 'vk',
        name: source.name
      };
      
      console.log(`📅 Scheduled VK source ${source.name} (every ${source.checkFrequency} minutes)`);
    }
    
    // Process Telegram sources
    for (const source of telegramSources) {
      const sourceId = `tg_${source._id.toString()}`;
      currentSourceIds.add(sourceId);
      
      const cronExpression = calculateCronExpression(source.checkFrequency);
      
      if (cronJobs[sourceId]) {
        // Recreate Telegram jobs on every reconcile to recover from silently
        // dropped or stale cron state inside long-lived runtimes.
        cronJobs[sourceId].job.stop();
        delete cronJobs[sourceId];
      }
      
      // Create cron job for Telegram source
      const job = cron.schedule(cronExpression, async () => {
        try {
          await telegramSourcesService.processMessagesFromSource(source);
        } catch (error) {
          console.error(`Error processing Telegram source ${source._id}:`, error);
        }
      });
      
      cronJobs[sourceId] = {
        job,
        expression: cronExpression,
        frequency: source.checkFrequency,
        type: 'telegram',
        name: source.name
      };
      
      console.log(`📅 Scheduled Telegram source ${source.name} (every ${source.checkFrequency} minutes)`);
    }
    
    // Clean up removed or deactivated sources
    for (const jobId of Object.keys(cronJobs)) {
      if (!currentSourceIds.has(jobId)) {
        cronJobs[jobId].job.stop();
        delete cronJobs[jobId];
        console.log(`🗑️ Removed scheduled job for ${jobId}`);
      }
    }
    
    return {
      activeJobs: Object.keys(cronJobs).length,
      vkSources: vkSources.length,
      telegramSources: telegramSources.length
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

const refreshTelegramAnalyticsSnapshots = async () => {
  if (!telegramAnalyticsService.isEnabled()) {
    return { processedSources: 0 };
  }

  const telegramSources = await TelegramSource.find({
    active: true,
    checkFrequency: { $gt: 15 }
  });

  let processedSources = 0;

  for (const source of telegramSources) {
    try {
      await telegramSourcesService.processMessagesFromSource(source);
      processedSources++;
    } catch (error) {
      console.warn(`Telegram analytics refresh failed for ${source.name}:`, error.message);
    }
  }

  return { processedSources };
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
                  const result = await telegramService.forwardPost(post, source, mapping.telegramChannel, {
                    isHighDynamics: true,
                    growthRate: dynamicsCheck.growthRate,
                    viewHistory: dynamicsCheck.history,
                    timeRange: dynamicsCheck.timeRange
                  });
                  if (result?.skipped) {
                    continue;
                  }
                  
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
 * Adjusted limits to support high dynamics detection
 */
const performViewHistoryCleanup = async () => {
  try {
    console.log('🧹 Starting automated ViewHistory cleanup...');
    
    // Get initial count
    const initialCount = await ViewHistory.countDocuments();
    
    // Step 1: Remove entries older than 3 days (increased from 1 day to support dynamics)
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    
    const oldResult = await ViewHistory.deleteMany({
      timestamp: { $lt: threeDaysAgo }
    });
    
    // Step 2: Limit total entries to 60,000 maximum (increased from 20k)
    const countAfterOld = await ViewHistory.countDocuments();
    const maxEntries = 60000; // Increased limit to support dynamics tracking
    
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
    
    // Step 3: Remove only very low-value entries (keep more data for dynamics analysis)
    const lowValueResult = await ViewHistory.deleteMany({
      growthRate: { $lt: -10 } // Only remove significantly negative growth rates
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
    
    // Warning thresholds (adjusted for higher limits)
    if (memUsageMB.rss > 1400) { // 1.4GB (increased from 1.2GB)
      console.warn(`⚠️  High memory usage detected: ${memUsageMB.rss}MB RSS, ${viewHistoryCount} ViewHistory entries`);
    }
    
    // Emergency cleanup triggers (adjusted for higher limits)
    if (memUsageMB.rss > 1800 || viewHistoryCount > 80000) { // 1.8GB or 80k entries
      console.warn('🚨 EMERGENCY: Critical memory usage! Triggering immediate cleanup...');
      await performViewHistoryCleanup();
    }
    
  } catch (error) {
    console.error('Error monitoring memory:', error);
  }
};

/**
 * Recalculate thresholds for all active VK sources
 * Runs weekly to keep thresholds up to date with current posting patterns
 */
const recalculateAllVkThresholds = async () => {
  const startTime = Date.now();
  
  try {
    console.log('═══════════════════════════════════════════════════');
    console.log('🔄 WEEKLY THRESHOLD RECALCULATION');
    console.log('═══════════════════════════════════════════════════');
    
    // Get all active VK sources
    const sources = await VkSource.find({ active: { $ne: false } });
    console.log(`📊 Found ${sources.length} active VK sources\n`);
    
    let updated = 0;
    let failed = 0;
    let skipped = 0;
    const results = [];
    
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      const progress = `[${i + 1}/${sources.length}]`;
      
      try {
        // Skip sources with manual threshold
        if (source.thresholdType === 'manual') {
          console.log(`${progress} Skipped ${source.name} (manual threshold)`);
          skipped++;
          continue;
        }
        
        const oldThreshold = source.calculatedThreshold;
        
        // Recalculate using current method (defaults to percentile p90)
        await vkService.updateSourceThreshold(source._id, source.thresholdMethod || 'percentile');
        
        // Reload to get updated values
        const updatedSource = await VkSource.findById(source._id);
        const newThreshold = updatedSource.calculatedThreshold;
        
        const change = newThreshold - oldThreshold;
        const changePercent = oldThreshold > 0 
          ? ((change / oldThreshold) * 100).toFixed(1) 
          : 'N/A';
        
        console.log(`${progress} ${source.name}: ${oldThreshold.toLocaleString()} → ${newThreshold.toLocaleString()} (${changePercent}%)`);
        
        results.push({
          name: source.name,
          old: oldThreshold,
          new: newThreshold,
          change,
          changePercent
        });
        
        updated++;
        
        // Add small delay to avoid overwhelming the VK API
        if (i % 10 === 0 && i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`${progress} ❌ ${source.name}: ${error.message}`);
        failed++;
      }
    }
    
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log('\n═══════════════════════════════════════════════════');
    console.log('📊 WEEKLY RECALCULATION COMPLETED');
    console.log(`  ✅ Updated: ${updated}`);
    console.log(`  ⏭️  Skipped: ${skipped} (manual thresholds)`);
    console.log(`  ❌ Failed: ${failed}`);
    console.log(`  ⏱️  Duration: ${duration} minutes`);
    console.log('═══════════════════════════════════════════════════');
    
    // Log top 5 biggest changes
    if (results.length > 0) {
      results.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
      console.log('\n🔝 TOP-5 BIGGEST CHANGES:');
      results.slice(0, 5).forEach((r, i) => {
        const sign = r.change > 0 ? '+' : '';
        console.log(`  ${i + 1}. ${r.name}: ${sign}${r.change.toLocaleString()} (${sign}${r.changePercent}%)`);
      });
    }
    
    console.log('\n✅ Weekly threshold recalculation completed successfully\n');
    
    return {
      updated,
      failed,
      skipped,
      duration,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('❌ Error in weekly threshold recalculation:', error);
    throw error;
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
  recalculateAllVkThresholds,
  getCronJobs: () => cronJobs
}; 
