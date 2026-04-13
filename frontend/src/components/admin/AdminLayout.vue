<template>
  <div class="admin-app">
    <!-- Сайдбар -->
    <aside class="admin-sidebar">
      <div class="admin-sidebar__logo">
        <span>🛡️</span>
        <span>Admin</span>
      </div>

      <nav class="admin-nav">
        <router-link v-for="item in navItems" :key="item.path" :to="item.path" class="admin-nav__item">
          <span class="admin-nav__icon">{{ item.icon }}</span>
          <span class="admin-nav__label" style="display:flex; align-items:center; gap:6px;">
            {{ item.label }}
            <span v-if="item.id === 'verifications' && pendingCount > 0" class="nav-badge">{{ pendingCount }}</span>
          </span>
        </router-link>
      </nav>

      <button class="admin-logout-btn" @click="logout">
        <span>🚪</span> Выйти
      </button>
    </aside>

    <!-- Контент -->
    <main class="admin-content">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { API_URL } from '../../config';
import { adminFetch } from '../../utils/adminFetch';

const router = useRouter();
const pendingCount = ref(0);

const navItems = [
  { id: 'users', path: '/admin/users',    icon: '👤', label: 'Пользователи' },
  { id: 'verifications', path: '/admin/verifications', icon: '📹', label: 'Верификации' },
  { id: 'matches', path: '/admin/matches',  icon: '🤝', label: 'Матчи' },
  { id: 'chats', path: '/admin/chats',    icon: '💬', label: 'Чаты' },
  { id: 'quests', path: '/admin/quests',   icon: '🃏', label: 'Карточки' },
  { id: 'partners', path: '/admin/partners', icon: '🤝', label: 'Партнёры' },
  { id: 'config', path: '/admin/config',   icon: '⚙️', label: 'Настройки' },
  { id: 'analytics', path: '/admin/analytics',icon: '📊', label: 'Аналитика' },
];

async function checkPending() {
  try {
    const res = await adminFetch(`${API_URL}/admin/users?pendingVideo=true&limit=1`);
    const data = await res.json();
    pendingCount.value = data.total || 0;
  } catch {}
}

onMounted(() => {
  checkPending();
  // Можем обновлять раз в минуту
  setInterval(checkPending, 60000);
});

function logout() {
  localStorage.removeItem('adminToken');
  router.push('/admin/login');
}
</script>

<style scoped>
.admin-app {
  display: flex;
  min-height: 100dvh;
  background: #0f1117;
  color: #e5e7eb;
  font-family: 'Nunito', system-ui, sans-serif;
}

.admin-sidebar {
  width: 220px;
  flex-shrink: 0;
  background: #1a1d27;
  border-right: 1px solid #2a2d3a;
  display: flex;
  flex-direction: column;
  padding: 24px 16px;
  gap: 8px;
  position: sticky;
  top: 0;
  height: 100dvh;
}

.admin-sidebar__logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.2rem;
  font-weight: 800;
  color: #fff;
  padding: 0 8px 20px;
  border-bottom: 1px solid #2a2d3a;
  margin-bottom: 8px;
}

.admin-nav { display: flex; flex-direction: column; gap: 4px; flex: 1; }

.admin-nav__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  text-decoration: none;
  color: #9ca3af;
  font-weight: 600;
  font-size: 0.9rem;
  transition: background 0.15s, color 0.15s;
}
.admin-nav__item:hover { background: #252836; color: #e5e7eb; }
.admin-nav__item.router-link-active { background: rgba(99, 102, 241, 0.15); color: #818cf8; }
.admin-nav__icon { font-size: 1.1rem; }

.admin-logout-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  border: none;
  background: transparent;
  color: #6b7280;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.admin-logout-btn:hover { background: rgba(239, 68, 68, 0.1); color: #f87171; }

.admin-content {
  flex: 1;
  overflow-y: auto;
  padding: 32px;
  min-width: 0;
}

.nav-badge {
  background: #ef4444;
  color: white;
  font-size: 0.70rem;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 10px;
  line-height: 1;
}
</style>
