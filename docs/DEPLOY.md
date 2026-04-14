# Деплой на Linux VPS + Docker Compose

Этот документ описывает базовый production-деплой `Starfall Aegis` на Linux VPS с использованием Docker Compose.

## 1. Подготовка сервера

Ожидается Linux VPS, например Ubuntu или Debian, с доступом по SSH.

Установите Docker Engine и Compose plugin по официальной инструкции для вашей ОС.

Проверьте, что команды доступны:

```bash
docker --version
docker compose version
```

## 2. Клонирование репозитория

```bash
git clone <URL_ВАШЕГО_РЕПОЗИТОРИЯ> starfall-aegis
cd starfall-aegis
```

## 3. Первый запуск

Соберите и поднимите production-контейнер:

```bash
docker compose up -d --build
```

Контейнер будет раздавать production build игры через `nginx` на порту `8080`.

## 4. Проверка состояния

Проверьте, что контейнер поднялся:

```bash
docker compose ps
```

Посмотрите логи, если что-то пошло не так:

```bash
docker compose logs -f
```

## 5. Обновление приложения

При выходе новой версии:

```bash
git pull
docker compose up -d --build
```

Так контейнер будет пересобран уже из нового кода.

## 6. Проверка снаружи

Откройте в браузере:

```text
http://<IP_СЕРВЕРА>:8080
```

## 7. Порт и firewall

Не забудьте открыть TCP-порт `8080` на сервере и в панели провайдера VPS, если там есть отдельные правила firewall/security group.

## 8. Что дальше можно добавить

- reverse proxy через `nginx` или `traefik`
- HTTPS/SSL через Let's Encrypt
- домен вместо прямого IP
- CI/CD-сборку и автоматический деплой

Текущая конфигурация intentionally простая: она подходит для быстрого старта и тестового production-развёртывания статической Phaser-игры.
