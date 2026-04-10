<template>
  <div class="admin-page">
    <div class="admin-page-header">
      <h1>📊 Аналитика</h1>
    </div>

    <!-- Выбор периода -->
    <div class="admin-toolbar period-bar">
      <div class="period-btns">
        <button
          v-for="p in periods"
          :key="p.label"
          class="status-tab"
          :class="{ active: activePeriod === p.label }"
          @click="setPeriod(p)"
        >{{ p.label }}</button>
      </div>
      <div class="custom-range">
        <input v-model="dateFrom" type="date" class="admin-date-input" />
        <span>—</span>
        <input v-model="dateTo" type="date" class="admin-date-input" />
        <button class="admin-btn-sm" @click="loadSummary">Применить</button>
      </div>
    </div>

    <div v-if="loading" class="admin-loading">Загружаем аналитику...</div>

    <template v-else-if="summary">
      <!-- KPI карточки -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-value">{{ summary.newUsers }}</div>
          <div class="kpi-label">👤 Новых пользователей</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value">{{ summary.totalSwipeLikes }}</div>
          <div class="kpi-label">👍 Лайков (свайп)</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value">{{ summary.totalSwiperNopes }}</div>
          <div class="kpi-label">👎 Нопов (свайп)</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value">{{ summary.newMatches }}</div>
          <div class="kpi-label">🤝 Новых матчей</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value">{{ summary.completedMatches }}</div>
          <div class="kpi-label">✅ Завершённых встреч</div>
        </div>
        <div class="kpi-card kpi-highlight">
          <div class="kpi-value">{{ summary.conversion }}</div>
          <div class="kpi-label">🎯 Конверсия (матч/лайк)</div>
        </div>
      </div>

      <!-- График активности -->
      <div class="admin-card">
        <h3>📈 Активность по дням</h3>
        <div class="chart-wrap">
          <div class="chart-bars">
            <div
              v-for="day in summary.dailyEvents"
              :key="day.day"
              class="chart-bar-wrap"
              :title="`${day.day}: ${day.count} событий`"
            >
              <div
                class="chart-bar"
                :style="{ height: barHeight(day.count) + 'px' }"
              />
              <div class="chart-day-label">{{ formatDayLabel(day.day) }}</div>
            </div>
          </div>
          <div v-if="!summary.dailyEvents.length" class="admin-empty">Нет данных за период</div>
        </div>
      </div>

      <!-- Топ событий -->
      <div class="detail-grid">
        <div class="admin-card">
          <h3>🔢 Топ событий</h3>
          <table class="admin-table">
            <thead><tr><th>Событие</th><th>Кол-во</th></tr></thead>
            <tbody>
              <tr v-for="e in summary.eventBreakdown" :key="e.event">
                <td><code class="event-code">{{ e.event }}</code></td>
                <td class="cell-center">{{ e.count }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="admin-card">
          <h3>🔄 Всего событий за период</h3>
          <div class="total-events-display">{{ summary.totalEvents }}</div>
          <p style="color:#6b7280;font-size:0.875rem;margin-top:8px">событий отслежено в выбранный период</p>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { API_URL } from '../../config';

const summary = ref<any>(null);
const loading = ref(true);
const activePeriod = ref('7 дней');

const today = new Date();
const dateFrom = ref(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
const dateTo = ref(today.toISOString().slice(0, 10));

const periods = [
  { label: 'Сегодня', days: 0 },
  { label: '7 дней', days: 7 },
  { label: '30 дней', days: 30 },
];

function setPeriod(p: { label: string; days: number }) {
  activePeriod.value = p.label;
  const now = new Date();
  dateTo.value = now.toISOString().slice(0, 10);
  dateFrom.value = p.days === 0
    ? now.toISOString().slice(0, 10)
    : new Date(now.getTime() - p.days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  loadSummary();
}

async function loadSummary() {
  loading.value = true;
  const token = localStorage.getItem('adminToken');
  const params = new URLSearchParams({ from: dateFrom.value, to: dateTo.value + 'T23:59:59' });

  try {
    const res = await fetch(`${API_URL}/admin/analytics/summary?${params}`, {
      headers: { 'X-Admin-Token': token ?? '' },
    });
    summary.value = await res.json();
  } finally {
    loading.value = false;
  }
}

function barHeight(count: number): number {
  if (!summary.value?.dailyEvents?.length) return 0;
  const max = Math.max(...summary.value.dailyEvents.map((d: any) => d.count));
  if (max === 0) return 0;
  return Math.round((count / max) * 100);
}

function formatDayLabel(day: string) {
  const d = new Date(day);
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

onMounted(loadSummary);
</script>

<style scoped>
@import '../../assets/admin-common.css';

.period-bar { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.status-tab {
  padding: 6px 14px; border-radius: 8px; border: 1px solid #2a2d3a;
  background: transparent; color: #6b7280; cursor: pointer; font-size: 0.825rem;
  font-weight: 600; transition: all 0.15s;
}
.status-tab:hover { border-color: #6366f1; color: #818cf8; }
.status-tab.active { background: rgba(99,102,241,0.15); border-color: #6366f1; color: #818cf8; }

.custom-range { display: flex; align-items: center; gap: 8px; }
.admin-date-input {
  background: #0f1117; border: 1px solid #2a2d3a; border-radius: 8px;
  padding: 6px 10px; color: #e5e7eb; font-size: 0.875rem; outline: none;
}

.kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
.kpi-card {
  background: #1a1d27; border: 1px solid #2a2d3a; border-radius: 12px;
  padding: 20px; display: flex; flex-direction: column; gap: 8px;
}
.kpi-highlight { border-color: #6366f1; background: rgba(99,102,241,0.08); }
.kpi-value { font-size: 2rem; font-weight: 800; color: #fff; }
.kpi-label { font-size: 0.825rem; color: #6b7280; }

.chart-wrap { padding-top: 12px; }
.chart-bars { display: flex; align-items: flex-end; gap: 6px; height: 120px; overflow-x: auto; }
.chart-bar-wrap { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 28px; }
.chart-bar { width: 20px; background: #6366f1; border-radius: 4px 4px 0 0; min-height: 2px; transition: height 0.3s; }
.chart-day-label { font-size: 0.65rem; color: #4b5563; writing-mode: vertical-rl; transform: rotate(180deg); }

.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.event-code { background: #0f1117; padding: 2px 8px; border-radius: 6px; font-size: 0.825rem; color: #818cf8; }
.total-events-display { font-size: 3rem; font-weight: 800; color: #6366f1; line-height: 1; }
</style>
