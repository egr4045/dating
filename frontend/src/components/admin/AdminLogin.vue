<template>
  <div class="admin-login-page">
    <div class="admin-login-card">
      <div class="admin-login-logo">
        <span class="admin-logo-icon">🛡️</span>
        <h1>Admin Panel</h1>
        <p>Meetup · Панель модератора</p>
      </div>

      <form class="admin-login-form" @submit.prevent="handleLogin">
        <div class="field-group">
          <label class="field-label">Логин</label>
          <input
            id="admin-login-input"
            v-model="form.login"
            type="text"
            class="field-input"
            placeholder="admin"
            autocomplete="username"
            required
          />
        </div>
        <div class="field-group">
          <label class="field-label">Пароль</label>
          <input
            id="admin-password-input"
            v-model="form.password"
            type="password"
            class="field-input"
            placeholder="••••••••"
            autocomplete="current-password"
            required
          />
        </div>

        <div v-if="error" class="admin-error">{{ error }}</div>

        <button id="admin-login-btn" type="submit" class="admin-btn" :disabled="loading">
          {{ loading ? 'Входим...' : 'Войти' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { API_URL } from '../../config';

const router = useRouter();
const form = ref({ login: '', password: '' });
const error = ref('');
const loading = ref(false);

async function handleLogin() {
  loading.value = true;
  error.value = '';
  try {
    const res = await fetch(`${API_URL}/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form.value),
    });
    if (!res.ok) {
      const data = await res.json();
      error.value = data.message || 'Неверный логин или пароль';
      return;
    }
    const data = await res.json();
    localStorage.setItem('adminToken', data.token);
    router.push('/admin/users');
  } catch {
    error.value = 'Ошибка подключения к серверу';
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.admin-login-page {
  min-height: 100dvh;
  background: #0f1117;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.admin-login-card {
  width: 100%;
  max-width: 380px;
  background: #1a1d27;
  border: 1px solid #2a2d3a;
  border-radius: 16px;
  padding: 40px 32px;
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.admin-login-logo {
  text-align: center;
}
.admin-logo-icon { font-size: 2.5rem; }
.admin-login-logo h1 {
  font-size: 1.5rem;
  font-weight: 800;
  color: #fff;
  margin: 8px 0 4px;
}
.admin-login-logo p { font-size: 0.85rem; color: #6b7280; margin: 0; }

.admin-login-form { display: flex; flex-direction: column; gap: 16px; }

.field-group { display: flex; flex-direction: column; gap: 6px; }
.field-label { font-size: 0.8rem; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.05em; }
.field-input {
  background: #0f1117;
  border: 1px solid #2a2d3a;
  border-radius: 10px;
  padding: 12px 14px;
  color: #fff;
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.15s;
}
.field-input:focus { border-color: #6366f1; }
.field-input::placeholder { color: #4b5563; }

.admin-error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  padding: 10px 14px;
  color: #f87171;
  font-size: 0.875rem;
}

.admin-btn {
  background: #6366f1;
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 14px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
}
.admin-btn:hover { background: #4f46e5; }
.admin-btn:active { transform: scale(0.98); }
.admin-btn:disabled { opacity: 0.5; pointer-events: none; }
</style>
