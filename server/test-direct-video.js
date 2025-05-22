// Load environment variables from the project root
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { VK } = require('vk-io');
const os = require('os');

// Use token from environment variable
const token = process.env.TELEGRAM_BOT_TOKEN;
const vkToken = process.env.VK_ACCESS_TOKEN;
const testChannelUsername = '@newsChannelTest1';

// Check if Telegram Bot token is available
if (!token) {
  console.error('ERROR: TELEGRAM_BOT_TOKEN is not set in .env file');
  console.error('Please add your Telegram bot token to the .env file in the project root.');
  process.exit(1);
}

// Check if VK token is available
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

// Temporary directory for downloaded videos
const tempDir = os.tmpdir();

/**
 * Extract video URLs from a VK video attachment
 * @param {string} ownerId - Video owner ID
 * @param {string} videoId - Video ID
 * @param {string} accessKey - Access key (optional)
 * @returns {Promise<Object>} - Object with video URLs
 */
async function getVideoUrls(ownerId, videoId, accessKey) {
  try {
    // Request video data from VK API
    const response = await vk.api.video.get({
      videos: `${ownerId}_${videoId}${accessKey ? '_' + accessKey : ''}`,
      extended: 1
    });

    if (!response.items || response.items.length === 0) {
      throw new Error('No video data returned from VK API');
    }

    const videoData = response.items[0];
    console.log('Video data:', JSON.stringify(videoData, null, 2));

    // Extract player URL and direct URLs if available
    return {
      title: videoData.title || 'VK Video',
      duration: videoData.duration || 0,
      playerUrl: videoData.player,
      files: videoData.files || {},
      image: videoData.image && videoData.image.length > 0 
        ? videoData.image[videoData.image.length - 1].url 
        : null
    };
  } catch (error) {
    console.error('Error getting video URLs:', error);
    throw error;
  }
}

/**
 * Extract direct video URL from VK player page or response
 * @param {Object} videoData - Video data from VK API
 * @returns {Promise<string|null>} - Best direct video URL or null
 */
async function extractDirectVideoUrl(videoData) {
  // First, check if we have direct URLs in the files property
  if (videoData.files) {
    // VK provides multiple quality options, we'll try to get the highest quality
    const qualities = ['mp4_1080', 'mp4_720', 'mp4_480', 'mp4_360', 'mp4_240'];
    
    for (const quality of qualities) {
      if (videoData.files[quality]) {
        console.log(`Found direct ${quality} URL:`, videoData.files[quality]);
        return videoData.files[quality];
      }
    }
  }

  // If no direct URLs found, try to extract from player page
  if (videoData.playerUrl) {
    try {
      console.log('Trying to extract from player URL:', videoData.playerUrl);
      const response = await axios.get(videoData.playerUrl);
      
      // Look for direct video URL in the player page HTML
      const html = response.data;
      const urlMatch = html.match(/https:\/\/[^"']+\.mp4[^"']*/);
      
      if (urlMatch) {
        console.log('Extracted video URL from player page:', urlMatch[0]);
        return urlMatch[0];
      }
    } catch (error) {
      console.error('Error extracting from player page:', error);
    }
  }
  
  console.log('No direct video URL found');
  return null;
}

/**
 * Download a video file from a URL
 * @param {string} url - Video URL
 * @param {string} filename - Output filename
 * @returns {Promise<string>} - Path to downloaded file
 */
async function downloadVideo(url, filename) {
  const outputPath = path.join(tempDir, filename);
  
  console.log(`Downloading video from ${url} to ${outputPath}`);
  
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
        console.log(`Video downloaded successfully to ${outputPath}`);
        resolve(outputPath);
      }
    });
  });
}

/**
 * Send a video to Telegram
 * @param {string} chatId - Telegram chat ID
 * @param {string} videoPath - Path to video file
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} - Telegram API response
 */
async function sendVideoToTelegram(chatId, videoPath, options = {}) {
  console.log(`Sending video to Telegram chat ${chatId}`);
  
  const defaultOptions = {
    caption: 'Test video from VK',
    parse_mode: 'HTML',
    supports_streaming: true
  };
  
  const mergedOptions = { ...defaultOptions, ...options };
  
  try {
    const result = await bot.sendVideo(chatId, videoPath, mergedOptions);
    console.log('Video sent successfully!');
    return result;
  } catch (error) {
    console.error('Error sending video to Telegram:', error);
    throw error;
  }
}

/**
 * Clean up temporary files
 * @param {string} filePath - Path to file to delete
 */
function cleanupTempFiles(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Deleted temporary file: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error deleting temporary file ${filePath}:`, error);
  }
}

/**
 * Main function to test video sending
 */
async function testDirectVideoSending() {
  try {
    // Get chat ID for the test channel
    const chatInfo = await bot.getChat(testChannelUsername);
    const chatId = chatInfo.id;
    
    console.log(`Found chat ID for ${testChannelUsername}: ${chatId}`);
    
    // Example VK video: replace with a real video ID from VK
    // Format: owner_id_video_id
    const videoUrl = 'https://vk.com/video-76982440_456240081';
    
    // Extract owner and video IDs from URL
    const videoRegex = /video(-?\d+)_(\d+)/;
    const videoMatch = videoUrl.match(videoRegex);
    
    if (!videoMatch) {
      throw new Error('Invalid VK video URL format');
    }
    
    const ownerId = videoMatch[1];
    const videoId = videoMatch[2];
    
    console.log(`Extracting video data for owner ID ${ownerId}, video ID ${videoId}`);
    
    // Get video data from VK
    const videoData = await getVideoUrls(ownerId, videoId);
    
    // Try to get a direct video URL
    const directVideoUrl = await extractDirectVideoUrl(videoData);
    
    if (!directVideoUrl) {
      throw new Error('Could not find a direct video URL');
    }
    
    // Download the video
    const videoFilename = `vk_video_${videoId}.mp4`;
    const videoPath = await downloadVideo(directVideoUrl, videoFilename);
    
    // Prepare caption
    const caption = `<b>Test Video from VK</b>\n\n` +
                    `Title: <b>${videoData.title}</b>\n` +
                    `Duration: ${Math.floor(videoData.duration / 60)}:${(videoData.duration % 60).toString().padStart(2, '0')}\n\n` +
                    `<a href="${videoUrl}">View original on VK</a>`;
    
    // Send to Telegram
    await sendVideoToTelegram(chatId, videoPath, {
      caption,
      thumb: videoData.image,
      duration: videoData.duration
    });
    
    // Clean up
    cleanupTempFiles(videoPath);
    
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Error in test:', error);
  }
}

// Run the test
testDirectVideoSending(); 