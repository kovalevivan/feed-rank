// Load environment variables from the project root
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');

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

// Temporary directory for downloaded videos
const tempDir = os.tmpdir();

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
    timeout: 60000, // 60 seconds timeout
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
    
    // Sample publicly accessible video URL - a smaller Creative Commons video
    // Using a smaller sample to reduce download time
    const videoUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
    const videoFilename = 'test_video_small.mp4';
    
    // Download the video
    console.log(`Downloading test video from ${videoUrl}`);
    const videoPath = await downloadVideo(videoUrl, videoFilename);
    
    // Prepare caption
    const caption = '<b>Test Video</b>\n\nThis is a test of the direct video upload functionality.';
    
    // Send the video to Telegram
    console.log(`Sending video to Telegram channel ${chatId}`);
    await bot.sendVideo(chatId, videoPath, {
      caption: caption,
      parse_mode: 'HTML',
      supports_streaming: true
    });
    
    console.log('Video sent successfully!');
    
    // Clean up
    cleanupTempFiles(videoPath);
    
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Error in test:', error);
  }
}

// Run the test
testDirectVideoSending(); 