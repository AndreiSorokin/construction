# Единая система строительного контроля API

MVP backend на NestJS для раздела "Снабжение": объекты, объектные материалы, заявки на закупку, согласования и история изменения цен.

## Стек

- NestJS
- Prisma
- PostgreSQL

## Быстрый старт

```bash
npm install
copy .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run start:dev
```

Перед миграцией укажите реальный `DATABASE_URL` в `.env`.

## Основные модели

- `User` - пользователь с ролью: прораб, начальник участка, снабжение, ПТО, главный инженер, директор.
- `ObjectEntity` - строительный объект или внутренний отдел с лимитом закрытия.
- `UserObjectAccess` - промежуточная таблица доступов пользователей к объектам.
- `ObjectMaterial` - справочник материалов отдельно для каждого объекта.
- `SupplyRequest` - заявка на снабжение с уникальным номером.
- `SupplyRequestItem` - позиции заявки со snapshot-данными материала на момент создания.
- `ApprovalHistory` - история согласований, возвратов, отклонений и комментариев.
- `RequestPriceHistory` - история изменения цен ПТО и снабжения по позициям заявки.

## MVP endpoints

Пользователи:

- `POST /users`
- `GET /users`

Объекты и материалы:

- `POST /objects`
- `GET /objects`
- `GET /objects/:id`
- `POST /objects/:id/access`
- `POST /objects/:id/materials`
- `GET /objects/:id/materials`
- `PATCH /objects/:id/materials/:materialId`

Заявки на материалы:

- `POST /supply-requests/materials`
- `GET /supply-requests`
- `GET /supply-requests/:id`
- `PATCH /supply-requests/:id/pto-limit-prices`
- `PATCH /supply-requests/:id/chief-engineer/approve`
- `PATCH /supply-requests/:id/supplier-purchase-prices`
- `PATCH /supply-requests/:id/director/approve`
- `PATCH /supply-requests/:id/director/return`
- `PATCH /supply-requests/:id/director/reject`
- `PATCH /supply-requests/:id/director/archive`
- `PATCH /supply-requests/:id/complete`
- `PATCH /supply-requests/:id/archive`
