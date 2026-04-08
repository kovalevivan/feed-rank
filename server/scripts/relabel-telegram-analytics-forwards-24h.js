const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');
const mongoose = require('mongoose');
const TelegramSource = require('../models/TelegramSource');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const HORIZON_OPTIONS = [24 * 60, 36 * 60, 48 * 60];
const MIN_MATURE_POSTS = 5;
const MAX_RETRIES = 5;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const percentile = (values, percentileValue) => {
  const numericValues = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);

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

const choosePercentile = (sampleSize) => {
  if (sampleSize >= 40) {
    return 80;
  }

  if (sampleSize >= 20) {
    return 75;
  }

  if (sampleSize >= 10) {
    return 70;
  }

  return 65;
};

const getForwardsWithin = (post, horizonMinutes) => Math.max(
  ...post.snapshots
    .filter((snapshot) => snapshot.ageMinutes <= horizonMinutes)
    .map((snapshot) => snapshot.forwards),
  0
);

const getClusterKey = (publishedAt) => {
  if (!publishedAt) {
    return null;
  }

  const date = publishedAt instanceof Date ? publishedAt : new Date(publishedAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
};

const chooseCanonicalPost = (posts = []) => {
  return [...posts].sort((left, right) => {
    if (right.forwards24h !== left.forwards24h) {
      return right.forwards24h - left.forwards24h;
    }

    if (right.views24h !== left.views24h) {
      return right.views24h - left.views24h;
    }

    return Number(left.messageId || 0) - Number(right.messageId || 0);
  })[0];
};

const clearChannelLabels = async (pg, channelId) => {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      await pg.query('BEGIN');
      await pg.query(`SET LOCAL lock_timeout = '10s'`);
      await pg.query(`SET LOCAL statement_timeout = '120s'`);

      await pg.query(
        `
          UPDATE tg_posts
          SET current_is_viral = false,
              first_became_viral_at = NULL,
              threshold_used = NULL,
              updated_at = NOW()
          WHERE channel_id = $1
        `,
        [channelId]
      );

      await pg.query(
        `
          UPDATE tg_post_snapshots
          SET is_viral = false,
              threshold_used = NULL
          WHERE post_id IN (
            SELECT id
            FROM tg_posts
            WHERE channel_id = $1
          )
        `,
        [channelId]
      );

      await pg.query('COMMIT');
      return;
    } catch (error) {
      await pg.query('ROLLBACK').catch(() => {});

      if ((error.code === '40P01' || error.code === '55P03') && attempt < MAX_RETRIES) {
        await sleep(1000 * attempt);
        continue;
      }

      throw error;
    }
  }
};

const relabelChannel = async (pg, channel) => {
  const snapshotResult = await pg.query(
    `
      SELECT
        p.id AS post_id,
        p.message_id,
        p.published_at,
        p.view_count_last,
        s.id AS snapshot_id,
        s.snapshot_at,
        s.age_minutes,
        s.view_count,
        s.forward_count
      FROM tg_posts p
      JOIN tg_post_snapshots s ON s.post_id = p.id
      WHERE p.channel_id = $1
      ORDER BY p.id ASC, s.snapshot_at ASC
    `,
    [channel.id]
  );

  const postsMap = new Map();
  snapshotResult.rows.forEach((row) => {
    const post = postsMap.get(row.post_id) || {
      id: row.post_id,
      messageId: row.message_id,
      publishedAt: row.published_at,
      viewCountLast: Number(row.view_count_last) || 0,
      snapshots: []
    };

    post.snapshots.push({
      id: row.snapshot_id,
      snapshotAt: row.snapshot_at,
      ageMinutes: Number(row.age_minutes) || 0,
      views: Number(row.view_count) || 0,
      forwards: Number(row.forward_count) || 0
    });

    postsMap.set(row.post_id, post);
  });

  const allPosts = Array.from(postsMap.values());
  const groupedPosts = new Map();
  allPosts.forEach((post) => {
    const bucketKey = getClusterKey(post.publishedAt) || `post:${post.id}`;
    const bucket = groupedPosts.get(bucketKey) || [];
    bucket.push({
      ...post,
      maxObservedAge: Math.max(...post.snapshots.map((snapshot) => snapshot.ageMinutes), 0),
      views24h: Math.max(...post.snapshots.map((snapshot) => Number(snapshot.views || 0)), post.viewCountLast || 0)
    });
    groupedPosts.set(bucketKey, bucket);
  });

  const canonicalPosts = Array.from(groupedPosts.values()).map((bucket) => chooseCanonicalPost(bucket));
  const canonicalPostIds = new Set(canonicalPosts.map((post) => post.id));
  const horizonStats = HORIZON_OPTIONS.map((horizonMinutes) => {
    const maturePosts = canonicalPosts
      .map((post) => ({
        ...post,
        forwardsWithinHorizon: getForwardsWithin(post, horizonMinutes)
      }))
      .filter((post) => Number(post.maxObservedAge || 0) >= horizonMinutes)
      .filter((post) => post.forwardsWithinHorizon > 0);

    return {
      horizonMinutes,
      maturePosts
    };
  });

  const selectedHorizon = horizonStats.find((item) => item.maturePosts.length >= MIN_MATURE_POSTS)
    || horizonStats[horizonStats.length - 1];
  const maturePosts = selectedHorizon.maturePosts;
  const horizonMinutes = selectedHorizon.horizonMinutes;

  if (maturePosts.length < MIN_MATURE_POSTS) {
    await clearChannelLabels(pg, channel.id);
    return {
      skipped: true,
      reason: `Not enough mature 24h posts with forwards: ${maturePosts.length}`,
      posts: allPosts.length,
      maturePosts: maturePosts.length
    };
  }

  const percentileValue = choosePercentile(maturePosts.length);
  const threshold = Math.max(1, Math.ceil(percentile(
    maturePosts.map((post) => post.forwardsWithinHorizon),
    percentileValue
  )));
  const viralPostIds = new Set(
    maturePosts
      .filter((post) => post.forwardsWithinHorizon >= threshold)
      .map((post) => post.id)
  );

  const snapshotIds = [];
  const snapshotFlags = [];
  const postIds = [];
  const postFlags = [];
  const firstViralAt = [];

  allPosts.forEach((post) => {
    const isPostViral = canonicalPostIds.has(post.id) && viralPostIds.has(post.id);
    let firstViralSnapshot = null;
    let viralAlreadyTriggered = false;

    post.snapshots.forEach((snapshot) => {
      let isSnapshotViral = false;
      if (isPostViral) {
        if (viralAlreadyTriggered) {
          isSnapshotViral = true;
        } else if (snapshot.ageMinutes <= horizonMinutes && snapshot.forwards >= threshold) {
          isSnapshotViral = true;
        }
      }

      if (isSnapshotViral && !firstViralSnapshot) {
        firstViralSnapshot = snapshot;
        viralAlreadyTriggered = true;
      }

      snapshotIds.push(snapshot.id);
      snapshotFlags.push(isSnapshotViral);
    });

    postIds.push(post.id);
    postFlags.push(isPostViral);
    firstViralAt.push(firstViralSnapshot ? new Date(firstViralSnapshot.snapshotAt) : null);
  });

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      await pg.query('BEGIN');
      await pg.query(`SET LOCAL lock_timeout = '10s'`);
      await pg.query(`SET LOCAL statement_timeout = '120s'`);

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
        [postIds, postFlags, firstViralAt, threshold]
      );

      await pg.query(
        `
          UPDATE tg_post_snapshots AS snapshots
          SET is_viral = relabel.is_viral,
              threshold_used = $3
          FROM UNNEST($1::BIGINT[], $2::BOOLEAN[]) AS relabel(snapshot_id, is_viral)
          WHERE snapshots.id = relabel.snapshot_id
        `,
        [snapshotIds, snapshotFlags, threshold]
      );

      await pg.query('COMMIT');
      break;
    } catch (error) {
      await pg.query('ROLLBACK').catch(() => {});

      if ((error.code === '40P01' || error.code === '55P03') && attempt < MAX_RETRIES) {
        await sleep(1000 * attempt);
        continue;
      }

      throw error;
    }
  }

  return {
    posts: allPosts.length,
    maturePosts: maturePosts.length,
    horizonMinutes,
    percentile: percentileValue,
    threshold,
    viralPosts: postFlags.filter(Boolean).length,
    viralSnapshots: snapshotFlags.filter(Boolean).length,
    p50Forwards: percentile(maturePosts.map((post) => post.forwardsWithinHorizon), 50),
    p75Forwards: percentile(maturePosts.map((post) => post.forwardsWithinHorizon), 75),
    p85Forwards: percentile(maturePosts.map((post) => post.forwardsWithinHorizon), 85),
    p90Forwards: percentile(maturePosts.map((post) => post.forwardsWithinHorizon), 90)
  };
};

const main = async () => {
  if (!process.env.ANALYTICS_DATABASE_URL || !process.env.MONGODB_URI) {
    throw new Error('ANALYTICS_DATABASE_URL and MONGODB_URI are required');
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 30000,
    directConnection: true,
    replicaSet: undefined
  });

  const pg = new Client({
    connectionString: process.env.ANALYTICS_DATABASE_URL,
    ssl: process.env.ANALYTICS_DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined
  });

  await pg.connect();

  const channelsResult = await pg.query('SELECT id, title, username, mongo_source_id FROM tg_channels ORDER BY title ASC');
  const summary = [];

  for (const channel of channelsResult.rows) {
    const result = await relabelChannel(pg, channel);
    const source = await TelegramSource.findById(channel.mongo_source_id).catch(() => null);

    if (source && !result.skipped) {
      source.smartStrategy = {
        ...(source.smartStrategy || {}),
        profileKey: 'analytics_forwards_24h',
        profileTitle: `Аналитика ${Math.round(result.horizonMinutes / 60)}h`,
        strategyId: `analytics_forwards_${result.horizonMinutes}m`,
        strategyTitle: `Пересылки за ${Math.round(result.horizonMinutes / 60)} часа`,
        metric: 'forwards',
        threshold: result.threshold,
        maxNewsAgeMinutes: result.horizonMinutes,
        thresholdPercentile: result.percentile,
        explanation: `Пост становится viral, если достигает порога по пересылкам ${result.threshold} в течение ${Math.round(result.horizonMinutes / 60)} часов. После первой viral-точки все следующие snapshot тоже помечаются viral.`,
        appliedAt: new Date(),
        forwardWeight: 1,
        commentWeight: 0,
        reactionWeight: 0
      };
      await source.save();
    }

    summary.push({
      channel: channel.title,
      username: channel.username,
      ...result
    });
  }

  const totals = await pg.query(`
    SELECT COUNT(*) FILTER (WHERE current_is_viral)::INT AS viral_posts,
           COUNT(*)::INT AS total_posts
    FROM tg_posts
  `);

  console.log(JSON.stringify({
    finalTotals: totals.rows[0],
    summary
  }, null, 2));

  await pg.end();
  await mongoose.disconnect();
};

main().catch((error) => {
  console.error('Failed to relabel Telegram analytics by forwards 24h:', error);
  process.exit(1);
});
