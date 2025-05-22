// Load environment variables from the project root
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');

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

/**
 * Forward a post to a Telegram channel
 * Simplified version of the service's forwardPost function
 */
async function forwardPost(post, channel) {
  try {
    // Get VK source name
    const sourceName = post.sourceName || 'bez_cenznn';
    
    // Prepare post caption with HTML formatting
    let caption = `<b>From VK group: ${escapeHtml(sourceName)}</b>\n\n`;
    caption += `${escapeHtml(post.text)}\n\n`;
    caption += `👁 Views: <b>${post.viewCount.toLocaleString()}</b>\n`;
    caption += `👍 Likes: <b>${post.likeCount.toLocaleString()}</b>\n`;
    caption += `🔄 Reposts: <b>${post.repostCount.toLocaleString()}</b>\n`;
    caption += post.publishedAt ? `📅 Published: <i>${formatDate(post.publishedAt)}</i>\n\n` : '\n';
    caption += `<a href="${post.originalPostUrl}">View original post</a>`;
    
    let sentMessage;
    
    // Get all photo and video attachments
    const photoAttachments = post.attachments?.filter(att => att.type === 'photo' && att.url) || [];
    const videoAttachment = post.attachments?.find(att => att.type === 'video' && att.url);
    
    // If we have multiple photos, send them as a media group
    if (photoAttachments.length > 1) {
      try {
        // Prepare media group input
        const mediaGroup = photoAttachments.map((attachment, index) => ({
          type: 'photo',
          media: attachment.url,
          // Add caption only to the first media item
          ...(index === 0 ? { caption, parse_mode: 'HTML' } : {})
        }));
        
        // Send media group
        console.log('Sending multiple photos as media group');
        const sentMessages = await bot.sendMediaGroup(channel.chatId, mediaGroup);
        sentMessage = sentMessages[0]; // Use the first message for reference
        console.log('Successfully sent photo media group');
      } catch (mediaGroupError) {
        console.error(`Error sending media group:`, mediaGroupError);
        // Fallback to sending just the first photo
        try {
          console.log('Falling back to sending just the first photo');
          sentMessage = await bot.sendPhoto(
            channel.chatId,
            photoAttachments[0].url,
            {
              caption: caption,
              parse_mode: 'HTML'
            }
          );
          console.log('Successfully sent single photo');
        } catch (photoError) {
          // If that fails too, fall back to text message with links
          console.error(`Error sending single photo:`, photoError);
          const photoLinks = photoAttachments.map((photo, idx) => 
            `<a href="${photo.url}">Photo ${idx + 1}</a>`).join('\n');
          sentMessage = await bot.sendMessage(
            channel.chatId,
            `${caption}\n\n${photoLinks}`,
            {
              parse_mode: 'HTML',
              disable_web_page_preview: false
            }
          );
          console.log('Successfully sent message with photo links');
        }
      }
    }
    // If we have a single photo attachment, send it as a photo with caption
    else if (photoAttachments.length === 1) {
      try {
        console.log('Sending single photo');
        sentMessage = await bot.sendPhoto(
          channel.chatId,
          photoAttachments[0].url,
          {
            caption: caption,
            parse_mode: 'HTML'
          }
        );
        console.log('Successfully sent photo');
      } catch (mediaError) {
        console.error(`Error sending photo:`, mediaError);
        // Fallback to regular message if media sending fails
        sentMessage = await bot.sendMessage(
          channel.chatId, 
          `${caption}\n\n<a href="${photoAttachments[0].url}">View photo</a>`, 
          { 
            parse_mode: 'HTML',
            disable_web_page_preview: false
          }
        );
        console.log('Successfully sent message with photo link');
      }
    }
    // If we have a video attachment, send a video or link to it
    else if (videoAttachment) {
      try {
        // First, try with direct URL if available
        if (videoAttachment.directUrl && videoAttachment.directUrl.match(/\.(mp4|mov|avi|mkv)$/i)) {
          console.log(`Attempting to send video with direct URL: ${videoAttachment.directUrl}`);
          try {
            sentMessage = await bot.sendVideo(
              channel.chatId,
              videoAttachment.directUrl,
              {
                caption: caption,
                parse_mode: 'HTML',
                thumbnail: videoAttachment.thumbnailUrl,
                supports_streaming: true
              }
            );
            console.log('Successfully sent video using direct URL');
          } catch (directUrlError) {
            console.error(`Failed to send video with direct URL: ${directUrlError.message}`);
            throw directUrlError; // Proceed to next attempt
          }
        } 
        // Then try with VK video URL
        else if (videoAttachment.url && videoAttachment.url.includes('vk.com/video')) {
          console.log(`Attempting to send VK video URL: ${videoAttachment.url}`);
          try {
            sentMessage = await bot.sendVideo(
              channel.chatId,
              videoAttachment.url,
              {
                caption: caption,
                parse_mode: 'HTML',
                thumbnail: videoAttachment.thumbnailUrl,
                supports_streaming: true
              }
            );
            console.log('Successfully sent video using VK URL');
          } catch (vkUrlError) {
            console.error(`Failed to send video with VK URL: ${vkUrlError.message}`);
            throw vkUrlError; // Proceed to fallback
          }
        }
        // Finally try with any other video URL
        else if (videoAttachment.url) {
          console.log(`Attempting to send video with URL: ${videoAttachment.url}`);
          try {
            sentMessage = await bot.sendVideo(
              channel.chatId,
              videoAttachment.url,
              {
                caption: caption,
                parse_mode: 'HTML',
                thumbnail: videoAttachment.thumbnailUrl,
                supports_streaming: true
              }
            );
            console.log('Successfully sent video using URL');
          } catch (urlError) {
            console.error(`Failed to send video with URL: ${urlError.message}`);
            throw urlError; // Proceed to fallback
          }
        }
        // If we get here with no sentMessage, we haven't been able to send the video directly
        if (!sentMessage) {
          throw new Error('No suitable video URL found');
        }
      } catch (videoError) {
        // All video sending attempts failed, fall back to sending thumbnail with link
        console.log(`Falling back to thumbnail with link due to error: ${videoError.message}`);
        
        if (videoAttachment.thumbnailUrl) {
          try {
            console.log(`Sending thumbnail with link: ${videoAttachment.thumbnailUrl}`);
            sentMessage = await bot.sendPhoto(
              channel.chatId,
              videoAttachment.thumbnailUrl,
              {
                caption: `${caption}\n\n<b>🎬 Video available at:</b> <a href="${videoAttachment.url}">Watch video</a>`,
                parse_mode: 'HTML'
              }
            );
            console.log('Successfully sent thumbnail with video link');
          } catch (thumbnailError) {
            console.error(`Failed to send thumbnail: ${thumbnailError.message}`);
            // Final fallback - just send a message with the link
            sentMessage = await bot.sendMessage(
              channel.chatId, 
              `${caption}\n\n<b>🎬 Video available at:</b> <a href="${videoAttachment.url}">Watch video</a>`, 
              { 
                parse_mode: 'HTML',
                disable_web_page_preview: false
              }
            );
            console.log('Successfully sent message with video link');
          }
        } else {
          // No thumbnail, just send the message with a link
          sentMessage = await bot.sendMessage(
            channel.chatId, 
            `${caption}\n\n<b>🎬 Video available at:</b> <a href="${videoAttachment.url}">Watch video</a>`, 
            { 
              parse_mode: 'HTML',
              disable_web_page_preview: false
            }
          );
          console.log('Successfully sent message with video link');
        }
      }
    }
    // Default case - no media or unsupported media type
    else {
      console.log('Sending text-only message');
      sentMessage = await bot.sendMessage(
        channel.chatId, 
        caption, 
        { 
          parse_mode: 'HTML',
          disable_web_page_preview: false // Enable preview for the original post link
        }
      );
      console.log('Successfully sent text message');
    }
    
    return {
      success: true,
      telegramMessageId: sentMessage.message_id,
      channelId: channel._id
    };
  } catch (error) {
    console.error(`Error forwarding post to Telegram channel ${channel.name || channel.chatId}:`, error);
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
    
    // Create a mock channel
    const channel = {
      _id: new mongoose.Types.ObjectId(),
      name: chatInfo.title,
      chatId: chatInfo.id.toString(),
      username: channelUsername
    };
    
    // Test cases - each is a post we'll try to forward
    const testCases = [
      {
        name: 'Video Post',
        data: {
          _id: new mongoose.Types.ObjectId(),
          text: "This is a test post with a video attachment from VK.",
          sourceName: 'bez_cenznn',
          viewCount: 15000,
          likeCount: 500,
          repostCount: 100,
          publishedAt: new Date(),
          originalPostUrl: 'https://vk.com/wall-158663270_1249747',
          attachments: [
            {
              type: 'video',
              url: 'https://vk.com/video-158663270_456303633',
              thumbnailUrl: 'https://i.imgur.com/HmXUFX0.jpg'
            }
          ]
        }
      },
      {
        name: 'Photo Post',
        data: {
          _id: new mongoose.Types.ObjectId(),
          text: "This is a test post with a photo attachment.",
          sourceName: 'bez_cenznn',
          viewCount: 12000,
          likeCount: 450,
          repostCount: 80,
          publishedAt: new Date(),
          originalPostUrl: 'https://vk.com/wall-158663270_1249746',
          attachments: [
            {
              type: 'photo',
              url: 'https://i.imgur.com/f5HIjU0.jpg'
            }
          ]
        }
      },
      {
        name: 'Multiple Photos Post',
        data: {
          _id: new mongoose.Types.ObjectId(),
          text: "This is a test post with multiple photo attachments.",
          sourceName: 'bez_cenznn',
          viewCount: 10000,
          likeCount: 400,
          repostCount: 60,
          publishedAt: new Date(),
          originalPostUrl: 'https://vk.com/wall-158663270_1249745',
          attachments: [
            {
              type: 'photo',
              url: 'https://i.imgur.com/f5HIjU0.jpg'
            },
            {
              type: 'photo',
              url: 'https://i.imgur.com/HmXUFX0.jpg'
            },
            {
              type: 'photo',
              url: 'https://i.imgur.com/BxJH6qr.jpg'
            }
          ]
        }
      },
      {
        name: 'Text Only Post',
        data: {
          _id: new mongoose.Types.ObjectId(),
          text: "This is a test post with text only, no attachments.",
          sourceName: 'bez_cenznn',
          viewCount: 8000,
          likeCount: 300,
          repostCount: 40,
          publishedAt: new Date(),
          originalPostUrl: 'https://vk.com/wall-158663270_1249744'
        }
      },
      {
        name: 'Direct Video URL Post',
        data: {
          _id: new mongoose.Types.ObjectId(),
          text: "This is a test post with a direct video URL (not from VK).",
          sourceName: 'bez_cenznn',
          viewCount: 20000,
          likeCount: 600,
          repostCount: 120,
          publishedAt: new Date(),
          originalPostUrl: 'https://vk.com/wall-158663270_1249743',
          attachments: [
            {
              type: 'video',
              url: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
              directUrl: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
              thumbnailUrl: 'https://i.imgur.com/HmXUFX0.jpg'
            }
          ]
        }
      }
    ];
    
    // Process each test case
    for (const [index, testCase] of testCases.entries()) {
      console.log(`\n=== Test Case ${index + 1}: ${testCase.name} ===`);
      
      try {
        // Forward the post
        console.log(`Forwarding post to ${channel.name}...`);
        const result = await forwardPost(testCase.data, channel);
        
        console.log('Post forwarded successfully!');
        console.log('Result:', result);
      } catch (error) {
        console.error(`Error forwarding post for test case "${testCase.name}":`, error);
      }
      
      // Add a small delay between posts to avoid rate limiting
      if (index < testCases.length - 1) {
        console.log('Waiting 3 seconds before next test case...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

run(); 