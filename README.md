# CookLog

Личный дневник рецептов. Статический фронтенд (HTML/CSS/JS) + Cloudflare Pages Functions + D1.

## Стек

- **Фронтенд** — чистый HTML/CSS/JS, PWA (устанавливается на телефон, работает офлайн для статики)
- **Хостинг** — Cloudflare Pages
- **API** — Cloudflare Pages Functions (`/functions/api/*`)
- **База данных** — Cloudflare D1 (SQLite)
- **Авторизация админки** — пароль администратора + подписанная HttpOnly cookie-сессия (30 дней)

## Деплой

Полная инструкция — в [`DEPLOY.md`](./DEPLOY.md).

Коротко:
1. `wrangler d1 create cooklog-db`, применить `schema.sql`
2. Подключить репозиторий к Cloudflare Pages, добавить D1-биндинг `DB`
3. Задать секреты `ADMIN_PASSWORD` и `SESSION_SECRET`
4. Пуш в `main` — автодеплой
