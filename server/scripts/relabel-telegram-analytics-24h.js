const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const TelegramSource = require('../models/TelegramSource');

const HORIZON_MINUTES = 24 * 60;
const HORIZON_GRACE_MINUTES = 60;
const MIN_REQUIRED_POSTS = 5;

const STRATEGY_DEFINITIONS = [
  { id: 'views', metric: 'views', title: 'Просмотры' },
  { id: 'reactions', metric: 'reactions', title: 'Лайки' },
  { id: 'comments', metric: 'comments', title: 'Комментарии' },
  { id: 'forwards', metric: 'forwards', title: 'Пересылки' },
  {
    id: 'engagement_balanced',
    metric: 'engagement_score',
    title: 'Смешанная вовлеченность',
    weights: { reactionWeight: 1, commentWeight: 2, forwardWeight: 3 }
  },
  {
    id: 'engagement_discussion',
    metric: 'engagement_score',
    title: 'Дискуссионный сигнал',
    weights: { reactionWeight: 1, commentWeight: 4, forwardWeight: 2 }
  },
  {
    id: 'engagement_distribution',
    metric: 'engagement_score',
    title: 'Сигнал распространения',
    weights: { reactionWeight: 1, commentWeight: 1.5, forwardWeight: 4 }
  }
];

const percentile = (values, percentileValue) => {
  const numericValues = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (numericValues.length === 0) {
    return 0;
  }

  if (numericValues.length === 1) {
    return numericValues[0];
  }

  const rank = (Math.max(0, Math.min(100, percentileValue)) / 100) * (numericValues.length - 1);
  const lowerIndex = Math.floor(rank);
  const upperIndex = Math.ceil(rank);

  if (lowerIndex === upperIndex) {
    return numericValues[lowerIndex];
  }

  const weight = rank - lowerIndex;
  return numericValues[lowerIndex] + (numericValues[upperIndex] - numericValues[lowerIndex]) * weight;
};

const roundMetric = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(0, Math.round(numericValue));
};

const getMetricFromSnapshot = (snapshot, strategyDefinition) => {
  const reactions = Number(snapshot.reaction_count || 0);
  const comments = Number(snapshot.comment_count || 0);
  const forwards = Number(snapshot.forward_count || 0);
  const views = Number(snapshot.view_count || 0);

  switch (strategyDefinition.metric) {
    case 'views':
      return views;
    case 'comments':
      return comments;
    case 'forwards':
      return forwards;
    case 'engagement_score':
      return (
        reactions * Number(strategyDefinition.weights?.reactionWeight || 1) +
        comments * Number(strategyDefinition.weights?.commentWeight || 2) +
        forwards * Number(strategyDefinition.weights?.forwardWeight || 3)
      );
    case 'reactions':
    default:
      return reactions;
  }
};

const chooseFinal24hStrategy = (posts) => {
  const candidates = [];

  for (const strategyDefinition of STRATEGY_DEFINITIONS) {
    const eligiblePosts = posts
      .map((post) => {
        const horizonSnapshots = post.snapshots.filter((snapshot) => Number(snapshot.age_minutes) <= HORIZON_MINUTES);
        if (horizonSnapshots.length === 0) {
          return null;
        }

        const maxAgeMinutes = Math.max(...post.snapshots.map((snapshot) => Number(snapshot.age_minutes) || 0));
        if (maxAgeMinutes < HORIZON_MINUTES - HORIZON_GRACE_MINUTES) {
          return null;
        }

        const final24hValue = Math.max(
          ...horizonSnapshots.map((snapshot) => getMetricFromSnapshot(snapshot, strategyDefinition))
        );

        return {
          postId: post.postId,
          final24hValue,
          snapshots: horizonSnapshots
        };
      })
      .filter(Boolean)
      .filter((post) => Number.isFinite(post.final24hValue) && post.final24hValue > 0);

    if (eligiblePosts.length < MIN_REQUIRED_POSTS) {
      continue;
    }

    const values = eligiblePosts.map((post) => post.final24hValue);
    const thresholdPercentile = eligiblePosts.length >= 20 ? 95 : 90;
    const threshold = roundMetric(percentile(values, thresholdPercentile));
    if (threshold <= 0) {
      continue;
    }

    const hits = eligiblePosts.filter((post) => post.final24hValue >= threshold);
    if (hits.length === 0) {
      continue;
    }

    const median = percentile(values, 50);
    const p75 = percentile(values, 75);
    const p90 = percentile(values, 90);
    const hitRate = hits.length / eligiblePosts.length;
    const separation = median > 0 ? threshold / median : threshold;
    const spread = p75 > 0 ? p90 / p75 : p90;
    const score = separation * 0.7 + spread * 0.2 - hitRate * 0.3;

    candidates.push({
      strategyId: strategyDefinition.id,
      strategyTitle: strategyDefinition.title,
      metric: strategyDefinition.metric,
      threshold,
      thresholdPercentile,
      horizonMinutes: HORIZON_MINUTES,
      sampleSize: eligiblePosts.length,
      hitCount: hits.length,
      hitRate,
      separation,
      score,
      reactionWeight: strategyDefinition.weights?.reactionWeight,
      commentWeight: strategyDefinition.weights?.commentWeight,
      forwardWeight: strategyDefinition.weights?.forwardWeight,
      eligiblePosts
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  return candidates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    if (right.separation !== left.separation) {
      return right.separation - left.separation;
    }
    return left.hitRate - right.hitRate;
  })[0];
};

const relabelSource = async (pg, sourceId, strategy) => {
  const snapshotsResult = await pg.query(
    `
      SELECT
        p.id AS post_id,
        s.id AS snapshot_id,
        s.snapshot_at,
        s.age_minutes,
        s.view_count,
        s.forward_count,
        s.reaction_count,
        s.comment_count
      FROM tg_posts p
      JOIN tg_channels c ON c.id = p.channel_id
      JOIN tg_post_snapshots s ON s.post_id = p.id
      WHERE c.mongo_source_id = $1
      ORDER BY p.id ASC, s.snapshot_at ASC
    `,
    [sourceId]
  );

  const postsMap = new Map();
  snapshotsResult.rows.forEach((row) => {
    const post = postsMap.get(row.post_id) || {
      postId: row.post_id,
      snapshots: []
    };
    post.snapshots.push(row);
    postsMap.set(row.post_id, post);
  });

  const eligibleById = new Map((strategy.eligiblePosts || []).map((post) => [post.postId, post]));
  const snapshotIds = [];
  const snapshotFlags = [];
  const postIds = [];
  const postFlags = [];
  const postFirstViralAt = [];

  postsMap.forEach((post) => {
    const eligiblePost = eligibleById.get(post.postId);
    let firstViralSnapshot = null;

    post.snapshots.forEach((snapshot) => {
      let isViral = false;
      if (
        eligiblePost &&
        Number(snapshot.age_minutes || 0) <= HORIZON_MINUTES &&
        getMetricFromSnapshot(snapshot, strategy) >= Number(strategy.threshold || 0)
      ) {
        isViral = true;
        if (!firstViralSnapshot) {
          firstViralSnapshot = snapshot;
        }
      }

      snapshotIds.push(snapshot.snapshot_id);
      snapshotFlags.push(isViral);
    });

    postIds.push(post.postId);
    postFlags.push(Boolean(firstViralSnapshot));
    postFirstViralAt.push(firstViralSnapshot ? new Date(firstViralSnapshot.snapshot_at) : null);
  });

  await pg.query('BEGIN');
  try {
    if (snapshotIds.length > 0) {
      await pg.query(
        `
          UPDATE tg_post_snapshots AS snapshots
          SET is_viral = relabel.is_viral,
              threshold_used = $3
          FROM UNNEST($1::BIGINT[], $2::BOOLEAN[]) AS relabel(snapshot_id, is_viral)
          WHERE snapshots.id = relabel.snapshot_id
        `,
        [snapshotIds, snapshotFlags, Number(strategy.threshold || 0)]
      );
    }

    if (postIds.length > 0) {
      await pg.query(
        `
          UPDATE tg_posts AS posts
          SET current_is_viral = relabel.is_viral,
              first_became_viral_at = relabel.first_became_viral_at,
              threshold_used = $4,
              updated_at = NOW()
          FROM UNNEST($1::BIGINT[], $2::BOOLEAN[], $3::TIMESTAMPTZ[]) AS relabel(post_id, is_viral, first_became_viral_at)
          WHERE posts.id = relabel.post_id
        `,
        [postIds, postFlags, postFirstViralAt, Number(strategy.threshold || 0)]
      );
    }

    await pg.query('COMMIT');
  } catch (error) {
    await pg.query('ROLLBACK');
    throw error;
  }

  return {
    postsRelabeled: postIds.length,
    snapshotsRelabeled: snapshotIds.length,
    viralPosts: postFlags.filter(Boolean).length
  };
};

const main = async () => {
  const mongoURI = process.env.MONGODB_URI;
  const analyticsDatabaseUrl = process.env.ANALYTICS_DATABASE_URL;
  if (!mongoURI || !analyticsDatabaseUrl) {
    throw new Error('MONGODB_URI and ANALYTICS_DATABASE_URL must be configured');
  }

  await mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 30000,
    directConnection: true,
    replicaSet: undefined
  });

  const pg = new Client({
    connectionString: analyticsDatabaseUrl,
    ssl: process.env.ANALYTICS_DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined
  });
  await pg.connect();

  const sources = await TelegramSource.find({ active: true }).sort({ name: 1 });
  const summary = [];

  for (const source of sources) {
    const snapshotsResult = await pg.query(
      `
        SELECT
          p.id AS post_id,
          s.snapshot_at,
          s.age_minutes,
          s.view_count,
          s.forward_count,
          s.reaction_count,
          s.comment_count
        FROM tg_posts p
        JOIN tg_channels c ON c.id = p.channel_id
        JOIN tg_post_snapshots s ON s.post_id = p.id
        WHERE c.mongo_source_id = $1
        ORDER BY p.id ASC, s.snapshot_at ASC
      `,
      [String(source._id)]
    );

    const postsMap = new Map();
    snapshotsResult.rows.forEach((row) => {
      const post = postsMap.get(row.post_id) || {
        postId: row.post_id,
        snapshots: []
      };
      post.snapshots.push(row);
      postsMap.set(row.post_id, post);
    });

    const strategy = chooseFinal24hStrategy(Array.from(postsMap.values()));
    if (!strategy) {
      summary.push({
        source: source.name,
        skipped: true,
        reason: 'Not enough 24h-complete posts'
      });
      continue;
    }

    const relabel = await relabelSource(pg, String(source._id), strategy);
    summary.push({
      source: source.name,
      strategy: strategy.strategyTitle,
      metric: strategy.metric,
      threshold: strategy.threshold,
      thresholdPercentile: strategy.thresholdPercentile,
      sampleSize: strategy.sampleSize,
      hitCount: strategy.hitCount,
      horizonMinutes: HORIZON_MINUTES,
      relabel
    });
  }

  console.log(JSON.stringify(summary, null, 2));
  await pg.end();
  await mongoose.disconnect();
  process.exit(0);
};

main().catch((error) => {
  console.error('Failed to relabel Telegram analytics by 24h final data:', error);
  process.exit(1);
});
