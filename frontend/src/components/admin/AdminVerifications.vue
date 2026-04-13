<template>
  <div class="admin-page">
    <div class="admin-page-header">
      <h1>📹 Ожидают верификации</h1>
      <div class="header-meta">Всего: {{ total }}</div>
    </div>

    <div v-if="loading" class="admin-loading">Загружаем...</div>

    <div v-else class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Имя</th>
            <th>Username</th>
            <th>Видео добавлено</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="users.length === 0">
            <td colspan="5" class="empty-cell" style="text-align: center; padding: 40px; color: #6b7280;">Пока нет заявок</td>
          </tr>
          <tr
            v-for="user in users"
            :key="user.id"
            class="admin-table__row"
          >
            <td class="cell-id">#{{ user.id }}</td>
            <td class="cell-name">{{ user.firstName }}</td>
            <td class="cell-muted">{{ user.username ? '@' + user.username : '—' }}</td>
            <td class="cell-muted">{{ formatDate(user.createdAt) }}</td>
            <td>
              <button class="btn-admin btn-admin--primary" @click="$router.push(`/admin/users/${user.id}`)">Проверить</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="totalPages > 1" class="admin-pagination">
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

const users = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const loading = ref(true);
const limit = 30;

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit)));

async function loadUsers() {
  loading.value = true;
  const params = new URLSearchParams({
    page: String(page.value),
    limit: String(limit),
    pendingVideo: 'true'
  });

  try {
    const res = await adminFetch(`${API_URL}/admin/users?${params}`);
    const data = await res.json();
    users.value = data.users;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

function prevPage() { page.value--; loadUsers(); }
function nextPage() { page.value++; loadUsers(); }

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

onMounted(loadUsers);
</script>

<style scoped>
@import '../../assets/admin-common.css';
.btn-admin {
  padding: 6px 14px; border-radius: 8px; border: none;
  font-family: 'Nunito', system-ui, sans-serif; font-size: 0.8rem;
  font-weight: 700; cursor: pointer; transition: all 0.15s;
}
.btn-admin--primary  { background: #6366f1; color: #fff; }
.btn-admin--primary:hover { background: #4f46e5; }
</style>
