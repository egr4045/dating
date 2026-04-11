<template>
  <div class="page onboarding">

    <!-- Прогресс -->
    <div class="ob-progress">
      <div class="ob-progress__steps">
        <div
          v-for="i in totalSteps"
          :key="i"
          class="ob-progress__dot"
          :class="{ active: i - 1 === step, done: i - 1 < step }"
        />
      </div>
    </div>

    <!-- ШАГ 0: Фото -->
    <div v-if="step === 0" class="ob-step anim-fade-up">
      <h1>Твоё фото</h1>
      <p>Первое впечатление важно — загрузи реальное фото 😊</p>

      <div class="photo-upload" @click="triggerPhotoInput">
        <img v-if="photoPreview" :src="photoPreview" class="photo-upload__img" />
        <div v-else class="photo-upload__placeholder">
          <span class="photo-upload__icon">📷</span>
          <span>Нажми, чтобы добавить фото</span>
        </div>
        <input ref="photoInput" type="file" accept="image/*" class="hidden" @change="onPhotoSelected" />
      </div>

      <button class="btn btn-primary btn-full" :disabled="!photoPreview" @click="step++">
        Продолжить →
      </button>
      <button class="btn btn-ghost btn-full" @click="step++">Пропустить</button>
    </div>

    <!-- ШАГ 1: Данные -->
    <div v-if="step === 1" class="ob-step anim-fade-up">
      <h1>О тебе</h1>
      <p>Партнёры увидят это только после подтверждённой встречи</p>

      <div class="field-group">
        <label class="input-label">Имя</label>
        <input class="input" v-model="form.firstName" placeholder="Как тебя зовут?" maxlength="30" />
      </div>

      <div class="field-group">
        <label class="input-label">Возраст</label>
        <div class="age-slider-wrap">
          <span class="age-value">{{ form.age }} лет</span>
          <input type="range" min="16" max="60" v-model.number="form.age" class="age-slider" />
          <div class="age-range-labels"><span>16</span><span>60</span></div>
        </div>
      </div>

      <div class="field-group">
        <label class="input-label">Пол</label>
        <div class="gender-btns">
          <button
            v-for="g in genders"
            :key="g.value"
            class="gender-btn"
            :class="{ active: form.gender === g.value }"
            @click="form.gender = g.value"
          >{{ g.emoji }} {{ g.label }}</button>
        </div>
      </div>

      <div class="field-group">
        <label class="input-label">Город</label>
        <input class="input" v-model="form.city" placeholder="Москва, Санкт-Петербург..." maxlength="50" />
      </div>

      <button class="btn btn-primary btn-full" :disabled="!form.firstName || !form.gender" @click="step++">
        Продолжить →
      </button>
    </div>

    <!-- ШАГ 2: О себе -->
    <div v-if="step === 2" class="ob-step anim-fade-up">
      <h1>Пара слов о себе</h1>
      <p>Необязательно, но поможет найти близкого по духу человека</p>

      <textarea
        class="input bio-input"
        v-model="form.bio"
        placeholder="Люблю кино, настолки, не люблю скуку..."
        maxlength="200"
        rows="4"
      />
      <div class="text-xs text-muted text-center">{{ form.bio.length }}/200</div>

      <button class="btn btn-primary btn-full" @click="step++">Продолжить →</button>
      <button class="btn btn-ghost btn-full" @click="step++">Пропустить</button>
    </div>

    <!-- ШАГ 3: Интересы -->
    <div v-if="step === 3" class="ob-step anim-fade-up">
      <h1>Твои интересы</h1>
      <p>Выбери хотя бы 2 — они влияют на подбор событий</p>

      <div v-for="group in interestGroups" :key="group.key" class="interest-group">
        <div class="section-label">{{ group.emoji }} {{ group.label }}</div>
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

      <button
        class="btn btn-primary btn-full"
        :disabled="selectedInterests.length < 2"
        @click="step++"
      >
        Продолжить → ({{ selectedInterests.length }} выбрано)
      </button>
    </div>

    <!-- ШАГ 4: Фильтры партнёра -->
    <div v-if="step === 4" class="ob-step anim-fade-up">
      <h1>Кого ищешь?</h1>
      <p>Настрой, с кем хочешь ходить на события</p>

      <div class="field-group">
        <label class="input-label">Пол партнёра</label>
        <div class="gender-btns">
          <button
            v-for="g in prefGenders"
            :key="g.value"
            class="gender-btn"
            :class="{ active: form.prefGender === g.value }"
            @click="form.prefGender = g.value"
          >{{ g.emoji }} {{ g.label }}</button>
        </div>
      </div>

      <div class="field-group">
        <label class="input-label">Возраст: {{ form.prefAgeMin }}–{{ form.prefAgeMax }} лет</label>
        <div class="age-range-row">
          <div class="age-range-item">
            <span class="text-xs text-muted">От {{ form.prefAgeMin }}</span>
            <input type="range" min="16" max="60" v-model.number="form.prefAgeMin" class="age-slider" />
          </div>
          <div class="age-range-item">
            <span class="text-xs text-muted">До {{ form.prefAgeMax }}</span>
            <input type="range" min="16" max="60" v-model.number="form.prefAgeMax" class="age-slider" />
          </div>
        </div>
      </div>

      <button class="btn btn-primary btn-full" :disabled="!form.prefGender" @click="step++">
        Продолжить →
      </button>
    </div>

    <!-- ШАГ 5: Правила -->
    <div v-if="step === 5" class="ob-step anim-fade-up">
      <div class="rules-header">
        <div class="rules-icon">🤝</div>
        <h1>Правила сервиса</h1>
        <p>Безопасные и комфортные встречи — наш приоритет</p>
      </div>

      <div class="rules-list">
        <div class="rule-item" v-for="rule in rules" :key="rule.title">
          <span class="rule-emoji">{{ rule.emoji }}</span>
          <div>
            <div class="rule-title">{{ rule.title }}</div>
            <div class="text-sm text-muted">{{ rule.text }}</div>
          </div>
        </div>
      </div>

      <div class="payment-rule card card-sm">
        <div class="flex items-center gap-8">
          <span style="font-size:1.5rem">💰</span>
          <div>
            <div class="font-bold">Правило оплаты</div>
            <div class="text-sm text-muted">По умолчанию всё 50/50. Если хочется иначе — обсудите в чате.</div>
          </div>
        </div>
        <div class="payment-badge" style="margin-top:10px;align-self:flex-start">🤝 50/50</div>
      </div>

      <button class="btn btn-primary btn-full" @click="step++">Всё понятно, поехали!</button>
    </div>

    <!-- ШАГ 6: Видео-верификация -->
    <div v-if="step === 6" class="ob-step anim-fade-up">
      <h1>Видео-верификация</h1>
      <p>5–10 секунд записи подтверждают, что ты реальный человек. Видео видят только модераторы.</p>

      <VideoRecorder @update:blob="b => videoBlob = b" />

      <button class="btn btn-primary btn-full" @click="finish" :disabled="saving">
        {{ saving ? 'Сохранение...' : 'Завершить →' }}
      </button>
      <button class="btn btn-ghost btn-full" @click="finish">Пропустить</button>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { API_URL } from '../config';
import { track } from '../analytics';
import VideoRecorder from './VideoRecorder.vue';

const router = useRouter();
const step = ref(0);
const totalSteps = 7;
const saving = ref(false);
const videoBlob = ref<Blob | null>(null);

const DRAFT_KEY = 'onboarding_draft';

const form = ref({
  firstName: '',
  age: 25,
  gender: '',
  city: '',
  bio: '',
  prefGender: '',
  prefAgeMin: 18,
  prefAgeMax: 40,
  photoUrl: '',
});

const selectedInterests = ref<string[]>([]);

// Автосохранение: запись в localStorage при любом изменении
function saveDraft() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      step: step.value,
      form: { ...form.value, photoUrl: '' }, // не сохраняем base64 фото
      selectedInterests: selectedInterests.value,
    }));
  } catch { /* localStorage может быть заполнен */ }
}

function restoreDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    const draft = JSON.parse(raw);
    if (draft.step) step.value = draft.step;
    if (draft.form) Object.assign(form.value, draft.form);
    if (draft.selectedInterests) selectedInterests.value = draft.selectedInterests;
  } catch { /* игнорируем повреждённый черновик */ }
}

watch([step, form, selectedInterests], saveDraft, { deep: true });

watch(step, (newStep) => {
  track('onboarding_step', { step: newStep });
});

onMounted(() => {
  restoreDraft();
  track('onboarding_start');
});

// Чистим черновик после завершения онбординга (вызывается в finish())
function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}
const photoInput = ref<HTMLInputElement>();
const photoPreview = ref('');

function triggerPhotoInput() {
  photoInput.value?.click();
}

function onPhotoSelected(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    photoPreview.value = reader.result as string;
    form.value.photoUrl = reader.result as string;
  };
  reader.readAsDataURL(file);
}

const interestGroups = [
  {
    key: 'offline', emoji: '🌍', label: 'Активности',
    items: [
      { id: 'hookah', emoji: '💨', label: 'Кальян' },
      { id: 'bar', emoji: '🍺', label: 'Бар' },
      { id: 'sport', emoji: '⚽', label: 'Спорт' },
      { id: 'movie_theatre', emoji: '🎬', label: 'Кино' },
      { id: 'picnic', emoji: '🧺', label: 'Пикник' },
      { id: 'bowling', emoji: '🎳', label: 'Боулинг' },
    ]
  },
  {
    key: 'games', emoji: '🎮', label: 'Игры',
    items: [
      { id: 'dota', emoji: '⚔️', label: 'Dota 2' },
      { id: 'cs', emoji: '🔫', label: 'CS2' },
      { id: 'mc', emoji: '⛏️', label: 'Minecraft' },
      { id: 'wow', emoji: '🐉', label: 'WoW' },
      { id: 'itt', emoji: '🃏', label: 'Настолки' },
      { id: 'split', emoji: '🎭', label: 'Splitgate' },
    ]
  },
  {
    key: 'online', emoji: '📱', label: 'Онлайн',
    items: [
      { id: 'movie_online', emoji: '🍿', label: 'Смотреть кино' },
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

const genders = [
  { value: 'male', emoji: '👦', label: 'Парень' },
  { value: 'female', emoji: '👧', label: 'Девушка' },
  { value: 'other', emoji: '🌈', label: 'Другое' },
];
const prefGenders = [
  { value: 'any', emoji: '🌟', label: 'Любой' },
  { value: 'male', emoji: '👦', label: 'Парень' },
  { value: 'female', emoji: '👧', label: 'Девушка' },
];

const rules = [
  { emoji: '🎯', title: 'Один матч за раз', text: 'Нельзя иметь несколько активных встреч одновременно.' },
  { emoji: '🤝', title: 'Не сливайся', text: 'Отмена матчей снижает рейтинг. Много отмен — временный бан.' },
  { emoji: '🔒', title: 'Безопасность', text: 'Контакты не передаются до встречи. Только чат внутри сервиса.' },
  { emoji: '😊', title: 'Уважение', text: 'Это просто знакомство и совместный досуг. Без давления.' },
];

// (удален onVideoRecorded)

async function finish() {
  saving.value = true;
  const token = localStorage.getItem('token');
  if (!token) { router.push('/'); return; }

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  await fetch(`${API_URL}/users/profile`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      firstName: form.value.firstName || undefined,
      age: form.value.age,
      gender: form.value.gender || undefined,
      city: form.value.city || undefined,
      bio: form.value.bio || undefined,
      photoUrl: form.value.photoUrl || undefined,
      prefGender: form.value.prefGender || undefined,
      prefAgeMin: form.value.prefAgeMin,
      prefAgeMax: form.value.prefAgeMax,
    }),
  });

  if (selectedInterests.value.length > 0) {
    await fetch(`${API_URL}/users/interests`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ interests: selectedInterests.value }),
    });
  }

  if (videoBlob.value) {
    const formData = new FormData();
    formData.append('video', videoBlob.value, 'verification.webm');
    try {
      await fetch(`${API_URL}/users/video`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
    } catch {
      console.error('Ошибка загрузки видео');
    }
  }

  track('onboarding_complete');
  clearDraft();
  saving.value = false;
  router.push('/dashboard');
}
</script>

<style scoped>
.onboarding {
  background: var(--bg);
  padding-bottom: 40px;
}

.ob-progress {
  padding: 16px 20px 0;
  position: sticky;
  top: 0;
  background: var(--bg);
  z-index: 5;
}
.ob-progress__steps {
  display: flex;
  gap: 6px;
  justify-content: center;
  padding-bottom: 16px;
}
.ob-progress__dot {
  height: 6px;
  flex: 1;
  max-width: 48px;
  border-radius: 100px;
  background: var(--surface-2);
  transition: background 0.3s;
}
.ob-progress__dot.done   { background: var(--primary-soft); }
.ob-progress__dot.active { background: var(--primary); }

.ob-step {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px 20px;
  max-width: 480px;
  margin: 0 auto;
  width: 100%;
}
.ob-step h1 { margin-bottom: -8px; }

.photo-upload {
  width: 180px;
  height: 180px;
  border-radius: 50%;
  background: var(--primary-soft);
  border: 3px dashed var(--primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  align-self: center;
}
.photo-upload__img { width: 100%; height: 100%; object-fit: cover; }
.photo-upload__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--primary);
  font-size: 0.875rem;
  font-weight: 600;
  text-align: center;
  padding: 20px;
}
.photo-upload__icon { font-size: 2.5rem; }
.hidden { display: none; }

.age-slider-wrap { display: flex; flex-direction: column; gap: 8px; }
.age-value { font-size: 1.5rem; font-weight: 800; color: var(--primary); text-align: center; }
.age-slider { width: 100%; accent-color: var(--primary); cursor: pointer; }
.age-range-labels { display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); }
.age-range-row { display: flex; flex-direction: column; gap: 12px; }
.age-range-item { display: flex; flex-direction: column; gap: 4px; }

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
  transition: all 0.15s;
  color: var(--text-muted);
}
.gender-btn.active {
  border-color: var(--primary);
  background: var(--primary-soft);
  color: var(--primary);
}

.interest-group { display: flex; flex-direction: column; gap: 8px; }
.chips-wrap { display: flex; flex-wrap: wrap; gap: 8px; }
.field-group { display: flex; flex-direction: column; gap: 8px; }
.bio-input { resize: none; }

.rules-header { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 8px; }
.rules-icon { font-size: 3rem; }
.rules-list { display: flex; flex-direction: column; gap: 12px; }
.rule-item {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  background: var(--surface);
  padding: 14px;
  border-radius: var(--radius-sm);
}
.rule-emoji { font-size: 1.5rem; flex-shrink: 0; }
.rule-title { font-weight: 700; margin-bottom: 2px; }
.payment-rule { display: flex; flex-direction: column; }
</style>
