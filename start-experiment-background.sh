#!/bin/bash

# VK Experiment Background Starter
# Запуск эксперимента VK Views в фоновом режиме

echo "🔬 Запуск VK Views Experiment в фоновом режиме..."

# Создаем папку для логов, если её нет
mkdir -p logs

# Останавливаем предыдущий процесс, если он есть
echo "🛑 Проверка и остановка предыдущих процессов..."
pkill -f "run-vk-experiment" 2>/dev/null || echo "   Предыдущих процессов не найдено"

# Запускаем эксперимент в фоне с логированием
echo "🚀 Запуск нового процесса..."
nohup node server/run-vk-experiment.js start-test > logs/experiment.log 2>&1 &
PID=$!

echo "✅ Эксперимент запущен!"
echo "   PID: $PID"
echo "   Лог файл: logs/experiment.log"
echo ""
echo "📊 Полезные команды:"
echo "   Посмотреть логи:     tail -f logs/experiment.log"
echo "   Проверить процесс:   ps aux | grep run-vk-experiment"
echo "   Остановить:          kill $PID"
echo "   Статус эксперимента: node server/run-vk-experiment.js status"
echo ""

# Ждем немного и показываем начальные логи
sleep 3
echo "📋 Первые строки лога:"
head -10 logs/experiment.log 2>/dev/null || echo "   Лог файл еще создается..."
