<template>
  <div class="login-wrapper">
    <div class="glass-card">
      <header>
        <h1 class="huge-title">Привет! 👋</h1>
        <p class="subtitle">Чтобы найти компанию, нужно войти через Telegram</p>
      </header>

      <div class="content">
        <div v-if="!loginToken" class="loading-state">
          <span class="loader"></span>
          <p>Готовим сессию...</p>
        </div>

        <div v-else class="auth-action">
          <div v-if="status === 'pending'">
            <a :href="tgLink" target="_blank" class="tg-button">
              Открыть Telegram
            </a>
            <div class="status-msg">
              <span class="loader-small"></span>
              Ждем подтверждения в приложении...
            </div>
          </div>

          <div v-if="status === 'expired'" class="error-zone">
            <p>Время вышло ⏱️</p>
            <button @click="getCode" class="retry-btn">Попробовать снова</button>
          </div>
        </div>
      </div>

      <div class="dev-login">
        <p>🛠 Dev Tools</p>
        <input v-model="testName" placeholder="Имя тестового юзера" class="dev-input" />
        <button @click="handleTestLogin" class="dev-btn">Войти без ТГ</button>
      </div>

      <footer class="login-footer">
        <p>Это безопасно. Мы получим только ваше имя и аватар.</p>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import { API_URL } from '../config';

const router = useRouter(); // Инициализируем роутер для переходов
const loginToken = ref('');
const status = ref('pending');
const tgLink = computed(() => `https://t.me/datingTesting_bot?start=${loginToken.value}`);
let pollInterval: any = null;

// 1. Получаем уникальный код от бэкенда
const getCode = async () => {
  status.value = 'pending';
  loginToken.value = '';
  try {
    const res = await fetch(`${API_URL}/auth/generate`);
    const data = await res.json();
    loginToken.value = data.token;
    startPolling();
  } catch (e) {
    console.error('Ошибка при генерации кода:', e);
  }
};

// 2. Опрос бэкенда (ждём, пока юзер нажмет Start в боте)
const startPolling = () => {
  if (pollInterval) clearInterval(pollInterval);
  
  pollInterval = setInterval(async () => {
    try {
      const res = await fetch(`${API_URL}/auth/status?token=${loginToken.value}`);
      const data = await res.json();

      if (data.status === 'authenticated') {
        clearInterval(pollInterval);
        status.value = 'success';
        
        // Сохраняем токен
        localStorage.setItem('token', data.jwt);
        localStorage.setItem('userId', data.user.id);
        
        // МАГИЯ: Автоматически перекидываем на анбординг
        router.push('/onboarding'); 
      } else if (data.status === 'expired') {
        clearInterval(pollInterval);
        status.value = 'expired';
      }
    } catch (e) {
      console.error('Ошибка опроса:', e);
    }
  }, 1500); // Опрашиваем чуть реже, чтобы не спамить (раз в 1.5 сек)
};

onMounted(getCode);
onUnmounted(() => {
  if (pollInterval) clearInterval(pollInterval);
});

const testName = ref('');

const handleTestLogin = async () => {
  if (!testName.value) return;
  try {
    const res = await fetch(`${API_URL}/users/test-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: testName.value })
    });
    const data = await res.json();
    
    // Сохраняем ID и токен
    localStorage.setItem('token', data.token);
    localStorage.setItem('userId', data.user.id);
    
    // Если интересов нет — на анбординг, если есть — в дашборд
    if (!data.user.interests || data.user.interests.length === 0) {
      router.push('/onboarding');
    } else {
      router.push('/dashboard');
    }
  } catch (e) {
    console.error('Ошибка dev-логина:', e);
  }
};

</script>

<style scoped>
.login-wrapper {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 80vh; /* Чуть выше центра */
}

.glass-card {
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(15px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 32px; /* Очень скругленные углы для безопасности */
  padding: 40px;
  width: 100%;
  max-width: 400px;
  text-align: center;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.05);
}

.huge-title {
  font-size: 32px;
  font-weight: 800;
  margin-bottom: 12px;
  color: #2d3436;
}

.subtitle {
  color: #636e72;
  font-size: 16px;
  line-height: 1.5;
  margin-bottom: 32px;
}

.tg-button {
  display: block;
  background: #7c9aff; /* Наш основной спокойный синий */
  color: white;
  padding: 20px;
  border-radius: 20px;
  text-decoration: none;
  font-weight: 700;
  font-size: 18px;
  transition: all 0.3s ease;
  box-shadow: 0 10px 20px rgba(124, 154, 255, 0.2);
}

.tg-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 15px 25px rgba(124, 154, 255, 0.3);
}

.status-msg {
  margin-top: 24px;
  color: #b2bec3;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.login-footer {
  margin-top: 32px;
  font-size: 12px;
  color: #b2bec3;
}

.retry-btn {
  background: #f0f2f5;
  border: none;
  padding: 12px 24px;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 600;
}

/* Анимация загрузки */
.loader {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #7c9aff;
  border-radius: 50%;
  display: inline-block;
  animation: spin 1s infinite linear;
  margin-bottom: 16px;
}

.loader-small {
  width: 12px;
  height: 12px;
  border: 2px solid #eee;
  border-top: 2px solid #7c9aff;
  border-radius: 50%;
  display: inline-block;
  animation: spin 1s infinite linear;
}

.dev-login {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px dashed #ccc;
}
.dev-login p { font-size: 12px; color: #aaa; margin-bottom: 8px; }
.dev-input {
  padding: 8px;
  border-radius: 8px;
  border: 1px solid #ddd;
  margin-right: 8px;
}
.dev-btn {
  padding: 8px 12px;
  background: #333;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>