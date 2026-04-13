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
            <button v-if="item.status === 'COMPLETED' && !item.reviewed" 
                    @click="openReviewDialog(item.id)"
                    class="btn btn-sm btn-outline mt-2" 
                    style="border-color: var(--warning); color: var(--warning); font-size: 0.75rem; padding: 4px 8px;">
               ⭐ Оценить и получить +
            </button>
          </div>
          <div class="history-item__right">
            <div :class="['badge', statusBadgeClass(item.status)]">{{ statusLabel(item.status) }}</div>
            <div style="display:flex; align-items:center; gap:8px">
              <div :class="['rep-delta', deltaClass(item.reputationDelta)]">{{ item.reputationDelta === '0' ? '—' : item.reputationDelta }}</div>
              <button v-if="item.partner" class="icon-btn" style="color:var(--text-muted); font-size:1.2rem; padding:0" @click.stop="openReportDialog(item.partner.id)">⋮</button>
            </div>
          </div>
        </div>
      </div>

    </div>

    <ReportBlockDialog 
      v-model="showReportDialog" 
      :userId="reportTargetId" 
      @blocked="onUserBlocked" 
    />

    <!-- Review-диалог -->
    <Teleport to="body">
      <div v-if="showReviewDialog" class="confirm-overlay" @click.self="showReviewDialog = false">
        <div class="confirm-card anim-scale-in">
          <div class="confirm-icon">⭐</div>
          <h3 style="font-size:1.1rem">Оцени партнера и получи + к рейтингу</h3>
          <p>Анонимно. Это поможет нам улучшить подбор.</p>
          <div class="stars-container">
            <span v-for="star in 5" :key="star" 
                  class="star" 
                  :class="{ active: star <= reviewRating }"
                  @click="reviewRating = star"
            >★</span>
          </div>
          <input v-model="reviewComment" placeholder="Комментарий (необязательно)" class="input chat-input" style="width:100%; margin: 10px 0; border: 1px solid var(--surface-2)"/>
          <div class="confirm-btns">
            <button class="btn btn-ghost btn-sm" @click="showReviewDialog = false">Отмена</button>
            <button class="btn btn-sm btn-success" @click="submitReview" :disabled="reviewRating === 0">
              Отправить
            </button>
          </div>
        </div>
      </div>
    </Teleport>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { API_URL } from '../config';
import ReportBlockDialog from './ReportBlockDialog.vue';

interface HistoryItem {
  id: number; title: string; status: string;
  reputationDelta: string;
  reviewed?: boolean;
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

const showReportDialog = ref(false);
const reportTargetId = ref<number>(0);

function openReportDialog(id: number) {
  reportTargetId.value = id;
  showReportDialog.value = true;
}

function onUserBlocked() {
  loadData();
}

const showReviewDialog = ref(false);
const reviewRating = ref(0);
const reviewComment = ref('');
const reviewMatchId = ref<number | null>(null);

function openReviewDialog(matchId: number) {
  reviewMatchId.value = matchId;
  reviewRating.value = 0;
  reviewComment.value = '';
  showReviewDialog.value = true;
}

async function submitReview() {
  if (!reviewMatchId.value) return;
  const token = localStorage.getItem('token');
  try {
    await fetch(`${API_URL}/quests/match/${reviewMatchId.value}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ rating: reviewRating.value, comment: reviewComment.value }),
    });
    showReviewDialog.value = false;
    loadData();
  } catch (e) {
    console.warn(e);
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
.stars-container {
  display: flex; gap: 8px; justify-content: center; margin: 16px 0; font-size: 2.2rem; cursor: pointer;
}
.star {
  color: var(--text-light); transition: color 0.15s, transform 0.15s;
}
.star:hover { transform: scale(1.15); }
.star.active { color: var(--warning); }
.confirm-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(61, 53, 53, 0.45);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center; padding: 24px;
}
.confirm-card {
  background: var(--surface); border-radius: var(--radius);
  padding: 28px 24px; width: 100%; max-width: 340px;
  display: flex; flex-direction: column; gap: 12px; text-align: center;
  box-shadow: var(--shadow-lg);
}
.confirm-icon { font-size: 2.5rem; }
.confirm-card h3 { margin: 0; }
.confirm-card p { font-size: 0.9rem; }
.confirm-btns { display: flex; gap: 10px; margin-top: 4px; }
.confirm-btns .btn { flex: 1; }
.anim-scale-in { display: flex; flex-direction: column; min-width: 300px; }
.mt-2 { margin-top: 8px; }
</style>
