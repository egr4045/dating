import { createRouter, createWebHistory } from 'vue-router';
import TelegramLogin from './components/TelegramLogin.vue';
import Onboarding from './components/Onboarding.vue';
import Dashboard from './components/Dashboard.vue';
import ActiveMatch from './components/ActiveMatch.vue';
import SchedulingScreen from './components/SchedulingScreen.vue';
import Settings from './components/Settings.vue';
import History from './components/History.vue';
import { API_URL } from './config';

const routes = [
  { path: '/', component: TelegramLogin },
  { path: '/onboarding', component: Onboarding },
  { path: '/dashboard', component: Dashboard },
  { path: '/match/:id/schedule', component: SchedulingScreen },
  { path: '/match/:id', component: ActiveMatch },
  { path: '/settings', component: Settings },
  { path: '/history', component: History },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to, _from, next) => {
  const userId = localStorage.getItem('userId');

  if (!userId && to.path !== '/') return next('/');
  if (userId && to.path === '/') return next('/dashboard');

  if (userId && to.path === '/dashboard') {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/quests/active`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.hasActiveMatch) {
        // Редирект на scheduling если дата не подтверждена, иначе в чат
        return next(`/match/${data.matchId}/schedule`);
      }
    } catch { /* ignore */ }
  }

  next();
});
