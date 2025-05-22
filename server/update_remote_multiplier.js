require('dotenv').config();
const { MongoClient, ObjectId } = require('mongodb');

async function updateRemoteMultiplier() {
  let client = null;
  
  try {
    // Connect directly to the IP address
    const remoteUri = 'mongodb://gen_user:i26q1pAB9Av3@147.45.245.85:27017/feedrank?authSource=admin';
    console.log('Connecting to remote MongoDB...');
    
    // Connect with direct connection
    client = new MongoClient(remoteUri, {
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000,
      directConnection: true
    });
    
    await client.connect();
    console.log('Connected to remote MongoDB successfully');
    
    const db = client.db('feedrank');
    const vkSourcesCollection = db.collection('vksources');
    
    // Get the aftergorky source first
    const source = await vkSourcesCollection.findOne({ name: 'aftergorky' });
    
    if (!source) {
      console.log('Source "aftergorky" not found in remote database');
      return;
    }
    
    console.log('\nBefore update:');
    console.log('  Source:', source.name);
    console.log('  ID:', source._id);
    console.log('  statisticalMultiplier:', source.statisticalMultiplier || 'NOT SET');
    if (source.lastPostsData) {
      console.log('  lastPostsData.multiplierUsed:', source.lastPostsData.multiplierUsed || 'NOT SET');
    }
    
    // Set new multiplier value to 1.0
    const newMultiplier = 1.0;
    
    // Update the source document
    const updateResult = await vkSourcesCollection.updateOne(
      { _id: source._id },
      { 
        $set: { 
          'statisticalMultiplier': newMultiplier,
          'lastPostsData.multiplierUsed': newMultiplier
        } 
      }
    );
    
    console.log('\nUpdate result:');
    console.log('  Matched:', updateResult.matchedCount);
    console.log('  Modified:', updateResult.modifiedCount);
    
    // Verify the update
    const updatedSource = await vkSourcesCollection.findOne({ _id: source._id });
    
    console.log('\nAfter update:');
    console.log('  Source:', updatedSource.name);
    console.log('  statisticalMultiplier:', updatedSource.statisticalMultiplier || 'NOT SET');
    if (updatedSource.lastPostsData) {
      console.log('  lastPostsData.multiplierUsed:', updatedSource.lastPostsData.multiplierUsed || 'NOT SET');
    }
    
    if (updatedSource.statisticalMultiplier === newMultiplier) {
      console.log('\nSUCCESS: Multiplier value was updated to 1.0');
    } else {
      console.log('\nWARNING: Multiplier value may not have updated correctly');
    }
    
    console.log('\nUpdate complete');
  } catch (error) {
    console.error('Error during remote database update:', error);
  } finally {
    if (client) {
      await client.close();
      console.log('Disconnected from remote MongoDB');
    }
  }
}

updateRemoteMultiplier(); 