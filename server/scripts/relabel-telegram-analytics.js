const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const telegramAnalyticsService = require('../services/telegramAnalytics');
const TelegramSource = require('../models/TelegramSource');

const mongoURI = process.env.MONGODB_URI;

const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 15000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 30000,
  directConnection: true,
  replicaSet: undefined
};

const applyStrategyToSource = async (source, strategy) => {
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
};

const main = async () => {
  if (!mongoURI) {
    throw new Error('MONGODB_URI is not configured');
  }

  await mongoose.connect(mongoURI, mongooseOptions);
  await telegramAnalyticsService.init();

  const sources = await TelegramSource.find({ active: true }).sort({ name: 1 });
  const summary = [];

  for (const source of sources) {
    console.log(`Processing ${source.name}...`);
    const recommendation = await telegramAnalyticsService.getSourceStrategyRecommendation(String(source._id), {
      reactionWeight: source.reactionWeight,
      commentWeight: source.commentWeight,
      forwardWeight: source.forwardWeight
    });

    const balancedStrategy = recommendation?.recommendedStrategy || recommendation?.strategyProfiles?.balanced;
    if (!balancedStrategy) {
      console.log(`Skipping ${source.name}: ${recommendation?.message || 'No strict strategy'}`);
      summary.push({
        source: source.name,
        sourceId: String(source._id),
        skipped: true,
        reason: recommendation?.message || 'No balanced strategy'
      });
      continue;
    }

    await applyStrategyToSource(source, balancedStrategy);
    const relabelResult = await telegramAnalyticsService.relabelSourceByStrategy(String(source._id), balancedStrategy);
    console.log(`Relabeled ${source.name}: ${relabelResult.postsRelabeled} posts, ${relabelResult.snapshotsRelabeled} snapshots`);

    summary.push({
      source: source.name,
      sourceId: String(source._id),
      metric: balancedStrategy.metric,
      strategyTitle: balancedStrategy.strategyTitle,
      profileKey: balancedStrategy.profileKey,
      threshold: balancedStrategy.threshold,
      maxNewsAgeMinutes: balancedStrategy.maxNewsAgeMinutes,
      precision: balancedStrategy.precision,
      recall: balancedStrategy.recall,
      f1Score: balancedStrategy.f1Score,
      postsRelabeled: relabelResult.postsRelabeled,
      snapshotsRelabeled: relabelResult.snapshotsRelabeled,
      viralPosts: relabelResult.viralPosts
    });
  }

  console.log(JSON.stringify({
    processedSources: summary.length,
    relabeledSources: summary.filter((item) => !item.skipped).length,
    skippedSources: summary.filter((item) => item.skipped).length,
    summary
  }, null, 2));
};

main()
  .catch((error) => {
    console.error('Failed to relabel Telegram analytics:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect().catch(() => {});
    process.exit(process.exitCode || 0);
  });
