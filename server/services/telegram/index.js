const TelegramBot = require('node-telegram-bot-api');
const VkSource = require('../../models/VkSource');
const TelegramChannel = require('../../models/TelegramChannel');
const Mapping = require('../../models/Mapping');
const Post = require('../../models/Post');
const vkService = require('../vk');

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
 * Forwards a post to a Telegram channel
 * @param {Object} post - Post document from database
 * @param {Object} channel - Telegram channel document from database
 * @returns {Promise<Object>} - Result of forwarding
 */
const forwardPost = async (post, channel) => {
  if (!bot) throw new Error('Telegram bot not initialized');
  
  try {
    // Prepare post message
    let message = `*${post.text ? post.text.substring(0, 200) + (post.text.length > 200 ? '...' : '') : 'New post'}*\n\n`;
    message += `👁 Views: *${post.viewCount.toLocaleString()}*\n`;
    message += `👍 Likes: ${post.likeCount.toLocaleString()}\n`;
    message += `🔄 Reposts: ${post.repostCount.toLocaleString()}\n\n`;
    message += `[View original post](${post.originalPostUrl})`;
    
    // Send message with markdown
    const sentMessage = await bot.sendMessage(
      channel.chatId, 
      message, 
      { 
        parse_mode: 'Markdown',
        disable_web_page_preview: false // Enable preview for the original post link
      }
    );
    
    // If post has photo attachments, send the first photo
    const photoAttachment = post.attachments?.find(att => att.type === 'photo');
    if (photoAttachment && photoAttachment.url) {
      await bot.sendPhoto(channel.chatId, photoAttachment.url);
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
    
    return {
      success: true,
      telegramMessageId: sentMessage.message_id,
      channelId: channel._id
    };
  } catch (error) {
    console.error(`Error forwarding post to Telegram channel ${channel.name}:`, error);
    throw error;
  }
};

/**
 * Processes pending posts for forwarding
 * @returns {Promise<Object>} - Result of processing
 */
const processPendingPosts = async () => {
  try {
    // Get all pending viral posts
    const pendingPosts = await Post.find({
      isViral: true,
      status: 'pending'
    });
    
    let forwardedCount = 0;
    let errorCount = 0;
    
    // Process each post
    for (const post of pendingPosts) {
      // Find mappings for this post's source
      const mappings = await Mapping.find({
        vkSource: post.vkSource,
        active: true
      }).populate('telegramChannel');
      
      // Forward to each mapped channel
      for (const mapping of mappings) {
        try {
          await forwardPost(post, mapping.telegramChannel);
          forwardedCount++;
        } catch (error) {
          console.error(`Error forwarding post ${post._id} to channel ${mapping.telegramChannel.chatId}:`, error);
          errorCount++;
        }
      }
    }
    
    return {
      processed: pendingPosts.length,
      forwarded: forwardedCount,
      errors: errorCount
    };
  } catch (error) {
    console.error('Error processing pending posts:', error);
    throw error;
  }
};

module.exports = {
  init,
  forwardPost,
  processPendingPosts,
  getBot: () => bot
}; 