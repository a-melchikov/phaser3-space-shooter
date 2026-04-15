# Starfall Aegis

`Starfall Aegis` — 2D space shooter на `Phaser 3 + TypeScript + Vite` с модульной архитектурой, guest mode и foundation для входа через Google.

Игра запускается без какой-либо настройки Firebase: в этом случае всегда доступен гостевой режим. Если подключить Firebase Authentication и Google provider, меню начнёт поддерживать вход через Google, восстановление сессии после перезагрузки и пометку результатов как `ranked-eligible`.

## Что уже умеет игра

- волны врагов и босс каждые 5 волн
- три типа врагов: `basic`, `fast`, `heavy`
- бонусы `heal`, `doubleShot`, `shield`
- локальная история тренировочных результатов
- guest mode
- Google login через Firebase Authentication
- разделение `local practice history` и будущих `ranked results`
- Docker dev/prod запуск

## Guest mode и Google login

### Гость

- можно начать игру сразу, без регистрации
- весь геймплей доступен полностью
- результат сохраняется только в локальную `practice history` на устройстве
- результат не считается ranked
- гость не участвует в будущем leaderboard

### Google

- создаётся / восстанавливается авторизованная сессия Firebase Authentication
- профиль помечается как `ranked-eligible`
- результат сохраняется локально как practice history
- дополнительно результат проходит через отдельный ranked submission contract
- реальный leaderboard backend пока не подключён, но точка интеграции уже выделена

## Важное ограничение по безопасности

Текущая реализация **не является античит-решением**.

Google login на клиенте полезен как:

- идентификация игрока
- разделение guest и authenticated flow
- подготовка к leaderboard

Но для честного leaderboard позже всё равно понадобится:

- backend, либо
- проверяемый BaaS flow с серверной валидацией результатов

Сейчас ranked submission — это архитектурный контракт и заглушка, а не защищённая система рейтинга.

## Стек

- `Phaser 3`
- `TypeScript`
- `Vite`
- `Firebase Authentication`
- `ESLint`
- `Docker`
- `nginx`

## Структура проекта

```text
/
  index.html
  package.json
  package-lock.json
  tsconfig.json
  vite.config.ts
  eslint.config.js
  .env.example
  Dockerfile
  docker-compose.yml
  docker-compose.dev.yml
  nginx/
    default.conf
  docs/
    DEPLOY.md
  src/
    main.ts
    vite-env.d.ts
    auth/
      types.ts
      AuthService.ts
      FirebaseAuthService.ts
      authState.ts
      firebase.ts
    game/
      appContext.ts
      config.ts
      types/
        scene.ts
        game.ts
      scenes/
        BootScene.ts
        MenuScene.ts
        GameScene.ts
        GameOverScene.ts
      entities/
        Player.ts
        Enemy.ts
        Boss.ts
        PlayerBullet.ts
        EnemyBullet.ts
        PowerUp.ts
      systems/
        WaveManager.ts
        CollisionManager.ts
        UISystem.ts
        AudioSystem.ts
      services/
        PracticeScoreStore.ts
        ResultsService.ts
        RankedScoreSubmissionService.ts
        BackendLeaderboardClient.ts
        HttpRankedScoreSubmissionService.ts
      utils/
        constants.ts
        helpers.ts
        rankedEligibility.ts
        textureFactory.ts
        enemyFactory.ts
```

## Управление

- `Стрелки` — движение
- `Space` — стрельба
- `P` — пауза
- `R` — рестарт после поражения
- `Esc` — возврат в меню с экрана `Game Over`

## Локальный запуск

Требования:

- `Node.js 20.x`
- `npm`

Команды:

```bash
npm install
npm run dev
```

Приложение поднимется по адресу `http://localhost:5173`.

Дополнительные проверки:

```bash
npm run typecheck
npm run lint
npm run build
npm run preview
```

## Настройка Firebase Authentication

Если Firebase не настроен, игра всё равно работает в guest mode.

Чтобы включить Google login:

1. Создайте Firebase project.
2. Включите `Authentication`.
3. Включите provider `Google`.
4. Добавьте разрешённые домены:
   - `localhost`
   - ваш production-домен
5. Скопируйте `.env.example` в `.env`.
6. Заполните Vite env-переменные.

### Переменные окружения

Файл `.env.example`:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MEASUREMENT_ID=
```

Минимально обязательны:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`

Если этих переменных нет, Google login автоматически отключается, а guest mode остаётся доступным.

## Docker

### Dev

```bash
docker compose -f docker-compose.dev.yml up --build
```

### Production

```bash
docker compose up -d --build
```

Production контейнер публикуется на `http://localhost:8080`.

### Важно про env в Docker

Vite встраивает `VITE_*` переменные **на этапе сборки**, поэтому:

- для локального `npm run dev` достаточно `.env`
- для `docker compose up --build` переменные тоже должны быть доступны во время build

В проекте это учтено через `build.args` в `docker-compose.yml` и `ARG/ENV` в `Dockerfile`.

## Как устроен auth flow

1. `main.ts` создаёт `AuthState`, `FirebaseAuthService` и `ResultsService`.
2. `FirebaseAuthService` всегда стартует с безопасного fallback в guest mode.
3. Если Firebase env настроен, сервис:
   - инициализирует Firebase app
   - подключает `onAuthStateChanged`
   - восстанавливает Google-сессию после reload
4. `MenuScene` подписывается на auth state и показывает:
   - guest
   - authenticated Google profile
   - доступность ranked eligibility
5. `GameScene` получает уже готовый session snapshot через `GameStartPayload`.
6. `GameOverScene` сохраняет результат в локальную practice history и отдельно вызывает ranked submission contract.

## Как разделены practice и ranked results

### Local practice history

- хранится в `PracticeScoreStore`
- использует `localStorage`
- доступна и гостю, и авторизованному игроку
- отображается как локальная тренировочная история
- не называется leaderboard

### Ranked submission

- проверяется через `canSubmitRankedScore(session)`
- доступен только для authenticated Google session
- проходит через интерфейс `RankedScoreSubmissionService`
- сейчас реализован через `HttpRankedScoreSubmissionService`
- transport отделён от игрового кода и ходит в backend по `VITE_API_BASE_URL`

## Куда потом подключать leaderboard backend

Точка расширения уже выделена:

- интерфейс: [RankedScoreSubmissionService](./src/game/services/RankedScoreSubmissionService.ts)
- backend client: [BackendLeaderboardClient](./src/game/services/BackendLeaderboardClient.ts)
- ranked transport: [HttpRankedScoreSubmissionService](./src/game/services/HttpRankedScoreSubmissionService.ts)
- orchestration: [ResultsService](./src/game/services/ResultsService.ts)

Чтобы подключить реальный backend позже, достаточно:

1. расширить `BackendLeaderboardClient` новыми endpoints при необходимости
2. отправлять туда только authenticated results
3. при необходимости заменить transport, реализующий `RankedScoreSubmissionService`

Это позволит добавить leaderboard без переписывания сцен и без ломки guest mode.

## Ключевые архитектурные решения

- `GameScene` не зависит напрямую от Firebase SDK
- auth спрятан за `AuthService`
- сцены работают только с готовым session state
- guest mode всегда доступен, даже без Firebase env
- ranked eligibility вынесен в отдельный helper
- local practice history и future ranked flow разделены на уровне сервисов

## Что можно расширить дальше

- добавить отдельный leaderboard screen, использующий `BackendLeaderboardClient`
- добавить player profile storage для прогресса между сессиями
- вынести auth-индикаторы в отдельную overlay-scene
- показать avatar пользователя в меню
- добавить реальный leaderboard screen

Подробный серверный сценарий смотрите в [docs/DEPLOY.md](./docs/DEPLOY.md).
