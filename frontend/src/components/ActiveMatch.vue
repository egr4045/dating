<template>
  <div class="match-wrapper" v-if="match">
    <div class="glass-card match-card">
      
      <header class="match-header">
        <div class="pulse-dot"></div>
        <h2>Задание началось!</h2>
      </header>

      <div class="quest-banner" :style="{ background: match.template.imageUrl ? `url(${match.template.imageUrl}) center/cover` : 'linear-gradient(45deg, #a1c4fd, #c2e9fb)' }">
        <div class="banner-overlay">
          <h3>{{ match.template.title }}</h3>
          <p>{{ match.template.description }}</p>
        </div>
      </div>

      <div class="partner-zone" v-if="partner">
        <div class="avatar">{{ partner.firstName[0] }}</div>
        <div class="partner-info">
          <p class="label">Твой напарник</p>
          <p class="name">{{ partner.firstName }}</p>
        </div>
      </div>

      <div class="chat-section">
        <div class="messages-list" ref="chatContainer">
          <div v-if="messages.length === 0" class="empty-chat">
            Напиши «Привет!», чтобы начать общение 👋
          </div>
          
          <div 
            v-for="msg in messages" 
            :key="msg.id"
            :class="['message-bubble', msg.senderId === currentUserId ? 'my-message' : 'partner-message']"
          >
            {{ msg.text }}
          </div>
        </div>
        
        <div class="chat-input-area">
          <input 
            v-model="newMessage" 
            @keyup.enter="sendMessage"
            placeholder="Сообщение..." 
            class="chat-input"
          />
          <button @click="sendMessage" class="send-btn" :disabled="!newMessage.trim()">➤</button>
        </div>
      </div>

      <div class="actions">
        <div v-if="!canFinish" class="timer-overlay">
          <span class="lock-icon">🔒</span>
          <p>Кнопки разблокируются через <strong>{{ timeRemaining }}</strong></p>
        </div>

        <button class="danger-btn" :disabled="!canFinish" @click="cancelMatch">Сорвалось</button>
        <button class="success-btn" :disabled="!canFinish" @click="finishMatch">Всё супер!</button>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '../config';

const route = useRoute();
const router = useRouter();
const match = ref<any>(null);

// Чат
const currentUserId = parseInt(localStorage.getItem('userId') || '0');
const messages = ref<any[]>([]);
const newMessage = ref('');
let socket: Socket;
const chatContainer = ref<HTMLElement | null>(null);

// Таймер
const canFinish = ref(false);
const timeRemaining = ref('10:00');
let timerInterval: any = null;

const partner = computed(() => {
  if (!match.value) return null;
  return match.value.hostId === currentUserId ? match.value.participant : match.value.host;
});

const scrollToBottom = async () => {
  await nextTick();
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  }
};

const startTimer = () => {
  if (!match.value) return;
  const matchTime = new Date(match.value.createdAt).getTime();
  const waitTime = 15 * 60 * 1000; // 15 минут, как на бэкенде

  timerInterval = setInterval(() => {
    const diff = Date.now() - matchTime;
    if (diff >= waitTime) {
      canFinish.value = true;
      clearInterval(timerInterval);
    } else {
      const s = Math.floor((waitTime - diff) / 1000);
      const m = Math.floor(s / 60);
      timeRemaining.value = `${m}:${(s % 60).toString().padStart(2, '0')}`;
    }
  }, 1000);
};

// --- ФУНКЦИЯ ПРОЧТЕНИЯ (ЕДИНСТВЕННАЯ) ---
const markAsRead = () => {
  if (socket && match.value) {
    socket.emit('markAsRead', { matchId: match.value.id });
  }
};

const loadMatch = async () => {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL}/quests/match/${route.params.id}`, {
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    match.value = await res.json();
    messages.value = match.value.messages || [];
    startTimer();
    scrollToBottom();

    socket = io(API_URL, {
      auth: { token }
    });
    socket.emit('joinRoom', match.value.id);
    
    socket.on('newMessage', (msg) => {
      messages.value.push(msg);
      scrollToBottom();
      markAsRead(); // Сообщаем бэку, что прочитали новое сообщение
    });

    markAsRead(); // Сообщаем бэку, что прочитали историю при входе
  } catch (e) {
    console.error('Ошибка загрузки мэтча:', e);
  }
};

const sendMessage = () => {
  if (!newMessage.value.trim() || !socket) return;
  socket.emit('sendMessage', {
    matchId: match.value.id,
    text: newMessage.value.trim()
  });
  newMessage.value = '';
};

// Кнопки выхода
const cancelMatch = async () => {
  const token = localStorage.getItem('token');
  if (!canFinish.value || !token) return;
  try {
    await fetch(`${API_URL}/quests/match/${match.value.id}/status`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status: 'FAILED' })
    });
    router.push('/dashboard');
  } catch (e) {
    console.error('Ошибка при отмене квеста:', e);
  }
};

const finishMatch = async () => {
  const token = localStorage.getItem('token');
  if (!canFinish.value || !token) return;
  try {
    await fetch(`${API_URL}/quests/match/${match.value.id}/status`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status: 'COMPLETED' })
    });
    router.push('/dashboard');
  } catch (e) {
    console.error('Ошибка при завершении квеста:', e);
  }
};

onMounted(loadMatch);
onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval);
  if (socket) socket.disconnect();
});
</script>

<style scoped>
.match-wrapper { display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 20px; }
.match-card { width: 100%; max-width: 480px; background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(20px); border-radius: 32px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.1); }
.match-header { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 24px; background: #fff; border-bottom: 1px solid #f0f0f0; }
.match-header h2 { margin: 0; font-size: 20px; color: #1d1d1f; }
.pulse-dot { width: 12px; height: 12px; background: #43E97B; border-radius: 50%; animation: pulse 1.5s infinite; }
@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(67, 233, 123, 0.7); } 70% { box-shadow: 0 0 0 10px rgba(67, 233, 123, 0); } 100% { box-shadow: 0 0 0 0 rgba(67, 233, 123, 0); } }
.quest-banner { position: relative; height: 180px; display: flex; align-items: flex-end; }
.banner-overlay { width: 100%; padding: 20px; background: linear-gradient(to top, rgba(0,0,0,0.8), transparent); color: white; }
.banner-overlay h3 { margin: 0 0 8px; font-size: 24px; }
.banner-overlay p { margin: 0; font-size: 14px; opacity: 0.9; line-height: 1.4; }
.partner-zone { display: flex; align-items: center; gap: 16px; padding: 24px; background: #fcfcfc; }
.avatar { width: 56px; height: 56px; background: #7c9aff; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; }
.partner-info .label { margin: 0 0 4px; font-size: 12px; color: #888; text-transform: uppercase; }
.partner-info .name { margin: 0; font-size: 18px; font-weight: bold; color: #1d1d1f; }

/* ЧАТ */
.chat-section { display: flex; flex-direction: column; height: 300px; background: #f8faff; border-top: 1px solid #eee; border-bottom: 1px solid #eee; }
.messages-list { flex: 1; padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
.empty-chat { text-align: center; color: #a0a0a0; font-size: 14px; margin-top: auto; margin-bottom: auto; }
.message-bubble { max-width: 80%; padding: 10px 14px; border-radius: 16px; font-size: 14px; line-height: 1.4; word-wrap: break-word; }
.my-message { align-self: flex-end; background: #7c9aff; color: white; border-bottom-right-radius: 4px; }
.partner-message { align-self: flex-start; background: #e5e5ea; color: #1d1d1f; border-bottom-left-radius: 4px; }
.chat-input-area { display: flex; padding: 12px 16px; background: white; gap: 8px; }
.chat-input { flex: 1; padding: 12px 16px; border: 1px solid #ddd; border-radius: 24px; outline: none; font-size: 14px; transition: border-color 0.2s; }
.chat-input:focus { border-color: #7c9aff; }
.send-btn { width: 44px; height: 44px; border-radius: 50%; background: #7c9aff; color: white; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; flex: none; }
.send-btn:disabled { background: #ccc; cursor: not-allowed; }

/* КНОПКИ */
.actions { position: relative; display: flex; gap: 16px; padding: 24px; background: #fff; overflow: hidden; }
.timer-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(4px); display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 10; color: #1d1d1f; font-size: 14px; }
.timer-overlay .lock-icon { font-size: 24px; margin-bottom: 4px; }
.timer-overlay strong { color: #7c9aff; font-size: 16px; }
button { flex: 1; padding: 16px; border-radius: 16px; border: none; font-weight: 800; font-size: 16px; cursor: pointer; transition: all 0.2s; }
button:active:not(:disabled) { transform: scale(0.95); }
button:disabled { opacity: 0.3; cursor: not-allowed; }
.danger-btn { background: #ffe5e5; color: #ff5252; }
.success-btn { background: #43E97B; color: #106b31; box-shadow: 0 10px 20px rgba(67, 233, 123, 0.2); }
</style>
