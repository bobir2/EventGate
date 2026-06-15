# EventGate

Веб-застосунок для продажу квитків на події. Стек: Node.js, Express, PostgreSQL, HTML/CSS/JS.

## Запуск

1. PostgreSQL (локально або Docker):

```bash
docker run -d --name eventgate-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=eventgate \
  -p 5432:5432 postgres:16
```

2. Налаштування:

```bash
cp .env.example .env
npm install
npm run db:init
npm start
```

Сайт: http://localhost:3000

## Акаунти для перевірки

| Email | Пароль | Роль |
|-------|--------|------|
| user@eventgate.local | user123 | користувач |
| admin@eventgate.local | admin123 | адмін |

## Деплой (Render)

- Build: `npm install && npm run db:init`
- Start: `npm start`
- Змінні: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`
