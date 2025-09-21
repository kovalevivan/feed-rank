# 🚀 Запуск VK Experiment на сервере

## 1. Установка зависимостей

```bash
# На сервере в папке feed-rank
cd ~/feed-rank

# Установить зависимости для основного проекта
npm install

# Проверить, что установлены нужные модули
npm list dotenv vk-io node-cron
```

## 2. Запуск ПОЛНОГО эксперимента (30 мин интервалы)

```bash
# Обычный запуск (30 минут интервалы, 8 часов общее время)
node server/run-vk-experiment.js start

# Фоновый запуск с логированием
nohup node server/run-vk-experiment.js start > experiment.log 2>&1 &

# Посмотреть PID процесса
echo $!
```

## 3. Мониторинг

```bash
# Проверить процесс
ps aux | grep run-vk-experiment

# Посмотреть логи
tail -f experiment.log

# Проверить статус
node server/run-vk-experiment.js status
```

## 4. Остановка

```bash
# Найти PID
ps aux | grep run-vk-experiment

# Остановить
kill [PID]
```

## 5. Проверка данных

```bash
# Посмотреть созданные файлы CSV
ls -la server/services/vk-experiment/data/

# Первые строки данных
head -5 server/services/vk-experiment/data/short_term_views.csv
```
