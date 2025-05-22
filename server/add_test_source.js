require('dotenv').config();
const mongoose = require('mongoose');
const VkSource = require('./models/VkSource');

async function addTestSource() {
  try {
    console.log('Connecting to MongoDB...');
    const uri = 'mongodb://localhost:27017/feedrank';
    console.log(`Using MongoDB URI: ${uri}`);
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    // Check if source already exists
    const existingSource = await VkSource.findOne({ name: 'aftergorky' });
    
    if (existingSource) {
      console.log('\nFound existing source with name "aftergorky". Updating it...');
      existingSource.statisticalMultiplier = 1.0;
      
      if (existingSource.lastPostsData) {
        existingSource.lastPostsData.multiplierUsed = 1.0;
      } else {
        existingSource.lastPostsData = {
          averageViews: 0,
          postsAnalyzed: 0,
          lastAnalysisDate: new Date(),
          thresholdMethod: 'statistical',
          multiplierUsed: 1.0
        };
      }
      
      await existingSource.save();
      console.log('Updated multiplier to 1.0 for source:', existingSource.name);
    } else {
      // Create new source
      console.log('\nCreating new source with name "aftergorky"...');
      const newSource = new VkSource({
        name: 'aftergorky',
        url: 'https://vk.com/aftergorky',
        groupId: '178511971', // Example ID - this should be resolved from the VK API
        thresholdType: 'auto',
        thresholdMethod: 'statistical',
        statisticalMultiplier: 1.0,
        calculatedThreshold: 1000,
        checkFrequency: 60,
        active: true,
        lastPostsData: {
          averageViews: 0,
          postsAnalyzed: 0,
          lastAnalysisDate: new Date(),
          thresholdMethod: 'statistical',
          multiplierUsed: 1.0
        }
      });
      
      await newSource.save();
      console.log('Created new source:', newSource.name, 'with multiplier 1.0');
    }

    // Verify it exists with correct multiplier
    const verifySource = await VkSource.findOne({ name: 'aftergorky' });
    console.log('\nVerification:');
    console.log('  Source:', verifySource.name);
    console.log('  statisticalMultiplier:', verifySource.statisticalMultiplier);
    console.log('  lastPostsData.multiplierUsed:', verifySource.lastPostsData?.multiplierUsed || 'NOT SET');

    console.log('\nFinished adding/updating source');
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error adding/updating source:', error);
  }
}

addTestSource(); 