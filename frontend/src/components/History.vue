<template>
  <div class="history-container">
    <div class="glass-card">
      <header class="history-header">
        <button class="back-btn" @click="$router.push('/dashboard')">← Назад</button>
        <h1 class="page-title">История</h1>
      </header>

      <div v-if="loading" class="loading-state">Загрузка...</div>

      <template v-else>
        <!-- Репутация -->
        <div class="reputation-block">
          <div class="rep-header">
            <span class="rep-label">Текущая репутация</span>
            <span class="rep-value" :class="repClass">{{ reputation.toFixed(1) }}</span>
          </div>
          <div class="rep-bar-bg">
            <div class="rep-bar-fill" :style="{ width: repPercent + '%', background: repGradient }"></div>
          </div>
          <p class="rep-hint">{{ repHint }}</p>
        </div>

        <!-- Список -->
        <div v-if="history.length === 0" class="empty-history">
          <p>📭 Пока нет завершённых мероприятий</p>
        </div>

        <div class="history-list">
          <div v-for="item in history" :key="item.id" class="history-card">
            <div class="card-left">
              <div class="card-icon">{{ statusIcon(item.status) }}</div>
              <div class="card-info">
                <p class="card-title">{{ item.title }}</p>
                <p class="card-partner" v-if="item.partner">
                  с {{ item.partner.firstName }}
                </p>
                <p class="card-date">{{ formatDate(item.createdAt) }}</p>
              </div>
            </div>
            <div class="card-right">
              <span :class="['status-tag', statusClass(item.status)]">
                {{ statusLabel(item.status) }}
              </span>
              <span :class="['rep-delta', item.reputationDelta.startsWith('+') ? 'delta-plus' : item.reputationDelta === '0' ? 'delta-zero' : 'delta-minus']">
                {{ item.reputationDelta === '0' ? '—' : item.reputationDelta }}
              </span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { API_URL } from '../config';

interface HistoryItem {
  id: number;
  title: string;
  subcategory: string;
  status: string;
  reputationDelta: string;
  partner: { id: number; firstName: string } | null;
  createdAt: string;
}

const loading = ref(true);
const history = ref<HistoryItem[]>([]);
const reputation = ref(5.0);

const repPercent = computed(() => Math.min(100, Math.max(0, (reputation.value / 10) * 100)));
const repClass = computed(() => {
  if (reputation.value >= 4) return 'rep-good';
  if (reputation.value >= 2) return 'rep-warn';
  return 'rep-bad';
});
const repGradient = computed(() => {
  if (reputation.value >= 4) return 'linear-gradient(90deg, #43E97B, #38f9d7)';
  if (reputation.value >= 2) return 'linear-gradient(90deg, #ffb300, #ff9800)';
  return 'linear-gradient(90deg, #ff5252, #ff1744)';
});
const repHint = computed(() => {
  if (reputation.value >= 4) return '✨ Отличная репутация! Так держать';
  if (reputation.value >= 2) return '⚠️ Будь аккуратнее, репутация падает';
  return '🚨 Критически низкая репутация. Ещё немного — и бан';
});

const statusIcon = (s: string) => s === 'COMPLETED' ? '✅' : s === 'FAILED' ? '❌' : '🔥';
const statusLabel = (s: string) => s === 'COMPLETED' ? 'Выполнено' : s === 'FAILED' ? 'Сорвалось' : 'В процессе';
const statusClass = (s: string) => s === 'COMPLETED' ? 'tag-ok' : s === 'FAILED' ? 'tag-fail' : 'tag-active';

const formatDate = (d: string) => {
  const date = new Date(d);
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
};

const loadData = async () => {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    const [histRes, profileRes] = await Promise.all([
      fetch(`${API_URL}/quests/history`, { headers: { 'Authorization': `Bearer ${token}` } }),
      fetch(`${API_URL}/users/me`, { headers: { 'Authorization': `Bearer ${token}` } }),
    ]);
    history.value = await histRes.json();
    const profile = await profileRes.json();
    reputation.value = profile.reputation || 5.0;
  } catch (e) {
    console.error('Ошибка загрузки истории:', e);
  } finally {
    loading.value = false;
  }
};

onMounted(loadData);
</script>

<style scoped>
.history-container {
  display: flex;
  justify-content: center;
  padding: 24px;
  min-height: 100vh;
}

.glass-card {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  border-radius: 32px;
  padding: 40px;
  width: 100%;
  max-width: 600px;
  box-shadow: 0 30px 60px rgba(0,0,0,0.08);
}

.history-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 32px;
}
.back-btn {
  background: #f2f2f7;
  border: none;
  padding: 10px 16px;
  border-radius: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s;
}
.back-btn:hover { background: #e5e5ea; }
.page-title { font-size: 28px; font-weight: 800; color: #1d1d1f; margin: 0; }

.loading-state { text-align: center; padding: 40px; color: #86868b; }

/* Репутация */
.reputation-block {
  background: #f8f9fc;
  border-radius: 20px;
  padding: 20px 24px;
  margin-bottom: 28px;
}
.rep-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.rep-label { font-weight: 600; color: #86868b; font-size: 14px; }
.rep-value { font-weight: 800; font-size: 22px; }
.rep-good { color: #43E97B; }
.rep-warn { color: #ffb300; }
.rep-bad { color: #ff5252; }
.rep-bar-bg { height: 8px; background: #e5e5ea; border-radius: 4px; overflow: hidden; }
.rep-bar-fill { height: 100%; border-radius: 4px; transition: width 0.6s ease; }
.rep-hint { margin: 10px 0 0; font-size: 13px; color: #86868b; }

/* Список */
.empty-history { text-align: center; padding: 40px; color: #aeaeb2; font-size: 15px; }

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: white;
  border-radius: 20px;
  border: 1px solid #f0f0f0;
  transition: all 0.2s;
}
.history-card:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,0.04);
  transform: translateY(-1px);
}

.card-left {
  display: flex;
  align-items: center;
  gap: 14px;
}
.card-icon {
  font-size: 28px;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8f9fc;
  border-radius: 14px;
}

.card-info { display: flex; flex-direction: column; gap: 2px; }
.card-title { margin: 0; font-weight: 700; font-size: 15px; color: #1d1d1f; }
.card-partner { margin: 0; font-size: 13px; color: #86868b; }
.card-date { margin: 0; font-size: 12px; color: #aeaeb2; }

.card-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
}

.status-tag {
  padding: 4px 10px;
  border-radius: 8px;
  font-weight: 700;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.tag-ok { background: #e8faf0; color: #106b31; }
.tag-fail { background: #ffe5e5; color: #d32f2f; }
.tag-active { background: #fff3e0; color: #e65100; }

.rep-delta {
  font-weight: 800;
  font-size: 14px;
}
.delta-plus { color: #43E97B; }
.delta-minus { color: #ff5252; }
.delta-zero { color: #aeaeb2; }
</style>
