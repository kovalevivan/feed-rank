# 🔬 VK Views Experiment - Быстрый запуск

Экспериментальный сервис для исследования динамики просмотров постов ВКонтакте.

## 🚀 Быстрый старт

### 1. Проверка работоспособности

```bash
# Из корня проекта
cd /Users/ivankovalev/Documents/sandbox/feedrank2

# Запуск теста
node server/test-vk-experiment.js
```

### 2. Запуск эксперимента

```bash
# БЫСТРЫЙ ТЕСТ (5 минут интервалы, 30 минут общее время)
node server/run-vk-experiment.js start-test

# Или используйте специальный скрипт для быстрого теста
node server/test-vk-experiment-quick.js

# Полный эксперимент (30 минут интервалы, 8 часов)
node server/run-vk-experiment.js start

# С собственными настройками
VK_EXPERIMENT_TOKEN="your_token" VK_EXPERIMENT_GROUPS="group1,group2" node server/run-vk-experiment.js start-test
```

### 3. Мониторинг

```bash
# Проверка статуса
node server/run-vk-experiment.js status

# Остановка эксперимента
node server/run-vk-experiment.js stop
```

## 📊 Что собирается

### Краткосрочные данные (8 часов, каждые 30 минут)
- Файл: `server/services/vk-experiment/data/short_term_views.csv`
- Содержит: просмотры, лайки, репосты по времени

### Долгосрочные данные (24 и 48 часов)
- Файл: `server/services/vk-experiment/data/long_term_views.csv`
- Содержит: итоговые изменения просмотров

## ⚙️ Конфигурация

Создайте файл `.env` в корне проекта или установите переменные:

```env
# Токен ВК (по умолчанию используется тестовый)
VK_EXPERIMENT_TOKEN=033b5ad1033b5ad1033b5ad18b000beccb0033b033b5ad16b2dd6d4b4dc1ca34cf5232a

# Группы для отслеживания (по умолчанию: chp_nn)
VK_EXPERIMENT_GROUPS=chp_nn,group2,group3

# Тестовый режим (для быстрого тестирования)
VK_EXPERIMENT_TEST_MODE=true
VK_EXPERIMENT_TEST_INTERVAL=5  # минуты
```

## 🎯 Принцип работы

### 🧪 Тестовый режим (рекомендуется для начала)
1. **Краткосрочное отслеживание**: 6 проверок каждые 5 минут (30 минут общее время)
2. **Новые сессии**: Каждые 10 минут
3. **Быстрая проверка работоспособности** за 30 минут

### 🚀 Продакшн режим
1. **Запуск сессии**: Собирает данные о последних 10 постах каждой группы
2. **Краткосрочное отслеживание**: 16 проверок каждые 30 минут (8 часов)
3. **Долгосрочное отслеживание**: Автоматические проверки через 24 и 48 часов
4. **Новые сессии**: Автоматически каждые 12 часов

## 📈 Анализ данных

CSV файлы можно анализировать в Excel, Google Sheets или Python/R:

```python
import pandas as pd

# Краткосрочные данные
df_short = pd.read_csv('server/services/vk-experiment/data/short_term_views.csv')

# Долгосрочные данные  
df_long = pd.read_csv('server/services/vk-experiment/data/long_term_views.csv')
```

## 🔧 Устранение проблем

### "VK API Authentication Error"
- Проверьте токен ВК
- Убедитесь, что токен имеет права на чтение стены сообществ

### "Group not found"
- Убедитесь, что группа существует и публична
- Попробуйте использовать ID группы вместо имени

### Нет данных в CSV
- Проверьте права записи в папку `server/services/vk-experiment/data/`
- Убедитесь, что эксперимент не был остановлен

## 📁 Структура файлов

```
server/
├── run-vk-experiment.js          # Запуск из корня проекта
├── test-vk-experiment.js         # Тестирование
└── services/vk-experiment/
    ├── index.js                   # Основной класс эксперимента
    ├── cli.js                     # CLI интерфейс  
    ├── README.md                  # Подробная документация
    ├── package.json               # Конфигурация пакета
    ├── config.example.env         # Пример конфигурации
    └── data/                      # Папка с CSV данными
        ├── short_term_views.csv
        └── long_term_views.csv
```

## 🔐 Безопасность

- Эксперимент полностью изолирован от основной системы
- Использует отдельный токен ВК
- Только читает публичные данные
- Не изменяет основную базу данных

## 📞 Поддержка

При проблемах:
1. Запустите `node server/test-vk-experiment.js` для диагностики
2. Проверьте логи в консоли
3. Убедитесь в доступности ВК API
