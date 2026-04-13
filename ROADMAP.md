# Roadmap роста приложения

_Обновлён: 2026-04-12_

## Стек
- **Frontend:** Vue 3 + Vite + InteractJS + Socket.io-client (браузерное приложение)
- **Backend:** NestJS 11 + Prisma + PostgreSQL + Socket.io + Telegraf
- **Auth:** Telegram OAuth (JWT 7d)
- **Real-time:** Socket.io (chat, matches, typing)
- **Notifications:** Telegram Bot + Web Push API для браузера (планируется)

## Что уже работает хорошо
- Telegram OAuth + JWT
- Свайп + матчинг (атомарные транзакции)
- Планировщик встреч (PENDING → PROPOSED → CONFIRMED)
- Чат (typing, read receipts на сервере)
- Репутация (автобан < 2.0)
- Полноценная админка
- 4-tier алгоритм подбора квестов

---

# ПРИОРИТЕТ 1 — Срочно (блокирующие проблемы)

## 1.1 XSS в чате
**Файл:** `backend/src/chat/chat.gateway.ts`  
Добавить sanitize перед сохранением: `text = text.replace(/<[^>]*>/g, '').trim()`

## 1.2 Preferences не применяются в фиде
**Файл:** `backend/src/quests/quests.service.ts`  
`prefGender`, `prefAgeMin`, `prefAgeMax` хранятся но **не используются** при фильтрации.  
**Фикс:** При выборке WAITING лобби — JOIN на host user, проверять age + gender хоста.

## 1.3 Нет тостов об ошибках
**Создать:** `frontend/src/composables/useToast.ts` (глобальный event bus)  
**Создать:** `frontend/src/components/ToastContainer.vue`  
**Добавить в** `App.vue`  
Вызывать во всех catch-блоках во всех компонентах.

## 1.4 Настройки — пропущенные разделы
- **Слоты доступности** (TimeSlots) — модель есть, API есть, UI в Settings.vue **отсутствует**
- **Удаление аккаунта** — добавить кнопку + `DELETE /users/me` endpoint

---

# ПРИОРИТЕТ 2 — Качество продукта

## 2.1 Несколько фотографий профиля
**Схема:** Новая модель `UserPhoto` (`id`, `userId`, `url`, `order`, `createdAt`)  
**Бэкенд:** `POST /users/photos`, `DELETE /users/photos/:id`, `PATCH /users/photos/reorder`  
**Фронтенд:** Карусель в Settings.vue + карусель в ActiveMatch.vue у партнёра

## 2.2 Рабочие фильтры фида
```
GET /quests/feed?category=offline&ageMin=20&ageMax=35&gender=female&todayOnly=true
```
Применять при JOIN на host user в `quests.service.ts`.  
Передавать все фильтры из Dashboard.vue в query params.

## 2.3 Блокировка и жалобы
**Схема:** `UserBlock` (`blockerId`, `blockedId`), `Report` (`reporterId`, `targetId`, `reason`, `text`, `status`)  
**API:** `POST /users/block/:id`, `POST /users/report/:id`  
**Логика:** Исключать заблокированных из фида  
**UI:** Кнопки в ActiveMatch.vue (меню партнёра)  
**Админка:** Раздел «Жалобы» с action buttons

## 2.4 Тёмная тема
CSS-переменные уже есть. Добавить `[data-theme="dark"]` в `main.css`. Переключатель в Settings.vue.

## 2.5 Верификация профиля
`profileVerified: Boolean` в User. Отметка в админке. ✅ бейдж у верифицированных.

---

# ПРИОРИТЕТ 3 — Удержание (ретеншн)

## 3.1 Геймификация: Достижения + Стрики + Уровни

### Достижения (видны другим пользователям!)
**Схема:** `Achievement` (`userId`, `type` enum, `unlockedAt`)

| Ачивка | Условие |
|--------|---------|
| 🥇 `FIRST_MATCH` | Первый матч |
| 🔥 `STREAK_3` | 3 встречи подряд |
| 🔥 `STREAK_5` | 5 подряд |
| 🏆 `BEST_STREAK` | Новый личный рекорд стрика |
| 💎 `VERIFIED` | Верифицирован |
| 🌟 `REPUTATION_8` | Репутация > 8 |
| 🎯 `MATCHMAKER_10` | 10 завершённых встреч |
| 🎯 `MATCHMAKER_25` | 25 встреч |
| 🎯 `MATCHMAKER_50` | 50 встреч (Легенда) |

**UI:**
- Settings.vue → «Мои достижения» + заблокированные (мотивация)
- ActiveMatch.vue → бейджи партнёра под именем
- History.vue → уведомление о новом бейдже

### Стрики
`currentStreak Int @default(0)`, `bestStreak Int @default(0)` в User.  
streak++ при COMPLETED (в течение 14 дней), streak=0 при FAILED.

### Уровни пользователя (по числу матчей)
🌱 Новичок → ⭐ Активный → 🔥 Надёжный → 💎 Эксперт → 👑 Легенда

---

## 3.2 Взаимная оценка после встречи

После COMPLETED → экран оценки (1–5 ⭐ + комментарий).  
**Схема:** `MatchReview` (`matchId`, `reviewerId`, `targetId`, `rating Int`, `comment?`)

**Математика репутации — настраивается в админке:**  
Таблица `AppConfig` (`key String @id`, `value String`, `updatedAt`):
- `repCompletedBonus` — бонус за матч (default: 0.5)
- `repFailedPenalty` — штраф (default: 1.0)
- `repBanThreshold` — порог бана (default: 2.0)
- `repBanDays` — срок бана в днях (default: 30)
- Рейтинг оценки пропорционально влияет на бонус

---

## 3.3 Push-уведомления (Web Push API)

**Бэкенд:** `web-push` npm, VAPID ключи в .env, модель `PushSubscription`  
**Фронтенд:** `public/sw.js`, `composables/usePushNotifications.ts`  
Запрашивать разрешение после первого матча (не спамить сразу).

---

## 3.4 Реакции в чате

Лонг-тап по сообщению → 6 эмодзи (❤️ 😂 👍 🔥 😮 😢)  
**Схема:** `MessageReaction` (`messageId`, `userId`, `emoji`)  
WebSocket: `addReaction` / `removeReaction`

---

# ПРИОРИТЕТ 4 — Привлечение пользователей

## 4.1 Реферальная система
`referralCode String? @unique` + `referredById Int?` в User.  
Реферер +0.3 к репутации при первом матче реферала.  
UI в Settings.vue с кнопкой «Поделиться».

## 4.2 Шеринг квестов
Кнопка «Поделиться» на карточке → URL + Telegram share.  
Публичная страница `/quest/:id` без авторизации + CTA кнопка.

## 4.3 Карта квестов
`lat Float?` + `lon Float?` в QuestTemplate.  
Вкладка «Карта» в Dashboard → Leaflet.js + маркеры + фильтр «Рядом со мной».

---

# ПРИОРИТЕТ 5 — Монетизация

## 5.1 Партнёрские квесты
Поля в QuestTemplate: `sponsored Boolean`, `sponsorName`, `sponsorBudget Int`, `sponsorLogo`.  
Каждый 5-й в фиде — спонсорский (при `sponsorBudget > 0`, потом `sponsorBudget--`).  
Бейдж «Партнёр» на карточке.  
Раздел «Партнёры» в админке.

---

# ПРИОРИТЕТ 6 — Техническое здоровье

## 6.1 Тесты
- Unit: матчинг, репутация, дедупликация пушей
- E2E: регистрация → свайп → матч → оценка → репутация

## 6.2 Логирование (лёгкое)
- `@nestjs/common Logger` вместо console.log/warn/error
- `@sentry/vue` для фронтенда (бесплатный tier)

## 6.3 PWA
- `frontend/public/manifest.json`
- `frontend/public/sw.js` (cache-first + push handler)
- `<link rel="manifest">` в index.html

---

# ИТОГОВЫЙ ROADMAP

## Sprint 1 — «Сделать рабочим» (1 неделя)
- [x] Тосты ошибок (useToast + ToastContainer)
- [x] Preferences применять в фиде (возраст + пол хоста)
- [x] Sanitize XSS в чате
- [x] Слоты доступности в Settings.vue
- [x] Удаление аккаунта (UI + endpoint)
- [x] Рабочие фильтры фида (передавать из Dashboard)

## Sprint 2 — «Сделать качественным» (2 неделя)
- [x] Несколько фотографий профиля
- [x] Блокировка + жалобы
- [x] Тёмная тема
- [x] Верификация профиля (простая отметка)
- [x] AppConfig в БД + раздел настроек в админке

## Sprint 3 — «Удерживать» (3–4 неделя)
- [x] Взаимная оценка после встречи + репутация через AppConfig
- [x] Достижения + бейджи (видны другим пользователям)
- [x] Стрики + уровни пользователя
- [x] Реакции в чате

## Sprint 4 — «Растить» (5–6 неделя)
- [x] Реферальная система
- [x] Шеринг квестов + публичная страница
- [x] Push-уведомления (Web Push + Service Worker) — sw.js, usePush.ts, toggle в Settings
- [x] PWA (manifest + sw.js) — manifest.json, meta-теги, cache-first SW

## Sprint 5 — «Монетизировать» (7–8 неделя)
- [x] Партнёрские квесты (sponsored + бюджет + раздел в админке) — AdminPartners.vue, каждый 5-й в фиде
- [x] Карта квестов (Leaflet + геолокация) — QuestMap.vue, GET /quests/map, кнопка 🗺️ в Dashboard
- [ ] Тесты (unit + e2e)
- [x] Sentry для фронтенда — @sentry/vue, VITE_SENTRY_DSN, sourcemap

---

## Таблица затрагиваемых файлов

| Sprint | Файл | Изменение |
|--------|------|-----------|
| 1 | `frontend/src/composables/useToast.ts` | Создать |
| 1 | `frontend/src/components/ToastContainer.vue` | Создать |
| 1 | `backend/src/quests/quests.service.ts` | Применять preferences в getFeed |
| 1 | `backend/src/chat/chat.gateway.ts` | Sanitize XSS |
| 1 | `frontend/src/components/Settings.vue` | Слоты + удаление аккаунта |
| 1 | `backend/src/users/users.controller.ts` | DELETE /users/me |
| 2 | `backend/prisma/schema.prisma` | UserPhoto, UserBlock, Report, AppConfig |
| 2 | `backend/src/admin/admin.service.ts` | Чтение/запись AppConfig |
| 2 | `backend/src/admin/admin.controller.ts` | GET/PUT /admin/config |
| 3 | `backend/prisma/schema.prisma` | Achievement, MatchReview, MessageReaction |
| 3 | `frontend/src/components/ActiveMatch.vue` | Бейджи партнёра + реакции |
| 4 | `backend/prisma/schema.prisma` | PushSubscription, referralCode в User |
| 4 | `frontend/public/sw.js` | Service Worker |
| 4 | `frontend/src/composables/usePushNotifications.ts` | Создать |
| 5 | `backend/prisma/schema.prisma` | sponsored/lat/lon в QuestTemplate |
| 5 | `frontend/src/components/admin/AdminPartners.vue` | Создать |
