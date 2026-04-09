const TelegramBot = require('node-telegram-bot-api');
const TelegramSource = require('../../models/TelegramSource');
const Post = require('../../models/Post');
const telegramClient = require('./client');

// Initialize Telegram Bot for reading messages
let bot;
let processingQueue = Promise.resolve();
const queuedSourceIds = new Set();
const activeSourceIds = new Set();
const queuedSourceTimestamps = new Map();
const activeSourceTimestamps = new Map();
const SOURCE_PROCESS_TIMEOUT_MS = Math.max(
  30 * 1000,
  Number.parseInt(process.env.TELEGRAM_SOURCE_PROCESS_TIMEOUT_MS || `${5 * 60 * 1000}`, 10) || 5 * 60 * 1000
);
const SOURCE_STATE_STALE_MS = Math.max(
  SOURCE_PROCESS_TIMEOUT_MS,
  Number.parseInt(process.env.TELEGRAM_SOURCE_STATE_STALE_MS || `${10 * 60 * 1000}`, 10) || (10 * 60 * 1000)
);

const withTimeout = (promise, timeoutMs, sourceName) => {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Telegram source processing timed out after ${Math.round(timeoutMs / 1000)}s for ${sourceName}`));
    }, timeoutMs);
  });

  return Promise.race([
    promise.finally(() => clearTimeout(timeoutId)),
    timeoutPromise
  ]);
};

const getSourceStateAgeMs = (map, sourceId) => {
  const startedAt = map.get(sourceId);
  if (!startedAt) {
    return null;
  }
  return Date.now() - startedAt;
};

const clearSourceState = (sourceId) => {
  queuedSourceIds.delete(sourceId);
  activeSourceIds.delete(sourceId);
  queuedSourceTimestamps.delete(sourceId);
  activeSourceTimestamps.delete(sourceId);
};

const recoverStaleSourceState = (sourceId, sourceName) => {
  const queuedAgeMs = getSourceStateAgeMs(queuedSourceTimestamps, sourceId);
  const activeAgeMs = getSourceStateAgeMs(activeSourceTimestamps, sourceId);
  const isQueuedWithoutTimestamp = queuedSourceIds.has(sourceId) && queuedAgeMs === null;
  const isActiveWithoutTimestamp = activeSourceIds.has(sourceId) && activeAgeMs === null;

  if (isQueuedWithoutTimestamp || isActiveWithoutTimestamp) {
    console.warn(
      `♻️ Recovering Telegram source state without timestamp for ${sourceName} ` +
      `(queued=${isQueuedWithoutTimestamp}, active=${isActiveWithoutTimestamp})`
    );
    clearSourceState(sourceId);
    processingQueue = Promise.resolve();
    return true;
  }

  const maxAgeMs = Math.max(queuedAgeMs || 0, activeAgeMs || 0);

  if (maxAgeMs <= SOURCE_STATE_STALE_MS) {
    return false;
  }

  console.warn(
    `♻️ Recovering stale Telegram source state for ${sourceName} ` +
    `(queued=${queuedAgeMs}ms, active=${activeAgeMs}ms, threshold=${SOURCE_STATE_STALE_MS}ms)`
  );
  clearSourceState(sourceId);
  processingQueue = Promise.resolve();
  return true;
};

/**
 * Initialize the Telegram services for reading sources
 */
const init = async () => {
  console.log('🚀 Initializing Telegram sources service...');
  
  // Initialize Bot API (for channels where bot is admin)
  if (process.env.TELEGRAM_BOT_TOKEN) {
    bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
    console.log('✅ Telegram Bot API initialized');
  } else {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN not set. Bot API features disabled.');
  }
  
  // Initialize Client API (for subscribed channels)
  try {
    await telegramClient.init();
    console.log('✅ Telegram Client API initialized');
  } catch (error) {
    console.warn('⚠️ Telegram Client API initialization failed:', error.message);
  }
  
  console.log('✅ Telegram sources service initialized');
};

/**
 * Get user's subscribed channels and groups
 */
const getUserSubscriptions = async () => {
  try {
    if (telegramClient.isConnected()) {
      return await telegramClient.getUserSubscriptions();
    } else {
      console.warn('Telegram Client not connected. Cannot get user subscriptions.');
      return [];
    }
  } catch (error) {
    console.error('Error getting user subscriptions:', error);
    return [];
  }
};

/**
 * Get chat information
 */
const getChatInfo = async (chatId) => {
  try {
    // Try Client API first (more reliable for subscribed channels)
    if (telegramClient.isConnected()) {
      try {
        return await telegramClient.getChatInfo(chatId);
      } catch (clientError) {
        console.log('Client API failed, trying Bot API...');
      }
    }
    
    // Fallback to Bot API
    if (!bot) throw new Error('Neither Telegram Client nor Bot is available');
    
    const chat = await bot.getChat(chatId);
    return {
      id: chat.id.toString(),
      title: chat.title,
      username: chat.username,
      type: chat.type,
      description: chat.description,
      memberCount: chat.members_count || 0
    };
  } catch (error) {
    console.error(`Error getting chat info for ${chatId}:`, error);
    throw error;
  }
};

/**
 * Get recent messages from a channel/group
 */
const getRecentMessages = async (chatId, limit = 100, fromMessageId = null) => {
  if (!bot) throw new Error('Telegram bot not initialized');
  
  try {
    // Note: Regular bots cannot read message history from channels/groups
    // unless they are administrators. This is a Telegram API limitation.
    // For full functionality, you'd need:
    // 1. User authorization (MTProto)
    // 2. Bot admin permissions in the channel
    // 3. Or use Telegram's Bot API updates
    
    console.warn('Reading message history requires bot admin permissions or MTProto');
    return [];
  } catch (error) {
    console.error(`Error getting messages from ${chatId}:`, error);
    throw error;
  }
};

/**
 * Process messages from a Telegram source and create posts
 */
const processMessagesFromSource = async (telegramSource) => {
  const sourceId = telegramSource._id.toString();

  recoverStaleSourceState(sourceId, telegramSource.name);

  if (queuedSourceIds.has(sourceId)) {
    console.log(`⏭️ Skipping Telegram source ${telegramSource.name}: already queued`);
    return { processed: 0, created: 0, updated: 0, skipped: true };
  }

  if (activeSourceIds.has(sourceId)) {
    const activeAgeMs = getSourceStateAgeMs(activeSourceTimestamps, sourceId);
    if (activeAgeMs !== null && activeAgeMs < SOURCE_PROCESS_TIMEOUT_MS) {
      console.log(`⏭️ Skipping Telegram source ${telegramSource.name}: already processing`);
      return { processed: 0, created: 0, updated: 0, skipped: true };
    }

    console.warn(
      `♻️ Forcing recovery for active Telegram source ${telegramSource.name} ` +
      `(activeAgeMs=${activeAgeMs})`
    );
    clearSourceState(sourceId);
    processingQueue = Promise.resolve();
  }

  if (activeSourceIds.has(sourceId) || queuedSourceIds.has(sourceId)) {
    console.log(`⏭️ Skipping Telegram source ${telegramSource.name}: already queued or processing`);
    return { processed: 0, created: 0, updated: 0, skipped: true };
  }

  queuedSourceIds.add(sourceId);
  queuedSourceTimestamps.set(sourceId, Date.now());

  const runSource = async () => {
    queuedSourceIds.delete(sourceId);
    queuedSourceTimestamps.delete(sourceId);
    activeSourceIds.add(sourceId);
    activeSourceTimestamps.set(sourceId, Date.now());

    try {
      console.log(`🔄 Processing messages from Telegram source: ${telegramSource.name}`);
      console.log(`🚀 Using Client API exclusively for ${telegramSource.name}`);

      try {
        return await withTimeout(
          telegramClient.processMessagesFromSource(telegramSource),
          SOURCE_PROCESS_TIMEOUT_MS,
          telegramSource.name
        );
      } catch (clientError) {
        console.error(`❌ Client API failed for ${telegramSource.name}:`, clientError.message);
        console.log('🔄 Attempting to hard-reset Telegram Client...');
        await telegramClient.forceReinitialize(`source:${telegramSource.name}`);
        throw clientError;
      }
    } catch (error) {
      console.error(`❌ Error processing Telegram source ${telegramSource.name}:`, error);
      throw error;
    } finally {
      clearSourceState(sourceId);
    }
  };

  const runPromise = processingQueue.then(runSource, runSource);
  processingQueue = runPromise.catch(() => {});

  return runPromise;
};

/**
 * Extract relevant data from Telegram message
 */
const extractMessageData = (message, source) => {
  try {
    // Skip messages without text or media
    if (!message.text && !message.photo && !message.video && !message.document) {
      return null;
    }
    
    const messageData = {
      text: message.text || message.caption || '',
      publishedAt: new Date(message.date * 1000),
      url: `https://t.me/${source.username}/${message.message_id}`,
      attachments: []
    };
    
    // Extract view count (only available for channels)
    if (message.views) {
      messageData.viewCount = message.views;
    }
    
    // Extract forward count
    if (message.forwards) {
      messageData.forwardCount = message.forwards;
    }
    
    // Extract reactions (if available)
    if (message.reactions && message.reactions.results) {
      messageData.reactionCount = message.reactions.results.reduce(
        (sum, reaction) => sum + reaction.count, 0
      );
    }
    
    // Extract media attachments
    if (message.photo && message.photo.length > 0) {
      const photo = message.photo[message.photo.length - 1]; // Get highest resolution
      messageData.attachments.push({
        type: 'photo',
        fileId: photo.file_id,
        width: photo.width,
        height: photo.height
      });
    }
    
    if (message.video) {
      messageData.attachments.push({
        type: 'video',
        fileId: message.video.file_id,
        duration: message.video.duration,
        width: message.video.width,
        height: message.video.height
      });
    }
    
    if (message.document) {
      messageData.attachments.push({
        type: 'document',
        fileId: message.document.file_id,
        fileName: message.document.file_name,
        mimeType: message.document.mime_type
      });
    }
    
    return messageData;
    
  } catch (error) {
    console.error('Error extracting message data:', error);
    return null;
  }
};

/**
 * Process all active Telegram sources
 */
const processAllSources = async () => {
  try {
    const sources = await TelegramSource.find({ active: true });
    
    if (sources.length === 0) {
      console.log('No active Telegram sources found');
      return { sources: 0, totalProcessed: 0, totalCreated: 0 };
    }
    
    let totalProcessed = 0;
    let totalCreated = 0;
    
    for (const source of sources) {
      try {
        const result = await processMessagesFromSource(source);
        totalProcessed += result.processed;
        totalCreated += result.created;
      } catch (error) {
        console.error(`Error processing source ${source.name}:`, error);
      }
    }
    
    return { 
      sources: sources.length, 
      totalProcessed, 
      totalCreated 
    };
    
  } catch (error) {
    console.error('Error processing all Telegram sources:', error);
    throw error;
  }
};

/**
 * Test connection to a Telegram chat
 */
const testConnection = async (chatId) => {
  try {
    const chat = await getChatInfo(chatId);
    
    // Check connection method used
    const method = telegramClient.isConnected() ? 'Client API' : 'Bot API';
    
    return {
      success: true,
      chat: chat,
      method: method
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

module.exports = {
  init,
  getUserSubscriptions,
  getChatInfo,
  getRecentMessages,
  processMessagesFromSource,
  processAllSources,
  testConnection,
  getBot: () => bot,
  getQueueState: () => ({
    queued: queuedSourceIds.size,
    active: activeSourceIds.size,
    queuedSourceIds: [...queuedSourceIds],
    activeSourceIds: [...activeSourceIds],
    queuedSourceTimestamps: Object.fromEntries(queuedSourceTimestamps),
    activeSourceTimestamps: Object.fromEntries(activeSourceTimestamps)
  })
};
