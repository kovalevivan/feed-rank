# Инструкция по развертыванию

## Подготовка к деплою

### 1. Установка зависимостей

```bash
# Установка зависимостей клиента
cd client
npm install

# Установка зависимостей сервера
cd ../server
npm install
```

### 2. Сборка клиента

```bash
cd client
npm run build
```

Это создаст оптимизированную production-сборку в папке `client/build/`.

## Развертывание на сервере

### Вариант 1: Docker Compose (рекомендуется)

Уже настроен в `docker-compose.yml`:

```bash
# Из корня проекта
docker-compose up -d --build
```

Это запустит:
- **Client** на порту 80
- **Server API** на порту 5001
- **MongoDB** на порту 27017

### Вариант 2: Раздельное развертывание

#### Сервер (API)

```bash
cd server
npm install
npm start
```

Или с PM2:

```bash
cd server
pm2 start server.js --name feedrank-api
pm2 save
pm2 startup
```

#### Клиент

Для production рекомендуется использовать Nginx для раздачи статических файлов:

**nginx.conf пример:**

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    root /path/to/feedrank2/client/build;
    index index.html;

    # Раздача статических файлов
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Проксирование API запросов
    location /api {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Перезапустите Nginx:

```bash
sudo nginx -t
sudo systemctl restart nginx
```

### Вариант 3: Использование встроенного Nginx из Docker

Клиент уже имеет Dockerfile и nginx.conf:

```bash
cd client
docker build -t feedrank-client .
docker run -d -p 80:80 feedrank-client
```

## Переменные окружения

### Server (.env)

```env
NODE_ENV=production
PORT=5001
MONGODB_URI=mongodb://localhost:27017/feedrank2
JWT_SECRET=your_production_secret_key_here
VK_ACCESS_TOKEN=your_vk_token
VK_SERVICE_KEY=your_vk_service_key
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_API_ID=your_telegram_api_id
TELEGRAM_API_HASH=your_telegram_api_hash
```

### Client

Убедитесь, что в `client/src/api/axios.js` правильно настроен baseURL:

```javascript
const instance = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  // ...
});
```

Для production можно задать:

```env
REACT_APP_API_URL=https://yourdomain.com/api
```

## Проверка развертывания

1. **Посадочная страница**: http://yourdomain.com/
2. **Личный кабинет**: http://yourdomain.com/app
3. **API Health Check**: http://yourdomain.com/api/health (если есть)

## Структура URL после развертывания

```
├── / → Landing Page (публичная)
├── /login → Страница входа
├── /register → Страница регистрации
└── /app → Личный кабинет (требует авторизации)
    ├── / → Dashboard
    ├── /sources → Источники
    ├── /source-groups → Группы источников
    ├── /channels → Telegram каналы
    ├── /mappings → Маппинги
    ├── /analytics → Аналитика
    └── /settings → Настройки
```

## Мониторинг

### PM2

```bash
# Просмотр логов
pm2 logs feedrank-api

# Статус приложения
pm2 status

# Перезапуск
pm2 restart feedrank-api
```

### Docker

```bash
# Просмотр логов
docker-compose logs -f

# Статус контейнеров
docker-compose ps

# Перезапуск
docker-compose restart
```

## SSL/HTTPS (рекомендуется)

Для production обязательно настройте SSL с помощью Let's Encrypt:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

## Обновление на сервере

```bash
# Остановить сервисы
docker-compose down
# или
pm2 stop feedrank-api

# Обновить код
git pull origin main

# Пересобрать клиент
cd client
npm install
npm run build

# Запустить сервисы
docker-compose up -d --build
# или
cd ../server
npm install
pm2 restart feedrank-api
```

## Резервное копирование

Настройте регулярное резервное копирование MongoDB:

```bash
# Создать бэкап
mongodump --uri="mongodb://localhost:27017/feedrank2" --out=/path/to/backup/

# Восстановить из бэкапа
mongorestore --uri="mongodb://localhost:27017/feedrank2" /path/to/backup/feedrank2/
```

## Troubleshooting

### Клиент не загружается
- Проверьте, что `npm run build` выполнился успешно
- Проверьте права доступа к папке `client/build`
- Проверьте логи Nginx: `sudo tail -f /var/log/nginx/error.log`

### API не отвечает
- Проверьте, что сервер запущен: `pm2 status` или `docker ps`
- Проверьте переменные окружения
- Проверьте подключение к MongoDB

### Маршруты не работают
- Убедитесь, что Nginx настроен на `try_files $uri $uri/ /index.html`
- Проверьте, что клиент собран с правильными путями

