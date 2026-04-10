<template>
  <div class="login-page">

    <div class="login-card anim-scale-in">
      <!-- Логотип / иллюстрация -->
      <div class="login-hero">
        <div class="hero-emoji">🌟</div>
        <h1>Meetup</h1>
        <p>Находи компанию для любых событий — без лишнего давления</p>
      </div>

      <!-- Состояния авторизации -->
      <div class="auth-block">
        <div v-if="!loginToken" class="status-row">
          <div class="mini-spinner" />
          <span class="text-muted text-sm">Готовим сессию...</span>
        </div>

        <template v-else>
          <div v-if="status === 'pending'" class="flex-col gap-16">
            <a :href="tgLink" target="_blank" class="btn btn-primary btn-full">
              ✈️ Войти через Telegram
            </a>
            <div class="status-row">
              <div class="mini-spinner" />
              <span class="text-muted text-sm">Ждём подтверждения в боте...</span>
            </div>
          </div>

          <div v-if="status === 'expired'" class="flex-col gap-12 text-center">
            <p class="text-muted">Время вышло ⏱️</p>
            <button class="btn btn-outline btn-full" @click="getCode">Попробовать снова</button>
          </div>
        </template>
      </div>

      <p class="safety-note">🔒 Мы получаем только имя и аватар. Никаких лишних данных.</p>

      <!-- Dev login -->
      <div class="dev-section">
        <div class="section-label">🛠 Dev</div>
        <div class="flex gap-8">
          <input v-model="testName" placeholder="Имя тестового юзера" class="input" style="flex:1;padding:10px 12px;font-size:0.875rem" />
          <button class="btn btn-ghost btn-sm" @click="handleTestLogin">Войти</button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { API_URL } from '../config';

const router = useRouter();
const loginToken = ref('');
const status = ref('pending');
const testName = ref('');
const tgLink = computed(() => `https://t.me/datingTesting_bot?start=${loginToken.value}`);
let pollInterval: ReturnType<typeof setInterval> | null = null;

async function getCode() {
  status.value = 'pending';
  loginToken.value = '';
  try {
    const res = await fetch(`${API_URL}/auth/generate`);
    const data = await res.json();
    loginToken.value = data.token;
    startPolling();
  } catch { /* ignore */ }
}

function startPolling() {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(async () => {
    try {
      const res = await fetch(`${API_URL}/auth/status?token=${loginToken.value}`);
      const data = await res.json();
      if (data.status === 'authenticated') {
        clearInterval(pollInterval!);
        localStorage.setItem('token', data.jwt);
        localStorage.setItem('userId', String(data.user.id));
        router.push('/onboarding');
      } else if (data.status === 'expired') {
        clearInterval(pollInterval!);
        status.value = 'expired';
      }
    } catch { /* ignore */ }
  }, 1500);
}

async function handleTestLogin() {
  if (!testName.value) return;
  try {
    const res = await fetch(`${API_URL}/users/test-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: testName.value }),
    });
    const data = await res.json();
    localStorage.setItem('token', data.token);
    localStorage.setItem('userId', String(data.user.id));
    router.push(!data.user.interests?.length ? '/onboarding' : '/dashboard');
  } catch { /* ignore */ }
}

onMounted(getCode);
onUnmounted(() => { if (pollInterval) clearInterval(pollInterval); });
</script>

<style scoped>
.login-page {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  background: var(--bg);
}

.login-card {
  width: 100%;
  max-width: 380px;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-lg);
  padding: 36px 28px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.login-hero {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}
.hero-emoji { font-size: 3.5rem; line-height: 1; }
.login-hero h1 { font-size: 2rem; font-weight: 800; color: var(--primary); margin: 0; }
.login-hero p { color: var(--text-muted); font-size: 0.9rem; line-height: 1.5; max-width: 260px; }

.auth-block { display: flex; flex-direction: column; gap: 12px; }

.status-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.mini-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--surface-2);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

.flex-col { display: flex; flex-direction: column; }
.flex { display: flex; }
.gap-8 { gap: 8px; }
.gap-12 { gap: 12px; }
.gap-16 { gap: 16px; }
.text-center { text-align: center; }

.safety-note {
  font-size: 0.75rem;
  color: var(--text-light);
  text-align: center;
  margin: 0;
}

.dev-section {
  border-top: 1px dashed #EDE8E5;
  padding-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
