<template>
  <div class="page history">

    <header class="app-header">
      <button class="icon-btn" @click="$router.push('/dashboard')">←</button>
      <div class="app-header__logo">История</div>
      <div style="width:40px" />
    </header>

    <div v-if="loading" class="page-content" style="align-items:center;justify-content:center">
      <div style="font-size:2rem;animation:spin 1s linear infinite">🌀</div>
    </div>

    <div v-else class="page-content anim-fade-up">

      <!-- Репутация -->
      <div class="card rep-card">
        <div class="rep-card__top">
          <div>
            <div class="section-label">Надёжность</div>
            <div class="rep-big" :class="repClass">{{ reputation.toFixed(1) }}<span class="rep-max">/10</span></div>
          </div>
          <div class="rep-badge" :class="repClass">{{ repHint }}</div>
        </div>
        <div class="progress-bar">
          <div class="progress-bar__fill" :class="repClass" :style="{ width: repPercent + '%' }" />
        </div>
      </div>

      <!-- Фильтр-табы -->
      <div class="filter-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.value"
          class="filter-tab"
          :class="{ active: activeTab === tab.value }"
          @click="activeTab = tab.value"
        >{{ tab.label }}</button>
      </div>

      <!-- Пусто -->
      <div v-if="filteredHistory.length === 0" class="empty-state">
        <div style="font-size:3rem">📭</div>
        <h3>{{ activeTab === 'all' ? 'Пока нет встреч' : 'Нет записей в этой категории' }}</h3>
        <p v-if="activeTab === 'all'">Свайпай события на главной — и история появится здесь</p>
        <button v-if="activeTab === 'all'" class="btn btn-outline btn-sm" @click="$router.push('/dashboard')">Смотреть события</button>
      </div>

      <!-- Список -->
      <div class="history-list">
        <div v-for="item in filteredHistory" :key="item.id" class="history-item card card-sm">
          <div class="history-item__icon">{{ statusIcon(item.status) }}</div>
          <div class="history-item__body">
            <div class="history-item__title">{{ item.title }}</div>
            <div class="history-item__meta">
              <span v-if="item.partner" class="text-muted text-sm">с {{ item.partner.firstName }}</span>
              <span class="text-xs text-muted">{{ formatDate(item.createdAt) }}</span>
            </div>
          </div>
          <div class="history-item__right">
            <div :class="['badge', statusBadgeClass(item.status)]">{{ statusLabel(item.status) }}</div>
            <div :class="['rep-delta', deltaClass(item.reputationDelta)]">{{ item.reputationDelta === '0' ? '—' : item.reputationDelta }}</div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { API_URL } from '../config';

interface HistoryItem {
  id: number; title: string; status: string;
  reputationDelta: string;
  partner: { id: number; firstName: string } | null;
  createdAt: string;
}

const loading = ref(true);
const history = ref<HistoryItem[]>([]);
const reputation = ref(5.0);
const activeTab = ref<'all' | 'completed' | 'failed'>('all');

const tabs = [
  { value: 'all',       label: 'Все' },
  { value: 'completed', label: '✅ Состоялись' },
  { value: 'failed',    label: '❌ Сорвались' },
] as const;

const filteredHistory = computed(() => {
  if (activeTab.value === 'all') return history.value;
  const status = activeTab.value === 'completed' ? 'COMPLETED' : 'FAILED';
  return history.value.filter(i => i.status === status);
});

const repPercent = computed(() => Math.min(100, Math.max(0, (reputation.value / 10) * 100)));
const repClass = computed(() => {
  if (reputation.value >= 4) return 'rep-good';
  if (reputation.value >= 2) return 'rep-warn';
  return 'rep-bad';
});
const repHint = computed(() => {
  if (reputation.value >= 4) return '✨ Отлично';
  if (reputation.value >= 2) return '⚠️ Осторожно';
  return '🚨 Критично';
});

const statusIcon = (s: string) => s === 'COMPLETED' ? '✅' : s === 'FAILED' ? '❌' : '🔥';
const statusLabel = (s: string) => s === 'COMPLETED' ? 'Состоялось' : s === 'FAILED' ? 'Сорвалось' : 'В процессе';
const statusBadgeClass = (s: string) => s === 'COMPLETED' ? 'badge-success' : s === 'FAILED' ? 'badge-danger' : 'badge-warning';
const deltaClass = (d: string) => d.startsWith('+') ? 'delta-plus' : d === '0' ? 'delta-zero' : 'delta-minus';

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

async function loadData() {
  const token = localStorage.getItem('token');
  if (!token) return;
  try {
    const [histRes, profileRes] = await Promise.all([
      fetch(`${API_URL}/quests/history`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    history.value = await histRes.json();
    const profile = await profileRes.json();
    reputation.value = profile.reputation ?? 5.0;
  } finally {
    loading.value = false;
  }
}

onMounted(loadData);
</script>

<style scoped>
.history { background: var(--bg); }

.rep-card { display: flex; flex-direction: column; gap: 12px; }
.rep-card__top { display: flex; align-items: flex-start; justify-content: space-between; }
.rep-big { font-size: 2.5rem; font-weight: 800; line-height: 1; }
.rep-max { font-size: 1rem; font-weight: 600; color: var(--text-muted); margin-left: 2px; }
.rep-badge { font-size: 0.8rem; font-weight: 700; padding: 4px 10px; border-radius: 100px; margin-top: 4px; }
.rep-good { color: var(--success); }
.rep-warn { color: var(--warning); }
.rep-bad { color: var(--danger); }
.rep-badge.rep-good { background: var(--success-soft); }
.rep-badge.rep-warn { background: var(--warning-soft); }
.rep-badge.rep-bad { background: var(--danger-soft); }
.progress-bar__fill.rep-good { background: var(--success); }
.progress-bar__fill.rep-warn { background: var(--warning); }
.progress-bar__fill.rep-bad { background: var(--danger); }

.empty-state {
  display: flex; flex-direction: column; align-items: center;
  gap: 12px; text-align: center; padding: 20px 0;
}

.history-list { display: flex; flex-direction: column; gap: 10px; }

.history-item {
  display: flex;
  align-items: center;
  gap: 14px;
}
.history-item__icon { font-size: 1.75rem; flex-shrink: 0; }
.history-item__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.history-item__title { font-weight: 700; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.history-item__meta { display: flex; gap: 8px; align-items: center; }
.history-item__right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }

.rep-delta { font-weight: 800; font-size: 0.9rem; }
.delta-plus { color: var(--success); }
.delta-minus { color: var(--danger); }
.delta-zero { color: var(--text-muted); }

@keyframes spin { to { transform: rotate(360deg); } }

/* Фильтр-табы */
.filter-tabs {
  display: flex;
  gap: 6px;
}
.filter-tab {
  flex: 1;
  padding: 8px 6px;
  border-radius: var(--radius-sm);
  border: 2px solid #EDE8E5;
  background: var(--surface);
  font-family: var(--font);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  color: var(--text-muted);
  transition: all 0.15s;
  white-space: nowrap;
}
.filter-tab.active {
  border-color: var(--primary);
  background: var(--primary-soft);
  color: var(--primary);
}
</style>
