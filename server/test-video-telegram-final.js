// Load environment variables from the project root
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const TelegramBot = require('node-telegram-bot-api');

// Use token from environment variable
const token = process.env.TELEGRAM_BOT_TOKEN;
const testChannelUsername = '@newsChannelTest1';

// Check if Telegram Bot token is available
if (!token) {
  console.error('ERROR: TELEGRAM_BOT_TOKEN is not set in .env file');
  console.error('Please add your Telegram bot token to the .env file in the project root.');
  process.exit(1);
}

console.log('Using Telegram bot token from .env file (first few chars):', token.substring(0, 5) + '...');

// Initialize Telegram bot
const bot = new TelegramBot(token);

/**
 * Main function to test video sending directly from a URL
 */
async function testVideoSending() {
  try {
    // Get chat ID for the test channel
    const chatInfo = await bot.getChat(testChannelUsername);
    const chatId = chatInfo.id;
    
    console.log(`Found chat ID for ${testChannelUsername}: ${chatId}`);
    
    // URL of a small test video that Telegram can access directly
    // This is a short MP4 file from a public content delivery network
    const videoUrl = 'https://media.w3.org/2010/05/sintel/trailer.mp4';
    
    // Prepare caption
    const caption = '<b>Test Video Upload</b>\n\nThis is a test of direct video upload to Telegram.';
    
    // Send the video to Telegram using the URL directly
    console.log(`Sending video from URL: ${videoUrl}`);
    
    const result = await bot.sendVideo(chatId, videoUrl, {
      caption: caption,
      parse_mode: 'HTML',
      supports_streaming: true
    });
    
    console.log('Video sent successfully!');
    console.log(`Message ID: ${result.message_id}`);
    
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Error in test:', error);
    console.error(error.stack);
  }
}

// Run the test
testVideoSending(); 