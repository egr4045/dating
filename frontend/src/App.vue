<template>
  <main class="app-wrapper">
    <h1>Party Finder 🎮</h1>
    <TelegramLogin />
  </main>
</template>

<script setup lang="ts">
import TelegramLogin from './components/TelegramLogin.vue';
</script>

<style>
/* Немного базовых стилей, чтобы по центру было */
body {
  margin: 0;
  background-color: #242424;
  color: rgba(255, 255, 255, 0.87);
  font-family: system-ui, -apple-system, sans-serif;
}
.app-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}
</style>