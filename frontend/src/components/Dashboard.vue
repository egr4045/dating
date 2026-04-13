<template>
  <div class="page dashboard">

    <!-- Шапка -->
    <header class="app-header">
      <div class="app-header__logo">🌟 Meetup</div>
      <div class="app-header__actions">
        <div v-if="currentUser?.streakDays > 0" class="badge" style="font-size: 0.85rem; background: var(--surface-2); border: 1px solid var(--border); border-radius: 100px; padding: 4px 8px; margin-right: 4px; display: flex; align-items: center;">
          🔥 <span style="font-weight: bold; margin-left:2px;">{{ currentUser.streakDays }}</span>
        </div>
        <button class="icon-btn" :class="{ 'icon-btn--active': showMap }" @click="showMap = !showMap" title="Карта">🗺️</button>
        <button class="icon-btn" @click="showFilters = true" title="Фильтры">🔍</button>
        <button class="icon-btn" @click="$router.push('/history')" title="История">📋</button>
        <button class="icon-btn" @click="$router.push('/settings')" title="Настройки">⚙️</button>
        <button class="icon-btn" @click="logout" title="Выйти">👋</button>
      </div>
    </header>

    <!-- Бан-экран -->
    <div v-if="isBanned" class="ban-screen page-content anim-fade-up">
      <div class="ban-icon">🚫</div>
      <h2>Временный бан</h2>
      <p>Твой аккаунт заблокирован до {{ banDateFormatted }} из-за низкого рейтинга.</p>
      <p class="text-sm">Постарайся не пропускать договорённые встречи — это влияет на рейтинг.</p>
    </div>

    <!-- Карта квестов -->
    <QuestMap v-else-if="showMap" />

    <!-- Основная лента -->
    <template v-else>
      <!-- Pull-to-refresh индикатор -->
      <div v-if="pullRefreshing" class="ptr-indicator">
        <div class="ptr-spinner" />
      </div>

      <div class="cards-area"
        @touchstart.passive="onTouchStart"
        @touchmove.passive="onTouchMove"
        @touchend.passive="onTouchEnd"
      >
        <div v-if="loading" class="skeleton-stack">
          <div class="skeleton-quest-card">
            <div class="skeleton skeleton-img" />
            <div class="skeleton-quest-info">
              <div class="skeleton skeleton-text" style="width:60%" />
              <div class="skeleton skeleton-title" style="width:80%; margin-top:4px" />
              <div class="skeleton skeleton-text" style="width:45%; margin-top:8px" />
            </div>
          </div>
        </div>

        <div v-else-if="quests.length === 0" class="empty-state anim-fade-in">
          <div style="font-size:3rem">🎉</div>
          <h3>Пока событий нет</h3>
          <p>Попробуй изменить фильтры или загляни чуть позже</p>
          <button class="btn btn-outline btn-sm" @click="loadQuests">Обновить</button>
        </div>

        <div v-else class="cards-stack">
          <QuestCard
            v-for="(quest, index) in quests"
            :key="quest.id"
            :quest="quest"
            :ref="(el: any) => { if (el && index === quests.length - 1) questCardRef = el }"
            v-show="index === quests.length - 1"
            @swipeRight="onLike(quest.id)"
            @swipeLeft="onNope(quest.id)"
          />
        </div>

        <!-- Подсказки свайпа -->
        <div v-if="quests.length > 0" class="swipe-hints">
          <div class="swipe-hint">
            <span>👈</span>
            <span class="text-xs text-muted">Не сейчас</span>
          </div>
          <div class="swipe-hint">
            <span class="text-xs text-muted">Пойду!</span>
            <span>👉</span>
          </div>
        </div>
      </div>

      <!-- Кнопки под стопкой -->
      <div v-if="quests.length > 0" class="action-btns">
        <button class="action-btn action-btn--nope" @click="questCardRef?.triggerSwipe('left')">✕</button>
        <button class="action-btn action-btn--like" @click="questCardRef?.triggerSwipe('right')">✓</button>
      </div>

      <!-- Кнопка отмены свайпа -->
      <Teleport to="body">
        <Transition name="undo">
          <button v-if="showUndo" class="undo-btn" @click="undoSwipe">↩ Вернуть</button>
        </Transition>
      </Teleport>
    </template>

    <!-- Confirm-диалог выхода -->
    <Teleport to="body">
      <div v-if="showLogoutConfirm" class="confirm-overlay" @click.self="showLogoutConfirm = false">
        <div class="confirm-card anim-scale-in">
          <div style="font-size:2rem">👋</div>
          <h3>Выйти из аккаунта?</h3>
          <p>Тебе придётся войти снова через Telegram.</p>
          <div class="confirm-btns">
            <button class="btn btn-ghost btn-sm" @click="showLogoutConfirm = false">Отмена</button>
            <button class="btn btn-danger btn-sm" @click="doLogout">Выйти</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Фильтры (дровер) -->
    <Teleport to="body">
      <div v-if="showFilters" class="overlay" @click="showFilters = false">
        <div class="filter-drawer anim-scale-in" @click.stop>
          <div class="filter-drawer__header">
            <h3>Фильтры</h3>
            <button class="icon-btn" @click="showFilters = false">✕</button>
          </div>

          <div class="field-group">
            <label class="input-label">Ищу партнёра</label>
            <div class="gender-btns">
              <button
                v-for="g in prefGenderOptions"
                :key="g.value"
                class="gender-btn"
                :class="{ active: filters.prefGender === g.value }"
                @click="filters.prefGender = g.value"
              >{{ g.emoji }} {{ g.label }}</button>
            </div>
          </div>

          <div class="field-group">
            <label class="input-label">Категория активности</label>
            <div class="category-chips">
              <button
                v-for="cat in categoryOptions"
                :key="cat.value"
                class="chip"
                :class="filters.category === cat.value ? 'chip-active' : 'chip-default'"
                @click="filters.category = cat.value"
              >{{ cat.emoji }} {{ cat.label }}</button>
            </div>
          </div>

          <div class="field-group">
            <DualRangeSlider
              :min="16"
              :max="60"
              label="Возраст"
              v-model:modelValueMin="filters.ageMin"
              v-model:modelValueMax="filters.ageMax"
            />
          </div>

          <div class="field-group">
            <label class="toggle-row">
              <span class="input-label" style="margin-bottom:0">Только сегодня</span>
              <div class="toggle-switch" :class="{ on: filters.todayOnly }" @click="filters.todayOnly = !filters.todayOnly">
                <div class="toggle-thumb" />
              </div>
            </label>
          </div>

          <button class="btn btn-primary btn-full" @click="applyFilters">Применить</button>
        </div>
      </div>
    </Teleport>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '../config';
import { track } from '../analytics';
import QuestCard from './QuestCard.vue';
import DualRangeSlider from './DualRangeSlider.vue';
import QuestMap from './QuestMap.vue';
import { useToast } from '../composables/useToast';

const { error: toastError } = useToast();

const router = useRouter();
const quests = ref<any[]>([]);
const loading = ref(true);
const isBanned = ref(false);
const banDateFormatted = ref('');
const showFilters = ref(false);
const showMap = ref(false);
const currentUser = ref<any>(null);
const questCardRef = ref<InstanceType<typeof QuestCard> | null>(null);

const filters = ref({ prefGender: 'any', ageMin: 16, ageMax: 60, category: 'all', todayOnly: false });

// ── Pull-to-refresh ───────────────────────────────────────────────────────
const pullRefreshing = ref(false);
let touchStartY = 0;
function onTouchStart(e: TouchEvent) { touchStartY = e.touches[0].clientY; }
function onTouchMove() { /* passive — just track */ }
async function onTouchEnd(e: TouchEvent) {
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (dy > 80 && !loading.value) {
    pullRefreshing.value = true;
    track('pull_to_refresh');
    await loadQuests();
    pullRefreshing.value = false;
  }
}

// ── Undo свайпа ────────────────────────────────────────────────────────────
const lastNopedQuest = ref<any>(null);
const showUndo = ref(false);
let undoTimer: ReturnType<typeof setTimeout> | null = null;

function undoSwipe() {
  if (!lastNopedQuest.value) return;
  quests.value.push(lastNopedQuest.value);
  lastNopedQuest.value = null;
  showUndo.value = false;
  if (undoTimer) clearTimeout(undoTimer);
  track('swipe_undo');
}

function showToast(message: string, _type: string = 'error') {
  toastError(message);
}
const prefGenderOptions = [
  { value: 'any', emoji: '🌟', label: 'Любой' },
  { value: 'male', emoji: '👦', label: 'Парень' },
  { value: 'female', emoji: '👧', label: 'Девушка' },
];
const categoryOptions = [
  { value: 'all',     emoji: '✨', label: 'Все' },
  { value: 'offline', emoji: '🌍', label: 'Активности' },
  { value: 'games',   emoji: '🎮', label: 'Игры' },
  { value: 'online',  emoji: '📱', label: 'Онлайн' },
];

let socket: Socket | null = null;

async function loadQuests() {
  loading.value = true;
  const token = localStorage.getItem('token');
  if (!token) { router.push('/'); return; }

  try {
    // Параллельно грузим квесты и профиль для получения актуального стрика
    const [questsRes, profileRes] = await Promise.all([
      fetch(`${API_URL}/quests/feed?${new URLSearchParams({
        prefGender: filters.value.prefGender,
        ageMin: String(filters.value.ageMin),
        ageMax: String(filters.value.ageMax),
        ...(filters.value.category !== 'all' ? { category: filters.value.category } : {}),
        ...(filters.value.todayOnly ? { todayOnly: 'true' } : {}),
      })}`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
    ]);

    if (profileRes.ok) {
      currentUser.value = await profileRes.json();
    }

    if (questsRes.status === 403) {
      const data = await questsRes.json();
      isBanned.value = true;
      const match = data.message?.match(/\d{4}-\d{2}-\d{2}/);
      banDateFormatted.value = match
        ? new Date(match[0]).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
        : 'неизвестной даты';
      return;
    }

    const data = await questsRes.json();
    quests.value = data;
    track('feed_load', { count: data.length });
  } catch {
    quests.value = [];
  } finally {
    loading.value = false;
  }
}

async function onLike(questId: string) {
  if (!questId) return;
  track('swipe_like', { questId });

  const token = localStorage.getItem('token');
  if (!token) return;

  // Убираем карточку из стека с задержкой, чтобы анимация улёта успела доиграть
  setTimeout(() => {
    quests.value = quests.value.filter(q => q.id !== questId);
  }, 500);

  try {
    const res = await fetch(`${API_URL}/quests/swipe`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ questId, action: 'like' }),
    });

    if (!res.ok) {
      // Возвращаем карточку обратно при ошибке сервера
      await loadQuests();
      showToast('Не удалось отправить лайк. Попробуй ещё раз.', 'error');
      return;
    }

    const data = await res.json();
    if (data.status === 'matched') {
      router.push(`/match/${data.match.id}/schedule`);
    } else if (data.status === 'already_matched') {
      router.push(`/match/${data.matchId}/schedule`);
    }
  } catch {
    await loadQuests();
    showToast('Нет соединения. Проверь интернет.', 'error');
  }
}

function onNope(questId: string) {
  if (!questId) return;
  track('swipe_nope', { questId });
  const quest = quests.value.find(q => q.id === questId);
  // Задержка для анимации улёта
  setTimeout(() => {
    quests.value = quests.value.filter(q => q.id !== questId);
  }, 500);
  if (quest) {
    lastNopedQuest.value = quest;
    showUndo.value = true;
    if (undoTimer) clearTimeout(undoTimer);
    undoTimer = setTimeout(() => {
      showUndo.value = false;
      lastNopedQuest.value = null;
    }, 4000);
  }
}

function applyFilters() {
  showFilters.value = false;
  loadQuests();
}

const showLogoutConfirm = ref(false);

function logout() {
  showLogoutConfirm.value = true;
}

function doLogout() {
  localStorage.removeItem('token');
  localStorage.removeItem('userId');
  router.push('/');
}

function connectSocket() {
  const token = localStorage.getItem('token');
  if (!token) return;
  const wsUrl = API_URL.replace('/api', '');
  socket = io(wsUrl, { auth: { token }, path: '/api-socket' });
  socket.on('matchFound', (matchId: number) => {
    router.push(`/match/${matchId}/schedule`);
  });
}

onMounted(() => {
  loadQuests();
  connectSocket();
});

onUnmounted(() => { socket?.disconnect(); });
</script>

<style scoped>
.dashboard { overflow-x: hidden; }

.cards-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px 20px 0;
  min-height: 0;
}

.cards-stack {
  position: relative;
  width: 100%;
  max-width: 360px;
  height: 480px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
  padding: 40px 20px;
}
.skeleton-stack { width: 100%; max-width: 360px; }
.skeleton-quest-card {
  width: 100%; border-radius: var(--radius); overflow: hidden;
  background: var(--surface); box-shadow: var(--shadow);
}
.skeleton-img { width: 100%; height: 300px; border-radius: 0; }
.skeleton-quest-info { padding: 16px; display: flex; flex-direction: column; gap: 8px; }

.swipe-hints {
  display: flex;
  justify-content: space-between;
  width: 100%;
  max-width: 360px;
  padding: 12px 8px 0;
}
.swipe-hint { display: flex; align-items: center; gap: 4px; font-size: 1rem; }

.action-btns {
  display: flex;
  justify-content: center;
  gap: 24px;
  padding: 20px;
}
.action-btn {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  border: none;
  font-size: 1.5rem;
  font-weight: 800;
  cursor: pointer;
  box-shadow: var(--shadow);
  transition: transform 0.15s;
}
.action-btn:active { transform: scale(0.93); }
.action-btn--nope { background: var(--danger-soft); color: var(--danger); }
.action-btn--like { background: var(--success-soft); color: var(--success); }

.overlay {
  position: fixed;
  inset: 0;
  background: rgba(61,53,53,0.4);
  backdrop-filter: blur(4px);
  z-index: 100;
  display: flex;
  align-items: flex-end;
}
.filter-drawer {
  background: var(--surface);
  border-radius: var(--radius) var(--radius) 0 0;
  padding: 24px 20px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.filter-drawer__header { display: flex; align-items: center; justify-content: space-between; }
.field-group { display: flex; flex-direction: column; gap: 8px; }
.gender-btns { display: flex; gap: 10px; }
.gender-btn {
  flex: 1;
  padding: 12px 8px;
  border-radius: var(--radius-sm);
  border: 2px solid #EDE8E5;
  background: var(--surface);
  font-family: var(--font);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  color: var(--text-muted);
  transition: all 0.15s;
}
.gender-btn.active { border-color: var(--primary); background: var(--primary-soft); color: var(--primary); }
.age-range-row { display: flex; flex-direction: column; gap: 8px; }
.age-slider { width: 100%; accent-color: var(--primary); cursor: pointer; }

.ban-screen { align-items: center; justify-content: center; text-align: center; }
.ban-icon { font-size: 4rem; }

/* Pull-to-refresh */
.ptr-indicator {
  display: flex;
  justify-content: center;
  padding: 10px 0 0;
}
@keyframes ptr-spin { to { transform: rotate(360deg); } }
.ptr-spinner {
  width: 24px; height: 24px;
  border: 3px solid var(--primary-soft);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: ptr-spin 0.7s linear infinite;
}

.confirm-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(61, 53, 53, 0.45); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center; padding: 24px;
}
.confirm-card {
  background: var(--surface); border-radius: var(--radius);
  padding: 28px 24px; width: 100%; max-width: 320px;
  display: flex; flex-direction: column; gap: 12px; text-align: center;
  box-shadow: var(--shadow-lg);
}
.confirm-card h3 { margin: 0; }
.confirm-card p  { font-size: 0.9rem; }
.confirm-btns { display: flex; gap: 10px; margin-top: 4px; }
.confirm-btns .btn { flex: 1; }

.toast-msg {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 20px;
  border-radius: var(--radius-sm);
  font-size: 0.9rem;
  font-weight: 600;
  z-index: 200;
  max-width: 340px;
  text-align: center;
  box-shadow: var(--shadow-lg);
}
.toast-msg--error { background: var(--danger); color: #fff; }
.toast-msg--success { background: var(--success); color: #fff; }
.toast-enter-active, .toast-leave-active { transition: opacity 0.25s, transform 0.25s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(12px); }

/* Undo-кнопка */
.undo-btn {
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--text);
  color: #fff;
  border: none;
  border-radius: 100px;
  padding: 10px 22px;
  font-family: var(--font);
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  z-index: 150;
  box-shadow: var(--shadow-lg);
  white-space: nowrap;
}
.undo-enter-active, .undo-leave-active { transition: opacity 0.2s, transform 0.2s; }
.undo-enter-from, .undo-leave-to { opacity: 0; transform: translateX(-50%) translateY(8px); }

/* Категории в фильтрах */
.category-chips { display: flex; flex-wrap: wrap; gap: 6px; }

/* Тогл */
.toggle-row { display: flex; align-items: center; justify-content: space-between; cursor: pointer; }
.toggle-switch {
  width: 44px; height: 26px;
  background: #EDE8E5;
  border-radius: 100px;
  position: relative;
  transition: background 0.2s;
  flex-shrink: 0;
}
.toggle-switch.on { background: var(--primary); }
.toggle-thumb {
  position: absolute;
  top: 3px; left: 3px;
  width: 20px; height: 20px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
  box-shadow: 0 1px 4px rgba(0,0,0,0.15);
}
.toggle-switch.on .toggle-thumb { transform: translateX(18px); }
</style>
