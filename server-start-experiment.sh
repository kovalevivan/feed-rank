#!/bin/bash

# VK Experiment Server Setup & Start
# Быстрая установка и запуск на сервере

echo "🔬 VK Experiment Server Setup"
echo "============================="

# 1. Проверяем, где мы
echo "📁 Current directory: $(pwd)"

# 2. Устанавливаем зависимости
echo "📦 Installing dependencies..."
if [ -f "package.json" ]; then
    npm install
    if [ $? -eq 0 ]; then
        echo "✅ Dependencies installed successfully"
    else
        echo "❌ Failed to install dependencies"
        exit 1
    fi
else
    echo "❌ package.json not found. Are you in the project root?"
    exit 1
fi

# 3. Проверяем нужные зависимости
echo "🔍 Checking required modules..."
npm list dotenv vk-io node-cron --depth=0

# 4. Останавливаем предыдущие процессы
echo "🛑 Stopping previous processes..."
pkill -f "run-vk-experiment" 2>/dev/null || echo "   No previous processes found"

# 5. Запускаем ПОЛНЫЙ эксперимент в фоне
echo "🚀 Starting FULL experiment (30 min intervals, 8 hours)..."
nohup node server/run-vk-experiment.js start > experiment.log 2>&1 &
PID=$!

echo "✅ Experiment started!"
echo "   PID: $PID"
echo "   Log file: experiment.log"
echo ""

# 6. Ждем и показываем первые логи
echo "📋 Waiting for startup (10 seconds)..."
sleep 10

if [ -f "experiment.log" ]; then
    echo "📊 First log entries:"
    head -15 experiment.log
else
    echo "⚠️  Log file not created yet"
fi

echo ""
echo "🔧 Useful commands:"
echo "   View logs:        tail -f experiment.log"
echo "   Check process:    ps aux | grep run-vk-experiment"
echo "   Stop experiment:  kill $PID"
echo "   Check data:       ls -la server/services/vk-experiment/data/"
