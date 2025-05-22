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
 * Format date in Russian style (DD.MM.YYYY, HH:MM)
 * @param {Date} date - Date to format
 * @returns {string} - Formatted date string
 */
function formatDate(date) {
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
}

/**
 * Main function to test date format in Telegram message
 */
async function testDateFormat() {
  try {
    // Get chat ID for the test channel
    const chatInfo = await bot.getChat(testChannelUsername);
    const chatId = chatInfo.id;
    
    console.log(`Found chat ID for ${testChannelUsername}: ${chatId}`);
    
    // Create a sample post with date
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Prepare caption with Russian date format
    const caption = `<b>Test Post Format</b>\n\n` +
                    `This is a test post to verify the date format.\n\n` +
                    `👁 Views: <b>1,234</b>\n` +
                    `👍 Likes: <b>123</b>\n` +
                    `🔄 Reposts: <b>45</b>\n` +
                    `📅 ${formatDate(yesterday)}\n\n` +
                    `<a href="https://example.com">View original post</a>`;
    
    // Send the message to Telegram
    console.log(`Sending test message with date format: ${formatDate(yesterday)}`);
    
    const result = await bot.sendMessage(chatId, caption, {
      parse_mode: 'HTML'
    });
    
    console.log('Message sent successfully!');
    console.log(`Message ID: ${result.message_id}`);
    
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Error in test:', error);
    console.error(error.stack);
  }
}

// Run the test
testDateFormat(); 