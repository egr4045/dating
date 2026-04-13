/**
 * useImagePreloader — умная фоновая предзагрузка квестов и картинок.
 *
 * Стратегия:
 *  1. Сразу после авторизации — fetch /quests/feed, результат пишем в localStorage
 *  2. Первые 5 картинок → <link rel="preload" as="image"> (браузерный приоритет "High")
 *  3. Оставшиеся картинки → new Image() порциями по 3 с паузой 300мс
 *  4. Dashboard.vue читает кэш и рендерится мгновенно, потом тихо обновляется
 */

import { API_URL } from '../config';

const FEED_CACHE_KEY = 'questFeedCache';
const FEED_CACHE_TTL = 5 * 60 * 1000; // 5 минут

interface FeedCache {
  data: any[];
  ts: number;
  token: string; // чтобы не отдавать кэш другого юзера
}

// ── Утилиты ──────────────────────────────────────────────────────────────────

function injectPreloadLink(url: string) {
  if (!url) return;
  // Не дублируем уже вставленные
  if (document.querySelector(`link[rel="preload"][href="${CSS.escape ? CSS.escape(url) : url}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'image';
  link.href = url;
  // fetchpriority — поддерживается Chrome 102+
  (link as any).fetchPriority = 'high';
  document.head.appendChild(link);
}

function loadImage(url: string): Promise<void> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = img.onerror = () => resolve();
    img.src = url;
  });
}

/** Загружаем картинки порциями, не насилуем сеть */
async function loadInBatches(urls: string[], batchSize = 3, delayMs = 250) {
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    await Promise.allSettled(batch.map(loadImage));
    if (i + batchSize < urls.length) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

// ── Основная функция ─────────────────────────────────────────────────────────

export function useImagePreloader() {

  /**
   * Запускает предзагрузку фида и картинок в фоне.
   * НЕ блокирует — вызывай без await.
   */
  function startPreload(token: string) {
    // fire-and-forget
    _doPreload(token).catch(() => { /* silent */ });
  }

  async function _doPreload(token: string) {
    // 1. Фетчим фид
    const res = await fetch(`${API_URL}/quests/feed`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;

    const quests: any[] = await res.json();

    // 2. Кешируем данные фида — Dashboard подхватит
    const cache: FeedCache = { data: quests, ts: Date.now(), token };
    try {
      localStorage.setItem(FEED_CACHE_KEY, JSON.stringify(cache));
    } catch { /* quota exceeded — ничего страшного */ }

    // 3. Собираем URL картинок (дедупликация)
    const urls = [...new Set(
      quests
        .map(q => q.imageUrl)
        .filter((u): u is string => !!u)
    )];

    if (!urls.length) return;

    // 4. Первые 5 — браузерный <link rel="preload"> (приоритет High)
    urls.slice(0, 5).forEach(injectPreloadLink);

    // 5. Остальные — стaggered new Image()
    await loadInBatches(urls.slice(5), 3, 300);
  }

  /**
   * Возвращает актуальный кэш фида или null.
   * Dashboard использует это для мгновенного рендера.
   */
  function getCachedFeed(token: string): any[] | null {
    try {
      const raw = localStorage.getItem(FEED_CACHE_KEY);
      if (!raw) return null;
      const cache: FeedCache = JSON.parse(raw);
      // Проверяем принадлежность токену и свежесть
      if (cache.token !== token) return null;
      if (Date.now() - cache.ts > FEED_CACHE_TTL) return null;
      return cache.data;
    } catch {
      return null;
    }
  }

  /** Инвалидируем кэш (например, после свайпа) */
  function invalidateCache() {
    localStorage.removeItem(FEED_CACHE_KEY);
  }

  return { startPreload, getCachedFeed, invalidateCache };
}
