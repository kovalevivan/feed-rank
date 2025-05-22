// Load environment variables from the project root
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const { VK } = require('vk-io');

// Use token from environment variable
const token = process.env.TELEGRAM_BOT_TOKEN;
const vkToken = process.env.VK_ACCESS_TOKEN;

// Check if Telegram Bot token is available
if (!token) {
  console.error('ERROR: TELEGRAM_BOT_TOKEN is not set in .env file');
  console.error('Please add your Telegram bot token to the .env file in the project root.');
  process.exit(1);
}

// Check if VK API token is available
if (!vkToken) {
  console.error('ERROR: VK_ACCESS_TOKEN is not set in .env file');
  console.error('Please add your VK access token to the .env file in the project root.');
  process.exit(1);
}

console.log('Using Telegram bot token from .env file (first few chars):', token.substring(0, 5) + '...');

// Initialize Telegram bot
const bot = new TelegramBot(token);

// Initialize VK API client
const vk = new VK({
  token: vkToken
});

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

/**
 * Extract video information from VK API
 */
async function getVkVideoInfo(videoOwnerID, videoID) {
  try {
    console.log(`Fetching video info for video${videoOwnerID}_${videoID}`);
    const response = await vk.api.video.get({
      videos: `${videoOwnerID}_${videoID}`,
      extended: 1
    });

    if (!response.items || response.items.length === 0) {
      throw new Error('Video not found');
    }

    const videoInfo = response.items[0];
    console.log('Video info retrieved:', {
      title: videoInfo.title,
      duration: videoInfo.duration,
      player: !!videoInfo.player,
      files: Object.keys(videoInfo.files || {})
    });

    return videoInfo;
  } catch (error) {
    console.error('Error fetching VK video info:', error);
    throw error;
  }
}

async function run() {
  try {
    // Channel username to send to
    const channelUsername = '@newsChannelTest1';
    console.log(`Testing with channel: ${channelUsername}`);
    
    // Try to get chat info
    const chatInfo = await bot.getChat(channelUsername);
    console.log('Chat info retrieved:', chatInfo.title, chatInfo.id);
    
    // Parse VK video URL
    const vkVideoUrl = 'https://vk.com/video-158663270_456303633';
    const videoMatch = vkVideoUrl.match(/video(-?\d+)_(\d+)/);
    
    if (!videoMatch) {
      console.error('Invalid VK video URL format');
      process.exit(1);
    }
    
    const [, ownerID, videoID] = videoMatch;
    console.log(`Parsed video owner ID: ${ownerID}, video ID: ${videoID}`);
    
    // Get video info from VK API
    const videoInfo = await getVkVideoInfo(ownerID, videoID);
    
    // Create a mock post
    const post = {
      text: "This is a test post for video forwarding from VK to Telegram.",
      viewCount: 15000,
      likeCount: 500,
      repostCount: 100,
      publishedAt: new Date(),
      originalPostUrl: `https://vk.com/wall${ownerID}_${Date.now()}`
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
    
    // Method 1: Try to send video directly using the player URL
    console.log('\n=== Method 1: Using VK player URL ===');
    if (videoInfo.player) {
      try {
        console.log(`Sending video using player URL: ${videoInfo.player}`);
        const message1 = await bot.sendVideo(
          chatInfo.id,
          videoInfo.player,
          {
            caption: `${caption}\n\nMethod 1: Using VK player URL`,
            parse_mode: 'HTML',
          }
        );
        console.log('Success! Message ID:', message1.message_id);
      } catch (error) {
        console.error('Method 1 failed:', error.message);
      }
    } else {
      console.log('No player URL available, skipping Method 1');
    }
    
    // Method 2: Try to send video using a direct MP4 URL if available
    console.log('\n=== Method 2: Using direct MP4 URL ===');
    if (videoInfo.files) {
      const videoQualities = ['mp4_1080', 'mp4_720', 'mp4_480', 'mp4_360', 'mp4_240'];
      let directUrl = null;
      
      // Get the highest quality available
      for (const quality of videoQualities) {
        if (videoInfo.files[quality]) {
          directUrl = videoInfo.files[quality];
          console.log(`Found ${quality} URL: ${directUrl}`);
          break;
        }
      }
      
      if (directUrl) {
        try {
          console.log(`Sending video using direct URL: ${directUrl}`);
          const message2 = await bot.sendVideo(
            chatInfo.id,
            directUrl,
            {
              caption: `${caption}\n\nMethod 2: Using direct MP4 URL`,
              parse_mode: 'HTML',
              supports_streaming: true
            }
          );
          console.log('Success! Message ID:', message2.message_id);
        } catch (error) {
          console.error('Method 2 failed:', error.message);
        }
      } else {
        console.log('No direct MP4 URL available, skipping Method 2');
      }
    } else {
      console.log('No video files information available, skipping Method 2');
    }
    
    // Method 3: Try to send video using the original VK video URL
    console.log('\n=== Method 3: Using original VK video URL ===');
    try {
      console.log(`Sending video using original URL: ${vkVideoUrl}`);
      const message3 = await bot.sendVideo(
        chatInfo.id,
        vkVideoUrl,
        {
          caption: `${caption}\n\nMethod 3: Using original VK video URL`,
          parse_mode: 'HTML',
          supports_streaming: true
        }
      );
      console.log('Success! Message ID:', message3.message_id);
    } catch (error) {
      console.error('Method 3 failed:', error.message);
      
      // Fallback to sending thumbnail with a link
      console.log('\n=== Fallback: Sending thumbnail with a link ===');
      const thumbnailUrl = videoInfo.image ? 
        videoInfo.image[videoInfo.image.length - 1].url : 
        'https://i.imgur.com/HmXUFX0.jpg';
      
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