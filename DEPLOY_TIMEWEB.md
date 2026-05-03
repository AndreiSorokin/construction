# Deploy to Timeweb Cloud

## Вариант для MVP

Рекомендуемый вариант: Timeweb Cloud App Platform + отдельная PostgreSQL база.

Домен на старте не обязателен. После деплоя Timeweb выдаст технический домен приложения. Его нужно будет указать в `CLIENT_URL`, чтобы email-приглашения вели на правильный фронтенд.

## Что деплоится

`docker-compose.yml` поднимает три сервиса:

- `gateway` - nginx, первый сервис compose, принимает внешний трафик;
- `client` - Next.js;
- `server` - NestJS API.

Фронтенд ходит в API через относительный путь `/api`, поэтому отдельный API-домен не нужен.

## База данных

Создайте PostgreSQL в Timeweb Cloud и скопируйте connection string в переменную:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME?schema=public
```

Не храните production базу внутри Docker Compose без постоянного хранилища.

## Переменные приложения

В Timeweb App Platform добавьте переменные из `.env.production.example`.

Минимально нужны:

```env
NEXT_PUBLIC_API_URL=/api
DATABASE_URL=...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
CLIENT_URL=https://technical-domain-from-timeweb
```

Для email-приглашений дополнительно:

```env
SMTP_HOST=...
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=...
SMTP_TLS_REJECT_UNAUTHORIZED=true
```

## Деплой через App Platform

1. Создайте приложение в Timeweb Cloud App Platform.
2. Выберите Docker Compose.
3. Подключите GitHub/GitLab/Bitbucket репозиторий.
4. Выберите ветку.
5. Укажите переменные окружения.
6. Запустите деплой.

При включенном автодеплое Timeweb будет пересобирать приложение после новых коммитов в выбранную ветку.

## CI/CD

В репозитории добавлен `.github/workflows/ci.yml`.

Он делает:

- build NestJS API;
- Prisma generate;
- build Next.js client;
- build Docker images через `docker compose build`.

CD можно делать двумя способами:

- проще для MVP: включить автодеплой в Timeweb App Platform;
- позже: добавить отдельный GitHub Actions deploy job по SSH на VPS или через registry, если вместо App Platform будет выбран облачный сервер.
