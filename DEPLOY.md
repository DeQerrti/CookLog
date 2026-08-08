# Деплой CookLog на Cloudflare (Pages + D1)

Всё делается один раз. После этого — просто `git push`, деплой автоматический.

## 0. Подготовка

Нужен аккаунт Cloudflare (бесплатный) — https://dash.cloudflare.com/sign-up

Локально (или в этом контейнере) понадобится `wrangler` — CLI Cloudflare:

```bash
npm install -g wrangler
wrangler login
```
Откроется браузер — авторизуешься своим Cloudflare-аккаунтом.

## 1. Создать базу D1

```bash
wrangler d1 create cooklog-db
```

Команда выведет что-то вроде:
```
[[d1_databases]]
binding = "DB"
database_name = "cooklog-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**Сохрани `database_id`** — он понадобится на шаге 3.

## 2. Применить схему таблицы

```bash
wrangler d1 execute cooklog-db --remote --file=./schema.sql
```

Это создаст таблицу `recipes` в твоей новой базе.

## 3. Создать `wrangler.toml` в корне репозитория

```toml
name = "cooklog"
compatibility_date = "2024-09-01"
pages_build_output_dir = "."

[[d1_databases]]
binding = "DB"
database_name = "cooklog-db"
database_id = "ВСТАВЬ_СЮДА_database_id_ИЗ_ШАГА_1"
```

## 4. Подключить репозиторий к Cloudflare Pages

1. Зайди в [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
2. Выбери репозиторий `CookLog`
3. Настройки сборки:
   - **Framework preset:** None
   - **Build command:** (оставить пустым)
   - **Build output directory:** `/`
4. Нажми **Save and Deploy**

После первого деплоя зайди в настройки проекта → **Settings** → **Functions** → **D1 database bindings** → добавь биндинг:
- **Variable name:** `DB`
- **D1 database:** `cooklog-db`

(Это дублирует то, что в `wrangler.toml`, но для Pages Dashboard иногда нужно указать явно — если `wrangler.toml` подхватится автоматически, шаг можно пропустить.)

## 5. Задать секреты (пароль админки и ключ подписи сессий)

В Dashboard → твой проект → **Settings** → **Environment variables** → **Add variable** (обязательно как **Secret**, не как обычную переменную):

- `ADMIN_PASSWORD` — пароль, которым будешь заходить в `/admin.html`
- `SESSION_SECRET` — любая длинная случайная строка (используется для подписи cookie-сессии). Можно сгенерировать:
  ```bash
  openssl rand -base64 32
  ```

Или через CLI:
```bash
wrangler pages secret put ADMIN_PASSWORD --project-name=cooklog
wrangler pages secret put SESSION_SECRET --project-name=cooklog
```

После добавления секретов — сделай **Retry deployment** (или просто новый пуш), чтобы они подхватились.

## 6. Проверка

- Открой `https://cooklog.pages.dev` (или свой домен, если подключишь) — должна открыться публичная страница с рецептами (пустая, пока не добавишь через админку)
- Открой `/admin.html`, введи `ADMIN_PASSWORD`, добавь тестовый рецепт
- Обнови главную страницу — рецепт должен появиться

## 7. (Опционально) Перенести старые рецепты из Supabase

Если хочешь забрать данные, которые уже есть в Supabase:

```bash
# Экспортируешь recipes из старой Supabase-базы в JSON (через Table Editor → Export, или через API),
# затем можно массово вставить в D1 через wrangler d1 execute с INSERT-запросами,
# сгенерированными из JSON.
```
Если нужно — просто пришли мне экспортированный JSON, я сгенерирую готовые SQL-запросы для импорта.

## 8. Свой домен (опционально)

Dashboard → проект → **Custom domains** → **Set up a custom domain** — если хочешь не `cooklog.pages.dev`, а что-то своё.

---

### Что дальше при обычной работе

Просто `git push` в `main` — Cloudflare Pages сам пересоберёт и задеплоит и статику, и функции. Никаких пауз, лимитов простоя нет — только реальные лимиты бесплатного тарифа D1 (5 GB хранилища, 5 млн операций чтения/сутки) — тебе на дневник рецептов хватит с огромным запасом.
