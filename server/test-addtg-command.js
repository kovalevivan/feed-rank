const dotenv = require('dotenv');
const path = require('path');
const TelegramChannel = require('./models/TelegramChannel');
const mongoose = require('mongoose');
const { VK } = require('vk-io');
const TelegramBot = require('node-telegram-bot-api');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// The channel ID to test
const channelInput = process.argv[2] || '-1002313558754';

console.log(`\n=== Testing Adding Telegram Channel: ${channelInput} ===\n`);

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/feedrank')
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Initialize bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

/**
 * Simulates the bot's /addtg command handler
 */
async function simulateAddTgCommand() {
  console.log('Simulating /addtg command for channel:', channelInput);
  
  try {
    // Check if it's a username (with @ prefix) or already a chat ID
    let channelChatId, channelUsername, channelName;
    
    if (channelInput.startsWith('@')) {
      // It's a username, try to resolve it
      channelUsername = channelInput;
      channelName = channelInput.substring(1); // Remove @ for the name
      
      console.log('Input is a username:', channelUsername);
      try {
        // Try to get chat info by username
        const chat = await bot.getChat(channelUsername);
        channelChatId = chat.id.toString();
        console.log('Resolved username to chatId:', channelChatId);
        
        // Use title if available
        if (chat.title) {
          channelName = chat.title;
          console.log('Using channel title as name:', channelName);
        }
      } catch (error) {
        console.error('Could not resolve channel by username:', error.message);
        return;
      }
    } else if (channelInput.startsWith('-100')) {
      // It's already a chat ID
      channelChatId = channelInput;
      channelName = `Channel ${channelInput}`;
      console.log('Input is already a chat ID:', channelChatId);
      
      // Try to get more info about the channel
      try {
        const chat = await bot.getChat(channelChatId);
        console.log('Retrieved chat info:', {
          title: chat.title,
          username: chat.username,
          id: chat.id
        });
        
        if (chat.title) {
          channelName = chat.title;
          console.log('Using channel title as name:', channelName);
        }
        if (chat.username) {
          channelUsername = '@' + chat.username;
          console.log('Using channel username:', channelUsername);
        }
      } catch (error) {
        console.error('Could not get additional info for channel:', error.message);
        console.log('Continuing with just the chat ID...');
      }
    } else {
      // Try to interpret as a chat ID with auto-correction
      if (channelInput.match(/^-?\d+$/)) {
        // It's numeric, assume it's a chat ID that might need the -100 prefix
        channelChatId = channelInput.startsWith('-') ? channelInput : `-100${channelInput}`;
        channelName = `Channel ${channelChatId}`;
        console.log('Input appears to be numeric, treating as chat ID with correction:', channelChatId);
        
        // Try to get more info
        try {
          const chat = await bot.getChat(channelChatId);
          console.log('Retrieved chat info:', {
            title: chat.title,
            username: chat.username,
            id: chat.id
          });
          
          if (chat.title) {
            channelName = chat.title;
            console.log('Using channel title as name:', channelName);
          }
          if (chat.username) {
            channelUsername = '@' + chat.username;
            console.log('Using channel username:', channelUsername);
          }
        } catch (error) {
          console.error('Could not retrieve channel info:', error.message);
          return;
        }
      } else {
        // Assume it's a channel name without @, try with @ prefix
        channelUsername = '@' + channelInput;
        channelName = channelInput;
        console.log('Input appears to be a channel name without @, adding prefix:', channelUsername);
        
        try {
          const chat = await bot.getChat(channelUsername);
          channelChatId = chat.id.toString();
          console.log('Resolved username to chatId:', channelChatId);
          
          if (chat.title) {
            channelName = chat.title;
            console.log('Using channel title as name:', channelName);
          }
        } catch (error) {
          console.error('Could not resolve channel by inferred username:', error.message);
          return;
        }
      }
    }
    
    console.log('\nChannel details resolved:');
    console.log('- Channel ID:', channelChatId);
    console.log('- Channel Name:', channelName);
    console.log('- Channel Username:', channelUsername || 'Not available');
    
    // Check if already exists
    const existingChannel = await TelegramChannel.findOne({ chatId: channelChatId });
    
    if (existingChannel) {
      console.log('⚠️ Channel already exists in database with ID:', existingChannel._id);
      return;
    }
    
    console.log('\nChannel is new, attempting to send test message...');
    
    // Create new channel
    const newChannel = new TelegramChannel({
      name: channelName,
      chatId: channelChatId,
      username: channelUsername
    });
    
    // Send test message to the channel
    try {
      const message = await bot.sendMessage(
        channelChatId,
        `✅ Successfully added to FeedRank!\n\nThis channel is now configured to receive viral posts from VK public groups.`
      );
      
      console.log('✅ Test message sent successfully!');
      console.log('- Message ID:', message.message_id);
      
      // All good, save the channel
      await newChannel.save();
      console.log('✅ Channel saved to database with ID:', newChannel._id);
      
    } catch (error) {
      console.error('❌ Could not send test message:', error.message);
      console.log('The bot likely does not have permission to post in this channel');
      console.log('Please make sure the bot is an admin with "Post Messages" permission');
    }
  } catch (error) {
    console.error('❌ Error during command simulation:', error);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the simulation
simulateAddTgCommand().catch(console.error); 