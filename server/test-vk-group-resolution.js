const dotenv = require('dotenv');
const path = require('path');
const { VK } = require('vk-io');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Check if VK_ACCESS_TOKEN is set
if (!process.env.VK_ACCESS_TOKEN) {
  console.error('VK_ACCESS_TOKEN is not set in .env file');
  process.exit(1);
}

// Initialize VK API client
const vk = new VK({
  token: process.env.VK_ACCESS_TOKEN
});

/**
 * Test resolving a VK group name to its ID
 */
async function testResolveGroupId(groupName) {
  console.log(`Testing resolution for group "${groupName}"...`);
  
  // Method 1: Direct groups.getById
  console.log('\nMethod 1: Using groups.getById');
  try {
    const response = await vk.api.groups.getById({
      group_id: groupName
    });
    
    if (response && response.length > 0) {
      console.log('✅ Success! Group details:');
      console.log(JSON.stringify(response[0], null, 2));
      return response[0].id.toString();
    } else {
      console.log('❌ Group found but no data returned');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  // Method 2: Try resolving via utils.resolveScreenName
  console.log('\nMethod 2: Using utils.resolveScreenName');
  try {
    if (isNaN(groupName)) {
      // Only use for non-numeric names
      const resolved = await vk.api.utils.resolveScreenName({
        screen_name: groupName
      });
      
      if (resolved && resolved.type === 'group') {
        console.log('✅ Success! Resolved to group ID:', resolved.object_id);
        return resolved.object_id.toString();
      } else {
        console.log('❌ Not a group or not found');
      }
    } else {
      console.log('Skipped - not applicable for numeric IDs');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  // Method 3: Access wall posts
  console.log('\nMethod 3: Trying to access wall');
  try {
    let ownerId = groupName;
    // If numeric, format as negative number (community ID)
    if (!isNaN(groupName)) {
      ownerId = `-${groupName}`;
    } else {
      // Try to find ID via screen name
      try {
        const resolved = await vk.api.utils.resolveScreenName({
          screen_name: groupName
        });
        if (resolved && resolved.type === 'group') {
          ownerId = `-${resolved.object_id}`;
        }
      } catch (e) {
        console.log('Failed to resolve screen name, trying direct name');
        ownerId = `${groupName}`;
      }
    }
    
    console.log(`Trying to access wall with owner_id: ${ownerId}`);
    const wallResult = await vk.api.wall.get({
      owner_id: ownerId,
      count: 1
    });
    
    if (wallResult && wallResult.items) {
      console.log('✅ Success! Wall accessible. Items count:', wallResult.count);
      return ownerId.replace('-', '');
    } else {
      console.log('❌ Wall found but no posts returned');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  console.log('\nAll methods failed to retrieve group information.');
  return null;
}

// Groups to test (those reported as failing)
const groupsToTest = ['nn800', '114469067'];

// Also try a known working group for comparison
groupsToTest.push('vk'); // Official VK group

async function runTests() {
  console.log('VK Group Resolution Test\n');
  console.log(`Using VK_ACCESS_TOKEN: ${process.env.VK_ACCESS_TOKEN.substring(0, 10)}...\n`);
  
  for (const group of groupsToTest) {
    console.log('\n==================================================');
    console.log(`TESTING GROUP: ${group}`);
    console.log('==================================================');
    
    await testResolveGroupId(group);
  }
}

runTests().catch(console.error); 