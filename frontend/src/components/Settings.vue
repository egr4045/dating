<template>
  <div class="page settings">

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
        <div class="photos-gallery">
          <div v-if="!profile?.photos?.length && !profile?.photoUrl" class="avatar avatar-xl">{{ profile?.firstName?.[0] }}</div>
          
          <div class="photos-scroll">
            <div v-if="!profile?.photos?.length && profile?.photoUrl" class="photo-item">
              <img :src="profile.photoUrl" class="gallery-img" />
            </div>

            <div 
              v-for="p in profile?.photos" 
              :key="p.id" 
              class="photo-item"
            >
              <img :src="p.url" class="gallery-img" />
              <button class="photo-del-btn" @click="deletePhoto(p.id)">✕</button>
            </div>
            
            <div class="photo-item add-photo-btn" @click="photoInput?.click()">
              <span class="plus-icon">+</span>
            </div>
          </div>
          <input ref="photoInput" type="file" accept="image/jpeg,image/png" style="display:none" @change="uploadPhoto" />
        </div>
        <div class="profile-info">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <h2>{{ profile?.firstName }}</h2>
            <div v-if="profile?.streakDays > 0" class="badge" style="background: var(--danger-soft); color: var(--danger); font-size: 0.9rem; border-radius: 100px;">
              🔥 {{ profile.streakDays }}
            </div>
          </div>

          <!-- Прогресс экспы -->
          <div v-if="profile && profile.xp !== undefined" style="margin-bottom: 8px;">
            <div style="display:flex; justify-content:space-between; font-size: 0.8rem; margin-bottom: 4px; font-weight: 600;">
              <span style="color: var(--primary);">Ур. {{ getLevelInfo(profile.xp).level }}</span>
              <span class="text-muted">{{ profile.xp }} / {{ getLevelInfo(profile.xp).nextLvlXp }} XP</span>
            </div>
            <div class="progress-bar" style="height: 6px; background: var(--surface-2); border-radius: 4px; overflow: hidden;">
              <div class="progress-bar__fill" :style="{ width: getLevelInfo(profile.xp).progressPercent + '%', background: 'var(--primary)', height: '100%', borderRadius: '4px' }" />
            </div>
          </div>
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

      <!-- Достижения -->
      <div class="card" v-if="profile">
        <h3 class="section-title" style="margin-bottom:12px">🏆 Мои достижения</h3>
        <div v-if="!profile.achievements?.length" class="text-sm text-muted" style="text-align: center; padding: 10px;">
          Получай достижения за встречи и идеальную репутацию!
        </div>
        <div v-else style="display:flex; gap: 8px; flex-wrap: wrap;">
          <div v-for="b in profile.achievements" :key="b.badgeId" 
               style="background: var(--surface-2); padding: 8px 12px; border-radius: 12px; border: 1px solid var(--border); display:flex; align-items:center; gap: 6px;">
            <span style="font-size: 1.5rem">{{ getBadge(b.badgeId).icon }}</span>
            <div style="display:flex; flex-direction:column; line-height: 1.2;">
              <span style="font-weight: 700; font-size: 0.85rem">{{ getBadge(b.badgeId).label }}</span>
              <span style="font-size: 0.7rem; color: var(--text-muted)">{{ getBadge(b.badgeId).desc }}</span>
            </div>
          </div>
        </div>
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

      <!-- Рефералка -->
      <div class="card">
        <div class="section-label">Пригласи друга</div>
        <p class="text-xs text-muted">Получи +0.3 к рейтингу, когда твой друг завершит свою первую встречу.</p>
        
        <div style="background: var(--surface-2); border-radius: 12px; padding: 12px; display: flex; align-items: center; justify-content: space-between; margin-top: 10px; border: 1px solid var(--border)">
          <div>
            <span class="text-xs text-muted" style="display:block">Твой код:</span>
            <span style="font-weight: bold; font-family: monospace; font-size: 1.1rem;">{{ profile?.referralCode }}</span>
          </div>
          <button class="btn btn-ghost btn-sm" @click="copyReferralLink">Копировать ссылку</button>
        </div>

        <div v-if="!profile?.referredById" style="margin-top: 16px; border-top: 1px solid var(--border); padding-top: 16px;">
          <div class="section-label">Есть код приглашения?</div>
          <div style="display:flex; gap: 8px; margin-top: 8px;">
            <input v-model="inputReferralCode" placeholder="ABCDEF" class="input chat-input" style="flex:1" maxlength="10" />
            <button class="btn btn-primary btn-sm" @click="applyReferral" :disabled="!inputReferralCode.trim() || applyingReferral">Ок</button>
          </div>
        </div>
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

      <!-- Расписание -->
      <div class="card">
        <div class="section-label">🕒 Моя доступность</div>
        <p class="text-xs text-muted" style="margin-bottom:12px;">Отметь дни и примерное время, когда тебе удобно ходить на встречи</p>
        
        <div class="slots-list">
          <div v-for="d in daysConfig" :key="d.val" class="slot-row">
            <button 
              class="slot-day-btn" 
              :class="{ active: d.active }"
              @click="d.active = !d.active"
            >
              {{ d.label }}
            </button>
            <div v-if="d.active" class="slot-times">
              <input type="time" v-model="d.timeFrom" class="slot-time-input" />
              <span>–</span>
              <input type="time" v-model="d.timeTo" class="slot-time-input" />
            </div>
            <div v-else class="slot-off text-xs text-muted">Недоступен</div>
          </div>
        </div>
        
        <button class="btn btn-primary btn-full btn-sm" @click="saveSlots" :disabled="savingSlots" style="margin-top:12px">
          {{ savingSlots ? 'Сохранение...' : 'Сохранить расписание' }}
        </button>
      </div>

      <!-- Уведомления -->
      <div class="card" style="margin-bottom: 12px;">
        <div class="section-label">🔔 Уведомления</div>

        <!-- Web Push подписка -->
        <div v-if="pushSupported" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div>
            <div style="font-weight:600; font-size:14px;">Web Push</div>
            <div class="text-xs text-muted">{{ pushSubscribed ? 'Включены' : 'Узнавай о матчах и сообщениях' }}</div>
          </div>
          <div class="theme-switch">
            <input type="checkbox" id="pushSwitch" :checked="pushSubscribed" @change="togglePush" :disabled="pushLoading" />
            <label for="pushSwitch" class="switch-ui"></label>
          </div>
        </div>

        <!-- Гранулярные настройки -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <div>
            <div style="font-weight:600; font-size:14px;">Новый матч</div>
            <div class="text-xs text-muted">Push + Telegram при новом совпадении</div>
          </div>
          <div class="theme-switch">
            <input type="checkbox" id="notifyMatchSwitch" v-model="notifyMatch" />
            <label for="notifyMatchSwitch" class="switch-ui"></label>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
          <div>
            <div style="font-weight:600; font-size:14px;">Новое сообщение</div>
            <div class="text-xs text-muted">Push + Telegram при входящем сообщении</div>
          </div>
          <div class="theme-switch">
            <input type="checkbox" id="notifyMessageSwitch" v-model="notifyMessage" />
            <label for="notifyMessageSwitch" class="switch-ui"></label>
          </div>
        </div>

        <button class="btn btn-primary btn-full btn-sm" @click="saveNotificationPrefs" :disabled="savingNotifPrefs">
          {{ savingNotifPrefs ? 'Сохранение...' : 'Сохранить' }}
        </button>
      </div>

      <!-- Темная тема -->
      <div class="card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
        <div>
          <div style="font-weight:700">Тёмная тема 🌙</div>
          <div class="text-xs text-muted">Снижает нагрузку на глаза</div>
        </div>
        <div class="theme-switch">
          <input type="checkbox" id="themeSwitch" v-model="isDarkTheme" @change="toggleTheme" />
          <label for="themeSwitch" class="switch-ui"></label>
        </div>
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

      <!-- Удаление аккаунта -->
      <div style="margin-top:24px;margin-bottom:16px;">
        <button class="btn btn-ghost btn-full text-sm" style="color:var(--danger)" @click="deleteAccount">Удалить аккаунт</button>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { API_URL } from '../config';
import { track } from '../analytics';
import { useToast } from '../composables/useToast';
import { getBadge } from '../utils/badges';
import { getLevelInfo } from '../utils/levels';
import { usePush } from '../composables/usePush';

const router = useRouter();
const { success: toastSuccess, error: toastError } = useToast();
const { isSupported: pushSupported, isSubscribed: pushSubscribed, loading: pushLoading, subscribe: pushSubscribe, checkSubscription } = usePush();

const loading = ref(true);
const savingInterests = ref(false);
const savingPrefs = ref(false);
const savingSlots = ref(false);
const savingNotifPrefs = ref(false);
const notifyMatch = ref(true);
const notifyMessage = ref(true);
const profile = ref<any>(null);
const selectedInterests = ref<string[]>([]);
const prefGender = ref('any');
const showPreview = ref(false);
const photoInput = ref<HTMLInputElement | null>(null);
const isDarkTheme = ref(false);
const inputReferralCode = ref('');
const applyingReferral = ref(false);

const daysConfig = ref([
  { val: 0, label: 'Пн', active: false, timeFrom: '19:00', timeTo: '22:00' },
  { val: 1, label: 'Вт', active: false, timeFrom: '19:00', timeTo: '22:00' },
  { val: 2, label: 'Ср', active: false, timeFrom: '19:00', timeTo: '22:00' },
  { val: 3, label: 'Чт', active: false, timeFrom: '19:00', timeTo: '22:00' },
  { val: 4, label: 'Пт', active: false, timeFrom: '19:00', timeTo: '22:00' },
  { val: 5, label: 'Сб', active: false, timeFrom: '12:00', timeTo: '20:00' },
  { val: 6, label: 'Вс', active: false, timeFrom: '12:00', timeTo: '20:00' },
]);

const interestEmojiMap: Record<string, string> = {
  hookah: '💨 Кальян', bar: '🍺 Бар', sport: '⚽ Спорт', movie_theatre: '🎬 Кино',
  picnic: '🧺 Пикник', bowling: '🎳 Боулинг',
  dota: '⚔️ Dota 2', cs: '🔫 CS2', mc: '⛏️ Minecraft', wow: '🐉 WoW', itt: '🃏 Настолки', split: '🎭 Splitgate',
  movie_online: '🍿 Кино онлайн', series: '📺 Сериалы', chatting: '💬 Поболтать',
};
function interestLabel(id: string) { return interestEmojiMap[id] ?? id; }

function showToast(message: string, type: 'success' | 'error' = 'success') {
  type === 'success' ? toastSuccess(message) : toastError(message);
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

function toggleTheme() {
  if (isDarkTheme.value) {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('theme', 'light');
  }
}

async function loadProfile() {
  isDarkTheme.value = document.documentElement.getAttribute('data-theme') === 'dark';
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    const res = await fetch(`${API_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { loading.value = false; return; }
    profile.value = await res.json();
    selectedInterests.value = [...(profile.value.interests ?? [])];
    prefGender.value = profile.value.prefGender ?? 'any';
    notifyMatch.value = profile.value.notifyMatch ?? true;
    notifyMessage.value = profile.value.notifyMessage ?? true;
    if (profile.value.timeSlots) {
      profile.value.timeSlots.forEach((s: any) => {
        const d = daysConfig.value.find(day => day.val === s.dayOfWeek);
        if (d) {
          d.active = true;
          d.timeFrom = s.timeFrom;
          d.timeTo = s.timeTo;
        }
      });
    }
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

async function saveSlots() {
  const token = localStorage.getItem('token');
  if (!token) return;
  savingSlots.value = true;
  try {
    const payload = daysConfig.value
      .filter(d => d.active)
      .map(d => ({ dayOfWeek: d.val, timeFrom: d.timeFrom, timeTo: d.timeTo }));
      
    const res = await fetch(`${API_URL}/users/slots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ slots: payload }),
    });
    if (res.ok) {
      showToast('✅ Расписание сохранено');
    } else {
      showToast('Ошибка сохранения', 'error');
    }
  } catch {
    showToast('Нет соединения', 'error');
  } finally {
    savingSlots.value = false;
  }
}

async function saveNotificationPrefs() {
  const token = localStorage.getItem('token');
  if (!token) return;
  savingNotifPrefs.value = true;
  try {
    const res = await fetch(`${API_URL}/users/notification-prefs`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ notifyMatch: notifyMatch.value, notifyMessage: notifyMessage.value }),
    });
    if (res.ok) {
      showToast('✅ Настройки уведомлений сохранены');
    } else {
      showToast('Ошибка сохранения', 'error');
    }
  } catch {
    showToast('Нет соединения', 'error');
  } finally {
    savingNotifPrefs.value = false;
  }
}

async function deleteAccount() {
  if (!confirm('Удалить аккаунт безвозвратно?')) return;
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    await fetch(`${API_URL}/users/me`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    localStorage.removeItem('token');
    router.push('/');
  } catch {
    showToast('Ошибка удаления', 'error');
  }
}

async function uploadPhoto(event: Event) {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const token = localStorage.getItem('token');
  if (!token) return;

  const formData = new FormData();
  formData.append('photo', file);

  showToast('Загрузка фото...', 'success');
  try {
    const res = await fetch(`${API_URL}/users/photos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (res.ok) {
      await loadProfile();
      showToast('Фото загружено', 'success');
    } else {
      showToast('Ошибка загрузки', 'error');
    }
  } catch {
    showToast('Нет соединения', 'error');
  } finally {
    if (photoInput.value) photoInput.value.value = '';
  }
}

async function deletePhoto(id: number) {
  if (!confirm('Удалить эту фотографию?')) return;
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    const res = await fetch(`${API_URL}/users/photos/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      await loadProfile();
      showToast('Фото удалено', 'success');
    } else {
      showToast('Ошибка удаления', 'error');
    }
  } catch {
    showToast('Нет соединения', 'error');
  }
}

function copyReferralLink() {
  const url = `${window.location.origin}/?ref=${profile.value.referralCode}`;
  navigator.clipboard.writeText(url);
  toastSuccess('Ссылка скопирована!');
}

async function applyReferral() {
  if (!inputReferralCode.value.trim()) return;
  applyingReferral.value = true;
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL}/users/apply-referral`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code: inputReferralCode.value.trim() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Ошибка');
    toastSuccess('Код успешно применен!');
    loadProfile(); 
  } catch (e: any) {
    toastError(e.message);
  } finally {
    applyingReferral.value = false;
  }
}

async function togglePush() {
  if (pushSubscribed.value) {
    // Отписываемся
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        const token = localStorage.getItem('token');
        await fetch(`${API_URL}/users/push-subscription`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
      }
      pushSubscribed.value = false;
      toastSuccess('Уведомления отключены');
    } catch {
      toastError('Не удалось отключить уведомления');
    }
  } else {
    const ok = await pushSubscribe();
    if (ok) toastSuccess('Уведомления включены 🔔');
    else toastError('Не удалось включить уведомления. Проверьте разрешения.');
  }
}

onMounted(async () => {
  await loadProfile();
  checkSubscription();
});
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
.photos-gallery { width: 100%; text-align: center; display: flex; flex-direction: column; align-items: center; }
.photos-scroll { 
  display: flex; gap: 12px; overflow-x: auto; padding: 4px; scroll-snap-type: x mandatory;
  width: 100%; max-width: 100%; scrollbar-width: none;
}
.photos-scroll::-webkit-scrollbar { display: none; }
.photo-item { 
  position: relative; flex-shrink: 0; width: 110px; height: 140px; scroll-snap-align: center; 
  border-radius: var(--radius); overflow: hidden; background: #eee;
  box-shadow: var(--shadow-sm);
}
.gallery-img { width: 100%; height: 100%; object-fit: cover; }
.photo-del-btn {
  position: absolute; top: 4px; right: 4px; width: 24px; height: 24px;
  background: rgba(255,59,48,0.9); color: #fff; border: none; border-radius: 50%;
  font-size: 0.8rem; cursor: pointer; display: flex; align-items: center; justify-content: center;
}
.add-photo-btn {
  display: flex; align-items: center; justify-content: center;
  background: var(--surface); border: 2px dashed #EDE8E5; cursor: pointer;
  color: var(--primary); transition: all 0.2s;
}
.add-photo-btn:hover { border-color: var(--primary); background: var(--primary-soft); }
.plus-icon { font-size: 2.5rem; font-weight: 300; }

.profile-info { display: flex; flex-direction: column; gap: 6px; align-items: center; margin-top: 4px; }
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

.slots-list { display: flex; flex-direction: column; gap: 8px; }
.slot-row { display: flex; align-items: center; gap: 12px; }
.slot-day-btn {
  width: 36px; height: 36px; border-radius: 50%;
  border: 2px solid #EDE8E5; background: var(--surface);
  font-weight: 600; font-size: 0.8rem; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-muted); flex-shrink: 0; transition: all 0.15s;
}
.slot-day-btn.active { border-color: var(--primary); background: var(--primary-soft); color: var(--primary); }
.slot-times { display: flex; align-items: center; gap: 6px; }
.slot-time-input { 
  max-width: 68px; text-align: center; padding: 4px 6px; 
  font-size: 0.85rem; border: 1px solid #EDE8E5; 
  border-radius: var(--radius-sm); background: var(--bg);
}
.slot-off { flex: 1; text-align: left; opacity: 0.7; }

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

/* Switch для темной темы */
.theme-switch input { display: none; }
.switch-ui {
  display: block; width: 44px; height: 24px; background: var(--surface-2); border: 1px solid #EDE8E5;
  border-radius: 100px; position: relative; cursor: pointer;
  transition: background 0.3s, border-color 0.3s;
}
.switch-ui::after {
  content: ''; position: absolute; top: 1px; left: 1px;
  width: 20px; height: 20px; background: #fff; border-radius: 50%;
  transition: transform 0.3s; box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
.theme-switch input:checked + .switch-ui { background: var(--primary); border-color: var(--primary); }
.theme-switch input:checked + .switch-ui::after { transform: translateX(20px); }
</style>
