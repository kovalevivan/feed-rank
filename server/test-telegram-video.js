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

// Initialize bot
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
    
    // Create a mock post with video data
    const post = {
      text: "This is a test post for video forwarding from VK to Telegram.",
      viewCount: 15000,
      likeCount: 500,
      repostCount: 100,
      publishedAt: new Date(),
      originalPostUrl: 'https://vk.com/wall-158663270_1249747'
    };
    
    // Video attachment info (from the specific VK post)
    const videoAttachment = {
      type: 'video',
      url: 'https://vk.com/video-158663270_456303633',
      thumbnailUrl: 'https://i.imgur.com/HmXUFX0.jpg'
    };
    
    // Prepare caption with HTML formatting
    let caption = `<b>From VK group: bez_cenznn</b>\n\n`;
    caption += `${escapeHtml(post.text)}\n\n`;
    caption += `👁 Views: <b>${post.viewCount.toLocaleString()}</b>\n`;
    caption += `👍 Likes: ${post.likeCount.toLocaleString()}\n`;
    caption += `🔄 Reposts: ${post.repostCount.toLocaleString()}\n`;
    caption += `📅 Published: <i>${formatDate(post.publishedAt)}</i>\n\n`;
    caption += `<a href="${post.originalPostUrl}">View original post</a>`;
    
    console.log('Caption prepared:', caption);
    console.log('Video attachment:', videoAttachment);
    
    // Send the video attachment as a photo with caption
    console.log('Sending video thumbnail as photo with video link...');
    const sentMessage = await bot.sendPhoto(
      chatInfo.id,
      videoAttachment.thumbnailUrl,
      {
        caption: `${caption}\n\n<b>🎬 Video available at:</b> <a href="${videoAttachment.url}">Watch video</a>`,
        parse_mode: 'HTML'
      }
    );
    
    console.log('Message sent successfully!');
    console.log('Message ID:', sentMessage.message_id);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

run(); 