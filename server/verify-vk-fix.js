const dotenv = require('dotenv');
const path = require('path');
const { VK } = require('vk-io');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Check if VK_ACCESS_TOKEN is set
if (!process.env.VK_ACCESS_TOKEN) {
  console.error('Error: VK_ACCESS_TOKEN is not set in .env file');
  process.exit(1);
}

// Initialize VK API client with token from .env
const vk = new VK({
  token: process.env.VK_ACCESS_TOKEN
});

/**
 * Resolves a VK group name to its ID
 * @param {string} groupName - Name of the VK group
 * @returns {Promise<string>} - Group ID
 */
const resolveGroupId = async (groupName) => {
  try {
    // Method 1: Direct getById - may not work for all groups
    try {
      const response = await vk.api.groups.getById({
        group_id: groupName
      });
      
      if (response && response.length > 0) {
        return response[0].id.toString();
      }
    } catch (error) {
      console.log(`Method 1 (getById) failed for "${groupName}": ${error.message}`);
      // Continue to next method
    }
    
    // Method 2: resolveScreenName for non-numeric IDs
    if (isNaN(groupName)) {
      try {
        const resolved = await vk.api.utils.resolveScreenName({
          screen_name: groupName
        });
        
        if (resolved && resolved.type === 'group') {
          return resolved.object_id.toString();
        }
      } catch (error) {
        console.log(`Method 2 (resolveScreenName) failed for "${groupName}": ${error.message}`);
        // Continue to next method
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
      const wallResult = await vk.api.wall.get({
        owner_id: ownerId,
        count: 1
      });
      
      if (wallResult && wallResult.count >= 0) {
        // Success, return the ID without the minus sign
        return ownerId.replace('-', '');
      }
    } catch (error) {
      console.log(`Method 3 (wall.get) failed for "${groupName}": ${error.message}`);
      // All methods failed
    }
    
    // If we get here, no method worked
    throw new Error(`Group "${groupName}" not found or not accessible`);
  } catch (error) {
    // Check for auth errors
    if (error.code === 5) {
      console.error('VK API Authentication Error: Invalid or expired access token');
      throw new Error('Failed to authenticate with VK API. Please update your VK_ACCESS_TOKEN.');
    }
    
    throw error;
  }
};

// Groups to test (those reported as failing)
const groupsToTest = ['nn800', '114469067', 'vk'];

async function runTests() {
  console.log('Verifying VK Group Resolution Fix\n');
  console.log(`Using VK_ACCESS_TOKEN: ${process.env.VK_ACCESS_TOKEN.substring(0, 10)}...\n`);
  
  for (const group of groupsToTest) {
    console.log(`Testing resolution for group "${group}"...`);
    try {
      const groupId = await resolveGroupId(group);
      console.log(`✅ Success! Resolved to group ID: ${groupId}`);
    } catch (error) {
      console.error(`❌ Error resolving group "${group}":`, error.message);
    }
    console.log('----------------------------\n');
  }
}

runTests().catch(console.error); 