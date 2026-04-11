<template>
  <div class="page settings">

    <Teleport to="body">
      <Transition name="toast">
        <div v-if="toast" :class="['s-toast', `s-toast--${toast.type}`]">{{ toast.message }}</div>
      </Transition>
    </Teleport>

    <header class="app-header">
      <button class="icon-btn" @click="$router.push('/dashboard')">←</button>
      <div class="app-header__logo">Настройки</div>
      <div style="width:40px" />
    </header>

    <div v-if="loading" class="page-content">
      <!-- Skeleton: профиль -->
      <div class="skeleton-card">
        <div style="display:flex;flex-direction:column;align-items:center;gap:12px">
          <div class="skeleton skeleton-avatar" style="width:120px;height:120px" />
          <div class="skeleton skeleton-title" style="width:120px" />
          <div style="display:flex;gap:8px">
            <div class="skeleton skeleton-text" style="width:60px;height:22px;border-radius:100px" />
            <div class="skeleton skeleton-text" style="width:80px;height:22px;border-radius:100px" />
          </div>
        </div>
      </div>
      <!-- Skeleton: репутация -->
      <div class="skeleton-card">
        <div class="skeleton skeleton-text" style="width:140px" />
        <div class="skeleton skeleton-title" style="width:80px;margin-top:4px" />
        <div class="skeleton skeleton-text" style="width:100%;height:6px;margin-top:8px;border-radius:100px" />
      </div>
      <!-- Skeleton: интересы -->
      <div class="skeleton-card">
        <div class="skeleton skeleton-text" style="width:120px" />
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px">
          <div v-for="n in 6" :key="n" class="skeleton" style="height:34px;width:80px;border-radius:100px" />
        </div>
        <div class="skeleton skeleton-btn" style="margin-top:4px" />
      </div>
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
        <button class="btn btn-ghost btn-sm" style="margin-top:4px" @click="showPreview = true">
          👁 Как меня видят
        </button>
      </div>

      <!-- Превью профиля (модалка) -->
      <Teleport to="body">
        <div v-if="showPreview" class="preview-overlay" @click.self="showPreview = false">
          <div class="preview-card anim-scale-in">
            <div class="preview-card__header">
              <span>Превью анкеты</span>
              <button class="icon-btn" @click="showPreview = false">✕</button>
            </div>
            <div class="preview-profile">
              <img v-if="profile?.photoUrl" :src="profile.photoUrl" class="preview-avatar" />
              <div v-else class="avatar avatar-xl">{{ profile?.firstName?.[0] }}</div>
              <h2 style="margin-top:12px">{{ profile?.firstName }}<span v-if="profile?.age" class="text-muted" style="font-weight:500;font-size:1.1rem">, {{ profile.age }}</span></h2>
              <div class="preview-meta">
                <span v-if="profile?.city" class="badge badge-muted">📍 {{ profile.city }}</span>
                <span v-if="profile?.videoVerified" class="badge badge-success">✅ Верифицирован</span>
                <span class="badge badge-muted">⭐ {{ profile?.reputation?.toFixed(1) }}</span>
              </div>
              <p v-if="profile?.bio" class="text-sm text-muted" style="margin-top:8px;text-align:center">{{ profile.bio }}</p>
              <div v-if="selectedInterests.length" class="preview-interests">
                <span v-for="id in selectedInterests.slice(0, 6)" :key="id" class="chip chip-default">
                  {{ interestLabel(id) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Teleport>

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
import { track } from '../analytics';

const loading = ref(true);
const savingInterests = ref(false);
const savingPrefs = ref(false);
const profile = ref<any>(null);
const selectedInterests = ref<string[]>([]);
const prefGender = ref('any');
const showPreview = ref(false);

const interestEmojiMap: Record<string, string> = {
  hookah: '💨 Кальян', bar: '🍺 Бар', sport: '⚽ Спорт', movie_theatre: '🎬 Кино',
  picnic: '🧺 Пикник', bowling: '🎳 Боулинг',
  dota: '⚔️ Dota 2', cs: '🔫 CS2', mc: '⛏️ Minecraft', wow: '🐉 WoW', itt: '🃏 Настолки', split: '🎭 Splitgate',
  movie_online: '🍿 Кино онлайн', series: '📺 Сериалы', chatting: '💬 Поболтать',
};
function interestLabel(id: string) { return interestEmojiMap[id] ?? id; }

// ── Тосты ─────────────────────────────────────────────────────────────────
const toast = ref<{ message: string; type: 'success' | 'error' } | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | null = null;
function showToast(message: string, type: 'success' | 'error' = 'success') {
  if (toastTimer) clearTimeout(toastTimer);
  toast.value = { message, type };
  toastTimer = setTimeout(() => { toast.value = null; }, 3000);
}

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
  try {
    const res = await fetch(`${API_URL}/users/interests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ interests: selectedInterests.value }),
    });
    if (res.ok) {
      track('settings_interests_save');
      showToast('✅ Интересы сохранены');
    } else {
      showToast('Не удалось сохранить. Попробуй снова.', 'error');
    }
  } catch {
    showToast('Нет соединения.', 'error');
  } finally {
    savingInterests.value = false;
  }
}

async function savePreferences() {
  const token = localStorage.getItem('token');
  if (!token) return;
  savingPrefs.value = true;
  try {
    const res = await fetch(`${API_URL}/users/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ prefGender: prefGender.value }),
    });
    if (res.ok) {
      track('settings_profile_save');
      showToast('✅ Предпочтения сохранены');
    } else {
      showToast('Не удалось сохранить. Попробуй снова.', 'error');
    }
  } catch {
    showToast('Нет соединения.', 'error');
  } finally {
    savingPrefs.value = false;
  }
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

.s-toast {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  padding: 12px 20px; border-radius: var(--radius-sm); font-size: 0.9rem;
  font-weight: 600; z-index: 300; max-width: 320px; text-align: center;
  box-shadow: var(--shadow-lg);
}
.s-toast--success { background: var(--success); color: #fff; }
.s-toast--error   { background: var(--danger);  color: #fff; }
.toast-enter-active, .toast-leave-active { transition: opacity 0.25s, transform 0.25s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(10px); }

/* Preview overlay */
.preview-overlay {
  position: fixed; inset: 0; z-index: 250;
  background: rgba(61, 53, 53, 0.5); backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center; padding: 24px;
}
.preview-card {
  background: var(--surface); border-radius: var(--radius);
  width: 100%; max-width: 340px;
  overflow: hidden; box-shadow: var(--shadow-lg);
}
.preview-card__header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 16px 12px; font-weight: 700; font-size: 0.875rem; color: var(--text-muted);
  border-bottom: 1px solid #EDE8E5;
}
.preview-profile {
  display: flex; flex-direction: column; align-items: center;
  padding: 20px 20px 24px; gap: 6px;
}
.preview-avatar { width: 110px; height: 110px; border-radius: 50%; object-fit: cover; }
.preview-meta { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-top: 4px; }
.preview-interests { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; margin-top: 8px; }
</style>
