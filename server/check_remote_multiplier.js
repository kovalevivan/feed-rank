require('dotenv').config();
const { MongoClient } = require('mongodb');

async function checkRemoteMultiplier() {
  let client = null;
  
  try {
    // Connect directly to the IP address without DNS resolution
    const remoteUri = 'mongodb://gen_user:i26q1pAB9Av3@147.45.245.85:27017/feedrank?authSource=admin';
    console.log('Connecting to remote MongoDB...');
    console.log('Using direct IP connection to avoid DNS issues');
    
    // Connect with increased timeout and direct connection
    client = new MongoClient(remoteUri, {
      connectTimeoutMS: 10000,
      serverSelectionTimeoutMS: 10000,
      directConnection: true  // Ensure direct connection to the server
    });
    
    console.log('Attempting connection...');
    await client.connect();
    console.log('Connected to remote MongoDB successfully');
    
    const db = client.db('feedrank');
    const vkSourcesCollection = db.collection('vksources');
    
    // First check if the collection exists
    const collections = await db.listCollections({name: 'vksources'}).toArray();
    if (collections.length === 0) {
      console.log('Collection "vksources" does not exist in the database');
      
      // List available collections
      console.log('\nAvailable collections:');
      const allCollections = await db.listCollections().toArray();
      allCollections.forEach(collection => {
        console.log(`- ${collection.name}`);
      });
      return;
    }
    
    // Get the aftergorky source
    const source = await vkSourcesCollection.findOne({ name: 'aftergorky' });
    
    if (!source) {
      console.log('Source "aftergorky" not found in remote database');
      
      // List all sources to see what's available (limited to 5)
      console.log('\nListing 5 VK sources in remote database:');
      const allSources = await vkSourcesCollection.find({}).limit(5).toArray();
      
      if (allSources.length === 0) {
        console.log('No sources found in remote database');
      } else {
        console.log(`Found ${allSources.length} sources. Displaying first 5:`);
        allSources.forEach((src) => {
          console.log(`- Source: ${src.name} (ID: ${src._id})`);
          console.log(`  thresholdType: ${src.thresholdType || 'NOT SET'}`);
          console.log(`  thresholdMethod: ${src.thresholdMethod || 'NOT SET'}`);
          console.log(`  statisticalMultiplier: ${src.statisticalMultiplier || 'NOT SET'}`);
          
          if (src.lastPostsData) {
            console.log(`  lastPostsData.multiplierUsed: ${src.lastPostsData.multiplierUsed || 'NOT SET'}`);
          } else {
            console.log(`  lastPostsData: NOT SET`);
          }
        });
      }
    } else {
      console.log('\nFound source in remote database:');
      console.log('  Source:', source.name);
      console.log('  ID:', source._id);
      console.log('  thresholdType:', source.thresholdType || 'NOT SET');
      console.log('  thresholdMethod:', source.thresholdMethod || 'NOT SET');
      console.log('  statisticalMultiplier:', source.statisticalMultiplier || 'NOT SET');
      
      if (source.lastPostsData) {
        console.log('  lastPostsData:');
        console.log('    multiplierUsed:', source.lastPostsData.multiplierUsed || 'NOT SET');
        console.log('    lastAnalysisDate:', source.lastPostsData.lastAnalysisDate || 'NOT SET');
        console.log('    postsAnalyzed:', source.lastPostsData.postsAnalyzed || 0);
        
        if (source.lastPostsData.detailedStats) {
          console.log('    detailedStats summary:');
          console.log('      mean:', source.lastPostsData.detailedStats.mean || 0);
          console.log('      standardDeviation:', source.lastPostsData.detailedStats.standardDeviation || 0);
        }
      } else {
        console.log('  lastPostsData: NOT SET');
      }
    }
    
    console.log('\nCheck complete');
  } catch (error) {
    console.error('Error during remote database check:', error);
    
    if (error.name === 'MongoServerSelectionError') {
      console.error('\nCould not connect to MongoDB server. Please check:');
      console.error('1. The MongoDB server is running and accessible at 147.45.245.85:27017');
      console.error('2. The credentials are correct (username: gen_user)');
      console.error('3. Network connectivity to the server');
      console.error('4. Firewall settings allowing the connection');
    }
  } finally {
    if (client) {
      await client.close();
      console.log('Disconnected from remote MongoDB');
    }
  }
}

checkRemoteMultiplier(); 