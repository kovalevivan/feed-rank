const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const { NewMessage } = require('telegram/events');
const TelegramSource = require('../../models/TelegramSource');
const Post = require('../../models/Post');
const { updateSourceThreshold } = require('./analytics');
const telegramAnalyticsService = require('../telegramAnalytics');

/**
 * Automatically forwards a viral Telegram post to all mapped channels
 * @param {Object} post - Post document
 * @param {Object} source - Telegram source document
 * @returns {Promise<Object>} - Forwarding results
 */
const autoForwardViralPost = async (post, source) => {
  try {
    if (post.publishedAt) {
      const maxNewsAgeMinutes = Math.max(1, source?.maxNewsAgeMinutes || 60);
      const postAgeMs = Date.now() - new Date(post.publishedAt).getTime();
      const maxAgeMs = maxNewsAgeMinutes * 60 * 1000;

      if (postAgeMs > maxAgeMs) {
        const ageMinutes = Math.round(postAgeMs / (60 * 1000));
        console.log(`⏭️ Skipping Telegram post ${post.originalPostId} - too old (${ageMinutes}m, limit: ${maxNewsAgeMinutes}m)`);
        return { forwarded: 0, errors: 0, skipped: true, reason: 'too_old' };
      }
    }

    // Import telegramService here to avoid circular dependency
    const telegramService = require('./index');
    const { getAllMappingsForSource } = require('../../utils/mappingUtils');
    
    // Get all mappings for this Telegram source
    const mappings = await getAllMappingsForSource(source._id.toString(), 'telegram');
    
    if (mappings.length === 0) {
      console.log(`No mappings found for viral Telegram post ${post.originalPostId} from source ${source.name}`);
      return { forwarded: 0, errors: 0 };
    }
    
    let forwardedCount = 0;
    let errorCount = 0;
    
    // Forward to each mapped channel
    for (const mapping of mappings) {
      if (mapping.telegramChannel && mapping.telegramChannel.active) {
        try {
          await telegramService.forwardPost(post, source, mapping.telegramChannel);
          forwardedCount++;
          console.log(`✅ Auto-forwarded viral Telegram post ${post.originalPostId} to ${mapping.telegramChannel.name}`);
        } catch (error) {
          console.error(`❌ Failed to auto-forward viral Telegram post ${post.originalPostId} to ${mapping.telegramChannel.name}: ${error.message}`);
          errorCount++;
        }
      }
    }
    
    // Update post status if forwarded
    if (forwardedCount > 0) {
      post.status = 'forwarded';
      await post.save();
    }
    
    return { forwarded: forwardedCount, errors: errorCount };
  } catch (error) {
    console.error(`Error auto-forwarding viral Telegram post ${post.originalPostId}:`, error);
    return { forwarded: 0, errors: 1 };
  }
};

const getThresholdUsed = (source) => {
  if (!source) {
    return 0;
  }

  if (source.thresholdType === 'manual') {
    return Number(source.manualThreshold || 0);
  }

  switch (source.viralDetectionMetric) {
    case 'views':
      return Number(source.calculatedThreshold || source.minViewsForViral || 0);
    case 'comments':
      return Number(source.calculatedThreshold || source.minCommentsForViral || 0);
    case 'engagement_score':
      return Number(source.calculatedThreshold || 30);
    case 'reactions':
    default:
      return Number(source.calculatedThreshold || source.minReactionsForViral || 0);
  }
};

// Telegram Client for reading user subscriptions
let client;
let isConnected = false;
let isInitializing = false;
let messageListenerSetup = false;
const DEFAULT_ANALYTICS_TRACKING_HOURS = Math.max(
  1,
  Number.parseInt(process.env.TELEGRAM_ANALYTICS_TRACKING_HOURS || '24', 10) || 24
);

/**
 * Initialize Telegram Client with user credentials
 */
const init = async () => {
  // Prevent multiple simultaneous initializations
  if (isInitializing) {
    console.log('⏳ Initialization already in progress, skipping...');
    return;
  }
  
  try {
    isInitializing = true;
    
    if (!process.env.TELEGRAM_API_ID || !process.env.TELEGRAM_API_HASH) {
      console.warn('Telegram API credentials not set. User channel reading will not work.');
      console.log('To enable reading from subscribed channels, set TELEGRAM_API_ID and TELEGRAM_API_HASH');
      return;
    }
    
    // Close old client if exists to prevent memory leak
    if (client) {
      try {
        console.log('🔄 Closing old Telegram client...');
        await client.disconnect();
        client = null;
        isConnected = false;
        messageListenerSetup = false; // Reset listener flag
      } catch (disconnectError) {
        console.warn('Warning disconnecting old client:', disconnectError.message);
        // Continue with new initialization anyway
        client = null;
        isConnected = false;
        messageListenerSetup = false;
      }
    }
    
    const apiId = parseInt(process.env.TELEGRAM_API_ID);
    const apiHash = process.env.TELEGRAM_API_HASH;
    const session = new StringSession(process.env.TELEGRAM_SESSION || '');
    
    client = new TelegramClient(session, apiId, apiHash, {
      connectionRetries: 10,
      retryDelay: 2000,
      timeout: 30000,
      requestRetries: 3,
      downloadRetries: 2,
      floodSleepThreshold: 60,
      autoReconnect: true,
      sequentialUpdates: true
    });
    
    // Start the client
    await client.start({
      phoneNumber: async () => {
        if (!process.env.TELEGRAM_PHONE) {
          throw new Error('TELEGRAM_PHONE not set. Please set your phone number in .env');
        }
        return process.env.TELEGRAM_PHONE;
      },
      password: async () => {
        if (process.env.TELEGRAM_PASSWORD) {
          return process.env.TELEGRAM_PASSWORD;
        }
        throw new Error('Two-factor authentication required. Please set TELEGRAM_PASSWORD in .env');
      },
      phoneCode: async () => {
        throw new Error('Phone verification required. Please run setup script first.');
      },
      onError: (err) => console.error('Telegram Client Error:', err),
    });
    
    // Save session for future use
    if (client.session.save()) {
      console.log('Telegram session saved. Add this to your .env as TELEGRAM_SESSION:');
      console.log('TELEGRAM_SESSION=' + client.session.save());
    }
    
    // Verify connection by testing it
    try {
      await client.getMe();
      isConnected = true;
      console.log('✅ Telegram Client initialized and connection verified');
      
      // Set up real-time message listener
      setupMessageListener();
    } catch (verifyError) {
      console.error('❌ Client initialized but connection verification failed:', verifyError.message);
      isConnected = false;
      throw verifyError;
    }
    
  } catch (error) {
    console.error('❌ Failed to initialize Telegram Client:', error.message);
    
    if (error.message.includes('AUTH_KEY_UNREGISTERED')) {
      console.log('🔧 Solution: Delete TELEGRAM_SESSION from .env and restart to re-authenticate');
    } else if (error.message.includes('TIMEOUT')) {
      console.log('⏳ Connection timeout - this is normal, client will auto-reconnect');
    } else if (error.message.includes('Not connected')) {
      console.log('🔄 Connection lost - auto-reconnection in progress');
    }
    
    // Set connected to false on error
    isConnected = false;
  } finally {
    isInitializing = false;
  }
};

/**
 * Check and maintain connection health
 */
const checkConnectionHealth = async () => {
  if (!client) return false;
  
  try {
    // Simple health check - try to get current user info
    await client.getMe();
    if (!isConnected) {
      isConnected = true;
      console.log('🔄 Telegram connection restored');
    }
    return true;
  } catch (error) {
    if (isConnected) {
      isConnected = false;
      console.log('⚠️ Telegram connection lost, will auto-reconnect');
    }
    return false;
  }
};

// Run connection health check every 2 minutes and reinitialize if needed
setInterval(async () => {
  const isHealthy = await checkConnectionHealth();
  if (!isHealthy && client) {
    console.log('🔄 Connection unhealthy, attempting reinitialization...');
    try {
      await init();
    } catch (error) {
      console.error('❌ Reinitialization failed:', error.message);
    }
  }
}, 2 * 60 * 1000);

/**
 * Setup real-time message listener for subscribed channels
 */
const setupMessageListener = () => {
  if (!client || !isConnected) return;
  
  // Prevent setting up multiple listeners (old client cleanup handles old listeners)
  if (messageListenerSetup) {
    console.log('📻 Message listener already set up');
    return;
  }
  
  client.addEventHandler(async (event) => {
    try {
      const message = event.message;
      if (!message) return;
      
      // Get chat information
      const chat = message.chat || message.peerId;
      if (!chat) return;
      
      const chatId = chat.chatId || chat.channelId || chat.userId;
      if (!chatId) return;
      
      // Check if this chat is one of our monitored sources
      const source = await TelegramSource.findOne({ 
        chatId: `-100${chatId}`,
        active: true 
      });
      
      if (!source) return;
      
      // New message processed (verbose logging disabled)
      
      // Process the message
      await processMessage(message, source);
      
    } catch (error) {
      console.error('Error processing real-time message:', error);
    }
  }, new NewMessage({}));
  
  messageListenerSetup = true;
  console.log('📻 Real-time message listener set up');
};

/**
 * Get user's subscribed channels and groups
 */
const getUserSubscriptions = async () => {
  if (!client || !isConnected) {
    throw new Error('Telegram Client not connected');
  }
  
  try {
    console.log('🔍 Fetching user subscriptions...');
    
    // Get all dialogs (chats, channels, groups)
    const dialogs = await client.getDialogs({
      limit: 100,
      // Don't use archived dialogs
      archived: false
    });
    
    const subscriptions = [];
    
    for (const dialog of dialogs) {
      const entity = dialog.entity;
      
      // Filter for channels and groups
      if (entity.className === 'Channel' || entity.className === 'Chat') {
        const isChannel = entity.broadcast === true;
        const isGroup = entity.megagroup === true || entity.className === 'Chat';
        
        if (isChannel || isGroup) {
          let extractedUsername = entity.username || (entity.usernames && entity.usernames.length > 0 ? entity.usernames[0].username : null);
          
          // For channels without username, try to get full entity info (entities from getDialogs() might be minimal)
          if (!extractedUsername && isChannel) {
            try {
              const fullEntity = await client.getEntity(entity.id);
              extractedUsername = fullEntity.username || (fullEntity.usernames && fullEntity.usernames.length > 0 ? fullEntity.usernames[0].username : null);
            } catch (fetchError) {
              // Silently continue if we can't fetch full entity
            }
          }
          
          subscriptions.push({
            id: entity.id.toString(),
            chatId: entity.id < 0 ? entity.id.toString() : `-100${entity.id}`,
            title: entity.title,
            username: extractedUsername,
            type: isChannel ? 'channel' : (isGroup ? 'supergroup' : 'group'),
            participantsCount: entity.participantsCount || 0,
            description: entity.about || '',
            isSubscribed: true
          });
        }
      }
    }
    
    console.log(`✅ Found ${subscriptions.length} subscribed channels/groups`);
    
    // Enhance subscriptions with usernames from our database (for channels we've already processed)
    try {
      const TelegramSource = require('../../models/TelegramSource');
      const dbSources = await TelegramSource.find({}, 'chatId username').lean();
      
      let enhancedCount = 0;
      for (const subscription of subscriptions) {
        if (!subscription.username) {
          const dbSource = dbSources.find(source => source.chatId === subscription.chatId);
          if (dbSource && dbSource.username) {
            // Add @ prefix if not already present
            subscription.username = dbSource.username.startsWith('@') ? dbSource.username : `@${dbSource.username}`;
            enhancedCount++;
          }
        }
      }
    } catch (dbError) {
      console.warn('Could not enhance subscriptions with database usernames:', dbError.message);
    }
    
    return subscriptions;
    
  } catch (error) {
    console.error('Error getting user subscriptions:', error);
    throw error;
  }
};

/**
 * Get chat information by username or ID
 */
const getChatInfo = async (identifier) => {
  if (!client || !isConnected) {
    throw new Error('Telegram Client not connected');
  }
  
  try {
    const entity = await client.getEntity(identifier);
    
    return {
      id: entity.id.toString(),
      chatId: entity.id < 0 ? entity.id.toString() : `-100${entity.id}`,
      title: entity.title,
      username: entity.username || (entity.usernames && entity.usernames.length > 0 ? entity.usernames[0].username : null),
      type: entity.broadcast ? 'channel' : (entity.megagroup ? 'supergroup' : 'group'),
      participantsCount: entity.participantsCount || 0,
      description: entity.about || '',
      verified: entity.verified || false
    };
  } catch (error) {
    console.error(`Error getting chat info for ${identifier}:`, error);
    throw error;
  }
};

const resolveChatEntity = async (chatId, username = null) => {
  let entity;

  if (username && username.startsWith('@')) {
    try {
      console.log(`🔄 Resolving entity by username: ${username}`);
      entity = await client.getEntity(username);
      console.log(`✅ Resolved entity by username: ${entity.id}`);
    } catch (usernameError) {
      console.warn(`⚠️ Failed to resolve by username ${username}:`, usernameError.message);
      entity = null;
    }
  }

  if (!entity) {
    try {
      let entityId;
      if (chatId.startsWith('-100')) {
        entityId = parseInt(chatId, 10);
      } else if (chatId.startsWith('-')) {
        entityId = parseInt(chatId, 10);
      } else {
        entityId = parseInt(chatId, 10);
      }

      console.log(`🔄 Resolving entity by ID: ${entityId} (from ${chatId})`);
      entity = await client.getEntity(entityId);
      console.log(`✅ Resolved entity by ID: ${entity.id}`);
    } catch (idError) {
      console.error(`❌ Failed to resolve entity by ID ${chatId}:`, idError.message);
      throw new Error(`Cannot resolve chat entity. Chat may be private or bot doesn't have access. ID: ${chatId}, Username: ${username}`);
    }
  }

  return entity;
};

/**
 * Get recent messages from a channel/group
 */
const getRecentMessages = async (chatId, limit = 50, offsetId = 0, username = null) => {
  if (!client || !isConnected) {
    throw new Error('Telegram Client not connected');
  }
  
  try {
    console.log(`📥 Fetching ${limit} messages from ${chatId} (username: ${username})...`);
    const entity = await resolveChatEntity(chatId, username);

    // Now get messages using the resolved entity
    const messages = await client.getMessages(entity, {
      limit: limit,
      offsetId: offsetId
    });
    
    console.log(`✅ Retrieved ${messages.length} messages from ${chatId}`);
    return messages;
    
  } catch (error) {
    console.error(`Error getting messages from ${chatId}:`, error);
    throw error;
  }
};

const getMessagesByIds = async (chatId, messageIds = [], username = null) => {
  if (!client || !isConnected) {
    throw new Error('Telegram Client not connected');
  }

  const uniqueIds = [...new Set(
    messageIds
      .map((id) => Number.parseInt(id, 10))
      .filter((id) => Number.isFinite(id) && id > 0)
  )];

  if (uniqueIds.length === 0) {
    return [];
  }

  try {
    console.log(`📥 Fetching ${uniqueIds.length} tracked messages by id from ${chatId}...`);
    const entity = await resolveChatEntity(chatId, username);
    const batches = [];

    for (let index = 0; index < uniqueIds.length; index += 100) {
      const chunk = uniqueIds.slice(index, index + 100);
      const chunkMessages = await client.getMessages(entity, { ids: chunk });
      batches.push(...chunkMessages.filter(Boolean));
    }

    console.log(`✅ Retrieved ${batches.length} tracked messages from ${chatId}`);
    return batches;
  } catch (error) {
    console.error(`Error getting tracked messages from ${chatId}:`, error);
    throw error;
  }
};

/**
 * Process a message and create a post if needed
 */
const processMessage = async (message, source, options = {}) => {
  try {
    const observedAt = new Date();
    const thresholdUsed = getThresholdUsed(source);
    const existingPost = await Post.findOne({
      telegramSource: source._id,
      originalPostId: message.id.toString()
    });

    // Extract message data
    const messageData = await extractMessageData(message, source, {
      includeMedia: !existingPost
    });
    if (!messageData) {
      return null;
    }

    const maxNewsAgeMinutes = Math.max(1, source?.maxNewsAgeMinutes || 60);
    const messageAgeMs = Date.now() - new Date(messageData.publishedAt).getTime();
    if (messageAgeMs > maxNewsAgeMinutes * 60 * 1000 && !existingPost && !options.ignoreAgeLimit) {
      return null;
    }
    
    // Check if message meets viral criteria
    const meetsViralCriteria = checkViralCriteria(messageData, source);
    
    if (existingPost) {
      // Update existing post with current metrics
      const hasMetricsChanged = (
        existingPost.reactionCount !== (messageData.reactionCount || 0) ||
        existingPost.commentCount !== (messageData.commentCount || 0) ||
        existingPost.forwardCount !== (messageData.forwardCount || 0) ||
        existingPost.viewCount !== (messageData.viewCount || 0)
      );
      
      if (hasMetricsChanged) {
        // Update metrics
        existingPost.reactionCount = messageData.reactionCount || 0;
        existingPost.commentCount = messageData.commentCount || 0;
        existingPost.forwardCount = messageData.forwardCount || 0;
        existingPost.viewCount = messageData.viewCount || 0;
        existingPost.thresholdUsed = thresholdUsed;
        existingPost.updatedAt = new Date();
        
        // Check if post became viral after update
        const wasViral = existingPost.isViral;
        existingPost.isViral = meetsViralCriteria;
        
        await existingPost.save();

        await telegramAnalyticsService.recordPostObservation({
          source,
          post: existingPost,
          messageData,
          observedAt,
          thresholdUsed,
          runId: options.runId || null
        });
        
        // If post became viral and wasn't before, auto-forward it
        if (!wasViral && meetsViralCriteria) {
          console.log(`🔥 Post ${existingPost.originalPostId} became viral after update! Reactions: ${existingPost.reactionCount}, Comments: ${existingPost.commentCount}, Forwards: ${existingPost.forwardCount}`);
          
          // Update source viral posts count
          source.viralPosts += 1;
          await source.save();
          
          try {
            const forwardResult = await autoForwardViralPost(existingPost, source);
            if (forwardResult.forwarded > 0) {
              console.log(`🚀 Auto-forwarded newly viral Telegram post ${existingPost.originalPostId} to ${forwardResult.forwarded} channels`);
            }
          } catch (error) {
            console.error(`Error auto-forwarding newly viral Telegram post ${existingPost.originalPostId}:`, error);
          }
        }
        
        return {
          action: 'updated',
          post: existingPost
        };
      } else {
        await telegramAnalyticsService.recordPostObservation({
          source,
          post: existingPost,
          messageData,
          observedAt,
          thresholdUsed,
          runId: options.runId || null
        });
        return {
          action: 'observed',
          post: existingPost
        };
      }
    }
    
    // Create new post in database
    const post = new Post({
      telegramSource: source._id,
      originalPostId: message.id.toString(),
      text: messageData.text,
      attachments: messageData.attachments,
      viewCount: messageData.viewCount || 0,
      forwardCount: messageData.forwardCount || 0,
      reactionCount: messageData.reactionCount || 0,
      commentCount: messageData.commentCount || 0,
      replyCount: messageData.replyCount || 0,
      publishedAt: messageData.publishedAt,
      originalPostUrl: messageData.url,
      isViral: meetsViralCriteria,
      thresholdUsed,
      status: 'pending'
    });
    
    await post.save();

    await telegramAnalyticsService.recordPostObservation({
      source,
      post,
      messageData,
      observedAt,
      thresholdUsed,
      runId: options.runId || null
    });
    
    // Update source statistics
    source.totalPosts += 1;
    if (meetsViralCriteria) {
      source.viralPosts += 1;
    }
    await source.save();
    
    // Auto-forward viral posts immediately
    if (meetsViralCriteria) {
      try {
        const forwardResult = await autoForwardViralPost(post, source);
        if (forwardResult.forwarded > 0) {
          console.log(`🚀 Auto-forwarded viral Telegram post ${post.originalPostId} to ${forwardResult.forwarded} channels`);
        }
      } catch (error) {
        console.error(`Error auto-forwarding viral Telegram post ${post.originalPostId}:`, error);
      }
    }
    
    // Message processed (logging reduced)
    return {
      action: 'created',
      post
    };
    
  } catch (error) {
    console.error(`Error processing message ${message.id}:`, error);
    return null;
  }
};

/**
 * Extract relevant data from Telegram message
 */
const extractMessageData = async (message, source, options = {}) => {
  try {
    // Skip empty messages
    if (!message.message && !message.media) {
      return null;
    }
    
    const messageData = {
      text: message.message || '',
      publishedAt: new Date(message.date * 1000),
      url: `https://t.me/${source.username?.replace('@', '')}/${message.id}`,
      attachments: []
    };
    
    // Extract view count
    if (message.views) {
      messageData.viewCount = message.views;
    }
    
    // Extract forward count
    if (message.forwards) {
      messageData.forwardCount = message.forwards;
    }
    
    // Extract reactions
    if (message.reactions) {
      messageData.reactionCount = message.reactions.results?.reduce(
        (sum, reaction) => sum + reaction.count, 0
      ) || 0;
    }
    
    // Extract reply/comment count
    if (message.replies) {
      messageData.replyCount = message.replies.replies || 0;
      messageData.commentCount = messageData.replyCount; // Alias for compatibility
    }
    
    // Extract media attachments
    if (message.media && options.includeMedia !== false) {
      const attachment = await extractMediaAttachment(message.media, message);
      if (attachment) {
        messageData.attachments.push(attachment);
      }
    }
    
    return messageData;
    
  } catch (error) {
    console.error('Error extracting message data:', error);
    return null;
  }
};

/**
 * Extract media attachment information and download media files
 */
const extractMediaAttachment = async (media, message) => {
  try {
    if (!media) return null;
    
    switch (media.className) {
      case 'MessageMediaPhoto':
        try {
          // Download photo buffer via Client API so Bot API can send it as attachment
          const photoBuffer = await client.downloadMedia(message, { workers: 1 });
          return {
            type: 'photo',
            fileId: media.photo.id.toString(),
            width: media.photo.sizes?.[media.photo.sizes.length - 1]?.w || 0,
            height: media.photo.sizes?.[media.photo.sizes.length - 1]?.h || 0,
            buffer: photoBuffer
          };
        } catch (downloadErr) {
          console.warn('Failed to download Telegram photo, will fallback to metadata only:', downloadErr.message);
          return {
            type: 'photo',
            fileId: media.photo.id.toString(),
            width: media.photo.sizes?.[media.photo.sizes.length - 1]?.w || 0,
            height: media.photo.sizes?.[media.photo.sizes.length - 1]?.h || 0
          };
        }
        
      case 'MessageMediaDocument':
        const document = media.document;
        const isVideo = document.mimeType?.startsWith('video/');
        const isAnimation = document.mimeType === 'video/mp4' && document.attributes?.some(attr => attr.className === 'DocumentAttributeAnimated');
        
        try {
          // For photos sent as documents or animations, try to download a buffer as well
          const docBuffer = await client.downloadMedia(message, { workers: 1 });
          return {
            type: isAnimation ? 'animation' : (isVideo ? 'video' : 'document'),
            fileId: document.id.toString(),
            fileName: document.attributes?.find(attr => attr.fileName)?.fileName,
            mimeType: document.mimeType,
            duration: document.attributes?.find(attr => attr.duration)?.duration,
            width: document.attributes?.find(attr => attr.w)?.w,
            height: document.attributes?.find(attr => attr.h)?.h,
            buffer: isVideo ? undefined : docBuffer // avoid huge video buffers; keep for images/animations
          };
        } catch (downloadErr) {
          console.warn('Failed to download Telegram document buffer:', downloadErr.message);
          return {
            type: isAnimation ? 'animation' : (isVideo ? 'video' : 'document'),
            fileId: document.id.toString(),
            fileName: document.attributes?.find(attr => attr.fileName)?.fileName,
            mimeType: document.mimeType,
            duration: document.attributes?.find(attr => attr.duration)?.duration,
            width: document.attributes?.find(attr => attr.w)?.w,
            height: document.attributes?.find(attr => attr.h)?.h
          };
        }
        
      case 'MessageMediaWebPage':
        return {
          type: 'link',
          url: media.webpage.url,
          title: media.webpage.title,
          description: media.webpage.description
        };
        
      default:
        return {
          type: 'other',
          mediaType: media.className
        };
    }
  } catch (error) {
    console.error('Error extracting media attachment:', error);
    return null;
  }
};

/**
 * Check if message meets viral criteria based on engagement metrics
 */
const checkViralCriteria = (messageData, source) => {
  try {
    const reactionCount = messageData.reactionCount || 0;
    const commentCount = messageData.commentCount || 0;
    const forwardCount = messageData.forwardCount || 0;
    const viewCount = messageData.viewCount || 0;
    
    // Determine which metric to use for viral detection
    const detectionMetric = source.viralDetectionMetric || 'reactions';
    const getEffectiveThreshold = (fallbackValue) => {
      if (source.thresholdType === 'manual') {
        return source.manualThreshold;
      }

      return source.calculatedThreshold || fallbackValue;
    };
    
    let meetsThreshold = false;
    
    switch (detectionMetric) {
      case 'reactions':
        const minReactions = getEffectiveThreshold(source.minReactionsForViral || 10);
        meetsThreshold = reactionCount >= minReactions;
        break;
        
      case 'comments':
        const minComments = getEffectiveThreshold(source.minCommentsForViral || 5);
        meetsThreshold = commentCount >= minComments;
        break;
        
      case 'views':
        const minViews = getEffectiveThreshold(source.minViewsForViral || 1000);
        meetsThreshold = viewCount >= minViews;
        break;
        
              case 'engagement_score':
        // Calculate weighted engagement score
        const reactionWeight = source.reactionWeight || 1.0;
        const commentWeight = source.commentWeight || 2.0;
        const forwardWeight = source.forwardWeight || 3.0;
        
        const engagementScore = (
          (reactionCount * reactionWeight) +
          (commentCount * commentWeight) +
          (forwardCount * forwardWeight)
        );
        
        // Use appropriate threshold based on type
        const minEngagementScore = getEffectiveThreshold(30);
          
        meetsThreshold = engagementScore >= minEngagementScore;
        
        console.log(`📊 Engagement Score: ${engagementScore} (reactions: ${reactionCount}×${reactionWeight}, comments: ${commentCount}×${commentWeight}, forwards: ${forwardCount}×${forwardWeight}) - Threshold: ${minEngagementScore} - Viral: ${meetsThreshold}`);
        break;
        
      default:
        console.warn(`Unknown viral detection metric: ${detectionMetric}, falling back to reactions`);
        meetsThreshold = reactionCount >= (source.minReactionsForViral || 10);
    }
    
    // Additional check: ensure at least some basic engagement
    const hasMinimalEngagement = detectionMetric === 'views'
      ? viewCount > 0
      : (reactionCount + commentCount + forwardCount) > 0;
    
    const isViral = meetsThreshold && hasMinimalEngagement;
    
    if (isViral) {
      console.log(`🔥 VIRAL: ${detectionMetric} - reactions: ${reactionCount}, comments: ${commentCount}, forwards: ${forwardCount}, views: ${viewCount}`);
    }
    
    return isViral;
    
  } catch (error) {
    console.error('Error checking viral criteria:', error);
    return false;
  }
};

/**
 * Process all messages from a source
 */
const processMessagesFromSource = async (telegramSource) => {
  if (!client || !isConnected) {
    throw new Error('Telegram Client not connected');
  }
  
  let analyticsRunId = null;
  try {
    console.log(`🔄 Processing messages from ${telegramSource.name}...`);
    analyticsRunId = await telegramAnalyticsService.startRun(telegramSource, 'source_sync');
    
    // Check if we need to calculate threshold for auto mode
    if (telegramSource.thresholdType === 'auto' && !telegramSource.calculatedThreshold) {
      console.log(`📊 Auto threshold not set, calculating based on recent posts...`);
      try {
        await updateSourceThreshold(
          telegramSource._id.toString(), 
          telegramSource.thresholdMethod || 'statistical',
          telegramSource.statisticalMultiplier || 0.5
        );
        // Reload the source to get updated threshold
        telegramSource = await TelegramSource.findById(telegramSource._id);
      } catch (thresholdError) {
        console.warn(`⚠️ Could not calculate threshold: ${thresholdError.message}`);
      }
    }
    
    // Get recent messages (including some older ones for re-evaluation)
    let newMessages = [];
    let trackedMessagesForUpdate = [];
    
    try {
      const postsToCheck = Math.max(1, Number.parseInt(telegramSource.postsToCheck || 10, 10) || 10);

      // Fetch new messages since lastPostId
      newMessages = await getRecentMessages(
        telegramSource.chatId,
        postsToCheck,
        telegramSource.lastPostId || 0,
        telegramSource.username
      );
      
      // Update access status to active if successful
      if (telegramSource.accessStatus !== 'active') {
        await TelegramSource.findByIdAndUpdate(telegramSource._id, {
          accessStatus: 'active',
          lastAccessError: null,
          lastAccessAttempt: new Date()
        });
      }
    } catch (error) {
      console.warn(`⚠️ Could not fetch new messages from ${telegramSource.name}: ${error.message}`);
      
      // Update access status based on error type
      let accessStatus = 'error';
      if (error.message.includes('Cannot resolve chat entity')) {
        accessStatus = 'access_denied';
      } else if (error.message.includes('not found')) {
        accessStatus = 'not_found';
      }
      
      await TelegramSource.findByIdAndUpdate(telegramSource._id, {
        accessStatus,
        lastAccessError: error.message,
        lastAccessAttempt: new Date()
      });
      
      // Continue with empty array - don't fail the entire process
    }
    
    try {
      // Re-fetch all already tracked posts for this source so analytics keeps accumulating
      // snapshots for the posts we have already started observing.
      const trackingWindowStart = new Date(
        Date.now() - DEFAULT_ANALYTICS_TRACKING_HOURS * 60 * 60 * 1000
      );
      const trackedPosts = await Post.find(
        {
          telegramSource: telegramSource._id,
          publishedAt: { $gte: trackingWindowStart }
        },
        'originalPostId publishedAt'
      )
        .sort({ publishedAt: -1 })
        .lean();

      console.log(
        `📈 Re-evaluating ${trackedPosts.length} tracked posts for ${telegramSource.name} ` +
        `within the last ${DEFAULT_ANALYTICS_TRACKING_HOURS}h`
      );

      trackedMessagesForUpdate = await getMessagesByIds(
        telegramSource.chatId,
        trackedPosts.map((post) => post.originalPostId),
        telegramSource.username
      );
    } catch (error) {
      console.warn(`⚠️ Could not fetch tracked messages for re-evaluation from ${telegramSource.name}: ${error.message}`);
      // Continue with empty array - don't fail the entire process
    }
    
    // Combine and deduplicate messages
    const allMessagesMap = new Map();
    
    // Add new messages
    newMessages.forEach(msg => allMessagesMap.set(msg.id, msg));
    
    // Add previously tracked messages for re-evaluation
    trackedMessagesForUpdate.forEach(msg => allMessagesMap.set(msg.id, msg));
    
    // Convert back to array and sort by ID
    const messages = Array.from(allMessagesMap.values()).sort((a, b) => a.id - b.id);
    
    if (messages.length === 0) {
      console.log(`No new messages found for ${telegramSource.name}`);
      await telegramAnalyticsService.finishRun(analyticsRunId, {
        messagesScanned: 0,
        postsCreated: 0,
        postsUpdated: 0,
        snapshotsWritten: 0
      });
      return { processed: 0, created: 0 };
    }
    
    let processedCount = 0;
    let createdCount = 0;
    let updatedCount = 0;
    let latestMessageId = telegramSource.lastPostId || 0;
    
    // Process messages in reverse order (oldest first)
    for (const message of messages.reverse()) {
      const result = await processMessage(message, telegramSource, { runId: analyticsRunId });
      
      if (result) {
        if (result.action === 'created') {
          createdCount++;
        } else if (result.action === 'updated') {
          updatedCount++;
        }
      }
      
      processedCount++;
      
      // Update latest message ID only for truly new messages
      if (message.id > latestMessageId) {
        latestMessageId = message.id;
      }
    }
    
    // Update source statistics
    telegramSource.lastChecked = new Date();
    telegramSource.lastPostId = latestMessageId;
    await telegramSource.save();

    await telegramAnalyticsService.finishRun(analyticsRunId, {
      messagesScanned: processedCount,
      postsCreated: createdCount,
      postsUpdated: updatedCount,
      snapshotsWritten: processedCount
    });
    
    console.log(`✅ Processed ${processedCount} messages, created ${createdCount} posts, updated ${updatedCount} posts for ${telegramSource.name}`);
    
    return { processed: processedCount, created: createdCount, updated: updatedCount };
    
  } catch (error) {
    await telegramAnalyticsService.finishRun(analyticsRunId, {}, error);
    console.error(`Error processing messages from ${telegramSource.name}:`, error);
    throw error;
  }
};

/**
 * Test connection to Telegram Client
 */
const testConnection = async () => {
  try {
    if (!client || !isConnected) {
      return {
        success: false,
        error: 'Telegram Client not connected'
      };
    }
    
    const me = await client.getMe();
    
    return {
      success: true,
      user: {
        id: me.id.toString(),
        firstName: me.firstName,
        lastName: me.lastName,
        username: me.username,
        phone: me.phone
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Check if client is connected
 */
const isClientConnected = () => {
  return client && isConnected;
};

/**
 * Get the client instance
 */
/**
 * Get recent messages directly from Telegram for threshold calculation (for new channels)
 * @param {string} chatId - Telegram chatId string (e.g., "-1001234567890")
 * @param {string} username - Telegram username (e.g., "@channelname")
 * @param {number} limit - Maximum number of messages to fetch (default: 100)
 * @returns {Promise<Array>} - Array of message data with engagement metrics
 */
const getMessagesForThresholdCalculation = async (chatId, username = null, limit = 100) => {
  try {
    console.log(`📊 Fetching ${limit} messages directly from Telegram for threshold calculation: ${chatId}`);
    
    // Fetch messages directly from Telegram
    const messages = await getRecentMessages(chatId, limit, 0, username);
    
    if (!messages || messages.length === 0) {
      console.log(`📊 No messages found in channel ${chatId}`);
      return [];
    }
    
    // Extract engagement data from each message
    const messagesWithEngagement = [];
    
    for (const message of messages) {
      try {
        // Skip deleted messages or messages without content
        if (!message || message.deleted || (!message.message && !message.media)) {
          continue;
        }
        
        // Extract engagement metrics
        const reactionCount = message.reactions?.results?.reduce((sum, reaction) => sum + reaction.count, 0) || 0;
        const commentCount = message.replies?.replies || 0;
        const forwardCount = message.forwards || 0;
        const viewCount = message.views || 0;
        
        // Only include messages with some engagement
        if (reactionCount > 0 || commentCount > 0 || forwardCount > 0) {
          messagesWithEngagement.push({
            originalPostId: message.id.toString(),
            text: message.message || '[Media]',
            reactionCount,
            commentCount,
            forwardCount,
            viewCount,
            publishedAt: message.date ? new Date(message.date * 1000) : new Date()
          });
        }
      } catch (messageError) {
        console.warn(`⚠️ Error processing message ${message.id}:`, messageError.message);
        continue;
      }
    }
    
    console.log(`📊 Found ${messagesWithEngagement.length} messages with engagement data out of ${messages.length} total messages`);
    
    return messagesWithEngagement;
  } catch (error) {
    console.error(`Error fetching messages for threshold calculation from ${chatId}:`, error);
    throw error;
  }
};

const getClient = () => {
  return client;
};

module.exports = {
  init,
  getUserSubscriptions,
  isConnected: isClientConnected,
  getClient,
  getChatInfo,
  getRecentMessages,
  getMessagesByIds,
  getMessagesForThresholdCalculation,
  processMessagesFromSource,
  autoForwardViralPost,
  testConnection,
  isConnected: () => isConnected,
  getClient: () => client
};
