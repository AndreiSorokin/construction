# Развёртывание на своём хосте (без docker)

Postgres, S3-хранилище и веб-сервер уже подняты на хосте — проект их не поднимает
и никаких docker-файлов больше не содержит. Ниже — только то, что относится к приложению.

## 1. Что нужно на хосте

- **Node.js 20+** и npm
- **PostgreSQL 14+** — база и пользователь для приложения
- **S3-совместимое хранилище** (MinIO или облачное) — бакет для вложений
- **nginx** (или другой обратный прокси) + сертификат HTTPS
- **pm2** либо systemd — чтобы процессы поднимались после перезагрузки

## 2. Установка

```bash
cd /opt/interstroy            # куда распакован проект

# ── сервер (API) ──
cd server
cp .env.example .env          # заполнить: DATABASE_URL, S3_*, JWT_*, WEB_ORIGIN, SMTP_*
npm ci
npm run prisma:generate
npm run prisma:deploy         # применяет миграции, включая 20260714120000_v59_delta
npm run seed                  # ТОЛЬКО при первом запуске: орг.структура и демо-доступы
npm run build

# ── клиент (веб-интерфейс) ──
cd ../client
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL — публичный адрес сайта, например https://sk.example.kz
npm ci
npm run build
```

## 3. Запуск процессов

```bash
# через pm2
pm2 start "npm run start" --name interstroy-server --cwd /opt/interstroy/server
pm2 start "npm run start" --name interstroy-client --cwd /opt/interstroy/client
pm2 save && pm2 startup
```

Сервер слушает `PORT` из `server/.env` (по умолчанию 4000), клиент — 3000.

## 4. nginx

```nginx
server {
    listen 443 ssl http2;
    server_name sk.example.kz;

    # сертификаты — ваши
    ssl_certificate     /etc/letsencrypt/live/sk.example.kz/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sk.example.kz/privkey.pem;

    client_max_body_size 25m;         # вложения к заявкам

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

При такой схеме в `client/.env.local` укажите публичный адрес: `NEXT_PUBLIC_API_URL=https://sk.example.kz`,
а в `server/.env` — `WEB_ORIGIN=https://sk.example.kz`, `COOKIE_SECURE=true`.

## 5. Первичная настройка в браузере

1. Войти `admin` / `admin` — **сразу сменить пароль** (Настройки → Люди).
2. Настройки → Приложение: логотип компании, лимит заявок «Срочно».
3. Настройки → Люди: сотрудники (логин подставляется автоматически, можно задать свой).
4. Настройки → Отделы · Объекты · ИП · Номенклатура.
5. Настройки → Маршруты согласования — **до** того, как люди начнут подавать заявки:
   без маршрута заявка уходит сразу в снабжение (в историю пишется предупреждение).

## 6. Бэкапы

```bash
# база
pg_dump -U interstroy interstroy | gzip > /backups/db-$(date +%F).sql.gz

# вложения: синхронизация бакета вашим инструментом (aws s3 sync / mc mirror)
```

Проверяйте восстановление на копии — бэкап без проверки не бэкап.

## 7. Обновление версии

```bash
cd /opt/interstroy/server && npm ci && npm run prisma:deploy && npm run build
cd ../client && npm ci && npm run build
pm2 restart interstroy-server interstroy-client
```

## 8. Безопасность — короткий чек-лист

- пароли демо-учёток сменены, лишние деактивированы (Настройки → Люди → «Уволить»)
- `JWT_ACCESS_SECRET` — длинная случайная строка, не из примера
- `COOKIE_SECURE=true`, сайт только по HTTPS
- Postgres и S3 не смотрят наружу — доступ только с localhost/внутренней сети
- бэкапы по расписанию и проверенное восстановление
