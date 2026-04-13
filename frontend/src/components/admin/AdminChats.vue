<template>
  <div class="admin-page">
    <div class="admin-page-header">
      <h1>💬 Активные чаты</h1>
      <div class="header-meta">Всего: {{ total }}</div>
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
            <th>Сообщений</th>
            <th>Подтверждение даты</th>
            <th>Последнее сообщение</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="chat in chats"
            :key="chat.id"
            class="admin-table__row"
            @click="$router.push(`/admin/matches/${chat.id}`)"
          >
            <td class="cell-id">#{{ chat.id }}</td>
            <td>{{ chat.template.title }}</td>
            <td>{{ chat.host.firstName }}</td>
            <td>{{ chat.participant?.firstName ?? '—' }}</td>
            <td class="cell-center">{{ chat._count.messages }}</td>
            <td>
              <span :class="schedulingClass(chat.schedulingStatus)">{{ chat.schedulingStatus }}</span>
            </td>
            <td class="cell-muted">{{ chat.lastMessageAt ? formatDate(chat.lastMessageAt) : '—' }}</td>
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
import { adminFetch } from '../../utils/adminFetch';

const chats = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const loading = ref(true);
const limit = 30;

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit)));

async function loadChats() {
  loading.value = true;
  const params = new URLSearchParams({ page: String(page.value), limit: String(limit) });

  try {
    const res = await adminFetch(`${API_URL}/admin/chats?${params}`);
    const data = await res.json();
    chats.value = data.chats;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

function prevPage() { page.value--; loadChats(); }
function nextPage() { page.value++; loadChats(); }

function schedulingClass(s: string) {
  const m: Record<string, string> = {
    CONFIRMED: 'status-badge status-active',
    PROPOSED: 'status-badge status-waiting',
    PENDING: 'status-badge',
  };
  return m[s] ?? 'status-badge';
}

function formatDate(d: string) {
  return new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

onMounted(loadChats);
</script>

<style scoped>
@import '../../assets/admin-common.css';
</style>
