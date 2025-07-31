#!/usr/bin/env node

/**
 * Telegram Client Setup Script
 * 
 * This script helps you authenticate with Telegram's Client API to read
 * messages from channels/groups you're subscribed to.
 * 
 * You'll need:
 * 1. API ID and API Hash from https://my.telegram.org/apps
 * 2. Your phone number
 * 3. Access to receive SMS/phone calls for verification
 */

const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

const main = async () => {
  console.log('🚀 Telegram Client Setup');
  console.log('==============================\n');
  
  console.log('This script will help you set up Telegram Client API to read messages');
  console.log('from channels and groups you\'re subscribed to.\n');
  
  console.log('📋 Prerequisites:');
  console.log('1. Get API credentials from https://my.telegram.org/apps');
  console.log('2. Have your phone number ready');
  console.log('3. Access to receive SMS/calls for verification\n');
  
  try {
    // Get API credentials
    let apiId = process.env.TELEGRAM_API_ID;
    let apiHash = process.env.TELEGRAM_API_HASH;
    
    if (!apiId) {
      apiId = await question('📱 Enter your API ID: ');
    } else {
      console.log(`📱 Using API ID from environment: ${apiId}`);
    }
    
    if (!apiHash) {
      apiHash = await question('🔑 Enter your API Hash: ');
    } else {
      console.log(`🔑 Using API Hash from environment: ${apiHash.substring(0, 8)}...`);
    }
    
    if (!apiId || !apiHash) {
      console.error('❌ API ID and Hash are required!');
      console.log('\n📝 Get them from: https://my.telegram.org/apps');
      process.exit(1);
    }
    
    // Get phone number
    let phoneNumber = process.env.TELEGRAM_PHONE;
    if (!phoneNumber) {
      phoneNumber = await question('📞 Enter your phone number (with country code, e.g., +1234567890): ');
    } else {
      console.log(`📞 Using phone number from environment: ${phoneNumber}`);
    }
    
    console.log('\n🔄 Connecting to Telegram...');
    
    // Initialize client
    const session = new StringSession('');
    const client = new TelegramClient(session, parseInt(apiId), apiHash, {
      connectionRetries: 5,
    });
    
    await client.start({
      phoneNumber: async () => phoneNumber,
      password: async () => {
        return await question('🔐 Enter your 2FA password (if enabled): ');
      },
      phoneCode: async () => {
        return await question('📨 Enter the verification code you received: ');
      },
      onError: (err) => {
        console.error('❌ Authentication error:', err.message);
      },
    });
    
    console.log('\n✅ Successfully authenticated!');
    
    // Get user info
    const me = await client.getMe();
    console.log(`👋 Hello, ${me.firstName}${me.lastName ? ' ' + me.lastName : ''}!`);
    
    // Save session
    const sessionString = client.session.save();
    console.log('\n🔐 Your session token:');
    console.log(`TELEGRAM_SESSION=${sessionString}`);
    
    // Update .env file
    const envPath = path.join(__dirname, '../../.env');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // Update or add environment variables
    const updateEnvVar = (content, key, value) => {
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(content)) {
        return content.replace(regex, `${key}=${value}`);
      } else {
        return content + `\n${key}=${value}`;
      }
    };
    
    envContent = updateEnvVar(envContent, 'TELEGRAM_API_ID', apiId);
    envContent = updateEnvVar(envContent, 'TELEGRAM_API_HASH', apiHash);
    envContent = updateEnvVar(envContent, 'TELEGRAM_PHONE', phoneNumber);
    envContent = updateEnvVar(envContent, 'TELEGRAM_SESSION', sessionString);
    
    fs.writeFileSync(envPath, envContent.trim() + '\n');
    
    console.log('\n📝 Environment variables saved to .env file');
    
    // Get subscriptions preview
    console.log('\n📋 Getting your subscribed channels/groups...');
    try {
      const dialogs = await client.getDialogs({ limit: 10 });
      const channels = dialogs.filter(d => 
        d.entity.className === 'Channel' && (d.entity.broadcast || d.entity.megagroup)
      );
      
      if (channels.length > 0) {
        console.log('\n📺 Found channels/groups (first 10):');
        channels.forEach((dialog, i) => {
          const entity = dialog.entity;
          const type = entity.broadcast ? 'Channel' : 'Group';
          console.log(`${i + 1}. ${entity.title} (@${entity.username || 'no_username'}) - ${type}`);
        });
      } else {
        console.log('\n📺 No channels or groups found');
      }
    } catch (error) {
      console.log('⚠️ Could not fetch subscriptions:', error.message);
    }
    
    console.log('\n🎉 Setup complete!');
    console.log('\n📖 Next steps:');
    console.log('1. Restart your FeedRank server');
    console.log('2. Go to "Telegram Sources" in the web interface');
    console.log('3. Add channels/groups you want to monitor');
    console.log('4. The system will now be able to read messages from your subscribed channels');
    
    await client.disconnect();
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    
    if (error.message.includes('PHONE_CODE_INVALID')) {
      console.log('💡 Try: Make sure you entered the correct verification code');
    } else if (error.message.includes('PHONE_NUMBER_INVALID')) {
      console.log('💡 Try: Make sure your phone number includes the country code (e.g., +1234567890)');
    } else if (error.message.includes('API_ID_INVALID')) {
      console.log('💡 Try: Check your API ID and Hash from https://my.telegram.org/apps');
    }
    
    process.exit(1);
  } finally {
    rl.close();
  }
};

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n\n👋 Setup cancelled by user');
  rl.close();
  process.exit(0);
});

main().catch(console.error);