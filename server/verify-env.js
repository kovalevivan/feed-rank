// Load environment variables from the project root
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

console.log('Environment variables verification:');
console.log('--------------------------------');

// Check MongoDB connection string
if (process.env.MONGODB_URI) {
  const maskedURI = process.env.MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//****:****@');
  console.log('✅ MONGODB_URI is set:', maskedURI);
} else {
  console.log('❌ MONGODB_URI is not set');
}

// Check VK API credentials
if (process.env.VK_ACCESS_TOKEN) {
  const maskedToken = process.env.VK_ACCESS_TOKEN.substring(0, 5) + '...' + 
    process.env.VK_ACCESS_TOKEN.substring(process.env.VK_ACCESS_TOKEN.length - 5);
  console.log('✅ VK_ACCESS_TOKEN is set:', maskedToken);
} else {
  console.log('❌ VK_ACCESS_TOKEN is not set');
}

// Check Telegram Bot token
if (process.env.TELEGRAM_BOT_TOKEN) {
  const maskedToken = process.env.TELEGRAM_BOT_TOKEN.substring(0, 5) + '...' + 
    process.env.TELEGRAM_BOT_TOKEN.substring(process.env.TELEGRAM_BOT_TOKEN.length - 5);
  console.log('✅ TELEGRAM_BOT_TOKEN is set:', maskedToken);
} else {
  console.log('❌ TELEGRAM_BOT_TOKEN is not set');
}

console.log('--------------------------------');
console.log('If any environment variables are missing, please add them to the .env file in the project root.');
