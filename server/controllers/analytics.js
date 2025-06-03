const express = require('express');
const router = express.Router();
const VkSource = require('../models/VkSource');
const Post = require('../models/Post');
const ViewHistory = require('../models/ViewHistory');

// Get sources with experimental tracking enabled
router.get('/experimental-sources', async (req, res) => {
  try {
    const sources = await VkSource.find({ 
      experimentalViewTracking: true,
      active: true 
    }).sort({ name: 1 });
    
    res.json(sources);
  } catch (error) {
    console.error('Error getting experimental sources:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get average dynamics for a source
router.get('/source-dynamics/:sourceId', async (req, res) => {
  try {
    const { sourceId } = req.params;
    const { days = 7 } = req.query; // Default to last 7 days
    
    // Verify source has experimental tracking enabled
    const source = await VkSource.findById(sourceId);
    if (!source) {
      return res.status(404).json({ message: 'Source not found' });
    }
    
    if (!source.experimentalViewTracking) {
      return res.status(400).json({ message: 'Experimental tracking not enabled for this source' });
    }
    
    // Get date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    // Get all posts from this source with view history
    const posts = await Post.find({
      vkSource: sourceId,
      createdAt: { $gte: startDate }
    }).select('_id postId text viewCount isViral publishedAt wasHighDynamics highDynamicsForwardedAt');
    
    // Get view history for all posts
    const postIds = posts.map(p => p._id);
    const viewHistories = await ViewHistory.find({
      post: { $in: postIds },
      vkSource: sourceId
    }).sort({ timestamp: 1 });
    
    // Group histories by post
    const historiesByPost = {};
    viewHistories.forEach(history => {
      const postId = history.post.toString();
      if (!historiesByPost[postId]) {
        historiesByPost[postId] = [];
      }
      historiesByPost[postId].push(history);
    });
    
    // Calculate average growth patterns
    const growthPatterns = calculateGrowthPatterns(historiesByPost);
    
    // Calculate per-post metrics
    const postMetrics = posts.map(post => {
      const postHistory = historiesByPost[post._id.toString()] || [];
      return {
        postId: post.postId,
        text: post.text ? post.text.substring(0, 100) + '...' : '',
        isViral: post.isViral,
        wasHighDynamics: post.wasHighDynamics,
        highDynamicsForwardedAt: post.highDynamicsForwardedAt,
        currentViews: post.viewCount,
        publishedAt: post.publishedAt,
        historyCount: postHistory.length,
        averageGrowthRate: calculateAverageGrowthRate(postHistory),
        maxGrowthRate: calculateMaxGrowthRate(postHistory),
        totalGrowth: calculateTotalGrowth(postHistory)
      };
    });
    
    res.json({
      source: {
        id: source._id,
        name: source.name,
        calculatedThreshold: source.calculatedThreshold,
        postsAnalyzed: posts.length
      },
      growthPatterns,
      postMetrics: postMetrics.sort((a, b) => b.averageGrowthRate - a.averageGrowthRate)
    });
  } catch (error) {
    console.error(`Error getting source dynamics for ${req.params.sourceId}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get aggregated dynamics across all experimental sources
router.get('/aggregated-dynamics', async (req, res) => {
  try {
    const sources = await VkSource.find({ 
      experimentalViewTracking: true,
      active: true 
    });
    
    if (sources.length === 0) {
      return res.json({
        message: 'No sources with experimental tracking enabled',
        data: []
      });
    }
    
    const sourceIds = sources.map(s => s._id);
    
    // Get recent view histories
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const viewHistories = await ViewHistory.find({
      vkSource: { $in: sourceIds },
      timestamp: { $gte: sevenDaysAgo }
    }).populate('vkSource', 'name');
    
    // Group by source
    const historiesBySource = {};
    viewHistories.forEach(history => {
      const sourceId = history.vkSource._id.toString();
      if (!historiesBySource[sourceId]) {
        historiesBySource[sourceId] = {
          sourceName: history.vkSource.name,
          histories: []
        };
      }
      historiesBySource[sourceId].histories.push(history);
    });
    
    // Calculate metrics for each source
    const sourceMetrics = Object.entries(historiesBySource).map(([sourceId, data]) => {
      const growthRates = data.histories
        .filter(h => h.growthRate > 0)
        .map(h => h.growthRate);
      
      return {
        sourceId,
        sourceName: data.sourceName,
        totalDataPoints: data.histories.length,
        averageGrowthRate: growthRates.length > 0 
          ? growthRates.reduce((a, b) => a + b, 0) / growthRates.length 
          : 0,
        medianGrowthRate: calculateMedian(growthRates),
        maxGrowthRate: Math.max(...growthRates, 0),
        percentile90: calculatePercentile(growthRates, 90),
        percentile95: calculatePercentile(growthRates, 95)
      };
    });
    
    res.json({
      sourcesAnalyzed: sources.length,
      data: sourceMetrics.sort((a, b) => b.averageGrowthRate - a.averageGrowthRate)
    });
  } catch (error) {
    console.error('Error getting aggregated dynamics:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Helper functions
function calculateGrowthPatterns(historiesByPost) {
  const allGrowthRates = [];
  const growthByTimeInterval = {};
  
  Object.values(historiesByPost).forEach(postHistory => {
    postHistory.forEach(history => {
      if (history.growthRate > 0) {
        allGrowthRates.push(history.growthRate);
        
        // Group by time interval (e.g., 0-30 min, 30-60 min, etc.)
        const intervalKey = Math.floor(history.timeDeltaMinutes / 30) * 30;
        if (!growthByTimeInterval[intervalKey]) {
          growthByTimeInterval[intervalKey] = [];
        }
        growthByTimeInterval[intervalKey].push(history.growthRate);
      }
    });
  });
  
  // Calculate average growth by time interval
  const averageByInterval = {};
  Object.entries(growthByTimeInterval).forEach(([interval, rates]) => {
    averageByInterval[interval] = rates.reduce((a, b) => a + b, 0) / rates.length;
  });
  
  return {
    overallAverage: allGrowthRates.length > 0 
      ? allGrowthRates.reduce((a, b) => a + b, 0) / allGrowthRates.length 
      : 0,
    median: calculateMedian(allGrowthRates),
    percentile75: calculatePercentile(allGrowthRates, 75),
    percentile90: calculatePercentile(allGrowthRates, 90),
    percentile95: calculatePercentile(allGrowthRates, 95),
    byTimeInterval: averageByInterval
  };
}

function calculateAverageGrowthRate(history) {
  const rates = history.filter(h => h.growthRate > 0).map(h => h.growthRate);
  return rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
}

function calculateMaxGrowthRate(history) {
  const rates = history.map(h => h.growthRate);
  return Math.max(...rates, 0);
}

function calculateTotalGrowth(history) {
  if (history.length < 2) return 0;
  const first = history[0];
  const last = history[history.length - 1];
  return last.viewCount - first.viewCount;
}

function calculateMedian(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 
    ? sorted[mid] 
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function calculatePercentile(values, percentile) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  return lower === upper 
    ? sorted[lower] 
    : sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

module.exports = router; 