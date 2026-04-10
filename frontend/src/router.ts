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
      // Токен невалиден или просрочен
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      return next('/');
    }
  } catch (error) {
    // Ошибка сети или CORS — в целях безопасности кидаем на логин
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

  next();
});
