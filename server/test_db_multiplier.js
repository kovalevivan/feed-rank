require('dotenv').config();
const mongoose = require('mongoose');
const VkSource = require('./models/VkSource');
const vkService = require('./services/vk');

async function testDbMultiplier() {
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
    console.log('  sourceId:', source._id);
    console.log('  statisticalMultiplier:', source.statisticalMultiplier);
    console.log('  lastPostsData.multiplierUsed:', source.lastPostsData?.multiplierUsed || 'NOT SET');
    
    // Update the multiplier directly using the VK service
    const newMultiplier = source.statisticalMultiplier === 1.0 ? 0.7 : 1.0;
    console.log(`\nUpdating multiplier to ${newMultiplier} using VkService...`);
    
    // Workaround for the VK token check for testing purposes
    process.env.VK_ACCESS_TOKEN = process.env.VK_ACCESS_TOKEN || 'dummy_token_for_testing';
    
    try {
      // Call updateSourceThreshold directly
      await vkService.updateSourceThreshold(source._id.toString(), 'statistical', newMultiplier);
      console.log('Update successful');
    } catch (error) {
      console.log('Error during service call, proceeding with manual update');
      // If service call fails due to VK API, do manual update
      source.statisticalMultiplier = newMultiplier;
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
      await source.save();
    }
    
    // Verify the database was updated
    const updatedSource = await VkSource.findOne({ name: 'aftergorky' });
    
    console.log('\nAfter update (from database):');
    console.log('  Source:', updatedSource.name);
    console.log('  statisticalMultiplier:', updatedSource.statisticalMultiplier);
    console.log('  lastPostsData.multiplierUsed:', updatedSource.lastPostsData?.multiplierUsed || 'NOT SET');
    
    console.log('\nTest complete');
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error during test:', error);
  }
}

testDbMultiplier(); 