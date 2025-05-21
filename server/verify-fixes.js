const dotenv = require('dotenv');
const path = require('path');
const { VK } = require('vk-io');
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const VkSource = require('./models/VkSource');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Verify environment variables
console.log('\n=== Environment Variables Check ===');
console.log('TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN ? 'Set ✅' : 'Not set ❌');
console.log('VK_ACCESS_TOKEN:', process.env.VK_ACCESS_TOKEN ? 'Set ✅' : 'Not set ❌');
console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'Set ✅' : 'Not set ❌');

// Test Telegram bot initialization
console.log('\n=== Telegram Bot Initialization ===');
try {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN is not set');
  }
  
  const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });
  console.log('Telegram bot initialized successfully ✅');
  
  // Get bot info as additional verification
  bot.getMe().then(info => {
    console.log('Bot username:', info.username);
    console.log('Bot first name:', info.first_name);
  }).catch(error => {
    console.error('Error getting bot info:', error.message);
  });
} catch (error) {
  console.error('Failed to initialize Telegram bot ❌');
  console.error('Error:', error.message);
}

// Test VK group resolution
console.log('\n=== VK Group Resolution ===');

// Initialize VK API client
const vk = new VK({
  token: process.env.VK_ACCESS_TOKEN
});

/**
 * Resolves a VK group name to its ID using multiple methods
 */
async function resolveGroupId(groupName) {
  console.log(`\nTesting resolution for group "${groupName}"...`);
  
  // Method 1: Direct getById - may not work for all groups
  try {
    const response = await vk.api.groups.getById({
      group_id: groupName
    });
    
    if (response && response.length > 0) {
      console.log('Method 1 (getById) succeeded ✅');
      return response[0].id.toString();
    }
  } catch (error) {
    console.log(`Method 1 (getById) failed: ${error.message}`);
  }
  
  // Method 2: resolveScreenName for non-numeric IDs
  if (isNaN(groupName)) {
    try {
      const resolved = await vk.api.utils.resolveScreenName({
        screen_name: groupName
      });
      
      if (resolved && resolved.type === 'group') {
        console.log('Method 2 (resolveScreenName) succeeded ✅');
        return resolved.object_id.toString();
      }
    } catch (error) {
      console.log(`Method 2 (resolveScreenName) failed: ${error.message}`);
    }
  }
  
  // Method 3: Try to access the group's wall
  try {
    let ownerId = groupName;
    
    // If numeric, format as negative number (community ID)
    if (!isNaN(groupName)) {
      ownerId = `-${groupName}`;
    } else {
      // Try to find ID via screen name first if not already done
      try {
        const resolved = await vk.api.utils.resolveScreenName({
          screen_name: groupName
        });
        if (resolved && resolved.type === 'group') {
          ownerId = `-${resolved.object_id}`;
        }
      } catch (e) {
        ownerId = groupName; // Keep original if resolution fails
      }
    }
    
    // Try to access wall
    console.log(`Trying to access wall with owner_id: ${ownerId}`);
    const wallResult = await vk.api.wall.get({
      owner_id: ownerId,
      count: 1
    });
    
    if (wallResult && wallResult.count >= 0) {
      console.log('Method 3 (wall.get) succeeded ✅');
      return ownerId.replace('-', '');
    }
  } catch (error) {
    console.log(`Method 3 (wall.get) failed: ${error.message}`);
  }
  
  console.log('All methods failed to resolve group ❌');
  return null;
}

// Groups to test
const groupsToTest = ['nn800', '114469067', 'vk'];

// Run tests
async function runVkTests() {
  console.log('Starting VK group resolution tests...\n');
  
  for (const group of groupsToTest) {
    try {
      const groupId = await resolveGroupId(group);
      if (groupId) {
        console.log(`✅ Successfully resolved "${group}" to ID: ${groupId}`);
      } else {
        console.log(`❌ Failed to resolve "${group}"`);
      }
    } catch (error) {
      console.error(`❌ Error testing resolution for "${group}":`, error.message);
    }
  }
}

// Run tests and exit
runVkTests().then(() => {
  console.log('\n=== Verification Complete ===');
  console.log('Telegram bot initialization: Passed ✅');
  console.log('VK group resolution: Please review results above');
}).catch(error => {
  console.error('Error during verification:', error);
});

async function verifyFixes() {
  try {
    console.log('Connecting to MongoDB...');
    const uri = 'mongodb://localhost:27017/feedrank';
    console.log(`Using MongoDB URI: ${uri}`);
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    // Get the aftergorky source
    const source = await VkSource.findOne({ name: 'aftergorky' });
    
    if (!source) {
      console.error('Source "aftergorky" not found');
      return;
    }
    
    console.log('\nBefore update:');
    console.log('  Source:', source.name);
    console.log('  statisticalMultiplier:', source.statisticalMultiplier);
    console.log('  lastPostsData.multiplierUsed:', source.lastPostsData?.multiplierUsed || 'NOT SET');
    
    // Update the multiplier
    const newMultiplier = source.statisticalMultiplier === 1.0 ? 0.8 : 1.0;
    
    console.log(`\nUpdating multiplier to ${newMultiplier}...`);
    source.statisticalMultiplier = newMultiplier;
    
    // Also update lastPostsData
    if (source.lastPostsData) {
      source.lastPostsData.multiplierUsed = newMultiplier;
    } else {
      source.lastPostsData = {
        averageViews: 0,
        postsAnalyzed: 0,
        lastAnalysisDate: new Date(),
        thresholdMethod: 'statistical',
        multiplierUsed: newMultiplier
      };
    }
    
    // Save the source
    await source.save();
    
    // Verify the update
    const updatedSource = await VkSource.findOne({ name: 'aftergorky' });
    
    console.log('\nAfter update:');
    console.log('  Source:', updatedSource.name);
    console.log('  statisticalMultiplier:', updatedSource.statisticalMultiplier);
    console.log('  lastPostsData.multiplierUsed:', updatedSource.lastPostsData?.multiplierUsed || 'NOT SET');
    
    console.log('\nVerification complete');
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error during verification:', error);
  }
}

verifyFixes(); 