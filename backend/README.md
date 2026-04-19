# Starfall Aegis Leaderboard Backend

Backend-сервис для ranked leaderboard игры `Starfall Aegis`.

Сервис предназначен только для **авторизованных** игроков. Guest users могут играть на фронтенде, но их результаты не отправляются в ranked backend и не участвуют в leaderboard.

## Стек

- `Node.js 20+`
- `TypeScript`
- `Fastify`
- `Prisma ORM`
- `PostgreSQL`
- `Firebase Admin SDK`
- `Docker`

## Что умеет backend v1

- принимать ranked score только от пользователей с валидным Firebase ID token
- синхронизировать профиль игрока по проверенной identity из Firebase
- хранить историю всех score submissions
- поддерживать лучший результат игрока отдельно от истории
- отдавать публичный leaderboard
- отдавать профиль текущего игрока с rank
- отдавать игроков вокруг текущего места в рейтинге
- отклонять guest users на уровне protected endpoints
- валидировать payload через `zod`
- ограничивать частоту `submit`-запросов через rate limit

## Важное ограничение

Текущая реализация **не является полноценным anti-cheat решением**.

Backend уже:

- не доверяет display name из клиента
- проверяет Firebase ID token
- отделяет guest flow от ranked flow
- не даёт худшему результату ухудшить место игрока

Но backend пока **не валидирует само игровое состояние на сервере**, поэтому для честного leaderboard позже всё равно понадобится:

- дополнительная серверная валидация матча, либо
- проверяемый BaaS/backend flow с защитой от накрутки

## Структура проекта

```text
backend/
  package.json
  package-lock.json
  tsconfig.json
  .env.example
  Dockerfile
  docker-compose.yml
  prisma/
    schema.prisma
    migrations/
  src/
    app.ts
    server.ts
    config/
      env.ts
    modules/
      auth/
        auth.types.ts
        auth.middleware.ts
        auth.service.ts
      leaderboard/
        leaderboard.types.ts
        leaderboard.repository.ts
        leaderboard.service.ts
        leaderboard.controller.ts
        leaderboard.routes.ts
      players/
        players.types.ts
        players.repository.ts
        players.service.ts
        players.controller.ts
        players.routes.ts
    plugins/
      prisma.ts
    utils/
      errors.ts
      logger.ts
      validation.ts
```

## Конфигурация окружения

Скопируйте `.env.example` в `.env` и заполните переменные:

```env
PORT=3000
POSTGRES_DB=starfall_aegis
POSTGRES_USER=starfall_aegis_app
POSTGRES_PASSWORD=change-me-long-random-password
DATABASE_URL=postgresql://starfall_aegis_app:change-me-long-random-password@localhost:5432/starfall_aegis?schema=public
CORS_ORIGIN=http://localhost:5173
RANKED_SUBMISSIONS_ENABLED=false
RATE_LIMIT_MAX=20
RATE_LIMIT_WINDOW_MS=60000
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
LOG_LEVEL=info
```

Для локального запуска без Docker используйте `DATABASE_URL` с хостом `localhost`
и поднимайте Postgres отдельно с теми же `POSTGRES_*` credentials.

В `docker compose` backend получает внутренний `DATABASE_URL` автоматически из `POSTGRES_*`
и ходит к Postgres по сервисному хосту `postgres`.

### Firebase Admin

Backend использует service account Firebase Admin SDK.

Нужны:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Для `FIREBASE_PRIVATE_KEY` используйте строку с `\n`, а не многострочный literal. При старте backend автоматически преобразует `\\n` в реальные переводы строки.

## Локальный запуск без Docker

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

По умолчанию сервер поднимется на `http://localhost:3000`.

### Полезные команды

```bash
npm run typecheck
npm run build
npm run start
```

## Локальный запуск через Docker

```bash
cd backend
docker compose up --build
```

Что поднимется:

- `postgres` только во внутренней сети Docker Compose
- `api` на `localhost:3000`

Healthcheck:

- `GET /health`

## Модель данных

### Player

- `firebaseUid` — verified identity из Firebase token
- `displayName`, `email`, `avatarUrl` — синхронизируются из Firebase
- `bestScore`, `bestWave`, `bestScoreAt` — денормализованные поля лучшего результата

### ScoreEntry

- хранит **все** submissions игрока
- нужен для истории, аудита и будущего усиления правил

### Почему выбрана модель `all submissions + cached best score`

Для v1 это самый практичный вариант:

- leaderboard читается быстро по полям `Player.best*`
- история результатов не теряется
- бизнес-логика улучшения результата остаётся прозрачной
- позже можно добавить античит-эвристику или аналитику без смены схемы

## Правила ранжирования

Leaderboard сортируется по:

1. `bestScore DESC`
2. `bestWave DESC`
3. `bestScoreAt ASC`
4. `id ASC`

Это даёт стабильный и предсказуемый rank:

- больший score всегда выше
- при равном score выше игрок с большей волной
- при полном равенстве выше тот, кто достиг результата раньше
- `id` используется как детерминированный финальный tie-breaker

## API

Базовый префикс: `/api`

### Публичные endpoints

#### `GET /api/leaderboard`

Параметры:

- `limit`
- `offset`

Пример:

```bash
curl "http://localhost:3000/api/leaderboard?limit=20&offset=0"
```

Ответ:

```json
{
  "items": [
    {
      "rank": 1,
      "displayName": "Pilot One",
      "avatarUrl": "https://example.com/avatar.png",
      "bestScore": 18000,
      "bestWave": 12,
      "bestScoreAt": "2026-04-15T15:05:10.000Z"
    }
  ],
  "limit": 20,
  "offset": 0,
  "total": 48
}
```

#### `GET /api/leaderboard/top`

Параметры:

- `limit` — optional, максимум `10`

Пример:

```bash
curl "http://localhost:3000/api/leaderboard/top?limit=10"
```

### Protected endpoints

Все protected endpoints требуют:

```http
Authorization: Bearer <firebase-id-token>
```

#### `POST /api/leaderboard/submit`

Body:

```json
{
  "score": 14500,
  "wave": 9
}
```

Правила:

- `score > 0`
- `wave >= 1`
- guest users не допускаются
- невалидный token -> `401`
- худший результат не ухудшает leaderboard

Пример:

```bash
curl -X POST "http://localhost:3000/api/leaderboard/submit" \
  -H "Authorization: Bearer <firebase-id-token>" \
  -H "Content-Type: application/json" \
  -d "{\"score\":14500,\"wave\":9}"
```

Ответ:

```json
{
  "accepted": true,
  "improvedBest": true,
  "bestScore": 14500,
  "bestWave": 9,
  "bestScoreAt": "2026-04-15T15:10:00.000Z",
  "rank": 7
}
```

#### `GET /api/players/me`

Возвращает профиль текущего авторизованного игрока, его лучший результат и текущий rank.

#### `GET /api/leaderboard/around-me`

Параметры:

- `radius` — optional, по умолчанию `3`

Возвращает несколько игроков выше и ниже текущего пользователя.

## Формат ошибок

Все ошибки нормализованы:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Request validation failed.",
    "details": {}
  }
}
```

## Как фронтенду интегрироваться с backend

Frontend должен:

1. Проверять, что пользователь `ranked-eligible`
2. Получать Firebase ID token из текущей Google-сессии
3. Передавать токен в `Authorization: Bearer <token>`
4. Отправлять только `score` и `wave`

Рекомендуемый контракт на клиенте:

- `submitRankedScore(result, token)`
- `fetchLeaderboard({ limit, offset })`
- `fetchLeaderboardTop(limit)`
- `fetchLeaderboardAroundMe(token, radius?)`
- `fetchMyProfile(token)`

### Как определить eligible player

Если пользователь:

- не guest
- авторизован через Google
- имеет валидный Firebase ID token

то он считается eligible for ranked leaderboard.

### Почему guest scores не ranked

Guest mode остаётся полезным для мгновенного старта игры и локальной practice history, но guest identity:

- не верифицирована backend-ом
- не должна участвовать в общем рейтинге
- не подходит как основа для честного leaderboard

## Как потом расширять систему

Дальше можно добавить:

- отдельную таблицу матчей/запусков с дополнительными telemetry-полями
- эвристики против накрутки score
- moderation flags
- seasonal leaderboards
- friend leaderboards
- серверную валидацию run data
- отдельный profile service с persistent progression

## Что проверить после настройки

- `npm install`
- `npm run prisma:generate`
- `npm run prisma:migrate`
- `npm run typecheck`
- `npm run build`
- `npm run dev`
- `docker compose up --build`
- `GET /health`
- `POST /api/leaderboard/submit` без token -> `401`
- `POST /api/leaderboard/submit` с valid token -> score сохраняется
- худший score не ухудшает best result
- `GET /api/leaderboard` показывает корректный rank
- `GET /api/leaderboard/around-me` возвращает игроков вокруг текущего места
