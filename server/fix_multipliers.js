require('dotenv').config();
const mongoose = require('mongoose');
const VkSource = require('./models/VkSource');

async function fixMultipliers() {
  try {
    console.log('Connecting to MongoDB...');
    const uri = 'mongodb://localhost:27017/feedrank';
    console.log(`Using MongoDB URI: ${uri}`);
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    // Find all sources that don't have a statisticalMultiplier set (or it's null)
    const sources = await VkSource.find({
      $or: [
        { statisticalMultiplier: { $exists: false } },
        { statisticalMultiplier: null }
      ]
    });

    console.log(`Found ${sources.length} sources without statisticalMultiplier`);

    // Update each source
    for (const source of sources) {
      console.log(`\nFixing source: ${source.name} (ID: ${source._id})`);
      
      // Set default statisticalMultiplier
      source.statisticalMultiplier = 1.5;
      
      // Update lastPostsData if it exists
      if (source.lastPostsData) {
        console.log(`Source has lastPostsData, updating multiplierUsed`);
        if (source.thresholdMethod === 'statistical') {
          source.lastPostsData.multiplierUsed = 1.5;
        }
      } else {
        console.log(`Source doesn't have lastPostsData, creating it`);
        source.lastPostsData = {
          averageViews: 0,
          postsAnalyzed: 0,
          lastAnalysisDate: null,
          thresholdMethod: source.thresholdMethod || 'statistical',
          multiplierUsed: source.thresholdMethod === 'statistical' ? 1.5 : null
        };
      }
      
      // Save the updated source
      await source.save();
      console.log(`Updated source: ${source.name}, statisticalMultiplier: ${source.statisticalMultiplier}`);
    }

    console.log('\nFinished updating sources');
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error fixing multipliers:', error);
  }
}

fixMultipliers(); 