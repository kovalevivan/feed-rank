const dotenv = require('dotenv');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Parse command line arguments
const channelId = process.argv[2] || '-1002313558754'; // Default to the problematic channel ID

console.log(`\n=== Telegram Channel Test for ${channelId} ===\n`);

// Check if TELEGRAM_BOT_TOKEN is set
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('Error: TELEGRAM_BOT_TOKEN is not set in .env file');
  process.exit(1);
}

console.log('TELEGRAM_BOT_TOKEN is set. Creating bot instance...');

// Initialize bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

async function runTests() {
  try {
    console.log('Getting chat information...');
    
    try {
      const chat = await bot.getChat(channelId);
      console.log('✅ Successfully retrieved chat info:');
      console.log('- Title:', chat.title || 'N/A');
      console.log('- Type:', chat.type || 'N/A');
      console.log('- Username:', chat.username || 'N/A');
      console.log('- ID:', chat.id);
      
      // Check bot permissions
      try {
        console.log('\nChecking bot permissions...');
        const chatMember = await bot.getChatMember(channelId, bot.options.username);
        console.log('✅ Bot status in the channel:', chatMember.status);
        
        if (chatMember.status === 'administrator') {
          console.log('✅ Bot is an administrator of the channel');
          console.log('- Can post messages:', chatMember.can_post_messages ? 'Yes' : 'No');
          console.log('- Can edit messages:', chatMember.can_edit_messages ? 'Yes' : 'No');
          console.log('- Can delete messages:', chatMember.can_delete_messages ? 'Yes' : 'No');
        } else {
          console.log('❌ Bot is NOT an administrator of the channel');
          console.log('For the bot to work properly, it must be an admin with permission to post messages');
        }
      } catch (error) {
        console.error('❌ Could not check bot permissions:', error.message);
      }
      
      // Try to send a test message
      console.log('\nTrying to send a test message...');
      try {
        const message = await bot.sendMessage(
          channelId,
          `🧪 Test message from FeedRank\n\nThis is a test message sent at ${new Date().toLocaleString()}`
        );
        console.log('✅ Test message sent successfully!');
        console.log('- Message ID:', message.message_id);
        
        // Try to delete it after 2 seconds
        setTimeout(async () => {
          try {
            await bot.deleteMessage(channelId, message.message_id);
            console.log('✅ Test message deleted successfully');
          } catch (error) {
            console.error('❌ Could not delete test message:', error.message);
          }
        }, 2000);
      } catch (error) {
        console.error('❌ Failed to send test message:', error.message);
        console.log('This is likely because the bot does not have permission to post messages in this channel');
        console.log('Please add the bot as an administrator with "Post Messages" permission');
      }
    } catch (error) {
      console.error('❌ Could not get chat information:', error.message);
      console.log('Possible reasons:');
      console.log('1. The channel ID is incorrect');
      console.log('2. The bot is not a member of the channel');
      console.log('3. The bot token is invalid');
    }
  } catch (error) {
    console.error('❌ Error during test:', error.message);
  }
}

console.log(`Using bot token: ${process.env.TELEGRAM_BOT_TOKEN.substring(0, 10)}...`);
runTests().catch(console.error); 