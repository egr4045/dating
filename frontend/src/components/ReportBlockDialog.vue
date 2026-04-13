<template>
  <Teleport to="body">
    <div v-if="modelValue" class="dialog-overlay" @click.self="close">
      <div class="dialog-card anim-scale-in">
        <div class="dialog-header">
          <h3 style="margin:0; font-size:1.1rem; color: var(--danger)">Опции безопасности</h3>
          <button class="icon-btn" @click="close">✕</button>
        </div>
        
        <div class="dialog-body">
          <p class="text-sm text-muted" style="margin-bottom:16px;">
            Безопасность — наш приоритет. Выбери нужное действие:
          </p>
          
          <button class="action-btn" @click="mode = 'block'" v-if="mode === 'menu'">
            <span class="icon">🚫</span> Заблокировать
          </button>
          
          <button class="action-btn" @click="mode = 'report'" v-if="mode === 'menu'">
            <span class="icon">🚩</span> Пожаловаться
          </button>

          <!-- Блокировка -->
          <div v-if="mode === 'block'" class="flow-container">
            <h4 style="margin:0 0 8px 0">Заблокировать?</h4>
            <p class="text-sm text-muted" style="margin-bottom:12px;">Вы больше не увидите друг друга, а текущая встреча будет отменена.</p>
            <div class="flex gap-8">
              <button class="btn btn-ghost" @click="mode = 'menu'">Назад</button>
              <button class="btn btn-danger flex-1" @click="onBlock" :disabled="loading">В бан</button>
            </div>
          </div>

          <!-- Жалоба -->
          <div v-if="mode === 'report'" class="flow-container">
            <h4 style="margin:0 0 8px 0">Жалоба</h4>
            <select v-model="reason" class="input" style="width:100%; margin-bottom:12px;">
              <option value="" disabled>Укажи причину</option>
              <option value="fake">Ненастоящий профиль / Спам</option>
              <option value="inappropriate">Неприемлемое поведение</option>
              <option value="danger">Угроза безопасности</option>
              <option value="other">Другое</option>
            </select>
            <textarea v-if="reason === 'other'" v-model="customReason" class="input" rows="3" placeholder="Опиши подробнее..." style="width:100%; margin-bottom:12px; resize:none;"></textarea>
            
            <div class="flex gap-8">
              <button class="btn btn-ghost" @click="mode = 'menu'">Назад</button>
              <button class="btn btn-danger flex-1" @click="onReport" :disabled="loading || !finalReason">Отправить</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { API_URL } from '../config';
import { useToast } from '../composables/useToast';

const props = defineProps<{
  modelValue: boolean;
  userId: number;
}>();
const emit = defineEmits(['update:modelValue', 'blocked', 'reported']);

const { success, error } = useToast();
const mode = ref<'menu'|'block'|'report'>('menu');
const reason = ref('');
const customReason = ref('');
const loading = ref(false);

const finalReason = computed(() => reason.value === 'other' ? customReason.value.trim() : reason.value);

function close() {
  emit('update:modelValue', false);
  setTimeout(() => { mode.value = 'menu'; reason.value = ''; customReason.value = ''; }, 300);
}

async function onBlock() {
  const token = localStorage.getItem('token');
  loading.value = true;
  try {
    const res = await fetch(`${API_URL}/users/${props.userId}/block`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) {
      success('Пользователь заблокирован');
      emit('blocked');
      close();
    } else {
      error('Ошибка при блокировке');
    }
  } catch {
    error('Нет связи с сервером');
  } finally {
    loading.value = false;
  }
}

async function onReport() {
  const token = localStorage.getItem('token');
  loading.value = true;
  try {
    const res = await fetch(`${API_URL}/users/${props.userId}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ reason: finalReason.value })
    });
    if (res.ok) {
      success('Жалоба отправлена, спасибо за помощь');
      emit('reported');
      close();
    } else {
      error('Ошибка отправки жалобы');
    }
  } catch {
    error('Нет связи с сервером');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center; padding: 24px;
}
.dialog-card {
  background: var(--surface); border-radius: var(--radius);
  width: 100%; max-width: 320px; overflow: hidden;
  box-shadow: var(--shadow-lg);
}
.dialog-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px; border-bottom: 1px solid #EDE8E5;
}
.dialog-body { padding: 16px; display: flex; flex-direction: column; gap: 8px; }

.action-btn {
  display: flex; align-items: center; gap: 12px;
  width: 100%; padding: 12px 16px;
  background: var(--bg); border: 1px solid #EDE8E5; border-radius: var(--radius-sm);
  font-family: inherit; font-size: 0.95rem; font-weight: 600; color: var(--text);
  cursor: pointer; text-align: left; transition: all 0.15s;
}
.action-btn:hover { background: rgba(232,146,124,0.08); border-color: var(--primary); }
.action-btn .icon { font-size: 1.25rem; }

.flow-container { animation: fade-in 0.2s ease-out; }
@keyframes fade-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }
.flex { display: flex; }
.gap-8 { gap: 8px; }
.flex-1 { flex: 1; }
</style>
