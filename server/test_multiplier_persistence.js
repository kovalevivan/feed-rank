require('dotenv').config();
const mongoose = require('mongoose');
const VkSource = require('./models/VkSource');

async function testMultiplierPersistence() {
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
    
    // Toggle the multiplier value
    const newMultiplier = source.statisticalMultiplier === 1.0 ? 0.7 : 1.0;
    console.log(`\nUpdating multiplier to ${newMultiplier}...`);
    
    // Directly update the source
    source.statisticalMultiplier = newMultiplier;
    
    // Update lastPostsData.multiplierUsed too
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
    console.log('Source saved successfully');
    
    // Verify the update by retrieving again from database
    const updatedSource = await VkSource.findOne({ name: 'aftergorky' });
    
    console.log('\nAfter update (from database):');
    console.log('  Source:', updatedSource.name);
    console.log('  statisticalMultiplier:', updatedSource.statisticalMultiplier);
    console.log('  lastPostsData.multiplierUsed:', updatedSource.lastPostsData?.multiplierUsed || 'NOT SET');
    
    // Verify that the multiplier value persisted correctly
    if (updatedSource.statisticalMultiplier === newMultiplier) {
      console.log(`\nSUCCESS: Multiplier value correctly persisted as ${newMultiplier}`);
    } else {
      console.log(`\nFAILURE: Multiplier value did not persist correctly!`);
      console.log(`Expected: ${newMultiplier}, Got: ${updatedSource.statisticalMultiplier}`);
    }
    
    console.log('\nTest complete');
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error during test:', error);
  }
}

testMultiplierPersistence(); 