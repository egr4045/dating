<template>
  <div class="feed-container">
    <!-- Экран бана -->
    <div v-if="isBanned" class="ban-screen">
      <div class="ban-card">
        <div class="ban-icon">🚫</div>
        <h2>Доступ ограничен</h2>
        <p>Твоя репутация слишком низкая. Ты временно не можешь искать напарников.</p>
        <p class="ban-date">Разблокировка: <strong>{{ banDateFormatted }}</strong></p>
        <button @click="logout" class="logout-btn-big">Выйти</button>
      </div>
    </div>

    <!-- Основной интерфейс -->
    <template v-else>
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
        <div class="header-actions">
          <button @click="$router.push('/history')" class="icon-btn" title="История">📋</button>
          <button @click="$router.push('/settings')" class="icon-btn" title="Настройки">⚙️</button>
          <button @click="logout" class="logout-btn">Выйти</button>
        </div>
      </header>

      <!-- Модалка выбора слотов -->
      <MatchSlotSelector
        :visible="slotSelectorVisible"
        :hostSlots="pendingSlots"
        :lobbyId="pendingLobbyId"
        :questId="pendingQuestId"
        @confirm="onSlotConfirm"
        @decline="onSlotDecline"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { io, Socket } from 'socket.io-client';
import QuestCard from './QuestCard.vue';
import MatchSlotSelector from './MatchSlotSelector.vue';
import { API_URL } from '../config';

const router = useRouter();

interface Quest {
  id: string;
  title: string;
  description: string;
  subcategory: string;
  imageUrl?: string;
}

const quests = ref<Quest[]>([]);
let socket: Socket;

// Состояние бана
const isBanned = ref(false);
const banDateFormatted = ref('');

// Состояние модалки слотов
const slotSelectorVisible = ref(false);
const pendingSlots = ref<any[]>([]);
const pendingLobbyId = ref(0);
const pendingQuestId = ref('');

const logout = () => {
  localStorage.removeItem('userId');
  localStorage.removeItem('token');
  router.push('/');
};

const loadQuests = async () => {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    const res = await fetch(`${API_URL}/quests/feed`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.status === 403) {
      const data = await res.json();
      isBanned.value = true;
      banDateFormatted.value = data.message || 'Неизвестно';
      return;
    }

    const data = await res.json();
    quests.value = data.reverse();
  } catch (e) {
    console.error('Ошибка загрузки:', e);
  }
};

const onLike = async (questId: string) => {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    const res = await fetch(`${API_URL}/quests/swipe`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ questId, action: 'like' }),
    });
    const result = await res.json();

    if (result.status === 'matched') {
      router.push(`/match/${result.match.id}`);
    } else if (result.status === 'already_matched') {
      alert('У тебя уже есть активное задание!');
      router.push(`/match/${result.matchId}`);
    } else if (result.status === 'slots_required') {
      // Новая логика: показываем модалку выбора слотов
      pendingSlots.value = result.hostSlots || [];
      pendingLobbyId.value = result.lobbyId;
      pendingQuestId.value = result.questId || questId;
      slotSelectorVisible.value = true;
    } else {
      setTimeout(() => quests.value.pop(), 300);
    }
  } catch (e) {
    console.error('Ошибка свайпа:', e);
  }
};

const onSlotConfirm = async (slot: { dayOfWeek: number; timeFrom: string; timeTo: string }) => {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    const res = await fetch(`${API_URL}/quests/confirm-slot`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ lobbyId: pendingLobbyId.value, selectedSlot: slot }),
    });
    const result = await res.json();

    if (result.status === 'matched') {
      router.push(`/match/${result.match.id}`);
    } else {
      alert(result.message || 'Лобби уже занято, попробуй другое.');
      slotSelectorVisible.value = false;
      loadQuests();
    }
  } catch (e) {
    console.error('Ошибка подтверждения слота:', e);
  }
};

const onSlotDecline = async () => {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    await fetch(`${API_URL}/quests/decline-slots`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ questId: pendingQuestId.value }),
    });
    
    slotSelectorVisible.value = false;
    setTimeout(() => quests.value.pop(), 300);
  } catch (e) {
    console.error('Ошибка отклонения слотов:', e);
  }
};

const onNope = async (questId: string) => {
  const token = localStorage.getItem('token');
  if (!token) return;

  fetch(`${API_URL}/quests/swipe`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ questId, action: 'dislike' }),
  });
  
  setTimeout(() => quests.value.pop(), 300);
};

const connectToSocket = () => {
  const token = localStorage.getItem('token');
  if (!token) return;

  socket = io(API_URL, {
    auth: { token }
  });
  
  socket.on('matchFound', (matchId) => {
    router.push(`/match/${matchId}`);
  });
};

onMounted(() => {
  loadQuests();
  connectToSocket();
});

onUnmounted(() => {
  if (socket) socket.disconnect();
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
  align-items: center;
  padding: 20px;
  z-index: 100;
}
.logo { font-weight: 900; font-size: 20px; color: #1d1d1f; }

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.icon-btn {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: none;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}
.icon-btn:hover {
  background: #f2f2f7;
  transform: scale(1.05);
}

.logout-btn {
  background: rgba(255, 60, 60, 0.1); color: #ff3c3c;
  border: none; padding: 8px 16px; border-radius: 12px;
  font-weight: bold; cursor: pointer;
}

/* Экран бана */
.ban-screen {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 24px;
}
.ban-card {
  text-align: center;
  background: white;
  border-radius: 32px;
  padding: 48px;
  max-width: 400px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.1);
}
.ban-icon { font-size: 64px; margin-bottom: 16px; }
.ban-card h2 { font-size: 24px; font-weight: 800; color: #1d1d1f; margin-bottom: 12px; }
.ban-card p { color: #86868b; font-size: 15px; line-height: 1.5; }
.ban-date { margin-top: 16px; }
.ban-date strong { color: #ff3c3c; }
.logout-btn-big {
  margin-top: 24px;
  padding: 14px 32px;
  border-radius: 16px;
  border: none;
  background: #f2f2f7;
  font-weight: 700;
  font-size: 15px;
  cursor: pointer;
}
</style>