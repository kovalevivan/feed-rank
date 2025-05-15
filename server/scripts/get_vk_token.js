/**
 * This script helps you get a VK access token with the necessary permissions
 * 
 * Instructions:
 * 1. Create a VK app at https://vk.com/apps?act=manage
 * 2. Set your VK_APP_ID and redirect_uri below
 * 3. Run this script with: node get_vk_token.js
 * 4. Open the generated URL in your browser
 * 5. After authorization, you'll be redirected to a URL with the access token in it
 * 6. Copy the access_token parameter from the URL to your .env file
 */

const VK_APP_ID = '53523994'; // Replace with your VK app ID
const REDIRECT_URI = 'https://oauth.vk.com/blank.html'; // Default redirect URI

// Required permissions for FeedRank
const PERMISSIONS = [
  'groups',      // For accessing group information
  'wall',        // For reading posts
  'offline'      // For long-lived token
];

const scope = PERMISSIONS.join(',');
const authUrl = `https://oauth.vk.com/authorize?client_id=${VK_APP_ID}&display=page&redirect_uri=${REDIRECT_URI}&scope=${scope}&response_type=token&v=5.199`;

console.log('Open the following URL in your browser to get a VK access token:');
console.log(authUrl);
console.log('\nAfter authorization, you will be redirected to a URL containing your access token.');
console.log('Look for the "access_token" parameter in the URL and add it to your .env file as VK_ACCESS_TOKEN.'); 