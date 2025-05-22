require('dotenv').config();
const telegramService = require('./services/telegram');
const mongoose = require('mongoose');
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
    
    // Create a mock post with video
    const mockPost = {
      _id: new mongoose.Types.ObjectId(),
      text: "This is a test post for video forwarding from VK to Telegram.",
      vkSource: new mongoose.Types.ObjectId(),
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
    };
    
    console.log('Forwarding mock post with video to channel...');
    const result = await telegramService.forwardPost(mockPost, channel);
    
    console.log('Post forwarded successfully!');
    console.log('Result:', result);
    
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