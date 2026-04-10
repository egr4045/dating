<template>
  <div class="page dashboard">

    <!-- Шапка -->
    <header class="app-header">
      <div class="app-header__logo">🌟 Meetup</div>
      <div class="app-header__actions">
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

    <!-- Основная лента -->
    <template v-else>
      <div class="cards-area">
        <div v-if="loading" class="empty-state anim-fade-in">
          <div class="loading-spinner">🌀</div>
          <p>Загружаем события...</p>
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
        <button class="action-btn action-btn--nope" @click="onNope(quests[quests.length - 1]?.id)">✕</button>
        <button class="action-btn action-btn--like" @click="onLike(quests[quests.length - 1]?.id)">✓</button>
      </div>
    </template>

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
            <label class="input-label">Возраст: {{ filters.ageMin }}–{{ filters.ageMax }} лет</label>
            <div class="age-range-row">
              <input type="range" min="16" max="60" v-model.number="filters.ageMin" class="age-slider" />
              <input type="range" min="16" max="60" v-model.number="filters.ageMax" class="age-slider" />
            </div>
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

const router = useRouter();
const quests = ref<any[]>([]);
const loading = ref(true);
const isBanned = ref(false);
const banDateFormatted = ref('');
const showFilters = ref(false);

const filters = ref({ prefGender: 'any', ageMin: 16, ageMax: 60 });
const prefGenderOptions = [
  { value: 'any', emoji: '🌟', label: 'Любой' },
  { value: 'male', emoji: '👦', label: 'Парень' },
  { value: 'female', emoji: '👧', label: 'Девушка' },
];

let socket: Socket | null = null;

async function loadQuests() {
  loading.value = true;
  const token = localStorage.getItem('token');
  if (!token) { router.push('/'); return; }

  try {
    const res = await fetch(`${API_URL}/quests/feed`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 403) {
      const data = await res.json();
      isBanned.value = true;
      const match = data.message?.match(/\d{4}-\d{2}-\d{2}/);
      banDateFormatted.value = match
        ? new Date(match[0]).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
        : 'неизвестной даты';
      return;
    }

    const data = await res.json();
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
  quests.value = quests.value.filter(q => q.id !== questId);

  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    const res = await fetch(`${API_URL}/quests/swipe`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ questId, action: 'like' }),
    });
    const data = await res.json();

    if (data.status === 'matched') {
      router.push(`/match/${data.match.id}/schedule`);
    } else if (data.status === 'already_matched') {
      router.push(`/match/${data.matchId}/schedule`);
    }
  } catch { /* ignore */ }
}

function onNope(questId: string) {
  if (!questId) return;
  quests.value = quests.value.filter(q => q.id !== questId);
}

function applyFilters() {
  showFilters.value = false;
  loadQuests();
}

function logout() {
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
.loading-spinner { font-size: 2.5rem; animation: spin 1.2s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

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
</style>
