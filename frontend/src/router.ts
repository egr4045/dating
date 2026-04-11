import { createRouter, createWebHistory } from 'vue-router';
import TelegramLogin from './components/TelegramLogin.vue';
import Onboarding from './components/Onboarding.vue';
import Dashboard from './components/Dashboard.vue';
import ActiveMatch from './components/ActiveMatch.vue';
import SchedulingScreen from './components/SchedulingScreen.vue';
import Settings from './components/Settings.vue';
import History from './components/History.vue';
import AdminLogin from './components/admin/AdminLogin.vue';
import AdminLayout from './components/admin/AdminLayout.vue';
import AdminUsers from './components/admin/AdminUsers.vue';
import AdminUserDetail from './components/admin/AdminUserDetail.vue';
import AdminMatches from './components/admin/AdminMatches.vue';
import AdminMatchDetail from './components/admin/AdminMatchDetail.vue';
import AdminChats from './components/admin/AdminChats.vue';
import AdminAnalytics from './components/admin/AdminAnalytics.vue';
import AdminQuests from './components/admin/AdminQuests.vue';
import AdminVerifications from './components/admin/AdminVerifications.vue';
import { API_URL } from './config';
import { track } from './analytics';

const routes = [
  // ── Пользовательские маршруты ──────────────────────────────────────────────
  { path: '/', component: TelegramLogin },
  { path: '/onboarding', component: Onboarding },
  { path: '/dashboard', component: Dashboard },
  { path: '/match/:id/schedule', component: SchedulingScreen },
  { path: '/match/:id', component: ActiveMatch },
  { path: '/settings', component: Settings },
  { path: '/history', component: History },

  // ── Админка (отдельная ветка) ───────────────────────────────────────────────
  {
    path: '/admin/login',
    component: AdminLogin,
    meta: { isAdmin: true, isAdminPublic: true },
  },
  {
    path: '/admin',
    component: AdminLayout,
    meta: { isAdmin: true },
    children: [
      { path: '', redirect: '/admin/users' },
      { path: 'users', component: AdminUsers, meta: { isAdmin: true } },
      { path: 'verifications', component: AdminVerifications, meta: { isAdmin: true } },
      { path: 'users/:id', component: AdminUserDetail, meta: { isAdmin: true } },
      { path: 'matches', component: AdminMatches, meta: { isAdmin: true } },
      { path: 'matches/:id', component: AdminMatchDetail, meta: { isAdmin: true } },
      { path: 'chats', component: AdminChats, meta: { isAdmin: true } },
      { path: 'analytics', component: AdminAnalytics, meta: { isAdmin: true } },
      { path: 'quests', component: AdminQuests, meta: { isAdmin: true } },
    ],
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to, _from, next) => {
  // ── Разветвление: Admin vs User ────────────────────────────────────────────

  if (to.meta.isAdmin) {
    // Публичная страница логина в админку
    if (to.meta.isAdminPublic) return next();

    // Проверяем наличие adminToken
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) return next('/admin/login');

    // Можно было бы проверить токен на сервере, но для простоты — доверяем localStorage
    // (Токен подписан отдельным секретом, срок 12ч)
    return next();
  }

  // ── Пользовательские маршруты ──────────────────────────────────────────────
  const isPublic = to.path === '/';
  const token = localStorage.getItem('token');

  // Если страница публичная (логин)
  if (isPublic) {
    if (token) return next('/dashboard');
    return next();
  }

  // Защищённый маршрут — проверяем наличие токена
  if (!token) return next('/');

  // Проверяем валидность токена на сервере
  try {
    const res = await fetch(`${API_URL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      return next('/');
    }
  } catch (error) {
    console.error('Auth verification failed:', error);
    return next('/');
  }

  // Если юзер заходит на дашборд, проверяем наличие активного мэтча
  if (to.path === '/dashboard') {
    try {
      const res = await fetch(`${API_URL}/quests/active`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.hasActiveMatch) {
        return next(`/match/${data.matchId}/schedule`);
      }
    } catch { /* игнорируем ошибки при проверке статуса мэтча */ }
  }

  // Трекинг просмотра страниц
  track('page_view', { path: to.path });

  next();
});
