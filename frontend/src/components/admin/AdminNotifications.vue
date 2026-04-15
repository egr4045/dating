<template>
  <div class="admin-page">
    <div class="header-row">
      <h1 class="admin-title">📢 Массовые рассылки</h1>
    </div>

    <div class="notification-card">
      <!-- Сообщение -->
      <div class="form-group">
        <label>Заголовок (Title)</label>
        <input v-model="form.title" type="text" placeholder="У нас новый партнер!" class="admin-input" />
      </div>

      <div class="form-group">
        <label>Текст сообщения (Body)</label>
        <textarea v-model="form.body" rows="4" placeholder="Заходи посмотреть новые предложения..." class="admin-input"></textarea>
      </div>

      <div class="form-group">
        <label>URL (опционально)</label>
        <input v-model="form.url" type="text" placeholder="/dashboard или https://..." class="admin-input" />
      </div>

      <!-- Таргетинг -->
      <div class="form-group">
        <label>Аудитория</label>
        <div class="segment-tabs">
          <button
            v-for="t in targets"
            :key="t.value"
            :class="['segment-tab', { active: form.target === t.value }]"
            @click="form.target = t.value; fetchPreview()"
          >{{ t.label }}</button>
        </div>
        <div v-if="form.target === 'city'" style="margin-top:10px">
          <input v-model="form.city" @input="fetchPreview" type="text" placeholder="Москва" class="admin-input" />
        </div>
      </div>

      <!-- Каналы -->
      <div class="form-group">
        <label>Каналы отправки</label>
        <div class="channel-checks">
          <label class="channel-check">
            <input type="checkbox" v-model="form.channels.webPush" @change="fetchPreview" />
            <span>Web Push</span>
          </label>
          <label class="channel-check">
            <input type="checkbox" v-model="form.channels.telegram" @change="fetchPreview" />
            <span>Telegram</span>
          </label>
        </div>
      </div>

      <!-- Preview счётчик -->
      <div v-if="preview" class="preview-box">
        <span>👁 Получат:</span>
        <span v-if="form.channels.webPush"> Web Push — <strong>{{ preview.pushCount }}</strong></span>
        <span v-if="form.channels.telegram"> · Telegram — <strong>{{ preview.telegramCount }}</strong></span>
      </div>

      <div class="actions">
        <button class="btn btn-primary" :disabled="loading || !canSend" @click="send">
          {{ loading ? 'Отправка...' : 'Разослать' }}
        </button>
      </div>

      <div v-if="result" class="result-box anim-fade-up">
        <h3>✅ Отправлено:</h3>
        <p>Web Push: {{ result.webPushCount }}</p>
        <p>Telegram: {{ result.telegramCount }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { API_URL } from '../../config';
import { adminFetch } from '../../utils/adminFetch';

const targets = [
  { value: 'all', label: 'Все пользователи' },
  { value: 'verified', label: 'Верифицированные' },
  { value: 'city', label: 'По городу' },
];

const form = ref({
  title: '',
  body: '',
  url: '',
  target: 'all' as 'all' | 'verified' | 'city',
  city: '',
  channels: { webPush: true, telegram: true },
});

const loading = ref(false);
const result = ref<any>(null);
const preview = ref<{ pushCount: number; telegramCount: number } | null>(null);
let previewTimer: ReturnType<typeof setTimeout> | null = null;

const canSend = computed(() => form.value.title.trim() && form.value.body.trim() && (form.value.channels.webPush || form.value.channels.telegram));

function fetchPreview() {
  if (previewTimer) clearTimeout(previewTimer);
  previewTimer = setTimeout(async () => {
    const params = new URLSearchParams({ target: form.value.target });
    if (form.value.target === 'city' && form.value.city) params.set('city', form.value.city);
    try {
      const res = await adminFetch(`${API_URL}/admin/notifications/preview?${params}`);
      if (res.ok) preview.value = await res.json();
    } catch {}
  }, 400);
}

async function send() {
  if (!confirm(`Отправить уведомление ${preview.value ? `(Push: ${preview.value.pushCount}, TG: ${preview.value.telegramCount})` : ''}?`)) return;

  loading.value = true;
  result.value = null;

  try {
    const res = await adminFetch(`${API_URL}/admin/notifications/broadcast`, {
      method: 'POST',
      body: JSON.stringify({
        title: form.value.title,
        body: form.value.body,
        url: form.value.url || undefined,
        target: form.value.target,
        city: form.value.target === 'city' ? form.value.city : undefined,
        channels: form.value.channels,
      }),
    });

    if (res.ok) {
      result.value = await res.json();
      form.value = { title: '', body: '', url: '', target: 'all', city: '', channels: { webPush: true, telegram: true } };
      preview.value = null;
    } else {
      const err = await res.json();
      alert('Ошибка: ' + (err.message || 'Неизвестная ошибка'));
    }
  } catch {
    alert('Ошибка сети или сервера');
  } finally {
    loading.value = false;
  }
}

onMounted(fetchPreview);
</script>

<style scoped>
.notification-card {
  background: #1a1d27;
  border-radius: 16px;
  padding: 24px;
  border: 1px solid #2a2d3a;
  max-width: 600px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 0.9rem;
  font-weight: 700;
  color: #9ca3af;
}

.admin-input {
  width: 100%;
  background: #0f1117;
  border: 1px solid #2a2d3a;
  border-radius: 10px;
  padding: 12px 16px;
  color: #fff;
  font-family: inherit;
  font-size: 1rem;
  box-sizing: border-box;
}

.admin-input:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2);
}

.segment-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.segment-tab {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid #2a2d3a;
  background: #0f1117;
  color: #9ca3af;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.segment-tab.active {
  background: #6366f1;
  border-color: #6366f1;
  color: #fff;
}

.channel-checks {
  display: flex;
  gap: 20px;
}

.channel-check {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #9ca3af;
  font-size: 0.9rem;
  cursor: pointer;
}

.channel-check input { accent-color: #6366f1; width: 16px; height: 16px; }

.preview-box {
  background: rgba(99, 102, 241, 0.1);
  border: 1px solid rgba(99, 102, 241, 0.3);
  border-radius: 10px;
  padding: 12px 16px;
  font-size: 0.9rem;
  color: #818cf8;
  margin-bottom: 20px;
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.preview-box strong { color: #fff; }

.btn {
  padding: 12px 24px;
  border-radius: 10px;
  border: none;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #6366f1;
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  background: #4f46e5;
  transform: translateY(-2px);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.result-box {
  margin-top: 24px;
  padding: 16px;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.2);
  border-radius: 12px;
}

.result-box h3 {
  margin: 0 0 8px;
  color: #10b981;
  font-size: 1rem;
}

.result-box p {
  margin: 4px 0;
  font-size: 0.9rem;
  color: #9ca3af;
}
</style>
