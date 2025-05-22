require('dotenv').config();
const axios = require('axios');
const mongoose = require('mongoose');
const VkSource = require('./models/VkSource');

async function testApiMultiplier() {
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
    
    console.log('\nBefore API call:');
    console.log('  Source:', source.name);
    console.log('  sourceId:', source._id);
    console.log('  statisticalMultiplier:', source.statisticalMultiplier);
    
    // Call the API to update the threshold with a different multiplier
    const newMultiplier = source.statisticalMultiplier === 1.0 ? 0.7 : 1.0;
    console.log(`\nCalling API to update multiplier to ${newMultiplier}...`);
    
    const response = await axios.post(`http://localhost:5001/api/vk-sources/${source._id}/calculate-threshold`, {
      thresholdMethod: 'statistical',
      multiplier: newMultiplier
    });
    
    console.log('\nAPI Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    // Verify the database was updated
    const updatedSource = await VkSource.findOne({ name: 'aftergorky' });
    
    console.log('\nAfter API call (from database):');
    console.log('  Source:', updatedSource.name);
    console.log('  statisticalMultiplier:', updatedSource.statisticalMultiplier);
    console.log('  lastPostsData.multiplierUsed:', updatedSource.lastPostsData?.multiplierUsed || 'NOT SET');
    
    console.log('\nTest complete');
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('Error during API test:', error);
    if (error.response) {
      console.error('API Error Response:', error.response.data);
    }
  }
}

testApiMultiplier(); 