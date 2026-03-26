const { Pool } = require('pg');

let pool = null;
let initialized = false;
let enabled = false;
let lastError = null;
const STALE_RUN_ERROR = 'Marked stale by analytics recovery';
const SUPERSEDED_RUN_ERROR = 'Superseded by a newer run';

const getConnectionConfig = () => {
  const connectionString = process.env.ANALYTICS_DATABASE_URL;
  if (!connectionString) {
    return null;
  }

  const sslEnabled = process.env.ANALYTICS_DATABASE_SSL === 'true';
  return {
    connectionString,
    ssl: sslEnabled ? { rejectUnauthorized: false } : undefined
  };
};

const isEnabled = () => enabled;

const getHealth = () => ({
  enabled,
  initialized,
  lastError: lastError ? lastError.message : null
});

const calculateAgeMinutes = (publishedAt, observedAt) => {
  if (!publishedAt || !observedAt) {
    return 0;
  }

  const ageMs = new Date(observedAt).getTime() - new Date(publishedAt).getTime();
  return Math.max(0, Math.round(ageMs / (60 * 1000)));
};

const calculateEngagementScore = (messageData = {}, source = {}) => {
  const reactionWeight = Number(source.reactionWeight || 1);
  const commentWeight = Number(source.commentWeight || 2);
  const forwardWeight = Number(source.forwardWeight || 3);

  return (
    (Number(messageData.reactionCount) || 0) * reactionWeight +
    (Number(messageData.commentCount) || 0) * commentWeight +
    (Number(messageData.forwardCount) || 0) * forwardWeight
  );
};

const toInteger = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getMediaTypes = (attachments = []) => {
  return [...new Set(
    attachments
      .map((attachment) => attachment?.type)
      .filter(Boolean)
  )];
};

const STRATEGY_WINDOWS_MINUTES = [15, 30, 45, 60, 90, 120, 180];
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
const STRATEGY_THRESHOLD_PERCENTILES = [70, 75, 80, 85, 90, 95];
const STRATEGY_TARGET_PERCENTILE = 85;

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

const annotateStrategy = (strategy, profileKey) => {
  if (!strategy) {
    return null;
  }

  const profileMeta = {
    aggressive: {
      key: 'aggressive',
      title: 'Агрессивная',
      description: 'Ловит больше потенциально вирусных постов, допускает больше ложных срабатываний.'
    },
    balanced: {
      key: 'balanced',
      title: 'Сбалансированная',
      description: 'Компромисс между полнотой и точностью.'
    },
    strict: {
      key: 'strict',
      title: 'Строгая',
      description: 'Меньше ложных срабатываний, но может пропускать часть вирусных постов.'
    }
  }[profileKey] || {
    key: profileKey,
    title: profileKey,
    description: ''
  };

  return {
    ...strategy,
    profileKey: profileMeta.key,
    profileTitle: profileMeta.title,
    profileDescription: profileMeta.description,
    explanation:
      `${profileMeta.title}: ${strategy.strategyTitle || strategy.metric} в первые ${strategy.maxNewsAgeMinutes} мин, ` +
      `порог ${strategy.threshold}. Точность ${(strategy.precision * 100).toFixed(1)}%, ` +
      `полнота ${(strategy.recall * 100).toFixed(1)}%, F1 ${(strategy.f1Score * 100).toFixed(1)}%.`
  };
};

const sameStrategy = (left, right) => {
  if (!left || !right) {
    return false;
  }

  return (
    left.strategyId === right.strategyId &&
    left.threshold === right.threshold &&
    left.maxNewsAgeMinutes === right.maxNewsAgeMinutes
  );
};

const sameStrategyFamily = (left, right) => {
  if (!left || !right) {
    return false;
  }

  return left.strategyId === right.strategyId;
};

const pickDistinctStrategy = (candidates, scorer, excluded = [], options = {}) => {
  const {
    distinctByFamily = false
  } = options;

  const isExcluded = (candidate, excludedCandidate) => {
    if (sameStrategy(candidate, excludedCandidate)) {
      return true;
    }

    if (distinctByFamily && sameStrategyFamily(candidate, excludedCandidate)) {
      return true;
    }

    return false;
  };

  const available = candidates.filter((candidate) => (
    !excluded.some((excludedCandidate) => isExcluded(candidate, excludedCandidate))
  ));

  if (available.length === 0) {
    return null;
  }

  return [...available].sort((left, right) => {
    const leftScore = scorer(left);
    const rightScore = scorer(right);
    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }
    if (right.precision !== left.precision) {
      return right.precision - left.precision;
    }
    if (right.recall !== left.recall) {
      return right.recall - left.recall;
    }
    if (left.maxNewsAgeMinutes !== right.maxNewsAgeMinutes) {
      return left.maxNewsAgeMinutes - right.maxNewsAgeMinutes;
    }
    return left.threshold - right.threshold;
  })[0];
};

const getMetricFromCounts = (counts = {}, metric, weights = {}) => {
  const reactions = Number(counts.reaction_count ?? counts.reactionCount ?? 0) || 0;
  const comments = Number(counts.comment_count ?? counts.commentCount ?? 0) || 0;
  const forwards = Number(counts.forward_count ?? counts.forwardCount ?? 0) || 0;
  const views = Number(counts.view_count ?? counts.viewCount ?? 0) || 0;

  switch (metric) {
    case 'views':
      return views;
    case 'comments':
      return comments;
    case 'forwards':
      return forwards;
    case 'engagement_score':
      return (
        reactions * (Number(weights.reactionWeight) || 1) +
        comments * (Number(weights.commentWeight) || 2) +
        forwards * (Number(weights.forwardWeight) || 3)
      );
    case 'reactions':
    default:
      return reactions;
  }
};

const bootstrapSchema = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tg_channels (
      id BIGSERIAL PRIMARY KEY,
      mongo_source_id TEXT UNIQUE,
      chat_id TEXT NOT NULL UNIQUE,
      username TEXT,
      title TEXT NOT NULL,
      source_type TEXT NOT NULL,
      description TEXT,
      access_status TEXT,
      check_frequency_minutes INTEGER,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      last_seen_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS tg_ingest_runs (
      id BIGSERIAL PRIMARY KEY,
      channel_id BIGINT REFERENCES tg_channels(id) ON DELETE CASCADE,
      run_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ,
      messages_scanned INTEGER NOT NULL DEFAULT 0,
      posts_created INTEGER NOT NULL DEFAULT 0,
      posts_updated INTEGER NOT NULL DEFAULT 0,
      snapshots_written INTEGER NOT NULL DEFAULT 0,
      error_text TEXT
    );

    CREATE TABLE IF NOT EXISTS tg_posts (
      id BIGSERIAL PRIMARY KEY,
      channel_id BIGINT NOT NULL REFERENCES tg_channels(id) ON DELETE CASCADE,
      mongo_post_id TEXT UNIQUE,
      message_id TEXT NOT NULL,
      published_at TIMESTAMPTZ NOT NULL,
      first_observed_at TIMESTAMPTZ NOT NULL,
      latest_observed_at TIMESTAMPTZ NOT NULL,
      post_text TEXT,
      text_length INTEGER NOT NULL DEFAULT 0,
      has_media BOOLEAN NOT NULL DEFAULT FALSE,
      attachment_count INTEGER NOT NULL DEFAULT 0,
      media_types TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      view_count_last INTEGER NOT NULL DEFAULT 0,
      forward_count_last INTEGER NOT NULL DEFAULT 0,
      reaction_count_last INTEGER NOT NULL DEFAULT 0,
      comment_count_last INTEGER NOT NULL DEFAULT 0,
      reply_count_last INTEGER NOT NULL DEFAULT 0,
      first_view_count INTEGER NOT NULL DEFAULT 0,
      first_forward_count INTEGER NOT NULL DEFAULT 0,
      first_reaction_count INTEGER NOT NULL DEFAULT 0,
      first_comment_count INTEGER NOT NULL DEFAULT 0,
      current_is_viral BOOLEAN NOT NULL DEFAULT FALSE,
      first_became_viral_at TIMESTAMPTZ,
      threshold_used NUMERIC(12, 2),
      original_post_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (channel_id, message_id)
    );

    CREATE TABLE IF NOT EXISTS tg_post_snapshots (
      id BIGSERIAL PRIMARY KEY,
      post_id BIGINT NOT NULL REFERENCES tg_posts(id) ON DELETE CASCADE,
      run_id BIGINT REFERENCES tg_ingest_runs(id) ON DELETE SET NULL,
      snapshot_at TIMESTAMPTZ NOT NULL,
      age_minutes INTEGER NOT NULL DEFAULT 0,
      view_count INTEGER NOT NULL DEFAULT 0,
      forward_count INTEGER NOT NULL DEFAULT 0,
      reaction_count INTEGER NOT NULL DEFAULT 0,
      comment_count INTEGER NOT NULL DEFAULT 0,
      reply_count INTEGER NOT NULL DEFAULT 0,
      engagement_score NUMERIC(12, 2) NOT NULL DEFAULT 0,
      is_viral BOOLEAN NOT NULL DEFAULT FALSE,
      threshold_used NUMERIC(12, 2),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_tg_channels_active ON tg_channels(active);
    CREATE INDEX IF NOT EXISTS idx_tg_posts_channel_published ON tg_posts(channel_id, published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_tg_posts_mongo_post ON tg_posts(mongo_post_id);
    CREATE INDEX IF NOT EXISTS idx_tg_post_snapshots_post_time ON tg_post_snapshots(post_id, snapshot_at DESC);
    CREATE INDEX IF NOT EXISTS idx_tg_post_snapshots_run ON tg_post_snapshots(run_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tg_post_snapshots_unique_point ON tg_post_snapshots(post_id, snapshot_at);
  `);
};

const recoverStaleRuns = async (maxAgeMinutes = 30) => {
  if (!pool) {
    return 0;
  }

  const result = await pool.query(
    `
      UPDATE tg_ingest_runs
      SET
        status = 'failed',
        finished_at = NOW(),
        error_text = COALESCE(error_text, $2)
      WHERE status = 'running'
        AND started_at < NOW() - ($1::text || ' minutes')::interval
    `,
    [toInteger(maxAgeMinutes, 30), STALE_RUN_ERROR]
  );

  return result.rowCount || 0;
};

const init = async () => {
  if (initialized) {
    return getHealth();
  }

  initialized = true;
  const config = getConnectionConfig();
  if (!config) {
    console.warn('Telegram analytics PostgreSQL is disabled: ANALYTICS_DATABASE_URL is not set');
    return getHealth();
  }

  try {
    pool = new Pool(config);
    await pool.query('SELECT 1');
    await bootstrapSchema();
    const recoveredRuns = await recoverStaleRuns(30);
    enabled = true;
    lastError = null;
    console.log('✅ Telegram analytics PostgreSQL initialized');
    if (recoveredRuns > 0) {
      console.log(`🧹 Recovered ${recoveredRuns} stale Telegram analytics runs`);
    }
  } catch (error) {
    lastError = error;
    enabled = false;
    console.error('❌ Failed to initialize Telegram analytics PostgreSQL:', error.message);
  }

  return getHealth();
};

const withClient = async (handler) => {
  if (!enabled || !pool) {
    return null;
  }

  const client = await pool.connect();
  try {
    return await handler(client);
  } finally {
    client.release();
  }
};

const upsertChannel = async (client, source, observedAt = new Date()) => {
  const result = await client.query(
    `
      INSERT INTO tg_channels (
        mongo_source_id,
        chat_id,
        username,
        title,
        source_type,
        description,
        access_status,
        check_frequency_minutes,
        active,
        last_seen_at,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      ON CONFLICT (chat_id) DO UPDATE SET
        mongo_source_id = EXCLUDED.mongo_source_id,
        username = EXCLUDED.username,
        title = EXCLUDED.title,
        source_type = EXCLUDED.source_type,
        description = EXCLUDED.description,
        access_status = EXCLUDED.access_status,
        check_frequency_minutes = EXCLUDED.check_frequency_minutes,
        active = EXCLUDED.active,
        last_seen_at = EXCLUDED.last_seen_at,
        updated_at = NOW()
      RETURNING id
    `,
    [
      source._id.toString(),
      source.chatId,
      source.username || null,
      source.name,
      source.type,
      source.description || null,
      source.accessStatus || 'active',
      toInteger(source.checkFrequency, 60),
      Boolean(source.active),
      observedAt
    ]
  );

  return result.rows[0].id;
};

const startRun = async (source, runType = 'source_sync') => {
  try {
    return await withClient(async (client) => {
      const channelId = await upsertChannel(client, source);
      await client.query(
        `
          UPDATE tg_ingest_runs
          SET
            status = 'failed',
            finished_at = NOW(),
            error_text = COALESCE(error_text, $3)
          WHERE channel_id = $1
            AND run_type = $2
            AND status = 'running'
        `,
        [channelId, runType, SUPERSEDED_RUN_ERROR]
      );
      const result = await client.query(
        `
          INSERT INTO tg_ingest_runs (channel_id, run_type, status)
          VALUES ($1, $2, 'running')
          RETURNING id
        `,
        [channelId, runType]
      );
      return result.rows[0].id;
    });
  } catch (error) {
    lastError = error;
    console.warn('Telegram analytics run start failed:', error.message);
    return null;
  }
};

const finishRun = async (runId, stats = {}, error = null) => {
  if (!enabled || !pool || !runId) {
    return;
  }

  try {
    await pool.query(
      `
        UPDATE tg_ingest_runs
        SET
          status = $2,
          finished_at = NOW(),
          messages_scanned = $3,
          posts_created = $4,
          posts_updated = $5,
          snapshots_written = $6,
          error_text = $7
        WHERE id = $1
      `,
      [
        runId,
        error ? 'failed' : 'completed',
        toInteger(stats.messagesScanned, 0),
        toInteger(stats.postsCreated, 0),
        toInteger(stats.postsUpdated, 0),
        toInteger(stats.snapshotsWritten, 0),
        error ? error.message : null
      ]
    );
  } catch (finishError) {
    lastError = finishError;
    console.warn('Telegram analytics run finish failed:', finishError.message);
  }
};

const recordPostObservation = async ({
  source,
  post,
  messageData,
  observedAt = new Date(),
  thresholdUsed = 0,
  runId = null
}) => {
  if (!enabled || !pool || !source || !post || !messageData) {
    return false;
  }

  try {
    await withClient(async (client) => {
      try {
        await client.query('BEGIN');

        const channelId = await upsertChannel(client, source, observedAt);
        const mediaTypes = getMediaTypes(messageData.attachments);
        const engagementScore = calculateEngagementScore(messageData, source);
        const ageMinutes = calculateAgeMinutes(messageData.publishedAt, observedAt);
        const isViral = Boolean(post.isViral);

        const postResult = await client.query(
          `
          INSERT INTO tg_posts (
            channel_id,
            mongo_post_id,
            message_id,
            published_at,
              first_observed_at,
              latest_observed_at,
              post_text,
              text_length,
              has_media,
              attachment_count,
              media_types,
              view_count_last,
              forward_count_last,
              reaction_count_last,
              comment_count_last,
              reply_count_last,
              first_view_count,
              first_forward_count,
              first_reaction_count,
              first_comment_count,
              current_is_viral,
              first_became_viral_at,
              threshold_used,
              original_post_url,
            updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $11, $12, $13, $14,
            $16, $17, $18, $19, NOW()
          )
            ON CONFLICT (channel_id, message_id) DO UPDATE SET
              mongo_post_id = COALESCE(EXCLUDED.mongo_post_id, tg_posts.mongo_post_id),
              latest_observed_at = EXCLUDED.latest_observed_at,
              post_text = EXCLUDED.post_text,
              text_length = EXCLUDED.text_length,
              has_media = EXCLUDED.has_media,
              attachment_count = EXCLUDED.attachment_count,
              media_types = EXCLUDED.media_types,
              view_count_last = EXCLUDED.view_count_last,
              forward_count_last = EXCLUDED.forward_count_last,
              reaction_count_last = EXCLUDED.reaction_count_last,
              comment_count_last = EXCLUDED.comment_count_last,
              reply_count_last = EXCLUDED.reply_count_last,
              current_is_viral = EXCLUDED.current_is_viral,
              first_became_viral_at = COALESCE(
                tg_posts.first_became_viral_at,
                CASE WHEN EXCLUDED.current_is_viral THEN EXCLUDED.latest_observed_at ELSE NULL END
              ),
              threshold_used = EXCLUDED.threshold_used,
              original_post_url = EXCLUDED.original_post_url,
              updated_at = NOW()
            RETURNING id
          `,
          [
            channelId,
            post._id ? post._id.toString() : null,
            post.originalPostId.toString(),
            messageData.publishedAt,
            observedAt,
            messageData.text || '',
            toInteger((messageData.text || '').length, 0),
            mediaTypes.length > 0,
            toInteger(messageData.attachments?.length, 0),
            mediaTypes,
            toInteger(messageData.viewCount, 0),
            toInteger(messageData.forwardCount, 0),
            toInteger(messageData.reactionCount, 0),
            toInteger(messageData.commentCount, 0),
            toInteger(messageData.replyCount, 0),
            isViral,
            isViral ? observedAt : null,
            Number(thresholdUsed || post.thresholdUsed || 0),
            messageData.url || post.originalPostUrl || null
          ]
        );

        await client.query(
          `
            INSERT INTO tg_post_snapshots (
              post_id,
              run_id,
              snapshot_at,
              age_minutes,
              view_count,
              forward_count,
              reaction_count,
              comment_count,
              reply_count,
              engagement_score,
              is_viral,
              threshold_used
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (post_id, snapshot_at) DO UPDATE SET
              run_id = EXCLUDED.run_id,
              age_minutes = EXCLUDED.age_minutes,
              view_count = EXCLUDED.view_count,
              forward_count = EXCLUDED.forward_count,
              reaction_count = EXCLUDED.reaction_count,
              comment_count = EXCLUDED.comment_count,
              reply_count = EXCLUDED.reply_count,
              engagement_score = EXCLUDED.engagement_score,
              is_viral = EXCLUDED.is_viral,
              threshold_used = EXCLUDED.threshold_used
          `,
          [
            postResult.rows[0].id,
            runId,
            observedAt,
            ageMinutes,
            toInteger(messageData.viewCount, 0),
            toInteger(messageData.forwardCount, 0),
            toInteger(messageData.reactionCount, 0),
            toInteger(messageData.commentCount, 0),
            toInteger(messageData.replyCount, 0),
            engagementScore,
            isViral,
            Number(thresholdUsed || post.thresholdUsed || 0)
          ]
        );

        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });

    return true;
  } catch (error) {
    lastError = error;
    console.warn(`Telegram analytics observation write failed for post ${post.originalPostId}:`, error.message);
    return false;
  }
};

const getOverview = async () => {
  if (!enabled || !pool) {
    return {
      enabled: false,
      channels: 0,
      posts: 0,
      snapshots: 0,
      recentRuns: []
    };
  }

  const [{ rows: channelsRows }, { rows: postsRows }, { rows: snapshotsRows }, { rows: runsRows }] = await Promise.all([
    pool.query('SELECT COUNT(*)::INT AS count FROM tg_channels'),
    pool.query('SELECT COUNT(*)::INT AS count FROM tg_posts'),
    pool.query('SELECT COUNT(*)::INT AS count FROM tg_post_snapshots'),
    pool.query(`
      SELECT r.id, c.title AS channel_name, r.run_type, r.status, r.started_at, r.finished_at,
             r.messages_scanned, r.posts_created, r.posts_updated, r.snapshots_written
      FROM tg_ingest_runs r
      LEFT JOIN tg_channels c ON c.id = r.channel_id
      ORDER BY r.started_at DESC
      LIMIT 10
    `)
  ]);

  return {
    enabled: true,
    channels: channelsRows[0].count,
    posts: postsRows[0].count,
    snapshots: snapshotsRows[0].count,
    recentRuns: runsRows
  };
};

const getSourcesOverview = async () => {
  if (!enabled || !pool) {
    return [];
  }

  const result = await pool.query(`
    SELECT
      c.mongo_source_id,
      c.chat_id,
      c.username,
      c.title,
      c.source_type,
      c.active,
      c.last_seen_at,
      COUNT(DISTINCT p.id)::INT AS posts_count,
      COUNT(s.id)::INT AS snapshots_count,
      MAX(s.snapshot_at) AS last_snapshot_at
    FROM tg_channels c
    LEFT JOIN tg_posts p ON p.channel_id = c.id
    LEFT JOIN tg_post_snapshots s ON s.post_id = p.id
    GROUP BY c.id
    ORDER BY c.title ASC
  `);

  return result.rows;
};

const getSourcePosts = async (mongoSourceId, limit = 100, minAgeMinutes = null, maxAgeMinutes = null) => {
  if (!enabled || !pool) {
    return [];
  }

  const result = await pool.query(
    `
      SELECT
        p.id,
        p.mongo_post_id,
        p.message_id,
        p.published_at,
        p.latest_observed_at,
        p.original_post_url,
        p.view_count_last,
        p.forward_count_last,
        p.reaction_count_last,
        p.comment_count_last,
        p.current_is_viral,
        p.threshold_used,
        COUNT(s.id)::INT AS snapshots_count,
        COALESCE(range_metrics.range_view_count_max, 0)::INT AS range_view_count_max,
        COALESCE(range_metrics.range_forward_count_max, 0)::INT AS range_forward_count_max,
        COALESCE(range_metrics.range_reaction_count_max, 0)::INT AS range_reaction_count_max,
        COALESCE(range_metrics.range_comment_count_max, 0)::INT AS range_comment_count_max,
        COALESCE(range_metrics.range_snapshots_count, 0)::INT AS range_snapshots_count
      FROM tg_posts p
      JOIN tg_channels c ON c.id = p.channel_id
      LEFT JOIN tg_post_snapshots s ON s.post_id = p.id
      LEFT JOIN LATERAL (
        SELECT
          MAX(ps.view_count) AS range_view_count_max,
          MAX(ps.forward_count) AS range_forward_count_max,
          MAX(ps.reaction_count) AS range_reaction_count_max,
          MAX(ps.comment_count) AS range_comment_count_max,
          COUNT(*) AS range_snapshots_count
        FROM tg_post_snapshots ps
        WHERE ps.post_id = p.id
          AND ($3::INT IS NULL OR ps.age_minutes >= $3)
          AND ($4::INT IS NULL OR ps.age_minutes <= $4)
      ) AS range_metrics ON TRUE
      WHERE c.mongo_source_id = $1
      GROUP BY p.id, range_metrics.range_view_count_max, range_metrics.range_forward_count_max,
               range_metrics.range_reaction_count_max, range_metrics.range_comment_count_max,
               range_metrics.range_snapshots_count
      ORDER BY p.published_at DESC
      LIMIT $2
    `,
    [
      mongoSourceId,
      toInteger(limit, 100),
      minAgeMinutes === null ? null : toInteger(minAgeMinutes, 0),
      maxAgeMinutes === null ? null : toInteger(maxAgeMinutes, 0)
    ]
  );

  return result.rows;
};

const getPostSnapshots = async (postId, limit = 200) => {
  if (!enabled || !pool) {
    return [];
  }

  const result = await pool.query(
    `
      SELECT
        s.id,
        s.snapshot_at,
        s.age_minutes,
        s.view_count,
        s.forward_count,
        s.reaction_count,
        s.comment_count,
        s.reply_count,
        s.engagement_score,
        s.is_viral,
        s.threshold_used
      FROM tg_post_snapshots s
      WHERE s.post_id = $1
      ORDER BY s.snapshot_at ASC
      LIMIT $2
    `,
    [toInteger(postId, 0), toInteger(limit, 200)]
  );

  return result.rows;
};

const getSourceStrategyRecommendation = async (mongoSourceId, options = {}) => {
  if (!enabled || !pool) {
    return null;
  }

  const weights = {
    reactionWeight: Number(options.reactionWeight) || 1,
    commentWeight: Number(options.commentWeight) || 2,
    forwardWeight: Number(options.forwardWeight) || 3
  };

  const result = await pool.query(
    `
      SELECT
        p.id,
        p.message_id,
        p.published_at,
        p.original_post_url,
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
      ORDER BY p.id ASC, s.age_minutes ASC, s.snapshot_at ASC
    `,
    [mongoSourceId]
  );

  const postsMap = new Map();
  result.rows.forEach((row) => {
    const existing = postsMap.get(row.id) || {
      id: row.id,
      messageId: row.message_id,
      publishedAt: row.published_at,
      originalPostUrl: row.original_post_url,
      snapshots: []
    };
    existing.snapshots.push(row);
    postsMap.set(row.id, existing);
  });

  const posts = Array.from(postsMap.values()).filter((post) => post.snapshots.length >= 2);
  if (posts.length < 12) {
    return {
      recommendedStrategy: null,
      candidates: [],
      postsAvailable: posts.length,
      message: 'Недостаточно данных для расчёта умной стратегии'
    };
  }

  const candidates = [];

  STRATEGY_DEFINITIONS.forEach((strategyDefinition) => {
    STRATEGY_WINDOWS_MINUTES.forEach((windowMinutes) => {
      const metric = strategyDefinition.metric;
      const strategyWeights = strategyDefinition.weights || weights;
      const eligiblePosts = posts
        .map((post) => {
          const inWindowSnapshots = post.snapshots.filter((snapshot) => Number(snapshot.age_minutes) <= windowMinutes);
          if (inWindowSnapshots.length === 0) {
            return null;
          }

          const maxObservedAge = Math.max(...post.snapshots.map((snapshot) => Number(snapshot.age_minutes) || 0));
          if (maxObservedAge < windowMinutes) {
            return null;
          }

          const earlyValue = Math.max(
            ...inWindowSnapshots.map((snapshot) => getMetricFromCounts(snapshot, metric, strategyWeights))
          );
          const finalValue = Math.max(
            ...post.snapshots.map((snapshot) => getMetricFromCounts(snapshot, metric, strategyWeights))
          );

          return {
            id: post.id,
            earlyValue,
            finalValue
          };
        })
        .filter(Boolean)
        .filter((post) => Number.isFinite(post.earlyValue) && Number.isFinite(post.finalValue) && post.finalValue > 0);

      if (eligiblePosts.length < 12) {
        return;
      }

      const finalValues = eligiblePosts.map((post) => post.finalValue);
      const labelThreshold = percentile(finalValues, STRATEGY_TARGET_PERCENTILE);
      const actualPositiveCount = eligiblePosts.filter((post) => post.finalValue >= labelThreshold).length;

      if (actualPositiveCount < 3) {
        return;
      }

      const earlyValues = eligiblePosts.map((post) => post.earlyValue);
      const actualPositiveRate = actualPositiveCount / eligiblePosts.length;

      STRATEGY_THRESHOLD_PERCENTILES.forEach((thresholdPercentile) => {
        const threshold = roundMetric(percentile(earlyValues, thresholdPercentile));
        if (threshold <= 0) {
          return;
        }

        let truePositive = 0;
        let falsePositive = 0;
        let falseNegative = 0;
        let predictedCount = 0;

        eligiblePosts.forEach((post) => {
          const predicted = post.earlyValue >= threshold;
          const actual = post.finalValue >= labelThreshold;

          if (predicted) {
            predictedCount += 1;
          }

          if (predicted && actual) {
            truePositive += 1;
          } else if (predicted && !actual) {
            falsePositive += 1;
          } else if (!predicted && actual) {
            falseNegative += 1;
          }
        });

        if (predictedCount === 0) {
          return;
        }

        const predictedRate = predictedCount / eligiblePosts.length;
        if (predictedRate < 0.03 || predictedRate > 0.5) {
          return;
        }

        const precision = truePositive / Math.max(1, truePositive + falsePositive);
        const recall = truePositive / Math.max(1, truePositive + falseNegative);
        const f1Score = precision + recall > 0
          ? (2 * precision * recall) / (precision + recall)
          : 0;

        const score = (
          f1Score -
          Math.abs(predictedRate - actualPositiveRate) * 0.15 -
          windowMinutes * 0.0002
        );

        candidates.push({
          strategyId: strategyDefinition.id,
          strategyTitle: strategyDefinition.title,
          metric,
          threshold,
          maxNewsAgeMinutes: windowMinutes,
          thresholdPercentile,
          labelPercentile: STRATEGY_TARGET_PERCENTILE,
          precision,
          recall,
          f1Score,
          score,
          truePositive,
          falsePositive,
          falseNegative,
          postsEvaluated: eligiblePosts.length,
          predictedCount,
          actualPositiveCount,
          predictedRate,
          actualPositiveRate,
          reactionWeight: strategyWeights.reactionWeight,
          commentWeight: strategyWeights.commentWeight,
          forwardWeight: strategyWeights.forwardWeight
        });
      });
    });
  });

  const sortedCandidates = candidates.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    if (right.precision !== left.precision) {
      return right.precision - left.precision;
    }
    if (left.maxNewsAgeMinutes !== right.maxNewsAgeMinutes) {
      return left.maxNewsAgeMinutes - right.maxNewsAgeMinutes;
    }
    return left.threshold - right.threshold;
  });

  const aggressiveCandidates = sortedCandidates.filter((candidate) => candidate.predictedRate >= 0.12);
  const strictCandidates = sortedCandidates.filter((candidate) => candidate.predictedRate <= 0.18);

  const bestBalanced = pickDistinctStrategy(
    sortedCandidates,
    (candidate) => candidate.f1Score * 0.8 + candidate.precision * 0.1 + candidate.recall * 0.1
  );
  const bestAggressive = pickDistinctStrategy(
    aggressiveCandidates.length > 0 ? aggressiveCandidates : sortedCandidates,
    (candidate) => candidate.recall * 0.75 + candidate.f1Score * 0.2 - candidate.thresholdPercentile * 0.002,
    bestBalanced ? [bestBalanced] : [],
    { distinctByFamily: true }
  ) || bestBalanced;
  const bestStrict = pickDistinctStrategy(
    strictCandidates.length > 0 ? strictCandidates : sortedCandidates,
    (candidate) => candidate.precision * 0.75 + candidate.f1Score * 0.2 + candidate.thresholdPercentile * 0.002,
    [bestBalanced, bestAggressive].filter(Boolean),
    { distinctByFamily: true }
  ) || bestBalanced;

  const strategies = {
    aggressive: annotateStrategy(bestAggressive, 'aggressive'),
    balanced: annotateStrategy(bestBalanced, 'balanced'),
    strict: annotateStrategy(bestStrict, 'strict')
  };

  return {
    recommendedStrategy: strategies.balanced,
    strategyProfiles: strategies,
    candidates: sortedCandidates.slice(0, 5),
    postsAvailable: posts.length,
    message: bestBalanced
      ? 'Умные стратегии рассчитаны'
      : 'Не удалось найти устойчивую стратегию на текущих данных'
  };
};

const backfillFromMongo = async () => {
  if (!enabled || !pool) {
    return {
      enabled: false,
      sourcesProcessed: 0,
      postsProcessed: 0,
      snapshotsWritten: 0
    };
  }

  const mongoose = require('mongoose');
  const TelegramSource = require('../../models/TelegramSource');
  const Post = require('../../models/Post');

  const sources = await TelegramSource.find({ active: true }).lean();

  let sourcesProcessed = 0;
  let postsProcessed = 0;
  let snapshotsWritten = 0;

  for (const source of sources) {
    const runId = await startRun(source, 'mongo_backfill');

    try {
      const posts = await Post.find({ telegramSource: source._id })
        .sort({ publishedAt: 1, createdAt: 1 })
        .lean();

      for (const post of posts) {
        const observedAt = post.updatedAt || post.createdAt || post.publishedAt || new Date();
        const messageData = {
          text: post.text || '',
          publishedAt: post.publishedAt || post.createdAt || observedAt,
          url: post.originalPostUrl || null,
          attachments: Array.isArray(post.attachments) ? post.attachments : [],
          viewCount: post.viewCount || 0,
          forwardCount: post.forwardCount || 0,
          reactionCount: post.reactionCount || 0,
          commentCount: post.commentCount || 0,
          replyCount: post.replyCount || 0
        };

        const ok = await recordPostObservation({
          source,
          post,
          messageData,
          observedAt,
          thresholdUsed: post.thresholdUsed || source.calculatedThreshold || source.manualThreshold || 0,
          runId
        });

        postsProcessed += 1;
        if (ok) {
          snapshotsWritten += 1;
        }
      }

      sourcesProcessed += 1;
      await finishRun(runId, {
        messagesScanned: posts.length,
        postsCreated: posts.length,
        postsUpdated: 0,
        snapshotsWritten: posts.length
      });
    } catch (error) {
      await finishRun(runId, {
        messagesScanned: 0,
        postsCreated: 0,
        postsUpdated: 0,
        snapshotsWritten: 0
      }, error);
      throw error;
    }
  }

  return {
    enabled: true,
    sourcesProcessed,
    postsProcessed,
    snapshotsWritten
  };
};

module.exports = {
  init,
  isEnabled,
  getHealth,
  recoverStaleRuns,
  startRun,
  finishRun,
  recordPostObservation,
  backfillFromMongo,
  getOverview,
  getSourcesOverview,
  getSourcePosts,
  getPostSnapshots,
  getSourceStrategyRecommendation
};
