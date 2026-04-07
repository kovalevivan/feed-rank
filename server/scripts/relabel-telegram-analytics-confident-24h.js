const path = require('path');
const dotenv = require('dotenv');
const { Client } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const HORIZON_MINUTES = 24 * 60;
const RECENT_RETENTION_DAYS = 30;
const MIN_MATURE_POSTS = 8;
const SCORE_PERCENTILE = 95;

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

const safeRatio = (value, baseline) => {
  const numericValue = Number(value) || 0;
  const numericBaseline = Math.max(Number(baseline) || 0, 1);
  return numericValue / numericBaseline;
};

const calculateScore = (metrics, stats) => (
  Math.log1p(safeRatio(metrics.views, stats.p75Views)) * 0.8 +
  Math.log1p(safeRatio(metrics.reactions, stats.p75Reactions)) * 1.2 +
  Math.log1p(safeRatio(metrics.comments, stats.p75Comments)) * 1.4 +
  Math.log1p(safeRatio(metrics.forwards, stats.p75Forwards)) * 1.6
);

const hasRawOutlierSignal = (metrics, stats) => {
  const viewsOutlier = metrics.views >= stats.p95Views && metrics.views >= stats.medianViews * 1.5;
  const reactionsOutlier = metrics.reactions >= stats.p95Reactions && metrics.reactions > 0;
  const commentsOutlier = metrics.comments >= stats.p95Comments && metrics.comments > 0;
  const forwardsOutlier = metrics.forwards >= stats.p95Forwards && metrics.forwards > 0;

  return viewsOutlier || reactionsOutlier || commentsOutlier || forwardsOutlier;
};

const getMetricSummary = (post) => ({
  views: Math.max(...post.snapshots.filter((snapshot) => snapshot.ageMinutes <= HORIZON_MINUTES).map((snapshot) => snapshot.views), 0),
  reactions: Math.max(...post.snapshots.filter((snapshot) => snapshot.ageMinutes <= HORIZON_MINUTES).map((snapshot) => snapshot.reactions), 0),
  comments: Math.max(...post.snapshots.filter((snapshot) => snapshot.ageMinutes <= HORIZON_MINUTES).map((snapshot) => snapshot.comments), 0),
  forwards: Math.max(...post.snapshots.filter((snapshot) => snapshot.ageMinutes <= HORIZON_MINUTES).map((snapshot) => snapshot.forwards), 0)
});

const buildStats = (posts) => {
  const values = posts.map((post) => post.metrics);
  return {
    medianViews: percentile(values.map((metrics) => metrics.views), 50),
    p75Views: percentile(values.map((metrics) => metrics.views), 75),
    p95Views: percentile(values.map((metrics) => metrics.views), 95),
    p75Reactions: percentile(values.map((metrics) => metrics.reactions), 75),
    p95Reactions: percentile(values.map((metrics) => metrics.reactions), 95),
    p75Comments: percentile(values.map((metrics) => metrics.comments), 75),
    p95Comments: percentile(values.map((metrics) => metrics.comments), 95),
    p75Forwards: percentile(values.map((metrics) => metrics.forwards), 75),
    p95Forwards: percentile(values.map((metrics) => metrics.forwards), 95)
  };
};

const relabelChannel = async (pg, channel) => {
  const snapshotResult = await pg.query(
    `
      SELECT
        p.id AS post_id,
        s.id AS snapshot_id,
        s.snapshot_at,
        s.age_minutes,
        s.view_count,
        s.reaction_count,
        s.comment_count,
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
      snapshots: []
    };
    post.snapshots.push({
      id: row.snapshot_id,
      snapshotAt: row.snapshot_at,
      ageMinutes: Number(row.age_minutes) || 0,
      views: Number(row.view_count) || 0,
      reactions: Number(row.reaction_count) || 0,
      comments: Number(row.comment_count) || 0,
      forwards: Number(row.forward_count) || 0
    });
    postsMap.set(row.post_id, post);
  });

  const allPosts = Array.from(postsMap.values());
  const maturePosts = allPosts
    .filter((post) => Math.max(...post.snapshots.map((snapshot) => snapshot.ageMinutes), 0) >= HORIZON_MINUTES)
    .map((post) => ({
      ...post,
      metrics: getMetricSummary(post)
    }));

  if (maturePosts.length < MIN_MATURE_POSTS) {
    return {
      skipped: true,
      reason: `Not enough mature 24h posts: ${maturePosts.length}`,
      posts: allPosts.length,
      maturePosts: maturePosts.length
    };
  }

  const stats = buildStats(maturePosts);
  const scoredPosts = maturePosts.map((post) => ({
    ...post,
    score: calculateScore(post.metrics, stats)
  }));
  const scoreThreshold = percentile(scoredPosts.map((post) => post.score), SCORE_PERCENTILE);
  const viralPostIds = new Set(
    scoredPosts
      .filter((post) => post.score >= scoreThreshold && hasRawOutlierSignal(post.metrics, stats))
      .map((post) => post.id)
  );

  const snapshotIds = [];
  const snapshotFlags = [];
  const postIds = [];
  const postFlags = [];
  const firstViralAt = [];

  allPosts.forEach((post) => {
    const isPostViral = viralPostIds.has(post.id);
    let firstViralSnapshot = null;

    post.snapshots.forEach((snapshot) => {
      let isSnapshotViral = false;
      if (isPostViral && snapshot.ageMinutes <= HORIZON_MINUTES) {
        const snapshotMetrics = {
          views: snapshot.views,
          reactions: snapshot.reactions,
          comments: snapshot.comments,
          forwards: snapshot.forwards
        };
        isSnapshotViral = calculateScore(snapshotMetrics, stats) >= scoreThreshold &&
          hasRawOutlierSignal(snapshotMetrics, stats);

        if (isSnapshotViral && !firstViralSnapshot) {
          firstViralSnapshot = snapshot;
        }
      }

      snapshotIds.push(snapshot.id);
      snapshotFlags.push(isSnapshotViral);
    });

    postIds.push(post.id);
    postFlags.push(isPostViral);
    firstViralAt.push(firstViralSnapshot ? new Date(firstViralSnapshot.snapshotAt) : null);
  });

  await pg.query('BEGIN');
  try {
    await pg.query(
      `
        UPDATE tg_post_snapshots AS snapshots
        SET is_viral = relabel.is_viral,
            threshold_used = $3
        FROM UNNEST($1::BIGINT[], $2::BOOLEAN[]) AS relabel(snapshot_id, is_viral)
        WHERE snapshots.id = relabel.snapshot_id
      `,
      [snapshotIds, snapshotFlags, scoreThreshold]
    );

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
      [postIds, postFlags, firstViralAt, scoreThreshold]
    );

    await pg.query('COMMIT');
  } catch (error) {
    await pg.query('ROLLBACK');
    throw error;
  }

  return {
    posts: allPosts.length,
    maturePosts: maturePosts.length,
    viralPosts: postFlags.filter(Boolean).length,
    viralSnapshots: snapshotFlags.filter(Boolean).length,
    scoreThreshold,
    stats
  };
};

const main = async () => {
  if (!process.env.ANALYTICS_DATABASE_URL) {
    throw new Error('ANALYTICS_DATABASE_URL is not configured');
  }

  const pg = new Client({
    connectionString: process.env.ANALYTICS_DATABASE_URL,
    ssl: process.env.ANALYTICS_DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined
  });

  await pg.connect();

  const beforeRetention = await pg.query(
    `
      SELECT
        COUNT(*) FILTER (WHERE published_at < NOW() - ($1::TEXT || ' days')::INTERVAL)::INT AS old_posts,
        COUNT(*)::INT AS total_posts
      FROM tg_posts
    `,
    [RECENT_RETENTION_DAYS]
  );

  const channelsResult = await pg.query('SELECT id, title, username FROM tg_channels ORDER BY title ASC');
  const summary = [];

  for (const channel of channelsResult.rows) {
    const result = await relabelChannel(pg, channel);
    summary.push({
      channel: channel.title,
      username: channel.username,
      ...result
    });
  }

  const after = await pg.query(
    `
      SELECT
        COUNT(*) FILTER (WHERE current_is_viral)::INT AS viral_posts,
        COUNT(*)::INT AS total_posts
      FROM tg_posts
    `
  );

  console.log(JSON.stringify({
    retention: {
      days: RECENT_RETENTION_DAYS,
      oldPosts: beforeRetention.rows[0].old_posts,
      totalPosts: beforeRetention.rows[0].total_posts
    },
    finalTotals: after.rows[0],
    summary
  }, null, 2));

  await pg.end();
};

main().catch((error) => {
  console.error('Failed to relabel Telegram analytics with confident 24h labels:', error);
  process.exit(1);
});
