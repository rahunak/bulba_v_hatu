# Быстрый старт

## 1. Получите токены ботов

1. Откройте [@BotFather](https://t.me/BotFather) в Telegram
2. Создайте клиентского бота: `/newbot`
3. Создайте админского бота: `/newbot`
4. Сохраните оба токена

## 2. Узнайте свой Telegram ID

1. Откройте [@userinfobot](https://t.me/userinfobot)
2. Отправьте любое сообщение
3. Скопируйте ваш ID

## 3. Обновите данные

### Обновите .env файл:
```bash
DATABASE_URL="postgresql://postgres:postgres@postgres:5432/veggie_bot?schema=public"
CLIENT_BOT_TOKEN="ваш_токен_клиентского_бота"
ADMIN_BOT_TOKEN="ваш_токен_админского_бота"
RENDER_BACKEND_URL="http://localhost:3000"
TELEGRAM_API_URL="https://api.telegram.org"
```

### Обновите telegramId админа в базе:
```bash
docker compose exec app npx prisma studio
```
Откройте http://localhost:5555, найдите пользователя с role=ADMIN и замените telegramId на ваш.

Или через SQL:
```bash
docker compose exec postgres psql -U postgres -d veggie_bot -c "UPDATE \"User\" SET \"telegramId\" = '5151069944' WHERE role = 'ADMIN';"
```

## 4. Настройте webhook (для продакшена)

После деплоя на Render:
```bash
# Клиентский бот
curl -X POST "https://api.telegram.org/bot<CLIENT_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-app.onrender.com/webhook/client"}'

# Админский бот
curl -X POST "https://api.telegram.org/bot<ADMIN_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://your-app.onrender.com/webhook/admin"}'
```

## 5. Локальное тестирование (без webhook)

Для локального тестирования без webhook используйте polling. Обновите `src/app.module.ts`:

Замените `launchOptions` на:
```typescript
launchOptions: {
  // webhook: { ... }  // закомментируйте webhook
},
```

Или используйте ngrok для локального webhook:
```bash
ngrok http 3000
# Используйте ngrok URL в setWebhook
```

## 6. Тестирование

1. Откройте клиентского бота в Telegram
2. Отправьте `/start`
3. Просмотрите каталог товаров
4. Добавьте товары в корзину
5. Оформите заказ

Админский бот получит уведомление о новом заказе.

## Полезные команды

```bash
# Просмотр логов
docker compose logs -f app

# Перезапуск
docker compose restart app

# Остановка
docker compose down

# Prisma Studio (GUI для БД)
docker compose exec app npx prisma studio
```
