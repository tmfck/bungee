# Bungee CLI

Терминальная TUI-утилита для технической поддержки провайдера.
Bun + OpenTUI + Solid.js.

## Команды

```bash
bun install              # установка зависимостей
bun run dev              # запуск с вотч-режимом
bun run src/index.tsx    # однократный запуск
bun run typecheck        # tsc --noEmit
bun test                 # unit-тесты парсеров
bun run olt-scan         # отчёт по ONU на OLT (scripts/olt-scanner.ts)
```

## Переменные окружения

`.env` в корне проекта (см. `.env.example`):

| Переменная | Назначение |
| --- | --- |
| `USERSIDE_URL` | базовый URL UserSide, например `https://userside.example` |
| `USERSIDE_COOKIE` | строка `Cookie` активной сессии UserSide |
| `TELNET_OLT_USERNAME` / `TELNET_OLT_PASSWORD` | креды для `bun run olt-scan` |
| `TELNET_TIMEOUT` | таймаут подключения к OLT, мс (по умолчанию 5000) |
| `BUNGEE_DEBUG` | любое значение включает отладочные логи UserSide-клиента |

Отладочные логи всегда попадают в консольный оверлей (F12), даже когда он скрыт.

## Экраны и горячие клавиши

| Клавиша | Действие |
| --- | --- |
| `F1` | справка |
| `F3` | переход к поиску |
| `F10` | выход |
| `F12` | консоль отладки |
| `Esc` | назад; на поиске — сброс запроса, затем выход |
| `↑`/`↓`, `Enter` | навигация и выбор (результаты поиска, оборудование) |

Экраны: `SearchScreen` (поиск по лицевому счёту, ФИО, адресу), `AbonentScreen`
(карточка абонента, IP-MAC, оборудование с онлайн-опросом портов свичей),
`SwitchScreen` и `OLTScreen` — заглушки.

## Архитектура

- `src/index.tsx` — создание рендерера и монтирование Solid-приложения
- `src/tui/App.tsx` — маршрутизация экранов и глобальные хоткеи
- `src/tui/store.ts` — сигналы состояния и навигация
- `src/tui/client.ts` — единственный экземпляр UserSide-клиента + валидация env
- `src/tui/userside.ts` — HTTP-клиент UserSide и HTML-парсеры (покрыты тестами)
- `src/tui/screens/*`, `src/tui/components/*` — экраны и модалки
- `scripts/olt-scanner.ts` — telnet-сканер ONU по `data/olt-addresses.txt`

## Заметки

- Проект создан через `bun create tui` (OpenTUI). Сборка не нужна — Bun исполняет TypeScript напрямую.
- `.kilo/` — локальные настройки Kilo и намеренно не версионируются.
- `data/olt-addresses.txt` содержит внутренние адреса OLT и в git не попадает.
