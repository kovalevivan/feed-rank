// Load environment variables from the project root
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const telegramService = require('./services/telegram');
const mongoose = require('mongoose');
const Post = require('./models/Post');
const VkSource = require('./models/VkSource');
const TelegramChannel = require('./models/TelegramChannel');

// Connect to MongoDB
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/feedrank';
console.log('Connecting to MongoDB with URI:', mongoURI.replace(/\/\/[^:]+:[^@]+@/, '//****:****@'));

mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  console.log('Connected to MongoDB');
  
  try {
    // Initialize Telegram service
    telegramService.init();
    
    // Find or create Telegram channel
    const channelUsername = '@newsChannelTest1';
    let channel = await TelegramChannel.findOne({ username: channelUsername });
    
    if (!channel) {
      console.log(`Channel ${channelUsername} not found, looking it up via Telegram...`);
      const bot = telegramService.getBot();
      
      if (!bot) {
        throw new Error('Telegram bot not initialized');
      }
      
      // Try to get chat info from Telegram
      const chat = await bot.getChat(channelUsername);
      
      channel = new TelegramChannel({
        name: chat.title || 'News Channel Test',
        chatId: chat.id.toString(),
        username: channelUsername,
        active: true
      });
      
      await channel.save();
      console.log('Channel created in database:', channel.name);
    } else {
      console.log('Channel found in database:', channel.name);
    }
    
    // Find or create VK source
    const groupId = '158663270';
    let vkSource = await VkSource.findOne({ groupId });
    
    if (!vkSource) {
      console.log(`VK source with group ID ${groupId} not found, creating...`);
      vkSource = new VkSource({
        name: 'bez_cenznn',
        url: `https://vk.com/public${groupId}`,
        groupId,
        thresholdType: 'auto',
        calculatedThreshold: 1000,
        checkFrequency: 60
      });
      await vkSource.save();
      console.log('VK source created in database:', vkSource.name);
    } else {
      console.log('VK source found in database:', vkSource.name);
    }
    
    // Test cases - each is a post we'll try to forward
    const testCases = [
      {
        name: 'Video Post',
        data: {
          _id: new mongoose.Types.ObjectId(),
          text: "This is a test post with a video attachment from VK.",
          vkSource: vkSource._id,
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
          vkSource: vkSource._id,
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
          vkSource: vkSource._id,
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
          vkSource: vkSource._id,
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
          vkSource: vkSource._id,
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
        // Create a new Post instance
        const post = new Post(testCase.data);
        
        // Forward the post
        console.log(`Forwarding post to ${channel.name}...`);
        const result = await telegramService.forwardPost(post, channel);
        
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
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
    process.exit(0);
  }
}).catch(err => {
  console.error('Error connecting to MongoDB:', err);
  process.exit(1);
}); 