import { createRouter, createWebHistory } from 'vue-router';
import TelegramLogin from './components/TelegramLogin.vue';
import Onboarding from './components/Onboarding.vue';
import Dashboard from './components/Dashboard.vue';
import ActiveMatch from './components/ActiveMatch.vue';
import Settings from './components/Settings.vue';
import History from './components/History.vue';
import { API_URL } from './config';

const routes = [
  { path: '/', component: TelegramLogin },
  { path: '/onboarding', component: Onboarding },
  { path: '/dashboard', component: Dashboard },
  { path: '/match/:id', component: ActiveMatch },
  { path: '/settings', component: Settings },
  { path: '/history', component: History },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

// Глобальный страж маршрутов
router.beforeEach(async (to, _from, next) => {
  const userId = localStorage.getItem('userId');

  // 1. Если НЕ авторизован и пытается зайти куда-то кроме логина -> на логин
  if (!userId && to.path !== '/') {
    return next('/');
  }

  // 2. Пункт 3 из твоего списка: Если АВТОРИЗОВАН и идет на страницу логина -> на дашборд
  if (userId && to.path === '/') {
    return next('/dashboard');
  }

  // 3. Пункт 4 из твоего списка: Защита Дашборда от тех, у кого активен квест
  if (userId && to.path === '/dashboard') {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/quests/active`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (data.hasActiveMatch) {
        // У юзера есть мэтч! Принудительно кидаем его в комнату
        return next(`/match/${data.matchId}`);
      }
    } catch (e) {
      console.error('Ошибка проверки активного мэтча:', e);
    }
  }

  // Если всё ок — пропускаем
  next();
});
