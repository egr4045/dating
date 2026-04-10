<template>
  <div class="admin-page">
    <div class="admin-page-header">
      <h1>🤝 Матчи</h1>
      <div class="header-meta">Всего: {{ total }}</div>
    </div>

    <div class="admin-toolbar">
      <div class="status-tabs">
        <button
          v-for="tab in statusTabs"
          :key="tab.value"
          class="status-tab"
          :class="{ active: statusFilter === tab.value }"
          @click="setStatus(tab.value)"
        >{{ tab.label }}</button>
      </div>
      <input
        v-model="search"
        type="text"
        class="admin-search"
        placeholder="Поиск по ID матча..."
        @input="debouncedLoad"
      />
    </div>

    <div v-if="loading" class="admin-loading">Загружаем...</div>

    <div v-else class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Квест</th>
            <th>Хост</th>
            <th>Участник</th>
            <th>Статус</th>
            <th>Сообщений</th>
            <th>Создан</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="m in matches"
            :key="m.id"
            class="admin-table__row"
            @click="$router.push(`/admin/matches/${m.id}`)"
          >
            <td class="cell-id">#{{ m.id }}</td>
            <td>{{ m.template.title }}</td>
            <td>{{ m.host.firstName }}</td>
            <td>{{ m.participant?.firstName ?? '—' }}</td>
            <td><span :class="statusClass(m.status)">{{ m.status }}</span></td>
            <td class="cell-center">{{ m._count.messages }}</td>
            <td class="cell-muted">{{ formatDate(m.createdAt) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="admin-pagination">
      <button class="admin-btn-sm" :disabled="page === 1" @click="prevPage">← Пред.</button>
      <span class="page-info">Стр. {{ page }} / {{ totalPages }}</span>
      <button class="admin-btn-sm" :disabled="page >= totalPages" @click="nextPage">След. →</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { API_URL } from '../../config';

const matches = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const search = ref('');
const statusFilter = ref('');
const loading = ref(true);
const limit = 30;

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit)));

const statusTabs = [
  { value: '', label: 'Все' },
  { value: 'MATCHED', label: 'В процессе' },
  { value: 'WAITING', label: 'Ожидание' },
  { value: 'COMPLETED', label: 'Завершённые' },
  { value: 'FAILED', label: 'Отменённые' },
  { value: 'EXPIRED', label: 'Просрочены' },
];

function setStatus(val: string) {
  statusFilter.value = val;
  page.value = 1;
  loadMatches();
}

let debounceTimer: ReturnType<typeof setTimeout>;
function debouncedLoad() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => { page.value = 1; loadMatches(); }, 400);
}

async function loadMatches() {
  loading.value = true;
  const token = localStorage.getItem('adminToken');
  const params = new URLSearchParams({ page: String(page.value), limit: String(limit) });
  if (statusFilter.value) params.set('status', statusFilter.value);
  if (search.value) params.set('search', search.value);

  try {
    const res = await fetch(`${API_URL}/admin/matches?${params}`, {
      headers: { 'X-Admin-Token': token ?? '' },
    });
    const data = await res.json();
    matches.value = data.matches;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

function prevPage() { page.value--; loadMatches(); }
function nextPage() { page.value++; loadMatches(); }

function statusClass(s: string) {
  const m: Record<string, string> = {
    MATCHED: 'status-badge status-active',
    COMPLETED: 'status-badge status-active',
    WAITING: 'status-badge status-waiting',
    EXPIRED: 'status-badge status-banned',
    CANCELLED: 'status-badge status-banned',
    FAILED: 'status-badge status-banned',
  };
  return m[s] ?? 'status-badge';
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

onMounted(loadMatches);
</script>

<style scoped>
@import '../../assets/admin-common.css';
.status-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
.status-tab {
  padding: 6px 14px; border-radius: 8px; border: 1px solid #2a2d3a;
  background: transparent; color: #6b7280; cursor: pointer; font-size: 0.825rem;
  font-weight: 600; transition: all 0.15s;
}
.status-tab:hover { border-color: #6366f1; color: #818cf8; }
.status-tab.active { background: rgba(99,102,241,0.15); border-color: #6366f1; color: #818cf8; }
</style>
