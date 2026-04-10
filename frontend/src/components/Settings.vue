<template>
  <div class="page settings">

    <header class="app-header">
      <button class="icon-btn" @click="$router.push('/dashboard')">←</button>
      <div class="app-header__logo">Настройки</div>
      <div style="width:40px" />
    </header>

    <div v-if="loading" class="page-content" style="align-items:center;justify-content:center">
      <div style="font-size:2rem;animation:spin 1s linear infinite">🌀</div>
    </div>

    <div v-else class="page-content anim-fade-up">

      <!-- Профиль -->
      <div class="card profile-card">
        <div class="profile-photo">
          <img v-if="profile?.photoUrl" :src="profile.photoUrl" class="avatar-img" />
          <div v-else class="avatar avatar-xl">{{ profile?.firstName?.[0] }}</div>
        </div>
        <div class="profile-info">
          <h2>{{ profile?.firstName }}</h2>
          <div class="profile-meta">
            <span v-if="profile?.age" class="badge badge-muted">{{ profile.age }} лет</span>
            <span v-if="profile?.city" class="badge badge-muted">📍 {{ profile.city }}</span>
            <span v-if="profile?.videoVerified" class="badge badge-success">✅ Верифицирован</span>
          </div>
          <p v-if="profile?.bio" class="text-sm text-muted">{{ profile.bio }}</p>
        </div>
      </div>

      <!-- Репутация -->
      <div class="card">
        <div class="section-label">Рейтинг надёжности</div>
        <div class="rep-row">
          <span class="rep-score" :class="repClass">{{ profile?.reputation?.toFixed(1) }}</span>
          <span class="text-muted text-sm">/ 10</span>
        </div>
        <div class="progress-bar" style="margin-top:10px">
          <div class="progress-bar__fill" :class="repClass" :style="{ width: repPercent + '%' }" />
        </div>
        <p class="text-xs text-muted" style="margin-top:6px">{{ repHint }}</p>
      </div>

      <!-- Интересы -->
      <div class="card">
        <div class="section-label">🎯 Мои интересы</div>
        <div v-for="group in interestGroups" :key="group.key" class="interest-group">
          <div class="text-xs text-muted" style="font-weight:600;margin-bottom:6px">{{ group.emoji }} {{ group.label }}</div>
          <div class="chips-wrap">
            <button
              v-for="item in group.items"
              :key="item.id"
              class="chip"
              :class="selectedInterests.includes(item.id) ? 'chip-active' : 'chip-default'"
              @click="toggleInterest(item.id)"
            >{{ item.emoji }} {{ item.label }}</button>
          </div>
        </div>
        <button class="btn btn-primary btn-full btn-sm" @click="saveInterests" :disabled="savingInterests" style="margin-top:8px">
          {{ savingInterests ? 'Сохранение...' : 'Сохранить интересы' }}
        </button>
      </div>

      <!-- Предпочтения партнёра -->
      <div class="card">
        <div class="section-label">👥 Ищу партнёра</div>
        <div class="gender-btns">
          <button
            v-for="g in prefGenders"
            :key="g.value"
            class="gender-btn"
            :class="{ active: prefGender === g.value }"
            @click="prefGender = g.value"
          >{{ g.emoji }} {{ g.label }}</button>
        </div>
        <button class="btn btn-primary btn-full btn-sm" @click="savePreferences" :disabled="savingPrefs" style="margin-top:12px">
          {{ savingPrefs ? 'Сохранение...' : 'Сохранить предпочтения' }}
        </button>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { API_URL } from '../config';

const loading = ref(true);
const savingInterests = ref(false);
const savingPrefs = ref(false);
const profile = ref<any>(null);
const selectedInterests = ref<string[]>([]);
const prefGender = ref('any');

const repPercent = computed(() => Math.min(100, Math.max(0, ((profile.value?.reputation ?? 0) / 10) * 100)));
const repClass = computed(() => {
  const r = profile.value?.reputation ?? 0;
  if (r >= 4) return 'rep-good';
  if (r >= 2) return 'rep-warn';
  return 'rep-bad';
});
const repHint = computed(() => {
  const r = profile.value?.reputation ?? 0;
  if (r >= 4) return '✨ Отличная репутация, продолжай в том же духе!';
  if (r >= 2) return '⚠️ Старайся не пропускать встречи';
  return '🚨 Критически низко — ещё немного и временный бан';
});

const prefGenders = [
  { value: 'any', emoji: '🌟', label: 'Любой' },
  { value: 'male', emoji: '👦', label: 'Парень' },
  { value: 'female', emoji: '👧', label: 'Девушка' },
];

const interestGroups = [
  {
    key: 'offline', emoji: '🌍', label: 'Активности',
    items: [
      { id: 'hookah', emoji: '💨', label: 'Кальян' }, { id: 'bar', emoji: '🍺', label: 'Бар' },
      { id: 'sport', emoji: '⚽', label: 'Спорт' }, { id: 'movie_theatre', emoji: '🎬', label: 'Кино' },
      { id: 'picnic', emoji: '🧺', label: 'Пикник' }, { id: 'bowling', emoji: '🎳', label: 'Боулинг' },
    ]
  },
  {
    key: 'games', emoji: '🎮', label: 'Игры',
    items: [
      { id: 'dota', emoji: '⚔️', label: 'Dota 2' }, { id: 'cs', emoji: '🔫', label: 'CS2' },
      { id: 'mc', emoji: '⛏️', label: 'Minecraft' }, { id: 'wow', emoji: '🐉', label: 'WoW' },
      { id: 'itt', emoji: '🃏', label: 'Настолки' }, { id: 'split', emoji: '🎭', label: 'Splitgate' },
    ]
  },
  {
    key: 'online', emoji: '📱', label: 'Онлайн',
    items: [
      { id: 'movie_online', emoji: '🍿', label: 'Кино онлайн' },
      { id: 'series', emoji: '📺', label: 'Сериалы' },
      { id: 'chatting', emoji: '💬', label: 'Поболтать' },
    ]
  },
];

function toggleInterest(id: string) {
  const idx = selectedInterests.value.indexOf(id);
  if (idx === -1) selectedInterests.value.push(id);
  else selectedInterests.value.splice(idx, 1);
}

async function loadProfile() {
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    const res = await fetch(`${API_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } });
    profile.value = await res.json();
    selectedInterests.value = [...(profile.value.interests ?? [])];
    prefGender.value = profile.value.prefGender ?? 'any';
  } finally {
    loading.value = false;
  }
}

async function saveInterests() {
  const token = localStorage.getItem('token');
  if (!token) return;
  savingInterests.value = true;
  await fetch(`${API_URL}/users/interests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ interests: selectedInterests.value }),
  });
  savingInterests.value = false;
}

async function savePreferences() {
  const token = localStorage.getItem('token');
  if (!token) return;
  savingPrefs.value = true;
  await fetch(`${API_URL}/users/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ prefGender: prefGender.value }),
  });
  savingPrefs.value = false;
}

onMounted(loadProfile);
</script>

<style scoped>
.settings { background: var(--bg); }

.profile-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  text-align: center;
}
.profile-photo { position: relative; }
.avatar-img { width: 120px; height: 120px; border-radius: 50%; object-fit: cover; }
.profile-info { display: flex; flex-direction: column; gap: 6px; align-items: center; }
.profile-info h2 { margin: 0; }
.profile-meta { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }

.rep-row { display: flex; align-items: baseline; gap: 6px; margin-top: 6px; }
.rep-score { font-size: 2rem; font-weight: 800; }
.rep-good { color: var(--success); }
.rep-warn { color: var(--warning); }
.rep-bad { color: var(--danger); }
.progress-bar__fill.rep-good { background: var(--success); }
.progress-bar__fill.rep-warn { background: var(--warning); }
.progress-bar__fill.rep-bad { background: var(--danger); }

.interest-group { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
.chips-wrap { display: flex; flex-wrap: wrap; gap: 6px; }

.gender-btns { display: flex; gap: 10px; }
.gender-btn {
  flex: 1;
  padding: 10px 6px;
  border-radius: var(--radius-sm);
  border: 2px solid #EDE8E5;
  background: var(--surface);
  font-family: var(--font);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  color: var(--text-muted);
  transition: all 0.15s;
}
.gender-btn.active { border-color: var(--primary); background: var(--primary-soft); color: var(--primary); }

@keyframes spin { to { transform: rotate(360deg); } }
</style>
