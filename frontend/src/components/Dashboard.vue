<template>
  <div class="feed-container">
    <div class="cards-stack">
      <QuestCard 
        v-for="(quest, index) in quests" 
        :key="quest.id"
        v-show="index === quests.length - 1" 
        :quest="quest"
        @swipeRight="onLike"
        @swipeLeft="onNope"
      />
      
      <div v-if="quests.length === 0" class="empty-state">
        <h2>Задания закончились! 🏁</h2>
        <p>Заходи позже, мы подберем что-нибудь еще.</p>
        <button @click="loadQuests" class="retry-btn">Обновить</button>
      </div>
    </div>
    
    <header class="dashboard-header">
      <div class="logo">🔥 Quests</div>
      <button @click="logout" class="logout-btn">Выйти</button>
    </header>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { io, Socket } from 'socket.io-client';
import QuestCard from './QuestCard.vue';

// 1. Сначала инициализируем роутер
const router = useRouter();

// 2. Описываем интерфейсы и стейт
interface Quest {
  id: string;
  title: string;
  description: string;
  subcategory: string;
  imageUrl?: string;
}

const quests = ref<Quest[]>([]);
let socket: Socket;

// 3. Функции навигации и загрузки
const logout = () => {
  localStorage.removeItem('userId');
  localStorage.removeItem('token');
  router.push('/');
};

const loadQuests = async () => {
  const userId = localStorage.getItem('userId');
  if (!userId) return;

  try {
    const res = await fetch(`http://localhost:3000/quests/feed?userId=${userId}`);
    const data = await res.json();
    quests.value = data;
  } catch (e) {
    console.error('Ошибка загрузки:', e);
  }
};

// 4. Логика свайпов
const onLike = async (questId: string) => {
  const userId = localStorage.getItem('userId');
  if (!userId) return;

  try {
    const res = await fetch('http://localhost:3000/quests/swipe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: parseInt(userId), questId, action: 'like' }),
    });
    const result = await res.json();

    if (result.status === 'matched') {
      router.push(`/match/${result.match.id}`);
    } else if (result.status === 'already_matched') {
      alert('У тебя уже есть активное задание!');
      router.push(`/match/${result.matchId}`);
    } else {
      setTimeout(() => quests.value.pop(), 300);
    }
  } catch (e) {
    console.error('Ошибка свайпа:', e);
  }
};

const onNope = async (questId: string) => {
  const userId = localStorage.getItem('userId');
  if (!userId) return;

  fetch('http://localhost:3000/quests/swipe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: parseInt(userId), questId, action: 'dislike' }),
  });
  
  setTimeout(() => quests.value.pop(), 300);
};

// 5. Логика WebSockets
const connectToSocket = () => {
  const userId = localStorage.getItem('userId');
  if (!userId) return;

  socket = io('http://localhost:3000');
  
  socket.emit('joinUserRoom', parseInt(userId));

  socket.on('matchFound', (matchId) => {
    // Прилетел пуш с сервера — мгновенно летим в комнату!
    router.push(`/match/${matchId}`);
  });
};

// 6. Хуки жизненного цикла
onMounted(() => {
  loadQuests();
  connectToSocket(); // Теперь сокеты запускаются при старте
});

onUnmounted(() => {
  if (socket) socket.disconnect(); // Убираем за собой мусор
});
</script>

<style scoped>
.feed-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
}
.cards-stack {
  position: relative;
  width: 380px;
  height: 520px;
}
.empty-state {
  text-align: center;
  background: rgba(255,255,255,0.8);
  backdrop-filter: blur(10px);
  padding: 40px;
  border-radius: 32px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.05);
}
.retry-btn {
  margin-top: 20px;
  padding: 14px 28px;
  border-radius: 16px;
  border: none;
  background: #7c9aff;
  color: white;
  font-weight: 800;
  cursor: pointer;
}

.dashboard-header {
  position: absolute;
  top: 0; left: 0; right: 0;
  display: flex;
  justify-content: space-between;
  padding: 20px;
  z-index: 100;
}
.logo { font-weight: 900; font-size: 20px; color: #1d1d1f; }
.logout-btn {
  background: rgba(255, 60, 60, 0.1); color: #ff3c3c;
  border: none; padding: 8px 16px; border-radius: 12px;
  font-weight: bold; cursor: pointer;
}
</style>