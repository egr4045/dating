<template>
  <div class="login-container">
    <h2>Вход в систему</h2>
    <p>Авторизуйтесь через Telegram, чтобы найти пати</p>
    <div ref="telegramWrapper"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const telegramWrapper = ref<HTMLElement | null>(null);

// Эта функция сработает, когда юзер нажмет кнопку и ТГ отдаст данные
(window as any).onTelegramAuth = async (user: any) => {
  console.log('Данные от Telegram:', user);
  
  try {
    // Отправляем данные на наш NestJS бэкенд
    const response = await fetch('http://localhost:3000/auth/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user),
    });

    const data = await response.json();
    console.log('Ответ от сервера:', data);

    if (data.access_token) {
      // Сохраняем токен в память браузера
      localStorage.setItem('token', data.access_token);
      alert('Успешный вход! Привет, ' + data.user.firstName);
    } else {
      alert('Ошибка: ' + data.message);
    }
  } catch (error) {
    console.error('Ошибка запроса к серверу:', error);
  }
};

onMounted(() => {
  // Динамически создаем скрипт виджета ТГ
  const script = document.createElement('script');
  script.src = 'https://telegram.org/js/telegram-widget.js?22';
  
  // ВАЖНО: Вставь сюда юзернейм своего бота (который заканчивается на bot)
  script.setAttribute('data-telegram-login', 'datingTesting_bot'); 
  
  script.setAttribute('data-size', 'large');
  script.setAttribute('data-onauth', 'onTelegramAuth(user)');
  script.setAttribute('data-request-access', 'write');

  if (telegramWrapper.value) {
    telegramWrapper.value.appendChild(script);
  }
});
</script>

<style scoped>
.login-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 2rem;
  border: 1px solid #333;
  border-radius: 12px;
  background-color: #1a1a1a;
  color: white;
}
</style>