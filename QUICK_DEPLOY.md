# Быстрое развертывание на сервере

## Краткие команды для деплоя

### Через Docker (самый простой способ)

```bash
# 1. Загрузить код на сервер
git pull origin main

# 2. Запустить всё одной командой
docker-compose up -d --build

# Готово! Приложение доступно на порту 80
```

### Без Docker

```bash
# 1. Установить зависимости и собрать клиент
cd client
npm install
npm run build

# 2. Установить зависимости сервера
cd ../server
npm install

# 3. Запустить сервер
pm2 start server.js --name feedrank-api
pm2 save

# 4. Настроить Nginx (см. конфиг ниже)
```

## Минимальная конфигурация Nginx

```nginx
server {
    listen 80;
    server_name _;

    root /path/to/feedrank2/client/build;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Что изменилось

✅ **/ (главная)** → Теперь посадочная страница  
✅ **/app** → Личный кабинет (весь функционал)  
✅ **/login, /register** → Авторизация  

## Проверка после деплоя

1. Откройте **http://ваш-сервер/** → должна показаться красивая посадочная страница
2. Нажмите "Вход" или перейдите на **/app** → должен перенаправить на логин
3. Войдите в систему → должен перенаправить на **/app** (Dashboard)

## Если что-то не работает

```bash
# Проверить логи Docker
docker-compose logs -f

# Или логи PM2
pm2 logs feedrank-api

# Или логи Nginx
sudo tail -f /var/log/nginx/error.log
```

## Переменные окружения

Не забудьте проверить `.env` файлы:
- `server/.env` - токены API, MongoDB URI
- `client/.env` (опционально) - URL API

Вот и всё! 🚀

