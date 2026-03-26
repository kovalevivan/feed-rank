const express = require('express');
const router = express.Router();
const telegramAnalyticsService = require('../services/telegramAnalytics');
const TelegramSource = require('../models/TelegramSource');

router.get('/health', async (req, res) => {
  try {
    res.json(telegramAnalyticsService.getHealth());
  } catch (error) {
    console.error('Error getting Telegram analytics health:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/overview', async (req, res) => {
  try {
    const overview = await telegramAnalyticsService.getOverview();
    res.json(overview);
  } catch (error) {
    console.error('Error getting Telegram analytics overview:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/sources', async (req, res) => {
  try {
    const sources = await telegramAnalyticsService.getSourcesOverview();
    res.json(sources);
  } catch (error) {
    console.error('Error getting Telegram analytics sources:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/sources/:sourceId/posts', async (req, res) => {
  try {
    const limit = Number.parseInt(req.query.limit, 10) || 100;
    const minAgeMinutes = req.query.minAgeMinutes !== undefined
      ? Number.parseInt(req.query.minAgeMinutes, 10)
      : null;
    const maxAgeMinutes = req.query.maxAgeMinutes !== undefined
      ? Number.parseInt(req.query.maxAgeMinutes, 10)
      : null;
    const posts = await telegramAnalyticsService.getSourcePosts(
      req.params.sourceId,
      limit,
      Number.isFinite(minAgeMinutes) ? minAgeMinutes : null,
      Number.isFinite(maxAgeMinutes) ? maxAgeMinutes : null
    );
    res.json(posts);
  } catch (error) {
    console.error(`Error getting Telegram analytics posts for ${req.params.sourceId}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/sources/:sourceId/recommend-strategy', async (req, res) => {
  try {
    const source = await TelegramSource.findById(req.params.sourceId);
    if (!source) {
      return res.status(404).json({ message: 'Telegram source not found' });
    }

    const recommendation = await telegramAnalyticsService.getSourceStrategyRecommendation(req.params.sourceId, {
      reactionWeight: source.reactionWeight,
      commentWeight: source.commentWeight,
      forwardWeight: source.forwardWeight
    });

    res.json(recommendation);
  } catch (error) {
    console.error(`Error recommending strategy for ${req.params.sourceId}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.post('/sources/:sourceId/apply-recommended-strategy', async (req, res) => {
  try {
    const source = await TelegramSource.findById(req.params.sourceId);
    if (!source) {
      return res.status(404).json({ message: 'Telegram source not found' });
    }

    const recommendationResult = await telegramAnalyticsService.getSourceStrategyRecommendation(req.params.sourceId, {
      reactionWeight: source.reactionWeight,
      commentWeight: source.commentWeight,
      forwardWeight: source.forwardWeight
    });

    const requestedProfile = typeof req.body?.profileKey === 'string' ? req.body.profileKey : 'balanced';
    const strategy = recommendationResult?.strategyProfiles?.[requestedProfile] || recommendationResult?.recommendedStrategy;
    if (!strategy) {
      return res.status(400).json({
        message: 'Could not calculate a reliable strategy for this source yet'
      });
    }

    source.strategyMode = 'smart';
    source.thresholdType = 'manual';
    source.manualThreshold = strategy.threshold;
    source.viralDetectionMetric = strategy.metric;
    source.maxNewsAgeMinutes = strategy.maxNewsAgeMinutes;
    source.smartStrategy = {
      profileKey: strategy.profileKey,
      profileTitle: strategy.profileTitle,
      strategyId: strategy.strategyId,
      strategyTitle: strategy.strategyTitle,
      metric: strategy.metric,
      threshold: strategy.threshold,
      maxNewsAgeMinutes: strategy.maxNewsAgeMinutes,
      thresholdPercentile: strategy.thresholdPercentile,
      labelPercentile: strategy.labelPercentile,
      precision: strategy.precision,
      recall: strategy.recall,
      f1Score: strategy.f1Score,
      postsEvaluated: strategy.postsEvaluated,
      predictedCount: strategy.predictedCount,
      actualPositiveCount: strategy.actualPositiveCount,
      explanation: strategy.explanation,
      appliedAt: new Date()
    };

    if (strategy.metric === 'views') {
      source.minViewsForViral = strategy.threshold;
    } else if (strategy.metric === 'forwards') {
      source.minForwardsForViral = strategy.threshold;
    } else if (strategy.metric === 'comments') {
      source.minCommentsForViral = strategy.threshold;
    } else if (strategy.metric === 'reactions') {
      source.minReactionsForViral = strategy.threshold;
    } else if (strategy.metric === 'engagement_score') {
      source.reactionWeight = strategy.reactionWeight;
      source.commentWeight = strategy.commentWeight;
      source.forwardWeight = strategy.forwardWeight;
    }

    await source.save();

    res.json({
      message: 'Smart strategy applied to source',
      source,
      strategy
    });
  } catch (error) {
    console.error(`Error applying strategy for ${req.params.sourceId}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

router.get('/posts/:postId/snapshots', async (req, res) => {
  try {
    const limit = Number.parseInt(req.query.limit, 10) || 200;
    const snapshots = await telegramAnalyticsService.getPostSnapshots(req.params.postId, limit);
    res.json(snapshots);
  } catch (error) {
    console.error(`Error getting Telegram analytics snapshots for ${req.params.postId}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
