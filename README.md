# Telegram Veggie Bot

Монолитный бэкенд на NestJS для управления двумя Telegram-ботами (клиентский и админский) для бизнеса по доставке овощей в Минске.

## Технологии

- **Backend**: NestJS + TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Telegram**: nestjs-telegraf (Telegraf.js v4)
- **Hosting**: Render (Web Service) + Supabase (Database & Edge Functions)

## Архитектура

- Два изолированных бота (ClientBot и AdminBot) с отдельными токенами
- Сессии хранятся в PostgreSQL (решение проблемы холодного старта Render)
- Supabase Edge Function для проксирования webhook и уведомления о пробуждении сервера

## Локальная разработка

### 1. Установка зависимостей

```bash
npm install
```

### 2. Настройка окружения

Скопируйте `.env.example` в `.env` и заполните переменные:

```bash
cp .env.example .env
```

Переменные:
- `DATABASE_URL` - строка подключения к PostgreSQL
- `CLIENT_BOT_TOKEN` - токен клиентского бота от @BotFather
- `ADMIN_BOT_TOKEN` - токен админского бота от @BotFather
- `RENDER_BACKEND_URL` - URL вашего приложения на Render
- `TELEGRAM_API_URL` - URL Telegram API (по умолчанию https://api.telegram.org)

### 3. Запуск базы данных

```bash
docker-compose up postgres -d
```

### 4. Применение миграций

```bash
npx prisma migrate dev
```

### 5. Запуск приложения

```bash
npm run start:dev
```

## Деплой на Render + Supabase

### 1. База данных (Supabase)

1. Создайте проект на [Supabase](https://supabase.com)
2. Скопируйте строку подключения PostgreSQL
3. Обновите `DATABASE_URL` в настройках Render

### 2. Edge Function (Supabase)

1. Установите Supabase CLI:
```bash
npm install -g supabase
```

2. Войдите в аккаунт:
```bash
supabase login
```

3. Переименуйте файл обратно:
```bash
mv supabase/functions/telegram-proxy/index.ts.deno supabase/functions/telegram-proxy/index.ts
```

4. Деплой функции:
```bash
supabase functions deploy telegram-proxy --project-ref YOUR_PROJECT_REF
```

5. Установите переменные окружения для функции:
```bash
supabase secrets set BOT_TOKEN=your_client_or_admin_bot_token --project-ref YOUR_PROJECT_REF
supabase secrets set RENDER_BACKEND_URL=https://your-app.onrender.com --project-ref YOUR_PROJECT_REF
supabase secrets set TELEGRAM_API_URL=https://api.telegram.org --project-ref YOUR_PROJECT_REF
```

### 3. Backend (Render)

1. Создайте Web Service на [Render](https://render.com)
2. Подключите GitHub репозиторий
3. Настройте переменные окружения (см. `.env.example`)
4. Build Command: `npm install && npx prisma generate && npm run build`
5. Start Command: `npx prisma migrate deploy && node dist/main.js`

### 4. Настройка Webhook

После деплоя настройте webhook для ботов, указывая URL Supabase Edge Function:

```bash
# Для клиентского бота
curl -X POST "https://api.telegram.org/bot<CLIENT_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://<your-project-ref>.supabase.co/functions/v1/telegram-proxy"}'

# Для админского бота
curl -X POST "https://api.telegram.org/bot<ADMIN_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://<your-project-ref>.supabase.co/functions/v1/telegram-proxy"}'
```

## Структура проекта

```
telegram-veggie-bot/
├── prisma/
│   └── schema.prisma          # Схема базы данных
├── src/
│   ├── admin-bot/             # Админский бот
│   │   ├── admin-bot.module.ts
│   │   ├── admin-bot.service.ts
│   │   └── admin-bot.update.ts
│   ├── client-bot/            # Клиентский бот
│   │   ├── client-bot.module.ts
│   │   ├── client-bot.service.ts
│   │   └── client-bot.update.ts
│   ├── common/
│   │   ├── interfaces/
│   │   │   └── bot-context.interface.ts
│   │   └── middleware/
│   │       └── session.middleware.ts
│   ├── prisma/
│   │   ├── prisma.module.ts
│   │   └── prisma.service.ts
│   ├── app.module.ts
│   └── main.ts
├── supabase/
│   └── functions/
│       └── telegram-proxy/
│           └── index.ts.deno  # Edge Function для проксирования webhook
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

## Функционал

### Клиентский бот
- `/start` - Приветствие и регистрация
- Каталог товаров с фото и ценами
- Корзина с добавлением/удалением товаров
- Оформление заказа (телефон + адрес)
- Просмотр истории заказов

### Админский бот
- Уведомления о новых заказах
- Управление статусами заказов (Принять/Отменить/Завершить)
- `/stock` - Просмотр товаров на складе
- Активация/деактивация товаров

## База данных

Модели:
- `User` - Пользователи (клиенты и админы)
- `Product` - Товары
- `Order` - Заказы
- `OrderItem` - Позиции в заказе
- `Session` - Сессии ботов (для персистентности состояния)

## Лицензия

MIT

# bulba_v_hatu
