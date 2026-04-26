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

Desktop:

- `Стрелки` / `WASD` — движение
- `Space` — стрельба
- `Esc` / `P` — пауза
- `R` — рестарт после поражения
- `Esc` — возврат в меню с экрана `Game Over`

Mobile:

- удерживайте палец на игровом поле, чтобы корабль плавно следовал за целевой точкой
- отпустите палец, чтобы корабль остановился на текущей позиции
- базовая стрельба работает автоматически с тем же cooldown и текущими power-up эффектами
- кнопка `Pause` находится в безопасной верхней области экрана
- portrait и landscape поддерживаются; в узком portrait показывается мягкая подсказка повернуть устройство

Mobile input is isolated in `src/game/input/`: `GameScene` consumes normalized input state, while keyboard, touch-follow movement, and mobile buttons clean up their own listeners on shutdown.

## Mobile tuning

Mobile combat tuning lives in [src/game/config/mobile.ts](./src/game/config/mobile.ts).

Current mobile-only defaults:

- `enemyScaleMultiplier = 0.9`
- `enemySpeedMultiplier = 0.9`
- `enemyBulletSpeedMultiplier = 0.92`
- `enemySpawnPressureMultiplier = 0.94`
- `enemyCapMultiplier = 0.92`
- `playerHitboxMultiplier = 0.88`
- `touchFollowMaxSpeed = 640`
- `touchFollowResponsiveness = 13`
- `touchFollowStopDistance = 8`

Desktop balance uses `DEFAULT_COMBAT_TUNING` and is unchanged. To disable mobile balance while keeping touch controls, make `resolveCombatTuning(true)` return `DEFAULT_COMBAT_TUNING`, or tune only the multipliers you want to keep.

## PWA / installable app

The production build includes a web app manifest and service worker through `vite-plugin-pwa`.

- manifest: generated at `/manifest.webmanifest`
- service worker: generated during `npm run build`
- display mode: `standalone`
- start URL and scope: `/`
- app icons: `public/icons/`
- cached shell/assets: built JS/CSS/HTML, generated icons, font, and audio files
- API/auth/leaderboard/economy/audit responses are not runtime-cached

Install check:

1. Run `npm run build`.
2. Run `npm run preview`.
3. Open the preview URL on Android Chrome or desktop Chrome devtools mobile emulation.
4. Confirm `/manifest.webmanifest` and the generated service worker are available.
5. Use the browser install prompt; after install, the app should open in standalone mode.
6. Toggle offline in devtools and reload: the cached frontend shell should load, while backend-dependent UI falls back gracefully.

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
## Audio System

The game now uses a centralized audio layer built around [src/game/systems/AudioSystem.ts](./src/game/systems/AudioSystem.ts).

- `BootScene` preloads every audio file from a single manifest in [src/game/utils/audioKeys.ts](./src/game/utils/audioKeys.ts)
- scenes never call `this.sound.add()` or `this.sound.play()` directly for gameplay logic
- one global `AudioSystem` instance survives scene changes and owns the active music track
- music and SFX have separate volume controls and share a persisted `master mute`
- settings are stored in `localStorage` under `spaceShooterAudioSettingsV1`

### Audio Asset Layout

Audio files live in `public/audio/` so Vite serves them directly:

```text
public/
  audio/
    music/
      menu-theme.wav
      gameplay-loop.wav
      boss-loop.wav
      game-over-sting.wav
    sfx/
      player-shoot.wav
      enemy-hit.wav
      enemy-destroy.wav
      player-hurt.wav
      powerup-pickup.wav
      enemy-shoot.wav
      boss-attack.wav
      boss-hit.wav
      boss-death.wav
      ui-hover.wav
      ui-click.wav
      wave-start.wav
      game-over.wav
```

The repository includes lightweight placeholder `.wav` files with those exact names. You can replace them later with real assets without changing code, as long as the filenames stay the same.

### Music And SFX Flow

- `MenuScene` requests `music-menu`
- `GameScene` switches to `music-gameplay`
- boss waves switch to `music-boss`
- `GameOverScene` plays the one-shot `music-game-over` sting
- menu buttons and pause controls use UI hover / click SFX through `AudioSystem`
- combat events trigger typed SFX keys such as player fire, enemy hit, enemy destroy, player hurt, power-up pickup, boss attack, boss hit, boss death, wave start, and defeat

`AudioSystem` keeps only one active music instance at a time, so restarting a scene does not stack multiple looping tracks.

### Autoplay Restrictions

Browsers can block audio playback until the first user gesture. The project handles that in a Phaser-friendly way:

- menu pointer and keyboard input call `audioSystem.unlock()`
- if music is requested while audio is still locked, `AudioSystem` stores the latest pending music key
- once Phaser emits the `unlocked` event, the pending music track starts automatically
- locked SFX calls safely no-op instead of crashing the game

This means the game can boot silently, survive reloads, and begin music cleanly after the first interaction.

### Audio Settings UI

Audio controls are available in two places:

- the menu audio strip at the bottom of `MenuScene`
- the pause overlay inside `UISystem`

Available settings:

- `Mute: On / Off`
- `Music` volume from `0.0` to `1.0` in `0.1` steps
- `SFX` volume from `0.0` to `1.0` in `0.1` steps

Default balance:

- `masterMuted = false`
- `musicVolume = 0.55`
- `sfxVolume = 0.8`

### Adding New Audio

To add a new music track or SFX:

1. Add the file under `public/audio/music/` or `public/audio/sfx/`
2. Add a typed key in [src/game/types/audio.ts](./src/game/types/audio.ts)
3. Export the key from [src/game/utils/audioKeys.ts](./src/game/utils/audioKeys.ts)
4. Add the asset definition to `AUDIO_ASSETS`
5. If it is an SFX, optionally tune anti-spam behavior in `SFX_PLAYBACK_RULES`
6. Trigger it from a scene or system only through `AudioSystem`

### Scene Ownership Rules

- `BootScene` bootstraps the global audio system and preloads assets
- `MenuScene`, `GameScene`, and `GameOverScene` only talk to `AudioSystem` through its public API
- scene shutdown does not destroy the global audio service, which prevents duplicated music after restart
- app-level teardown calls `AudioSystem.destroyGlobal()` from `main.ts`
## Осколки и постоянная прогрессия

В игре есть одна постоянная валюта аккаунта: **осколки**. Они начисляются за high-level события забега: уничтожение обычных и элитных врагов, победы над боссами, волны без урона, boss wave без потери жизни, высокий остаток HP и серии волн без смерти. Осколки не лежат в `localStorage` как источник истины: баланс, покупки, ledger и награды забегов хранятся на backend и привязаны к Firebase/Google игроку.

Гость может играть без ограничений и видеть, сколько осколков мог бы получить за забег, но не может сохранять награды и покупать постоянные улучшения. После входа через Google меню показывает баланс и панель улучшений.

Постоянные улучшения имеют редкость, цену, уровень и жёсткий максимум:

- common: `Усиленный корпус`, `Калиброванные орудия`, `Улучшенный реактор`
- rare: `Расширенный импульс`, `Протокол восстановления`, `Калибровка дропа`
- epic: `Боевой дрон`, `Двойной контур`
- legendary: `Протокол Эгида`

Эффекты намеренно небольшие: немного HP, урона, fire rate, длительности бонусов, силы ремонта, drop chance, слабый постоянный дрон, короткий double-shot в начале волны и короткий щит в начале boss wave. Улучшения не дают бессмертия, бесконечного double-shot или автопобеды.

Economy flow:

1. Меню для авторизованного игрока вызывает `POST /api/economy/run/start` и получает `runId` плюс snapshot уровней улучшений.
2. `GameScene` применяет snapshot к текущему забегу и сохраняет `runId` вместе с autosave, чтобы продолженный забег мог получить награду один раз.
3. На `Game Over` клиент отправляет summary забега в `POST /api/economy/run/finish`.
4. Backend валидирует summary, сам считает награду, применяет caps, пишет `EconomyRunReward` и ledger transaction.
5. Повторная отправка того же `runId` возвращает уже сохранённую награду без повторного начисления.

V1 anti-abuse не является полноценным server-authoritative anti-cheat: сам gameplay исполняется на клиенте. Backend всё равно не имеет endpoint-а прямого начисления, требует Firebase token, проверяет принадлежность `runId`, идемпотентность finish, caps по волне/kill count/reward/duration и audit-ит suspicious submissions.
