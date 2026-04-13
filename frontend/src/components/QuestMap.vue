<template>
  <div class="quest-map-wrap">

    <!-- Панель управления -->
    <div class="map-controls">
      <button
        class="near-btn"
        :class="{ active: nearMe }"
        @click="toggleNearMe"
        :disabled="locating"
      >
        {{ locating ? '⏳' : '📍' }} {{ nearMe ? 'Рядом со мной' : 'Показать рядом' }}
      </button>
      <div class="cat-filter">
        <button
          v-for="cat in categories"
          :key="cat.value"
          class="cat-chip"
          :class="{ active: filterCat === cat.value }"
          @click="filterCat = cat.value; applyFilter()"
        >{{ cat.label }}</button>
      </div>
    </div>

    <!-- Карта -->
    <div ref="mapEl" class="leaflet-map" />

    <!-- Попап квеста -->
    <Transition name="slide-up">
      <div v-if="selected" class="quest-popup" @click.self="selected = null">
        <div class="quest-popup__card">
          <button class="popup-close" @click="selected = null">✕</button>
          <div class="popup-img" :style="selected.imageUrl ? `background-image:url(${selected.imageUrl})` : ''">
            <div v-if="!selected.imageUrl" class="popup-img-placeholder">🗺️</div>
            <div class="popup-cat-badge">{{ selected.subcategory }}</div>
          </div>
          <div class="popup-body">
            <div class="popup-title">{{ selected.title }}</div>
            <div v-if="selected.address" class="popup-address">📍 {{ selected.address }}</div>
            <div class="popup-meta">
              <span v-if="selected.price">💰 {{ selected.price }}</span>
              <span v-if="selected._waitingCount > 0" class="waiting-chip">🔥 {{ selected._waitingCount }} ждут</span>
            </div>
            <div class="popup-desc">{{ selected.description }}</div>
            <button class="btn-go" @click="goToQuest">Свайпнуть 🎯</button>
          </div>
        </div>
      </div>
    </Transition>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { API_URL } from '../config';

// Фикс иконок Leaflet после сборки Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
});

const router = useRouter();

const mapEl = ref<HTMLDivElement | null>(null);
let map: L.Map | null = null;
let markers: L.Marker[] = [];

const loading = ref(false);
const locating = ref(false);
const nearMe = ref(false);
const filterCat = ref('all');
const selected = ref<any>(null);
const allQuests = ref<any[]>([]);
const userCoords = ref<{ lat: number; lon: number } | null>(null);

const categories = [
  { value: 'all', label: 'Все' },
  { value: 'offline', label: '🌍 Офлайн' },
  { value: 'games', label: '🎮 Игры' },
  { value: 'online', label: '💻 Онлайн' },
];

const PURPLE_ICON = L.divIcon({
  className: '',
  html: `<div style="
    width:36px;height:36px;background:#7c3aed;border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);border:3px solid #fff;
    box-shadow:0 2px 8px rgba(124,58,237,0.5)">
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
});

const SPONSORED_ICON = L.divIcon({
  className: '',
  html: `<div style="
    width:36px;height:36px;background:#f59e0b;border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);border:3px solid #fff;
    box-shadow:0 2px 8px rgba(245,158,11,0.5)">
  </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
});

async function loadQuests() {
  loading.value = true;
  try {
    const token = localStorage.getItem('token');
    const cat = filterCat.value !== 'all' ? `&category=${filterCat.value}` : '';
    const res = await fetch(`${API_URL}/quests/map${cat}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    allQuests.value = data || [];
  } catch (e) {
    console.error('Map quests load error:', e);
  } finally {
    loading.value = false;
  }
}

function clearMarkers() {
  markers.forEach(m => m.remove());
  markers = [];
}

function renderMarkers() {
  if (!map) return;
  clearMarkers();

  const quests = allQuests.value.filter(q => q.lat && q.lon);

  quests.forEach(q => {
    const icon = q.sponsored ? SPONSORED_ICON : PURPLE_ICON;
    const marker = L.marker([q.lat, q.lon], { icon })
      .addTo(map!)
      .on('click', () => { selected.value = q; });
    markers.push(marker);
  });

  if (quests.length > 0 && !nearMe.value) {
    const bounds = L.latLngBounds(quests.map(q => [q.lat, q.lon] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }
}

async function applyFilter() {
  await loadQuests();
  renderMarkers();
}

async function toggleNearMe() {
  if (nearMe.value) {
    nearMe.value = false;
    renderMarkers();
    return;
  }

  locating.value = true;
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000 })
    );
    userCoords.value = { lat: pos.coords.latitude, lon: pos.coords.longitude };
    nearMe.value = true;

    // Центрируем карту на пользователе
    map?.setView([userCoords.value.lat, userCoords.value.lon], 13);

    // Маркер "Я здесь"
    const meIcon = L.divIcon({
      className: '',
      html: `<div style="width:14px;height:14px;background:#3b82f6;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 4px rgba(59,130,246,0.3)"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
    L.marker([userCoords.value.lat, userCoords.value.lon], { icon: meIcon })
      .addTo(map!)
      .bindTooltip('Я здесь', { permanent: false });

    renderMarkers();
  } catch {
    alert('Не удалось получить геолокацию. Проверьте разрешения.');
  } finally {
    locating.value = false;
  }
}

function goToQuest() {
  selected.value = null;
  router.push('/dashboard');
}

onMounted(async () => {
  await loadQuests();

  if (mapEl.value) {
    // Дефолт: Москва
    map = L.map(mapEl.value, {
      center: [55.751574, 37.573856],
      zoom: 10,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    renderMarkers();
  }
});

onUnmounted(() => {
  map?.remove();
  map = null;
});
</script>

<style scoped>
.quest-map-wrap {
  position: relative;
  height: calc(100dvh - 64px);
  display: flex;
  flex-direction: column;
  background: var(--bg);
}

.map-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}

.near-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 100px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.near-btn.active { background: rgba(59,130,246,0.15); border-color: #3b82f6; color: #60a5fa; }
.near-btn:disabled { opacity: 0.6; cursor: default; }

.cat-filter { display: flex; gap: 6px; }
.cat-chip {
  padding: 5px 12px;
  border-radius: 100px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-muted);
  font-size: 0.78rem;
  cursor: pointer;
  transition: all 0.15s;
}
.cat-chip.active { background: rgba(124,58,237,0.15); border-color: var(--primary); color: var(--primary-light); }

.leaflet-map {
  flex: 1;
  z-index: 1;
}

/* Переопределяем стили Leaflet для тёмной темы */
:global(.leaflet-container) { background: #1a1a2e !important; }

/* Попап квеста */
.quest-popup {
  position: absolute;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(0,0,0,0.5);
  padding-bottom: env(safe-area-inset-bottom, 0);
}

.quest-popup__card {
  position: relative;
  background: var(--surface);
  border-radius: 20px 20px 0 0;
  width: 100%;
  max-width: 480px;
  max-height: 70vh;
  overflow-y: auto;
}

.popup-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: rgba(255,255,255,0.1);
  color: var(--text);
  font-size: 1rem;
  cursor: pointer;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.popup-img {
  width: 100%;
  height: 160px;
  background: var(--surface-2) center/cover no-repeat;
  border-radius: 20px 20px 0 0;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}
.popup-img-placeholder { font-size: 3rem; }
.popup-cat-badge {
  position: absolute;
  bottom: 8px;
  left: 12px;
  background: rgba(0,0,0,0.6);
  color: #fff;
  font-size: 0.75rem;
  padding: 3px 10px;
  border-radius: 100px;
  backdrop-filter: blur(4px);
}

.popup-body { padding: 16px; }
.popup-title { font-size: 1.1rem; font-weight: 700; color: var(--text); margin-bottom: 4px; }
.popup-address { font-size: 0.8rem; color: var(--text-muted); margin-bottom: 8px; }
.popup-meta { display: flex; gap: 8px; align-items: center; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 10px; }
.waiting-chip { background: rgba(239,68,68,0.15); color: #f87171; border-radius: 100px; padding: 2px 8px; }
.popup-desc { font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 16px; }

.btn-go {
  width: 100%;
  padding: 12px;
  background: var(--primary);
  color: #fff;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn-go:hover { opacity: 0.9; }

/* Анимация попапа */
.slide-up-enter-active, .slide-up-leave-active { transition: all 0.3s cubic-bezier(0.34, 1.2, 0.64, 1); }
.slide-up-enter-from { opacity: 0; transform: translateY(100%); }
.slide-up-leave-to { opacity: 0; transform: translateY(100%); }
</style>
