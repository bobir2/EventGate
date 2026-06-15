# EventGate

Веб-застосунок для продажу квитків на події. Стек: Node.js, Express, SQLite/PostgreSQL, HTML/CSS/JS.

## Запуск

```bash
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

## Структура

- `server/` — API та робота з БД
- `public/` — клієнтська частина
- `data/` — SQLite (локально)

## Деплой

Render або Railway: вказати `DATABASE_URL`, `JWT_SECRET`, команда старту `npm start`.
