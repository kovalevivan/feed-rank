# Telegram Channel Setup Guide

This guide will help you properly set up Telegram channels with FeedRank.

## Prerequisites

1. **Create a Telegram Bot** (if you haven't already)
   - Message [@BotFather](https://t.me/BotFather) on Telegram
   - Send `/newbot` and follow the instructions
   - Copy the bot token (looks like `123456789:ABCDefGhIJKlmNoPQRsTUVwxyZ`)
   - Add this token to your `.env` file as `TELEGRAM_BOT_TOKEN`

## Adding a Telegram Channel

### Method 1: Via the Telegram Bot
1. Add your bot as an **administrator** to your channel
   - Open your channel in Telegram
   - Go to channel info → Administrators → Add Administrator
   - Search for your bot
   - Ensure "Post Messages" permission is enabled
   
2. Send a command to the bot directly (in a private chat with the bot):
   - Format: `/addtg @username` or `/addtg -100123456789`
   - Example: `/addtg @my_news_channel`
   
3. The bot will:
   - Verify it has access to the channel
   - Send a test message
   - Add the channel to the database

### Method 2: Via the Web Interface
1. Add your bot as an **administrator** to your channel (as described above)
2. In the FeedRank web interface:
   - Go to "Channels" → "Add Channel"
   - Enter the channel information:
     - Name: A friendly name for the channel
     - Channel ID: The numeric ID (e.g., `-1002313558754`)
     - OR Username: The channel username (e.g., `@my_news_channel`)

## Troubleshooting

### No Error Message in Web Interface
If you don't see any error message when trying to add a channel:
1. Check the server logs for details
2. Verify your database connection (different for Docker vs local)
3. Ensure the bot is an admin of the channel

### Cannot Send Messages to Channel
1. Verify the bot is an admin with "Post Messages" permission
2. Try removing and re-adding the bot to the channel
3. Check that you're using the correct channel ID or username

### Finding Your Channel ID
To find your Telegram channel ID:
1. Forward a message from your channel to [@username_to_id_bot](https://t.me/username_to_id_bot)
2. The bot will tell you the channel ID (should start with `-100` followed by numbers)

### Testing Channel Access
You can run our diagnostic script:
```
node test-telegram-channel.js -1001234567890
```
Replace the number with your channel ID.

## MongoDB Configuration
Make sure you're using the correct MongoDB connection string:
- Local development: `mongodb://localhost:27017/feedrank`
- Docker: `mongodb://mongo:27017/feedrank` 