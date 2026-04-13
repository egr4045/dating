<template>
  <div>
    <h2 style="margin-bottom:20px;color:#fff">Глобальные настройки (AppConfig)</h2>
    <div v-if="loading" style="color:#9ca3af">Ожидание конфигурации...</div>
    <div v-else class="config-grid">
      <div v-for="(_, key) in config" :key="key" class="config-card">
        <label :for="key" class="config-label">{{ dict[key] || key }}</label>
        <span class="config-desc">{{ dictDesc[key] }}</span>
        <input :id="String(key)" v-model="config[key]" type="text" class="admin-input" />
      </div>
    </div>
    
    <div style="margin-top:24px">
      <button class="save-btn" @click="save" :disabled="saving">
        {{ saving ? 'Сохранение...' : '💾 Сохранить изменения' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { API_URL } from '../../config';
import { adminFetch } from '../../utils/adminFetch';
import { useToast } from '../../composables/useToast';

const dict: Record<string, string> = {
  repCompletedBonus: 'Бонус за встречу (+)',
  repFailedPenalty: 'Штраф за срыв (-)',
  repBanThreshold: 'Порог автобана',
  repBanDays: 'Срок автобана (дней)',
};

const dictDesc: Record<string, string> = {
  repCompletedBonus: 'Сколько репутации добавляется при состоявшейся встрече',
  repFailedPenalty: 'Сколько репутации списывается за сорванную встречу',
  repBanThreshold: 'При падении репутации ниже этого значения юзер блокируется',
  repBanDays: 'Количество дней блокировки (0 = навсегда)',
};

const { success, error } = useToast();
const loading = ref(true);
const saving = ref(false);
const config = ref<Record<string, string>>({});

async function load() {
  try {
    const res = await adminFetch(`${API_URL}/admin/config`);
    config.value = await res.json();
  } catch(e) {
    error('Не удалось загрузить настройки');
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  try {
    const res = await adminFetch(`${API_URL}/admin/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config.value)
    });
    if (!res.ok) throw new Error();
    success('Настройки успешно обновлены!');
  } catch(e) {
    error('Ошибка сохранения');
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.config-grid { display: flex; flex-direction: column; gap: 16px; max-width: 600px; }
.config-card { background: #1a1d27; border: 1px solid #2a2d3a; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 8px; }
.config-label { font-weight: 700; font-size: 1.05rem; color: #fff; }
.config-desc { font-size: 0.85rem; color: #9ca3af; margin-bottom: 8px; }
.admin-input { background: #0f1117; border: 1px solid #374151; color: #fff; border-radius: 8px; padding: 10px 14px; font-family: inherit; font-size: 1rem; width: 100%; outline: none; transition: border-color 0.2s;}
.admin-input:focus { border-color: #6366f1; }
.save-btn { background: #6366f1; color: #fff; border: none; border-radius: 8px; padding: 12px 24px; font-weight: 700; font-size: 1rem; cursor: pointer; transition: background 0.2s; }
.save-btn:hover { background: #4f46e5; }
.save-btn:disabled { opacity: 0.7; cursor: wait; }
</style>
