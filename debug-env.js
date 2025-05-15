const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Print current directory and .env file path
console.log('Current directory:', __dirname);
const envPath = path.resolve(__dirname, '../.env');
console.log('.env path:', envPath);
console.log('.env exists:', fs.existsSync(envPath));

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  console.log('\n.env file content:');
  console.log(envContent);
}

// Load .env file
const result = dotenv.config({ path: envPath });
console.log('\nDotenv result:', result.error ? 'Error: ' + result.error.message : 'Success');

// Print environment variables
console.log('\n=== Environment Variables Debug ===');
console.log('TELEGRAM_BOT_TOKEN:', process.env.TELEGRAM_BOT_TOKEN);
console.log('TELEGRAM_BOT_TOKEN is set:', !!process.env.TELEGRAM_BOT_TOKEN);
console.log('VK_ACCESS_TOKEN:', process.env.VK_ACCESS_TOKEN ? process.env.VK_ACCESS_TOKEN.substring(0, 10) + '...' : 'Not set');
console.log('MONGODB_URI:', process.env.MONGODB_URI);
console.log('=== End Debug ==='); 