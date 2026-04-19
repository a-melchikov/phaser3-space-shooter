# Деплой на Linux VPS + Docker Compose

Этот документ описывает базовый production-деплой `Starfall Aegis` на Linux VPS с использованием Docker Compose.

## 1. Подготовка сервера

Нужен Linux VPS, например Ubuntu или Debian, с доступом по SSH.

Установите:

- Docker Engine
- Docker Compose plugin

Проверьте:

```bash
docker --version
docker compose version
```

## 2. Клонирование репозитория

```bash
git clone <URL_ВАШЕГО_РЕПОЗИТОРИЯ> starfall-aegis
cd starfall-aegis
```

## 3. Настройка env

Если вам нужен только guest mode, Firebase env можно не задавать.

Если нужен Google login:

1. Скопируйте `.env.example` в `.env`
2. Заполните Firebase значения

Пример:

```bash
cp .env.example .env
```

Затем отредактируйте `.env`.

Важно:

- `VITE_*` переменные используются Vite на этапе сборки
- `VITE_API_BASE_URL` по умолчанию оставляйте пустым, чтобы frontend ходил в `/api` на том же origin
- `API_UPSTREAM` должен указывать на backend, доступный из контейнера `nginx` внутри Docker сети
- значит `.env` должен существовать **до** `docker compose up -d --build`

## 4. Первый запуск

Соберите и поднимите production-контейнер:

```bash
docker compose up -d --build
```

Контейнер:

- соберёт Vite production build
- встроит `VITE_*` env в статические assets
- отдаст приложение через `nginx`

## 5. Проверка состояния

Проверьте контейнеры:

```bash
docker compose ps
```

Посмотрите логи:

```bash
docker compose logs -f
```

## 6. Проверка снаружи

Откройте:

```text
https://<ВАШ_ДОМЕН>
```

## 7. Обновление приложения

При выходе новой версии:

```bash
git pull
docker compose up -d --build
```

## 8. Порт и firewall

Не забудьте открыть TCP-порт `8080`:

- на самом сервере
- в панели VPS-провайдера
- в security group / firewall rules, если они есть

## 9. Firebase Authentication в production

Если вы включаете Google login:

1. Добавьте production-домен в `Authorized domains` Firebase Authentication
2. Проверьте, что в `.env` указан корректный `VITE_FIREBASE_AUTH_DOMAIN`
3. Пересоберите контейнер:

```bash
docker compose up -d --build
```

Если env не заданы или Firebase настроен неверно:

- приложение всё равно поднимется
- guest mode останется рабочим
- Google login будет просто недоступен в меню

## 10. Важная оговорка про leaderboard

Даже если Google login включён, это ещё не делает leaderboard честным и защищённым.

Для настоящего рейтинга позже потребуется:

- backend, либо
- проверяемый BaaS flow с серверной валидацией результатов

Текущая реализация подготавливает правильную архитектурную основу, но не является античит-системой.

## 11. Что можно добавить дальше

- backend upstream для `/api`, доступный из контейнера frontend
- HTTPS / SSL через Let's Encrypt или другой TLS-терминатор
- домен вместо прямого IP
- CI/CD сборку и деплой
- отдельный backend для leaderboard и профилей
