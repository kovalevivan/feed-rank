// Load environment variables from the project root
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const TelegramBot = require('node-telegram-bot-api');

// Use token from environment variable
const token = process.env.TELEGRAM_BOT_TOKEN;

// Check if Telegram Bot token is available
if (!token) {
  console.error('ERROR: TELEGRAM_BOT_TOKEN is not set in .env file');
  console.error('Please add your Telegram bot token to the .env file in the project root.');
  process.exit(1);
}

console.log('Using Telegram bot token from .env file (first few chars):', token.substring(0, 5) + '...');

// Initialize Telegram bot
const bot = new TelegramBot(token);

// Format the date
const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleString('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
};

// Escape HTML characters
const escapeHtml = (text) => {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

async function run() {
  try {
    // Channel username to send to
    const channelUsername = '@newsChannelTest1';
    console.log(`Testing with channel: ${channelUsername}`);
    
    // Try to get chat info
    const chatInfo = await bot.getChat(channelUsername);
    console.log('Chat info retrieved:', chatInfo.title, chatInfo.id);
    
    // VK video URL
    const vkVideoUrl = 'https://vk.com/video-158663270_456303633';
    console.log(`Using VK video URL: ${vkVideoUrl}`);
    
    // Imgur direct video URL (since we can't access the VK direct URL without proper permissions)
    // This is a public sample video that should be accessible
    const directVideoUrl = 'https://i.imgur.com/xITM4Pf.mp4';
    console.log(`Using direct video URL from Imgur: ${directVideoUrl}`);
    
    // Create a mock post
    const post = {
      text: "This is a test post for video forwarding from VK to Telegram.",
      viewCount: 15000,
      likeCount: 500,
      repostCount: 100,
      publishedAt: new Date(),
      originalPostUrl: 'https://vk.com/wall-158663270_1249747'
    };
    
    // Prepare caption with HTML formatting
    let caption = `<b>From VK group: bez_cenznn</b>\n\n`;
    caption += `${escapeHtml(post.text)}\n\n`;
    caption += `👁 Views: <b>${post.viewCount.toLocaleString()}</b>\n`;
    caption += `👍 Likes: ${post.likeCount.toLocaleString()}\n`;
    caption += `🔄 Reposts: ${post.repostCount.toLocaleString()}\n`;
    caption += `📅 Published: <i>${formatDate(post.publishedAt)}</i>\n\n`;
    caption += `<a href="${post.originalPostUrl}">View original post</a>`;
    
    console.log('Caption prepared');
    
    // Test 1: Try sending the direct video URL from Imgur
    console.log('\n=== Test 1: Sending using direct MP4 URL from Imgur ===');
    try {
      console.log(`Sending video using direct URL: ${directVideoUrl}`);
      const message1 = await bot.sendVideo(
        chatInfo.id,
        directVideoUrl,
        {
          caption: `${caption}\n\nTest 1: Using direct MP4 URL from Imgur`,
          parse_mode: 'HTML',
          supports_streaming: true
        }
      );
      console.log('Success! Message ID:', message1.message_id);
    } catch (error) {
      console.error('Test 1 failed:', error.message);
    }
    
    // Test 2: Try sending using the VK video URL directly
    console.log('\n=== Test 2: Sending using VK video URL ===');
    try {
      console.log(`Sending video using VK URL: ${vkVideoUrl}`);
      const message2 = await bot.sendVideo(
        chatInfo.id,
        vkVideoUrl,
        {
          caption: `${caption}\n\nTest 2: Using VK video URL directly`,
          parse_mode: 'HTML',
          supports_streaming: true
        }
      );
      console.log('Success! Message ID:', message2.message_id);
    } catch (error) {
      console.error('Test 2 failed:', error.message);
      
      // Fallback: Send the video URL as a link with a thumbnail
      console.log('\n=== Fallback: Sending thumbnail with link ===');
      const thumbnailUrl = 'https://i.imgur.com/HmXUFX0.jpg'; // A reliable image that Telegram can access
      
      try {
        console.log(`Sending thumbnail with link: ${thumbnailUrl}`);
        const fallbackMessage = await bot.sendPhoto(
          chatInfo.id,
          thumbnailUrl,
          {
            caption: `${caption}\n\n<b>🎬 Video available at:</b> <a href="${vkVideoUrl}">Watch video</a>`,
            parse_mode: 'HTML'
          }
        );
        console.log('Fallback successful! Message ID:', fallbackMessage.message_id);
      } catch (fallbackError) {
        console.error('Fallback method failed:', fallbackError.message);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

run(); 