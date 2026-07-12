require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const { Client } = require('pg');

const DEFAULT_RETENTION_DAYS = Math.max(
  1,
  Number.parseInt(process.env.DATA_RETENTION_DAYS || '30', 10) || 30
);

const DEFAULT_PG_CLEANUP_BATCH_SIZE = Math.max(
  1000,
  Number.parseInt(process.env.PG_CLEANUP_BATCH_SIZE || '50000', 10) || 50000
);

const DEFAULT_PG_POST_CLEANUP_BATCH_SIZE = Math.max(
  100,
  Number.parseInt(process.env.PG_POST_CLEANUP_BATCH_SIZE || '2000', 10) || 2000
);

const mongoUri = process.env.MONGODB_URI;
const analyticsDatabaseUrl = process.env.ANALYTICS_DATABASE_URL;
const analyticsDatabaseSsl = process.env.ANALYTICS_DATABASE_SSL === 'true';

const getCutoffDate = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

async function cleanupMongo(days) {
  if (!mongoUri) {
    return { skipped: true, reason: 'MONGODB_URI is not configured' };
  }

  const cutoffDate = getCutoffDate(days);
  const shouldDisconnect = mongoose.connection.readyState !== 1;

  if (shouldDisconnect) {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 15000,
    });
  }

  const db = mongoose.connection.db;
  const postsCollection = db.collection('posts');

  try {
    const [beforeCount, oldestDoc] = await Promise.all([
      postsCollection.estimatedDocumentCount(),
      postsCollection.find({ createdAt: { $exists: true } }, { projection: { createdAt: 1 } }).sort({ createdAt: 1 }).limit(1).toArray(),
    ]);

    const deleteResult = await postsCollection.deleteMany({
      createdAt: { $lt: cutoffDate },
    });

    const afterCount = await postsCollection.estimatedDocumentCount();

    return {
      skipped: false,
      collection: 'posts',
      cutoffDate: cutoffDate.toISOString(),
      beforeCount,
      deletedCount: deleteResult.deletedCount || 0,
      afterCount,
      oldestBefore: oldestDoc[0]?.createdAt || null,
    };
  } finally {
    if (shouldDisconnect) {
      await mongoose.disconnect();
    }
  }
}

async function cleanupOldData(retentionDays = DEFAULT_RETENTION_DAYS) {
  const result = {
    retentionDays,
  };

  try {
    result.mongo = await cleanupMongo(retentionDays);
  } catch (error) {
    result.mongo = { skipped: false, error: error.message };
  }

  try {
    result.analytics = await cleanupAnalytics(retentionDays);
  } catch (error) {
    result.analytics = { skipped: false, error: error.message };
  }

  return result;
}

async function pgTableExists(client, tableName) {
  const { rows } = await client.query(
    `
      select exists (
        select 1
        from information_schema.tables
        where table_schema = 'public' and table_name = $1
      ) as exists
    `,
    [tableName]
  );

  return rows[0]?.exists === true;
}

async function deletePostgresRowsInBatches(client, tableName, dateColumn, days, batchSize) {
  let deletedCount = 0;
  let batches = 0;

  while (true) {
    const { rowCount } = await client.query(
      `
        with rows_to_delete as (
          select ctid
          from ${tableName}
          where ${dateColumn} < now() - ($1::text || ' days')::interval
          limit $2
        )
        delete from ${tableName}
        where ctid in (select ctid from rows_to_delete)
      `,
      [String(days), batchSize]
    );

    deletedCount += rowCount || 0;
    batches += 1;

    if (!rowCount || rowCount < batchSize) {
      break;
    }
  }

  return { deletedCount, batches };
}

async function cleanupAnalytics(days) {
  if (!analyticsDatabaseUrl) {
    return { skipped: true, reason: 'ANALYTICS_DATABASE_URL is not configured' };
  }

  const client = new Client({
    connectionString: analyticsDatabaseUrl,
    ssl: analyticsDatabaseSsl ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 15000,
  });

  await client.connect();

  const hasSnapshots = await pgTableExists(client, 'tg_post_snapshots');
  const hasPosts = await pgTableExists(client, 'tg_posts');
  const hasRuns = await pgTableExists(client, 'tg_ingest_runs');

  if (!hasSnapshots && !hasPosts && !hasRuns) {
    await client.end();
    return { skipped: true, reason: 'Analytics tables not found' };
  }

  const summary = {
    skipped: false,
    retentionDays: days,
    tables: {},
  };

  try {
    if (hasSnapshots) {
      const { rows: beforeRows } = await client.query(
        `
          select count(*)::bigint as total_count,
                 min(snapshot_at) as oldest
          from tg_post_snapshots
        `
      );

      const deleteResult = await deletePostgresRowsInBatches(
        client,
        'tg_post_snapshots',
        'snapshot_at',
        days,
        DEFAULT_PG_CLEANUP_BATCH_SIZE
      );

      const { rows: afterRows } = await client.query(
        `
          select count(*)::bigint as total_count
          from tg_post_snapshots
        `
      );

      summary.tables.tg_post_snapshots = {
        beforeCount: Number(beforeRows[0]?.total_count || 0),
        deletedCount: deleteResult.deletedCount,
        batches: deleteResult.batches,
        afterCount: Number(afterRows[0]?.total_count || 0),
        oldestBefore: beforeRows[0]?.oldest || null,
      };
    }

    if (hasPosts) {
      const { rows: beforeRows } = await client.query(
        `
          select count(*)::bigint as total_count,
                 min(published_at) as oldest
          from tg_posts
        `
      );

      const deleteResult = await deletePostgresRowsInBatches(
        client,
        'tg_posts',
        'published_at',
        days,
        DEFAULT_PG_POST_CLEANUP_BATCH_SIZE
      );

      const { rows: afterRows } = await client.query(
        `
          select count(*)::bigint as total_count
          from tg_posts
        `
      );

      summary.tables.tg_posts = {
        beforeCount: Number(beforeRows[0]?.total_count || 0),
        deletedCount: deleteResult.deletedCount,
        batches: deleteResult.batches,
        afterCount: Number(afterRows[0]?.total_count || 0),
        oldestBefore: beforeRows[0]?.oldest || null,
      };
    }

    if (hasRuns) {
      const { rows: beforeRows } = await client.query(
        `
          select count(*)::bigint as total_count,
                 min(started_at) as oldest
          from tg_ingest_runs
        `
      );

      const deleteResult = await deletePostgresRowsInBatches(
        client,
        'tg_ingest_runs',
        'started_at',
        days,
        DEFAULT_PG_CLEANUP_BATCH_SIZE
      );

      const { rows: afterRows } = await client.query(
        `
          select count(*)::bigint as total_count
          from tg_ingest_runs
        `
      );

      summary.tables.tg_ingest_runs = {
        beforeCount: Number(beforeRows[0]?.total_count || 0),
        deletedCount: deleteResult.deletedCount,
        batches: deleteResult.batches,
        afterCount: Number(afterRows[0]?.total_count || 0),
        oldestBefore: beforeRows[0]?.oldest || null,
      };
    }
  } catch (error) {
    throw error;
  } finally {
    await client.end();
  }

  return summary;
}

async function main() {
  const result = await cleanupOldData(DEFAULT_RETENTION_DAYS);

  console.log(JSON.stringify(result, null, 2));

  if (result.mongo?.error || result.analytics?.error) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  cleanupOldData,
  cleanupMongo,
  cleanupAnalytics,
  DEFAULT_RETENTION_DAYS,
};
