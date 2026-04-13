const CACHE_NAME = 'questmatch-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
];

// ── Установка: кэшируем статику ───────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// ── Активация: чистим старые кэши ────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: cache-first для статики, network-first для API ─────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API запросы — всегда сеть (не кэшировать)
  if (url.pathname.startsWith('/api') || url.port === '3000') return;

  // Только GET запросы
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        // Кэшируем только успешные ответы на same-origin запросы
        if (
          response.ok &&
          response.type === 'basic' &&
          !url.pathname.includes('hot-update')
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Оффлайн fallback для навигации
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});

// ── Push-уведомления ──────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body,
    icon: data.icon || '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    data: { url: data.url || '/' },
    vibrate: [100, 50, 100],
    actions: [
      { action: 'open', title: 'Открыть' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ── Клик по уведомлению ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Ищем уже открытое окно приложения
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Открываем новое окно
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
