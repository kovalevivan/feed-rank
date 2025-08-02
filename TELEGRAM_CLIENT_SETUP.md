# 🚀 Telegram Client Setup Guide

This guide helps you set up **Telegram Client API** to read messages from channels and groups you're subscribed to (not just ones where you can add bots as admin).

## 📋 Prerequisites

1. **Telegram Account** - Your personal Telegram account
2. **API Credentials** - Get from [my.telegram.org/apps](https://my.telegram.org/apps)
3. **Phone Access** - For receiving verification codes

## 🔧 Setup Process

### Step 1: Get Telegram API Credentials

1. Go to [my.telegram.org/apps](https://my.telegram.org/apps)
2. Log in with your Telegram account
3. Create a new application:
   - **App title**: FeedRank
   - **Short name**: feedrank
   - **Platform**: Server
   - **Description**: Social media aggregator
4. Copy your **API ID** and **API Hash**

### Step 2: Run Setup Script

```bash
# Navigate to server directory
cd server

# Install dependencies (if not done already)
npm install

# Run the setup script
node scripts/setup-telegram-client.js
```

### Step 3: Follow Interactive Setup

The script will ask for:

1. **API ID** (from Step 1)
2. **API Hash** (from Step 1)  
3. **Phone Number** (with country code, e.g., +1234567890)
4. **Verification Code** (sent via SMS/call)
5. **2FA Password** (if you have two-factor authentication enabled)

### Step 4: Environment Variables

The script will automatically add these to your `.env` file:

```env
# Telegram Client API (for reading subscribed channels)
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash
TELEGRAM_PHONE=+1234567890
TELEGRAM_SESSION=your_session_string

# Telegram Bot API (for sending messages - optional)
TELEGRAM_BOT_TOKEN=your_bot_token
```

## 🎯 How It Works

### **Two API Modes:**

1. **🤖 Bot API** - For channels where your bot is admin
   - Limited to channels where bot has permissions
   - Good for sending messages to your own channels

2. **👤 Client API** - For channels you're subscribed to
   - Uses your personal account credentials
   - Can read from ANY channel/group you're subscribed to
   - **This is what you need for reading subscribed channels!**

### **Automatic Fallback:**

The system automatically chooses the best API:

- **Client API First** - Tries to use your personal account
- **Bot API Fallback** - Uses bot if Client API fails
- **Error Handling** - Clear messages about what's working

## 📱 Using Telegram Sources

After setup, you can:

### 1. **Discover Subscriptions**
- Go to **Telegram Sources** in the web interface
- Click **"Load Subscriptions"** to see channels you're subscribed to
- Select channels to monitor for viral posts

### 2. **Add Sources Manually**  
- Use **Channel ID** or **@username**
- System will auto-detect if it's a channel/group
- Configure viral detection settings

### 3. **Monitor & Process**
- Real-time message monitoring
- Manual processing triggers
- Viral detection based on views/engagement

## 🔍 Troubleshooting

### **"PHONE_CODE_INVALID"**
- Double-check the verification code
- Make sure you're entering it quickly (codes expire)

### **"API_ID_INVALID"**  
- Verify API ID and Hash from [my.telegram.org/apps](https://my.telegram.org/apps)
- Make sure API ID is a number, API Hash is a string

### **"Telegram Client not connected"**
- Restart your server after setup
- Check that all environment variables are set
- Re-run setup script if session is corrupted

### **"No subscriptions found"**
- Make sure you're subscribed to some channels/groups
- Client API needs a few seconds to connect after server start
- Check server logs for Client API initialization messages

### **Session Issues**
- Delete `TELEGRAM_SESSION` from `.env` and re-run setup
- Make sure you have permission to write to `.env` file

## 🔒 Security Notes

- **Session String** - Keep your `TELEGRAM_SESSION` secret (like a password)
- **API Credentials** - Don't share your API ID/Hash publicly
- **Phone Number** - Only stored locally in your `.env` file
- **2FA** - Recommended for additional security

## 📊 What Gets Monitored

The system monitors:

- ✅ **Public Channels** (you're subscribed to)
- ✅ **Private Channels** (you have access to)  
- ✅ **Supergroups** (large groups)
- ✅ **Regular Groups** (small groups)
- ❌ **Private Messages** (not monitored for privacy)

## 🎉 Success!

After successful setup, you'll see:

```
✅ Telegram Client API initialized
✅ All services initialized successfully
```

Now you can read messages from **any** Telegram channel or group you're subscribed to, not just ones where you can add bots! 🚀