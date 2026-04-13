<template>
  <div class="admin-page">
    <div class="admin-page-header">
      <h1>👤 Пользователи</h1>
      <div class="header-meta">Всего: {{ total }}</div>
    </div>

    <div class="admin-toolbar">
      <input
        id="admin-users-search"
        v-model="search"
        type="text"
        class="admin-search"
        placeholder="Поиск по имени, username или Telegram ID..."
        @input="debouncedLoad"
      />
    </div>

    <div v-if="loading" class="admin-loading">Загружаем...</div>

    <div v-else class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Имя</th>
            <th>Username</th>
            <th>Репутация</th>
            <th>Возраст</th>
            <th>Интересы</th>
            <th>Матчей</th>
            <th>Статус</th>
            <th>Зарегистрирован</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="user in users"
            :key="user.id"
            class="admin-table__row"
            @click="$router.push(`/admin/users/${user.id}`)"
          >
            <td class="cell-id">#{{ user.id }}</td>
            <td class="cell-name">{{ user.firstName }}</td>
            <td class="cell-muted">{{ user.username ? '@' + user.username : '—' }}</td>
            <td>
              <span :class="reputationClass(user.reputation)">⭐ {{ user.reputation.toFixed(1) }}</span>
            </td>
            <td class="cell-muted">{{ user.age ?? '—' }}</td>
            <td>
              <div class="interests-wrap">
                <span v-for="i in user.interests.slice(0, 3)" :key="i" class="interest-chip">{{ i }}</span>
                <span v-if="user.interests.length > 3" class="interest-chip interest-more">+{{ user.interests.length - 3 }}</span>
              </div>
            </td>
            <td class="cell-center">{{ (user._count.hostedLobbies + user._count.joinedLobbies) }}</td>
            <td>
              <span v-if="isBanned(user)" class="status-badge status-banned">🚫 Забанен</span>
              <span v-else class="status-badge status-active">✅ Активен</span>
            </td>
            <td class="cell-muted">{{ formatDate(user.createdAt) }}</td>
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

const users = ref<any[]>([]);
const total = ref(0);
const page = ref(1);
const search = ref('');
const loading = ref(true);
const limit = 30;

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / limit)));

let debounceTimer: ReturnType<typeof setTimeout>;
function debouncedLoad() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => { page.value = 1; loadUsers(); }, 400);
}

async function loadUsers() {
  loading.value = true;
  const params = new URLSearchParams({
    page: String(page.value),
    limit: String(limit),
  });
  if (search.value) params.set('search', search.value);

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

function isBanned(user: any) {
  return user.bannedUntil && new Date(user.bannedUntil) > new Date();
}

function reputationClass(rep: number) {
  if (rep >= 4) return 'rep rep-good';
  if (rep >= 2.5) return 'rep rep-mid';
  return 'rep rep-bad';
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

onMounted(loadUsers);
</script>

<style scoped>
@import '../../assets/admin-common.css';
</style>
