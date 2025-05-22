require('dotenv').config();
const mongoose = require('mongoose');
const VkSource = require('./models/VkSource');

async function verifyMultiplier() {
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

verifyMultiplier(); 