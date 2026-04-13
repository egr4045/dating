<template>
  <router-view />
  <ToastContainer />
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import ToastContainer from './components/ToastContainer.vue';

onMounted(async () => {
  // Захват реферального кода из URL
  const urlParams = new URLSearchParams(window.location.search);
  const refCode = urlParams.get('ref');
  if (refCode) {
    localStorage.setItem('pendingRefCode', refCode);
  }

  // 2. Регистрация SW (если еще нет)
  if ('serviceWorker' in navigator) {
    await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
  }

  const theme = localStorage.getItem('theme');
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
});
</script>
