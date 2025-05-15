#!/bin/bash

echo "FeedRank Setup Script"
echo "====================="
echo ""
echo "This script will help you set up the FeedRank application."
echo ""

# Check if .env file exists
if [ -f .env ]; then
    echo "A .env file already exists. Do you want to overwrite it? (y/n)"
    read -r overwrite
    if [[ ! $overwrite =~ ^[Yy]$ ]]; then
        echo "Setup cancelled. Your existing .env file was not modified."
        exit 1
    fi
fi

# Create a new .env file
echo "Creating .env file..."
cat > .env << EOF
# MongoDB connection string
MONGODB_URI=mongodb://mongo:27017/feedrank

# JWT Secret for authentication
JWT_SECRET=$(openssl rand -hex 32)

# VK API credentials
VK_APP_ID=
VK_APP_SECRET=
VK_ACCESS_TOKEN=

# Telegram Bot token
TELEGRAM_BOT_TOKEN=
EOF

echo "Basic .env file created with a random JWT_SECRET."
echo ""

# Help with VK API setup
echo "Do you want to set up VK API credentials now? (y/n)"
read -r setup_vk
if [[ $setup_vk =~ ^[Yy]$ ]]; then
    echo ""
    echo "VK API Setup Instructions:"
    echo "1. Go to https://vk.com/apps?act=manage and create a new application"
    echo "2. Note the App ID from your application settings"
    
    echo ""
    echo "Enter your VK APP ID:"
    read -r vk_app_id
    sed -i'' -e "s/VK_APP_ID=/VK_APP_ID=$vk_app_id/" .env
    
    echo ""
    echo "To get a VK Access Token with the required permissions, run:"
    echo "node server/scripts/get_vk_token.js"
    echo ""
    
    # Update the script with the provided App ID
    if [ -f server/scripts/get_vk_token.js ]; then
        sed -i'' -e "s/YOUR_VK_APP_ID/$vk_app_id/" server/scripts/get_vk_token.js
        echo "The get_vk_token.js script has been updated with your App ID."
        echo "Run it now? (y/n)"
        read -r run_script
        if [[ $run_script =~ ^[Yy]$ ]]; then
            node server/scripts/get_vk_token.js
            
            echo ""
            echo "Enter the VK Access Token from the URL:"
            read -r vk_access_token
            sed -i'' -e "s/VK_ACCESS_TOKEN=/VK_ACCESS_TOKEN=$vk_access_token/" .env
        fi
    else
        echo "Warning: get_vk_token.js script not found. Make sure to create it first."
    fi
fi

echo ""
echo "Setup completed."
echo "You can edit the .env file manually to add or change any values."
echo ""
echo "To start the application, run:"
echo "docker compose up -d"
echo "" 