# FeedRank - VK to Telegram Viral Posts Aggregator

FeedRank is a web service that helps find and forward viral posts from VK public groups to Telegram channels. It monitors posts from selected VK communities and automatically forwards those that exceed a specified view threshold to designated Telegram channels.

## Features

- Monitor multiple VK public groups for viral content
- Automatically detect viral posts based on view counts
- Configure custom viral thresholds per VK group
- Set up flexible mappings between VK groups and Telegram channels
- Manage everything through a Material UI web interface or Telegram bot commands
- Schedule automatic checks with customizable frequency
- Support for at least 100 VK public groups

## Tech Stack

### Frontend
- React.js
- Material UI
- Redux Toolkit
- Axios
- React Router

### Backend
- Node.js
- Express
- MongoDB
- VK API (via vk-io)
- Telegram Bot API

## Setup Instructions

### Prerequisites
- Node.js (v14+ recommended)
- MongoDB
- VK API access
- Telegram Bot token

### Environment Variables
Create a `.env` file in the root directory with the following variables:

```
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
VK_APP_ID=your_vk_app_id
VK_APP_SECRET=your_vk_app_secret
VK_ACCESS_TOKEN=your_vk_access_token
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
```

### Setting up VK API Credentials

1. Create a VK application at https://vk.com/apps?act=manage
2. Note your VK App ID and Secret
3. To get a VK Access Token with the necessary permissions:
   - Run the helper script:
     ```
     cd server/scripts
     node get_vk_token.js
     ```
   - Update the script with your VK App ID
   - Open the generated URL in your browser
   - Authorize the application
   - Copy the access_token from the redirected URL
   - Add it to your `.env` file as `VK_ACCESS_TOKEN`

The access token requires the following permissions:
- `groups` - To access group information
- `wall` - To read posts
- `offline` - For a long-lived token

### Installation

1. Clone the repository
```
git clone https://github.com/yourusername/feedrank.git
cd feedrank
```

2. Install dependencies for server
```
cd server
npm install
```

3. Install dependencies for client
```
cd ../client
npm install
```

4. Run the application in development mode
```
# Terminal 1 - Start the server
cd server
npm run dev

# Terminal 2 - Start the client
cd client
npm start
```

5. Build for production
```
cd client
npm run build
```

### Docker Setup

You can also run the application using Docker:

1. Build the Docker images
```
docker-compose build
```

2. Run the Docker containers
```
docker-compose up
```

3. To run in detached mode
```
docker-compose up -d
```

4. To stop the containers
```
docker-compose down
```

## Docker Configuration

The project includes a `docker-compose.yml` file that sets up:
- MongoDB database
- Node.js backend
- React frontend

To customize the Docker setup, edit the `docker-compose.yml` file and the Dockerfiles in the respective directories.

### Telegram Bot Commands

- `/start` - Initialize the bot
- `/help` - Show available commands
- `/addvk [group_name]` - Add a new VK public group
- `/removevk [group_id]` - Remove a VK public group
- `/addtg [channel_name_or_id]` - Add a Telegram channel (can use @username or ID)
- `/removetg [channel_id]` - Remove a Telegram channel
- `/map [vk_id] [tg_id]` - Create a mapping
- `/unmap [vk_id] [tg_id]` - Remove a mapping
- `/list` - List all configured sources and destinations
- `/status` - Show system status

## License

MIT 

## Troubleshooting

### VK API Authentication Issues

If you encounter the error "User authorization failed: no access_token passed" or similar authentication issues with the VK API:

1. Make sure your `.env` file contains a valid `VK_ACCESS_TOKEN`
2. If you need to obtain a new token, run the helper script:
   ```
   node server/scripts/get_vk_token.js
   ```
3. Follow the instructions provided by the script to authorize and get a new token
4. Copy the token to your `.env` file

### VK Group Resolution Issues

If you encounter errors when trying to resolve VK group names or IDs:

1. The application uses multiple methods to resolve groups, including:
   - Direct lookup via `groups.getById`
   - Screen name resolution via `utils.resolveScreenName`
   - Wall access via `wall.get`

2. Make sure the group exists and is publicly accessible
3. You can try using a numeric group ID if the name doesn't resolve

### Telegram Bot Issues

If you encounter "Telegram bot token not set" errors:

1. Verify your `.env` file has a valid `TELEGRAM_BOT_TOKEN` entry
2. If using Docker, make sure the environment variable is correctly passed to the container
3. Check that the bot is activated and working by talking to it directly in Telegram

### Adding Telegram Channels

You can add Telegram channels in multiple ways:

1. **Using Channel Username**: 
   - Via bot: `/addtg @channel_username`
   - Via web interface: Enter the username with or without @ prefix

2. **Using Channel ID**:
   - Via bot: `/addtg -100123456789`
   - Via web interface: Enter the channel ID

For any method to work, the bot must be an **admin** of the channel with permission to post messages.

### Docker Environment Issues

If using Docker and environment variables aren't correctly passed:

1. Make sure your `.env` file exists in the project root
2. Verify Docker Compose is correctly using the environment variables:
   ```yaml
   environment:
     - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
     - VK_ACCESS_TOKEN=${VK_ACCESS_TOKEN}
   ```
3. Try running `docker-compose config` to check if variables are correctly substituted 