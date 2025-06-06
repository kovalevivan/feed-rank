const TelegramBot = require('node-telegram-bot-api');
const VkSource = require('../../models/VkSource');
const TelegramChannel = require('../../models/TelegramChannel');
const Mapping = require('../../models/Mapping');
const Post = require('../../models/Post');
const vkService = require('../vk');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Temporary directory for downloaded videos
const tempDir = os.tmpdir();

// Initialize Telegram Bot
let bot;

/**
 * Initializes the Telegram Bot
 */
const init = () => {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.warn('Telegram bot token not set. Bot will not be initialized.');
    return;
  }
  
  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
  
  // Register command handlers
  registerCommands();
  
  console.log('Telegram bot initialized');
};

/**
 * Registers command handlers for the bot
 */
const registerCommands = () => {
  // Start command
  bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    
    await bot.sendMessage(chatId, 
      'Welcome to FeedRank Bot! 🚀\n\n' +
      'This bot helps you forward viral posts from VK public groups to Telegram channels.\n\n' +
      'Use /help to see available commands.'
    );
  });
  
  // Help command
  bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    
    await bot.sendMessage(chatId,
      'Available commands:\n\n' +
      '/addvk [group_name] - Add a new VK public group\n' +
      '/removevk [group_id] - Remove a VK public group\n' +
      '/addtg [channel_name] - Add a Telegram channel\n' +
      '/removetg [channel_id] - Remove a Telegram channel\n' +
      '/map [vk_id] [tg_id] - Create a mapping\n' +
      '/unmap [vk_id] [tg_id] - Remove a mapping\n' +
      '/list - List all configured sources and destinations\n' +
      '/status - Show system status'
    );
  });
  
  // Add VK public group
  bot.onText(/\/addvk (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const groupName = match[1];
    
    try {
      await bot.sendMessage(chatId, `Looking up VK group: ${groupName}...`);
      
      // Resolve group ID
      const groupId = await vkService.resolveGroupId(groupName);
      
      // Check if already exists
      const existingSource = await VkSource.findOne({ groupId });
      
      if (existingSource) {
        return bot.sendMessage(chatId, `Group "${groupName}" is already added as a source.`);
      }
      
      // Create new source
      const newSource = new VkSource({
        name: groupName,
        url: `https://vk.com/${groupName}`,
        groupId,
        thresholdType: 'auto',
        checkFrequency: 60 // Default: hourly
      });
      
      await newSource.save();
      
      // Calculate threshold
      await vkService.updateSourceThreshold(newSource._id);
      
      bot.sendMessage(chatId, 
        `✅ Successfully added VK group "${groupName}" (ID: ${groupId}).\n` +
        `Threshold will be calculated automatically.`
      );
    } catch (error) {
      console.error(`Error adding VK group via bot:`, error);
      bot.sendMessage(chatId, `❌ Error adding VK group: ${error.message}`);
    }
  });
  
  // Add Telegram channel
  bot.onText(/\/addtg (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const channelInput = match[1];
    
    try {
      await bot.sendMessage(chatId, `Processing Telegram channel: ${channelInput}...`);
      
      // Check if it's a username (with @ prefix) or already a chat ID
      let channelChatId, channelUsername, channelName;
      
      if (channelInput.startsWith('@')) {
        // It's a username, try to resolve it
        channelUsername = channelInput;
        channelName = channelInput.substring(1); // Remove @ for the name
        
        try {
          // Try to get chat info by username
          // Note: Bot needs to be admin of the channel for this to work
          const chat = await bot.getChat(channelUsername);
          channelChatId = chat.id.toString();
          
          // Use title if available
          if (chat.title) {
            channelName = chat.title;
          }
        } catch (error) {
          throw new Error(`Could not resolve channel ${channelUsername}. Make sure the bot is an admin of the channel and the username is correct.`);
        }
      } else if (channelInput.startsWith('-100')) {
        // It's already a chat ID
        channelChatId = channelInput;
        channelName = `Channel ${channelInput}`;
        
        // Try to get more info about the channel
        try {
          const chat = await bot.getChat(channelChatId);
          if (chat.title) {
            channelName = chat.title;
          }
          if (chat.username) {
            channelUsername = '@' + chat.username;
          }
        } catch (error) {
          console.log(`Could not get additional info for channel ${channelChatId}`);
          // Continue anyway since we have the chat ID
        }
      } else {
        // Try to interpret as a chat ID with auto-correction
        if (channelInput.match(/^-?\d+$/)) {
          // It's numeric, assume it's a chat ID that might need the -100 prefix
          channelChatId = channelInput.startsWith('-') ? channelInput : `-100${channelInput}`;
          channelName = `Channel ${channelChatId}`;
          
          // Try to get more info
          try {
            const chat = await bot.getChat(channelChatId);
            if (chat.title) {
              channelName = chat.title;
            }
            if (chat.username) {
              channelUsername = '@' + chat.username;
            }
          } catch (error) {
            throw new Error(`Could not find channel with ID ${channelChatId}. Make sure the bot is an admin of the channel and the ID is correct.`);
          }
        } else {
          // Assume it's a channel name without @, try with @ prefix
          channelUsername = '@' + channelInput;
          channelName = channelInput;
          
          try {
            const chat = await bot.getChat(channelUsername);
            channelChatId = chat.id.toString();
            
            if (chat.title) {
              channelName = chat.title;
            }
          } catch (error) {
            throw new Error(`Could not resolve channel ${channelUsername}. Make sure the bot is an admin of the channel and the username is correct.`);
          }
        }
      }
      
      // Check if already exists
      const existingChannel = await TelegramChannel.findOne({ chatId: channelChatId });
      
      if (existingChannel) {
        return bot.sendMessage(chatId, `Channel "${channelName}" is already added as a destination.`);
      }
      
      // Create new channel
      const newChannel = new TelegramChannel({
        name: channelName,
        chatId: channelChatId,
        username: channelUsername
      });
      
      await newChannel.save();
      
      // Send test message to the channel
      try {
        await bot.sendMessage(
          channelChatId,
          `✅ Successfully added to FeedRank!\n\nThis channel is now configured to receive viral posts from VK public groups.`
        );
        
        bot.sendMessage(chatId, 
          `✅ Successfully added Telegram channel "${channelName}".\n` +
          `ID: ${channelChatId}\n` +
          `Username: ${channelUsername || 'Not available'}`
        );
      } catch (error) {
        // If we can't send a message, the bot might not have permission
        await newChannel.deleteOne(); // Remove from database
        throw new Error(`Could not send a test message to the channel. Please make sure the bot is an admin of the channel with permission to post messages.`);
      }
    } catch (error) {
      console.error(`Error adding Telegram channel via bot:`, error);
      bot.sendMessage(chatId, `❌ Error adding Telegram channel: ${error.message}`);
    }
  });
  
  // Remove Telegram channel
  bot.onText(/\/removetg (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const channelId = match[1];
    
    try {
      // Find channel
      const channel = await TelegramChannel.findById(channelId);
      
      if (!channel) {
        return bot.sendMessage(chatId, `❌ Channel with ID "${channelId}" not found.`);
      }
      
      // Remove channel
      await channel.deleteOne();
      
      bot.sendMessage(chatId, `✅ Successfully removed Telegram channel "${channel.name}".`);
    } catch (error) {
      console.error(`Error removing Telegram channel via bot:`, error);
      bot.sendMessage(chatId, `❌ Error removing Telegram channel: ${error.message}`);
    }
  });
  
  // Create mapping between VK source and Telegram channel
  bot.onText(/\/map\s+([^\s]+)\s+([^\s]+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const vkSourceId = match[1];
    const tgChannelId = match[2];
    
    try {
      // Find VK source
      const vkSource = await VkSource.findById(vkSourceId);
      if (!vkSource) {
        return bot.sendMessage(chatId, `❌ VK source with ID "${vkSourceId}" not found.`);
      }
      
      // Find Telegram channel
      const tgChannel = await TelegramChannel.findById(tgChannelId);
      if (!tgChannel) {
        return bot.sendMessage(chatId, `❌ Telegram channel with ID "${tgChannelId}" not found.`);
      }
      
      // Check if mapping already exists
      const existingMapping = await Mapping.findOne({
        vkSource: vkSourceId,
        telegramChannel: tgChannelId
      });
      
      if (existingMapping) {
        return bot.sendMessage(chatId, `Mapping between "${vkSource.name}" and "${tgChannel.name}" already exists.`);
      }
      
      // Create new mapping
      const newMapping = new Mapping({
        vkSource: vkSourceId,
        telegramChannel: tgChannelId,
        active: true
      });
      
      await newMapping.save();
      
      bot.sendMessage(chatId, 
        `✅ Successfully created mapping:\n` +
        `VK Group: *${vkSource.name}* → Telegram Channel: *${tgChannel.name}*\n\n` +
        `Viral posts from "${vkSource.name}" will now be forwarded to "${tgChannel.name}".`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.error(`Error creating mapping via bot:`, error);
      bot.sendMessage(chatId, `❌ Error creating mapping: ${error.message}`);
    }
  });
  
  // Remove mapping
  bot.onText(/\/unmap\s+([^\s]+)\s+([^\s]+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const vkSourceId = match[1];
    const tgChannelId = match[2];
    
    try {
      // Find mapping
      const mapping = await Mapping.findOne({
        vkSource: vkSourceId,
        telegramChannel: tgChannelId
      });
      
      if (!mapping) {
        return bot.sendMessage(chatId, `❌ Mapping between these sources not found.`);
      }
      
      // Get names for response
      const vkSource = await VkSource.findById(vkSourceId);
      const tgChannel = await TelegramChannel.findById(tgChannelId);
      
      // Delete mapping
      await mapping.deleteOne();
      
      const vkName = vkSource ? vkSource.name : 'Unknown VK source';
      const tgName = tgChannel ? tgChannel.name : 'Unknown Telegram channel';
      
      bot.sendMessage(chatId, `✅ Successfully removed mapping between "${vkName}" and "${tgName}".`);
    } catch (error) {
      console.error(`Error removing mapping via bot:`, error);
      bot.sendMessage(chatId, `❌ Error removing mapping: ${error.message}`);
    }
  });
  
  // List sources and destinations
  bot.onText(/\/list/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
      // Fetch sources and destinations
      const vkSources = await VkSource.find({}).sort('name');
      const tgChannels = await TelegramChannel.find({}).sort('name');
      const mappings = await Mapping.find({})
        .populate('vkSource')
        .populate('telegramChannel');
      
      // Prepare response message
      let message = '*FeedRank Configuration*\n\n';
      
      // VK Sources
      message += '*VK Public Groups:*\n';
      if (vkSources.length === 0) {
        message += 'No VK groups configured.\n';
      } else {
        vkSources.forEach((source, index) => {
          message += `${index + 1}. *${source.name}* (ID: \`${source._id}\`)\n`;
          message += `   Threshold: ${source.thresholdType === 'manual' ? 'Manual' : 'Auto'} (${source.thresholdType === 'manual' ? source.manualThreshold : source.calculatedThreshold} views)\n`;
          message += `   Check frequency: Every ${source.checkFrequency} minutes\n`;
        });
      }
      
      // Telegram Channels
      message += '\n*Telegram Channels:*\n';
      if (tgChannels.length === 0) {
        message += 'No Telegram channels configured.\n';
      } else {
        tgChannels.forEach((channel, index) => {
          message += `${index + 1}. *${channel.name}* (ID: \`${channel._id}\`)\n`;
        });
      }
      
      // Mappings
      message += '\n*Mappings:*\n';
      if (mappings.length === 0) {
        message += 'No mappings configured.\n';
      } else {
        mappings.forEach((mapping, index) => {
          message += `${index + 1}. *${mapping.vkSource.name}* → *${mapping.telegramChannel.name}*\n`;
        });
      }
      
      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error(`Error listing configuration via bot:`, error);
      bot.sendMessage(chatId, `❌ Error listing configuration: ${error.message}`);
    }
  });
  
  // Status command
  bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    
    try {
      // Get counts
      const vkSourceCount = await VkSource.countDocuments({});
      const tgChannelCount = await TelegramChannel.countDocuments({});
      const mappingCount = await Mapping.countDocuments({});
      const viralPostCount = await Post.countDocuments({ isViral: true });
      const forwardedPostCount = await Post.countDocuments({ status: 'forwarded' });
      
      // Get last checked source
      const lastCheckedSource = await VkSource.findOne({})
        .sort({ lastChecked: -1 })
        .limit(1);
      
      // Prepare status message
      let message = '*FeedRank System Status*\n\n';
      message += `*VK Sources:* ${vkSourceCount}\n`;
      message += `*Telegram Channels:* ${tgChannelCount}\n`;
      message += `*Mappings:* ${mappingCount}\n`;
      message += `*Viral Posts Found:* ${viralPostCount}\n`;
      message += `*Posts Forwarded:* ${forwardedPostCount}\n`;
      
      if (lastCheckedSource) {
        message += `\n*Last Check:* ${lastCheckedSource.lastChecked ? new Date(lastCheckedSource.lastChecked).toLocaleString() : 'Never'}\n`;
      }
      
      await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error(`Error getting status via bot:`, error);
      bot.sendMessage(chatId, `❌ Error getting status: ${error.message}`);
    }
  });
  
  // Other commands would be implemented similarly
};

/**
 * Download a video file from a URL
 * @param {string} url - Video URL
 * @param {string} filename - Output filename
 * @returns {Promise<string>} - Path to downloaded file
 */
const downloadVideo = async (url, filename) => {
  const outputPath = path.join(tempDir, filename);
  
  try {
    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'stream',
      timeout: 30000, // 30 seconds timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const writer = fs.createWriteStream(outputPath);
    
    return new Promise((resolve, reject) => {
      response.data.pipe(writer);
      
      let error = null;
      writer.on('error', err => {
        error = err;
        writer.close();
        reject(err);
      });
      
      writer.on('close', () => {
        if (!error) {
          resolve(outputPath);
        }
      });
    });
  } catch (error) {
    console.error(`Error downloading video from ${url}:`, error);
    throw error;
  }
};

/**
 * Clean up temporary files
 * @param {string} filePath - Path to file to delete
 */
const cleanupTempFiles = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    // Silently ignore cleanup errors
  }
};

/**
 * Forwards a post to a Telegram channel
 * @param {Object} post - Post document from database
 * @param {Object} source - VK source document (optional, for compatibility)
 * @param {Object} channel - Telegram channel document from database
 * @param {Object} options - Additional options (isHighDynamics, growthRate, viewHistory)
 * @returns {Promise<Object>} - Result of forwarding
 */
const forwardPost = async (post, source, channel, options = {}) => {
  if (!bot) throw new Error('Telegram bot not initialized');
  
  // Handle both old (post, channel) and new (post, source, channel, options) signatures
  if (arguments.length === 2 && !options) {
    // Old signature: forwardPost(post, channel)
    options = {};
    channel = source;
    source = null;
  }
  
  // Validate required parameters
  if (!post) throw new Error('Post object is required');
  if (!channel) throw new Error('Channel object is required');
  if (!channel.chatId) throw new Error('Channel must have a valid chatId');
  if (!post.vkSource) throw new Error('Post must have a valid vkSource reference');
  
  try {
    // Get VK source if not provided
    const vkSource = source || await VkSource.findById(post.vkSource);
    const sourceName = vkSource ? vkSource.name : 'Неизвестный источник';
    
    // Escape special HTML characters to prevent formatting issues
    const escapeHtml = (text) => {
      if (!text) return '';
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    };
    
    // Truncate text to fit Telegram's message limit
    const truncateText = (text, maxLength = 3000) => {
      if (!text) return '';
      if (text.length <= maxLength) return text;
      
      // Find a good place to cut (try to cut at word boundary)
      const truncated = text.substring(0, maxLength);
      const lastSpace = truncated.lastIndexOf(' ');
      const cutPoint = lastSpace > maxLength * 0.8 ? lastSpace : maxLength;
      
      return text.substring(0, cutPoint) + '...';
    };
    
    // Format date
    const formatDate = (date) => {
      if (!date) return '';
      
      const d = new Date(date);
      return d.toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    };
    
    // Prepare post caption with HTML formatting
    let caption = '';
    
    // Add high dynamics marker if applicable
    if (options.isHighDynamics) {
      caption += `#ПОСТ_С_ВЫСОКОЙ_ДИНАМИКОЙ\n`;
    }
    
    caption += `${escapeHtml(truncateText(post.text))}\n\n`;
    caption += `👁 Просмотры: <b>${post.viewCount.toLocaleString()}</b>\n`;
    caption += `👍 Лайки: <b>${post.likeCount.toLocaleString()}</b>\n`;
    caption += `🔄 Репосты: <b>${post.repostCount.toLocaleString()}</b>\n`;
    caption += post.publishedAt ? `📅 Опубликовано: ${formatDate(post.publishedAt)}\n` : '';
    
    // Add high dynamics info if provided
    if (options.isHighDynamics && options.growthRate) {
      caption += `\n📈 <b>Скорость роста: ${options.growthRate.toFixed(1)} просмотров/мин</b>\n`;
      
      // Add time range information if available
      if (options.timeRange) {
        const startTime = new Date(options.timeRange.start).toLocaleString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        const endTime = new Date(options.timeRange.end).toLocaleString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        });
        caption += `\n⏱ <b>Период высокой динамики:</b>\n`;
        caption += `С ${startTime} по ${endTime}\n`;
        caption += `Длительность: ${options.timeRange.duration.toFixed(1)} мин\n`;
      }
    }
    // Remove experimental view history section
    else if (vkSource && vkSource.experimentalViewTracking && !options.isHighDynamics) {
      // Skip view history for non-high-dynamics posts
    }
    
    caption += `\n<a href="${post.originalPostUrl}">Смотреть оригинальный пост</a>`;

    // Add Telegram tag for the source at the bottom
    if (sourceName) {
      // Convert sourceName to a valid hashtag: remove spaces, non-alphanumeric, lowercase
      const tag = '#' + sourceName.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
      caption += `\n\n${tag}`;
    }
    
    let sentMessage;
    
    // Get all photo and video attachments
    const photoAttachments = post.attachments?.filter(att => att.type === 'photo' && att.url) || [];
    const videoAttachment = post.attachments?.find(att => att.type === 'video' && att.url);
    
    // If we have multiple photos, send them as a media group
    if (photoAttachments.length > 1) {
      try {
        // Prepare media group input
        const mediaGroup = photoAttachments.map((attachment, index) => ({
          type: 'photo',
          media: attachment.url,
          // Add caption only to the first media item
          ...(index === 0 ? { caption, parse_mode: 'HTML' } : {})
        }));
        
        // Send media group
        const sentMessages = await bot.sendMediaGroup(channel.chatId, mediaGroup);
        sentMessage = sentMessages[0]; // Use the first message for reference
      } catch (mediaGroupError) {
        // Fallback to sending just the first photo
        try {
          sentMessage = await bot.sendPhoto(
            channel.chatId,
            photoAttachments[0].url,
            {
              caption: caption,
              parse_mode: 'HTML'
            }
          );
        } catch (photoError) {
          // If that fails too, fall back to text message with links
          const photoLinks = photoAttachments.map((photo, idx) => 
            `<a href="${photo.url}">Фото ${idx + 1}</a>`).join('\n');
          sentMessage = await bot.sendMessage(
            channel.chatId,
            `${caption}\n\n${photoLinks}`,
            {
              parse_mode: 'HTML',
              disable_web_page_preview: false
            }
          );
        }
      }
    }
    // If we have a single photo attachment, send it as a photo with caption
    else if (photoAttachments.length === 1) {
      try {
        sentMessage = await bot.sendPhoto(
          channel.chatId,
          photoAttachments[0].url,
          {
            caption: caption,
            parse_mode: 'HTML'
          }
        );
      } catch (mediaError) {
        // Fallback to regular message if media sending fails
        sentMessage = await bot.sendMessage(
          channel.chatId, 
          `${caption}\n\n<a href="${photoAttachments[0].url}">Смотреть фото</a>`, 
          { 
            parse_mode: 'HTML',
            disable_web_page_preview: false
          }
        );
      }
    }
    // If we have a video attachment, send a video or link to it
    else if (videoAttachment) {
      try {
        // First, try with direct URL if available
        if (videoAttachment.directUrl && videoAttachment.directUrl.match(/\.(mp4|mov|avi|mkv)$/i)) {
          try {
            sentMessage = await bot.sendVideo(
              channel.chatId,
              videoAttachment.directUrl,
              {
                caption: caption,
                parse_mode: 'HTML',
                thumbnail: videoAttachment.thumbnailUrl,
                supports_streaming: true
              }
            );
          } catch (directVideoError) {
            throw directVideoError; // Let the next section handle it
          }
        } else {
          // If no direct URL available, try to extract video info from VK
          const videoIds = vkService.extractVideoIds(videoAttachment.url);
          
          if (videoIds) {
            try {
              // Get video URLs from VK API
              const videoData = await vkService.getVideoUrls(
                videoIds.ownerId, 
                videoIds.videoId
              );
              
              if (videoData.directUrl) {
                // We have a direct URL from the API, try to download and send it
                try {
                  // Download the video
                  const videoFilename = `vk_video_${videoIds.ownerId}_${videoIds.videoId}.mp4`;
                  const videoPath = await downloadVideo(videoData.directUrl, videoFilename);
                  
                  // Send the video to Telegram
                  sentMessage = await bot.sendVideo(
                    channel.chatId,
                    videoPath,
                    {
                      caption: caption,
                      parse_mode: 'HTML',
                      thumb: videoData.image,
                      duration: videoData.duration,
                      supports_streaming: true
                    }
                  );
                  
                  // Clean up the temporary file
                  cleanupTempFiles(videoPath);
                } catch (downloadError) {
                  throw downloadError; // Let the next section handle it
                }
              } else {
                throw new Error('No direct video URL found in API response');
              }
            } catch (videoApiError) {
              throw videoApiError; // Let the next section handle it
            }
          } else {
            throw new Error(`Could not extract video IDs from URL: ${videoAttachment.url}`);
          }
        }
      } catch (videoError) {
        
        // Fallback to regular message with video preview
        try {
          // Try to send with thumbnail and movie camera emoji
          const videoMessage = `${caption}\n\n🎬 <b>Видео доступно по ссылке:</b> <a href="${videoAttachment.url}">Смотреть в ВК</a>`;
          
          sentMessage = await bot.sendMessage(
            channel.chatId, 
            videoMessage, 
            { 
              parse_mode: 'HTML',
              disable_web_page_preview: false // Enable preview for the video
            }
          );
        } catch (fallbackError) {
          // Last resort - plain text with link
          sentMessage = await bot.sendMessage(
            channel.chatId, 
            `${caption}\n\n🎬 Видео: ${videoAttachment.url}`, 
            { 
              parse_mode: 'HTML',
              disable_web_page_preview: true
            }
          );
        }
      }
    }
    // Default case - no media or unsupported media type
    else {
      sentMessage = await bot.sendMessage(
        channel.chatId, 
        caption, 
        { 
          parse_mode: 'HTML',
          disable_web_page_preview: false // Enable preview for the original post link
        }
      );
    }
    
    // Update post in database
    post.status = 'forwarded';
    post.forwardedTo.push({
      telegramChannel: channel._id,
      telegramMessageId: sentMessage.message_id.toString()
    });
    
    await post.save();
    
    // Increment forwarded count on channel
    channel.postsForwarded += 1;
    await channel.save();
    
    // Log successful forwarding
    console.log(`✅ Message sent to ${channel.name || channel.chatId}`);
    
    // Update lastChecked timestamp on the source to prevent duplicate processing
    if (post.vkSource) {
      await VkSource.updateOne(
        { _id: post.vkSource },
        { $set: { 
          lastChecked: new Date(),
          updatedAt: new Date()
        }}
      );
    }
    
    return {
      success: true,
      telegramMessageId: sentMessage.message_id,
      channelId: channel._id
    };
  } catch (error) {
    console.error(`❌ Failed to send message to ${channel.name || channel.chatId}: ${error.message}`);
    throw error;
  }
};

/**
 * Processes approved posts for forwarding (manual approval workflow)
 * @returns {Promise<Object>} - Result of processing
 */
const processPendingPosts = async () => {
  try {
    // Get all approved viral posts that haven't been forwarded yet
    const approvedPosts = await Post.find({
      isViral: true,
      status: 'approved'
    }).populate('vkSource');
    
    // Filter out posts with deleted sources
    const validPosts = approvedPosts.filter(post => post.vkSource);
    
    if (validPosts.length < approvedPosts.length) {
      console.warn(`${approvedPosts.length - validPosts.length} posts skipped due to deleted sources`);
    }
    
    let forwardedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;
    
    // Track processed sources to update lastChecked just once per source
    const processedSources = new Set();
    
    // Process each post
    for (const post of validPosts) {
      // Find mappings for this post's source
      const mappings = await getAllMappingsForSource(post.vkSource._id.toString());
      
      // Filter out mappings with deleted channels (sources/groups are already validated in getAllMappingsForSource)
      const validMappings = mappings.filter(mapping => 
        mapping.telegramChannel && mapping.telegramChannel.active
      );
      
      if (validMappings.length === 0) {
        console.warn(`No valid mappings found for post ${post._id} with source ${post.vkSource._id}`);
        skippedCount++;
        continue;
      }
      
      // Forward to each mapped channel
      let postForwarded = false;
      for (const mapping of validMappings) {
        try {
          // Use the post's vkSource for forwarding (works for both individual and group mappings)
          await forwardPost(post, post.vkSource, mapping.telegramChannel);
          forwardedCount++;
          postForwarded = true;
        } catch (error) {
          console.error(`Error forwarding post ${post._id} to channel ${mapping.telegramChannel.chatId}:`, error);
          errorCount++;
        }
      }
      
      // Add the source ID to processed sources if at least one forward was successful
      if (postForwarded) {
        processedSources.add(post.vkSource._id.toString());
      }
    }
    
    // Update lastChecked for all processed sources that haven't been updated by forwardPost yet
    // This ensures the timestamp is updated even if some other error occurs after forwarding
    for (const sourceId of processedSources) {
      await VkSource.updateOne(
        { _id: sourceId },
        { $set: { 
          lastChecked: new Date(),
          updatedAt: new Date()
        }}
      );
    }
    
    return {
      processed: approvedPosts.length,
      valid: validPosts.length,
      skipped: skippedCount,
      forwarded: forwardedCount,
      errors: errorCount
    };
  } catch (error) {
    console.error('Error processing pending posts:', error);
    throw error;
  }
};

const { getAllMappingsForSource } = require('../../utils/mappingUtils');

module.exports = {
  init,
  forwardPost,
  processPendingPosts,
  getBot: () => bot
}; 