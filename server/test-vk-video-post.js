const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');
const { VK } = require('vk-io');
const TelegramBot = require('node-telegram-bot-api');
const Post = require('./models/Post');
const VkSource = require('./models/VkSource');
const TelegramChannel = require('./models/TelegramChannel');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Check for required environment variables
if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error('Error: TELEGRAM_BOT_TOKEN is not set in .env file');
  process.exit(1);
}

if (!process.env.VK_ACCESS_TOKEN) {
  console.error('Error: VK_ACCESS_TOKEN is not set in .env file');
  process.exit(1);
}

// Initialize VK API client
const vk = new VK({
  token: process.env.VK_ACCESS_TOKEN
});

// Initialize Telegram bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);

// Connect to MongoDB
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/feedrank';
console.log('Connecting to MongoDB with URI:', mongoURI.replace(/\/\/[^:]+:[^@]+@/, '//****:****@'));

const mongooseOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 15000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 30000,
  directConnection: true
};

async function forwardPost(post, channel) {
  if (!bot) throw new Error('Telegram bot not initialized');
  
  // Validate required parameters
  if (!post) throw new Error('Post object is required');
  if (!channel) throw new Error('Channel object is required');
  if (!channel.chatId) throw new Error('Channel must have a valid chatId');
  
  try {
    // Get VK source name
    const vkSource = await VkSource.findById(post.vkSource);
    const sourceName = vkSource ? vkSource.name : 'Unknown Source';
    
    // Escape special HTML characters to prevent formatting issues
    const escapeHtml = (text) => {
      if (!text) return '';
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    };
    
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
    
    // Prepare post caption with HTML formatting
    let caption = `<b>From VK group: ${escapeHtml(sourceName)}</b>\n\n`;
    caption += `${escapeHtml(post.text)}\n\n`;
    caption += `👁 Views: <b>${post.viewCount.toLocaleString()}</b>\n`;
    caption += `👍 Likes: ${post.likeCount.toLocaleString()}\n`;
    caption += `🔄 Reposts: ${post.repostCount.toLocaleString()}\n`;
    caption += post.publishedAt ? `📅 Published: <i>${formatDate(post.publishedAt)}</i>\n\n` : '\n';
    caption += `<a href="${post.originalPostUrl}">View original post</a>`;
    
    console.log('Caption prepared:', caption);
    
    let sentMessage;
    
    // Get all photo and video attachments
    const photoAttachments = post.attachments?.filter(att => att.type === 'photo' && att.url) || [];
    const videoAttachment = post.attachments?.find(att => att.type === 'video' && att.url);
    
    console.log('Attachments found:');
    console.log('- Photos:', photoAttachments.length);
    console.log('- Video:', videoAttachment ? 'Yes' : 'No');
    
    if (videoAttachment) {
      console.log('Video attachment details:');
      console.log('- URL:', videoAttachment.url);
      console.log('- Thumbnail URL:', videoAttachment.thumbnailUrl);
      
      try {
        // For videos, we'll use sendVideo if it's a direct video URL
        if (videoAttachment.url.match(/\.(mp4|mov|avi|mkv)$/i)) {
          console.log('Sending as direct video file...');
          // If we have a direct video file URL, send it as a video
          sentMessage = await bot.sendVideo(
            channel.chatId,
            videoAttachment.url,
            {
              caption: caption,
              parse_mode: 'HTML',
              thumbnail: videoAttachment.thumbnailUrl
            }
          );
        } else {
          // If it's a VK video link, send a message with the thumbnail and link
          if (videoAttachment.thumbnailUrl) {
            console.log('Sending as photo with video link...');
            // Send thumbnail as photo with caption and video link
            sentMessage = await bot.sendPhoto(
              channel.chatId,
              videoAttachment.thumbnailUrl,
              {
                caption: `${caption}\n\n<b>🎬 Video available at:</b> <a href="${videoAttachment.url}">Watch video</a>`,
                parse_mode: 'HTML'
              }
            );
          } else {
            console.log('Sending as message with video link...');
            // Without a thumbnail, just send the message with a link
            sentMessage = await bot.sendMessage(
              channel.chatId, 
              `${caption}\n\n<b>🎬 Video available at:</b> <a href="${videoAttachment.url}">Watch video</a>`, 
              { 
                parse_mode: 'HTML',
                disable_web_page_preview: false
              }
            );
          }
        }
      } catch (mediaError) {
        console.error('Error handling video:', mediaError);
        // Fallback to regular message with link
        console.log('Falling back to simple message with link...');
        sentMessage = await bot.sendMessage(
          channel.chatId, 
          `${caption}\n\n<b>🎬 Video available at:</b> <a href="${videoAttachment.url}">Watch video</a>`, 
          { 
            parse_mode: 'HTML',
            disable_web_page_preview: false
          }
        );
      }
    } else if (photoAttachments.length > 0) {
      console.log('Sending photo(s)...');
      // Handle photos (simplified for this test)
      try {
        sentMessage = await bot.sendPhoto(
          channel.chatId,
          photoAttachments[0].url,
          {
            caption: caption,
            parse_mode: 'HTML'
          }
        );
      } catch (mediaError) {
        console.error('Error sending photo:', mediaError);
        sentMessage = await bot.sendMessage(
          channel.chatId, 
          caption, 
          { 
            parse_mode: 'HTML',
            disable_web_page_preview: false
          }
        );
      }
    } else {
      console.log('Sending text-only message...');
      // No attachments, just send the message
      sentMessage = await bot.sendMessage(
        channel.chatId, 
        caption, 
        { 
          parse_mode: 'HTML',
          disable_web_page_preview: false
        }
      );
    }
    
    console.log('Message sent successfully!');
    console.log('Message ID:', sentMessage.message_id);
    
    return {
      success: true,
      telegramMessageId: sentMessage.message_id,
      channelId: channel._id
    };
  } catch (error) {
    console.error('Error forwarding post:', error);
    throw error;
  }
}

async function fetchVkPost(groupId, postId) {
  try {
    console.log(`Fetching VK post from group ID ${groupId}, post ID ${postId}...`);
    
    // Get post from VK API
    const response = await vk.api.wall.getById({
      posts: `-${groupId}_${postId}`
    });
    
    if (!response || !response.length) {
      throw new Error('Post not found');
    }
    
    const vkPost = response[0];
    console.log('Post fetched successfully!');
    
    // Extract post data
    const postData = {
      postId: vkPost.id.toString(),
      text: vkPost.text,
      viewCount: vkPost.views?.count || 0,
      likeCount: vkPost.likes?.count || 0,
      repostCount: vkPost.reposts?.count || 0,
      originalPostUrl: `https://vk.com/wall-${groupId}_${postId}`,
      publishedAt: new Date(vkPost.date * 1000),
      attachments: []
    };
    
    // Handle attachments
    if (vkPost.attachments?.length > 0) {
      postData.attachments = vkPost.attachments.map(att => {
        let attachment = {
          type: att.type
        };
        
        // Extract URLs based on attachment type
        if (att.type === 'photo') {
          // Get the largest photo
          const photos = att.photo.sizes || [];
          const largestPhoto = photos.sort((a, b) => (b.width || 0) - (a.width || 0))[0] || {};
          
          attachment.url = largestPhoto.url;
          
          // Get thumbnail
          const thumbnail = photos.find(p => p.type === 'x') || photos[0] || {};
          attachment.thumbnailUrl = thumbnail.url;
        } else if (att.type === 'video') {
          attachment.url = `https://vk.com/video${att.video.owner_id}_${att.video.id}`;
          // Use a reliable image URL for thumbnails
          attachment.thumbnailUrl = 'https://i.imgur.com/HmXUFX0.jpg';
        } else if (att.type === 'link') {
          attachment.url = att.link.url;
          attachment.thumbnailUrl = att.link.photo?.sizes?.length > 0 
            ? att.link.photo.sizes[0].url 
            : null;
        }
        
        return attachment;
      });
    }
    
    return postData;
  } catch (error) {
    console.error('Error fetching VK post:', error);
    throw error;
  }
}

async function main() {
  try {
    // Connect to MongoDB
    await mongoose.connect(mongoURI, mongooseOptions);
    console.log('Connected to MongoDB');
    
    // 1. Parse VK URL to get group ID and post ID
    const vkUrl = 'https://vk.com/wall-158663270_1249747';
    const match = vkUrl.match(/wall-(\d+)_(\d+)/);
    
    if (!match) {
      throw new Error('Invalid VK URL format');
    }
    
    const [, groupId, postId] = match;
    console.log(`Parsed VK URL: group ID=${groupId}, post ID=${postId}`);
    
    // 2. Find or create VK source
    let vkSource = await VkSource.findOne({ groupId });
    
    if (!vkSource) {
      console.log(`VK source with group ID ${groupId} not found, looking for "bez_cenznn"...`);
      vkSource = await VkSource.findOne({ name: 'bez_cenznn' });
      
      if (!vkSource) {
        console.log('Creating VK source for bez_cenznn...');
        vkSource = new VkSource({
          name: 'bez_cenznn',
          url: `https://vk.com/public${groupId}`,
          groupId,
          thresholdType: 'auto',
          calculatedThreshold: 1000,
          checkFrequency: 60
        });
        await vkSource.save();
      }
    }
    
    console.log('Using VK source:', vkSource.name);
    
    // 3. Fetch post from VK
    const postData = await fetchVkPost(groupId, postId);
    
    // 4. Create or update post in our database
    let post = await Post.findOne({ 
      vkSource: vkSource._id, 
      postId: postData.postId 
    });
    
    if (!post) {
      console.log('Creating new post in database...');
      post = new Post({
        vkSource: vkSource._id,
        ...postData,
        isViral: true,
        status: 'pending'
      });
      await post.save();
    } else {
      console.log('Updating existing post in database...');
      Object.assign(post, postData);
      await post.save();
    }
    
    console.log('Post saved to database with ID:', post._id);
    
    // 5. Find Telegram channel
    const channelUsername = '@newsChannelTest1';
    let telegramChannel = await TelegramChannel.findOne({ username: channelUsername });
    
    if (!telegramChannel) {
      console.log(`Telegram channel ${channelUsername} not found in database. Getting info from Telegram...`);
      
      try {
        // Get chat info from Telegram
        const chatInfo = await bot.getChat(channelUsername);
        
        telegramChannel = new TelegramChannel({
          name: chatInfo.title || 'News Channel Test 1',
          chatId: chatInfo.id.toString(),
          username: channelUsername,
          active: true
        });
        
        await telegramChannel.save();
        console.log('Telegram channel saved to database with ID:', telegramChannel._id);
      } catch (error) {
        console.error('Failed to get Telegram channel info:', error.message);
        console.error('Make sure your bot is an admin of the channel', channelUsername);
        process.exit(1);
      }
    } else {
      console.log('Found Telegram channel in database:', telegramChannel.name);
    }
    
    // 6. Forward post to Telegram channel
    console.log(`Forwarding post from ${vkSource.name} to ${channelUsername}...`);
    await forwardPost(post, telegramChannel);
    
    console.log('Post forwarded successfully!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    process.exit(0);
  }
}

// Run the test
main(); 