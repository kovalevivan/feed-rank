const express = require('express');
const router = express.Router();
const telegramAnalyticsService = require('../services/telegramAnalytics');

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
    const posts = await telegramAnalyticsService.getSourcePosts(req.params.sourceId, limit);
    res.json(posts);
  } catch (error) {
    console.error(`Error getting Telegram analytics posts for ${req.params.sourceId}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
