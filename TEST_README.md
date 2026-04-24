# Тесты для Telegram Veggie Bot

## Структура тестов

### Unit тесты
- `src/client-bot/client-bot.update.spec.ts` - тесты клиентского бота
- `src/admin-bot/admin-bot.update.spec.ts` - тесты админского бота

### E2E тесты
- `test/bot-integration.e2e-spec.ts` - интеграционные тесты взаимодействия ботов

## Запуск тестов

### Все тесты
```bash
npm test
```

### Unit тесты
```bash
npm run test:unit
```

### E2E тесты
```bash
npm run test:e2e
```

### Тесты с покрытием
```bash
npm run test:cov
```

### Тесты в watch режиме
```bash
npm run test:watch
```

## Что тестируется

### Клиентский бот
- ✅ Регистрация нового пользователя
- ✅ Просмотр каталога товаров
- ✅ Добавление товаров в корзину
- ✅ Увеличение количества товара в корзине
- ✅ Очистка корзины
- ✅ Оформление заказа
- ✅ Запрос телефона
- ✅ Запрос адреса
- ✅ Сохранение контакта

### Админский бот
- ✅ Создание админа
- ✅ Проверка прав доступа
- ✅ Просмотр товаров на складе
- ✅ Просмотр заказов
- ✅ Принятие заказа
- ✅ Отмена заказа
- ✅ Завершение заказа
- ✅ Изменение цены товара
- ✅ Изменение остатка товара
- ✅ Активация/деактивация товара

### Интеграционные тесты
- ✅ Полный жизненный цикл заказа
- ✅ Уменьшение остатка после заказа
- ✅ Управление сессиями
- ✅ Взаимодействие клиента и админа

## Настройка тестовой базы данных

Для E2E тестов используется отдельная тестовая база данных. Создайте `.env.test`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/veggie_bot_test?schema=public"
CLIENT_BOT_TOKEN="test_token_client"
ADMIN_BOT_TOKEN="test_token_admin"
```

Примените миграции для тестовой базы:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/veggie_bot_test?schema=public" npx prisma migrate deploy
```

## Запуск тестов в Docker

```bash
# Запустить тесты в контейнере
docker compose exec app npm test

# Запустить E2E тесты
docker compose exec app npm run test:e2e

# Запустить с покрытием
docker compose exec app npm run test:cov
```

## Покрытие кода

После запуска `npm run test:cov` отчет о покрытии будет доступен в `coverage/lcov-report/index.html`

## CI/CD

Тесты автоматически запускаются при:
- Push в любую ветку
- Создании Pull Request
- Перед деплоем на production

## Отладка тестов

Для отладки конкретного теста:

```bash
npm test -- --testNamePattern="should create new user"
```

Для отладки конкретного файла:

```bash
npm test -- client-bot.update.spec.ts
```

## Моки и фикстуры

Все моки находятся в самих тестовых файлах. Для создания тестовых данных используются:
- `mockPrismaService` - мок Prisma клиента
- `mockBot` - мок Telegraf бота
- `mockCtx` - мок контекста Telegram

## Troubleshooting

### Тесты падают с ошибкой подключения к БД
Убедитесь, что PostgreSQL запущен и доступен:
```bash
docker compose up postgres -d
```

### Тесты падают с ошибкой "Table does not exist"
Примените миграции для тестовой базы:
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/veggie_bot_test?schema=public" npx prisma migrate deploy
```

### Тесты проходят локально, но падают в CI
Проверьте переменные окружения в CI и убедитесь, что тестовая база данных доступна.
