<template>
  <div class="page active-match" v-if="match">

    <!-- Шапка с событием -->
    <div class="match-hero" :style="heroStyle">
      <div class="match-hero__overlay" />
      <div class="match-hero__content">
        <div class="flex items-center gap-8">
          <div class="pulse-dot" />
          <span class="text-sm font-bold" style="color:rgba(255,255,255,0.9)">Встреча подтверждена</span>
        </div>
        <h2>{{ match.template?.title }}</h2>
        <div v-if="match.scheduledAt" class="hero-date">
          📅 {{ formatDate(match.scheduledAt) }}
        </div>
      </div>
      <div class="payment-badge" style="position:absolute;top:14px;right:14px">🤝 50/50</div>
    </div>

    <!-- Партнёр (полная анкета теперь доступна) -->
    <div v-if="partner" class="partner-card">
      <div class="partner-card__photo">
        <img v-if="partner.photoUrl" :src="partner.photoUrl" class="partner-avatar-img" />
        <div v-else class="avatar avatar-lg">{{ partner.firstName?.[0] }}</div>
        <div v-if="partner.videoVerified" class="verified-badge">✅ Верифицирован</div>
      </div>
      <div class="partner-card__info">
        <div class="flex items-center gap-8">
          <h3>{{ partner.firstName }}</h3>
          <span v-if="partner.age" class="badge badge-muted">{{ partner.age }} лет</span>
          <span v-if="partner.city" class="badge badge-muted">📍 {{ partner.city }}</span>
        </div>
        <p v-if="partner.bio" class="text-sm text-muted">{{ partner.bio }}</p>
        <div v-if="partner.interests?.length" class="chips-wrap">
          <span v-for="i in partner.interests.slice(0,5)" :key="i" class="chip chip-default chip-sm">
            {{ interestEmoji(i) }} {{ i }}
          </span>
        </div>
      </div>
    </div>

    <!-- Чат -->
    <div class="chat-section">
      <div class="messages-list" ref="chatContainer">
        <div v-if="messages.length === 0" class="empty-chat">
          Напиши «Привет!», чтобы начать общение 👋
        </div>
        <div
          v-for="msg in messages"
          :key="msg.id"
          :class="['message-bubble', msg.senderId === currentUserId ? 'my-message' : 'partner-message']"
        >{{ msg.text }}</div>
      </div>

      <div class="chat-input-area">
        <input
          v-model="newMessage"
          @keyup.enter="sendMessage"
          placeholder="Сообщение..."
          class="input chat-input"
        />
        <button @click="sendMessage" class="send-btn" :disabled="!newMessage.trim()">➤</button>
      </div>
    </div>

    <!-- Кнопки завершения -->
    <div class="finish-area">
      <div v-if="!canFinish" class="timer-note text-sm text-muted text-center">
        🔒 Кнопки разблокируются через {{ timeRemaining }}
      </div>
      <div class="finish-btns">
        <button class="btn btn-danger" :disabled="!canFinish" @click="cancelMatch">😔 Сорвалось</button>
        <button class="btn btn-success" :disabled="!canFinish" @click="finishMatch">🎉 Всё прошло!</button>
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
const currentUserId = parseInt(localStorage.getItem('userId') || '0');
const messages = ref<any[]>([]);
const newMessage = ref('');
const chatContainer = ref<HTMLElement | null>(null);
const canFinish = ref(false);
const timeRemaining = ref('15:00');

let socket: Socket;
let timerInterval: ReturnType<typeof setInterval> | null = null;

const partner = computed(() => {
  if (!match.value) return null;
  return match.value.hostId === currentUserId ? match.value.participant : match.value.host;
});

const heroStyle = computed(() => {
  const img = match.value?.template?.imageUrl;
  if (img) return { background: `linear-gradient(to bottom, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.65) 100%), url(${img}) center/cover` };
  return { background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)' };
});

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString('ru-RU', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

const emojiMap: Record<string, string> = {
  hookah: '💨', bar: '🍺', sport: '⚽', movie_theatre: '🎬', picnic: '🧺', bowling: '🎳',
  dota: '⚔️', cs: '🔫', mc: '⛏️', wow: '🐉', itt: '🃏', split: '🎭',
  movie_online: '🍿', series: '📺', chatting: '💬',
};
function interestEmoji(id: string) { return emojiMap[id] ?? '✨'; }

async function scrollToBottom() {
  await nextTick();
  if (chatContainer.value) chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
}

function startTimer() {
  if (!match.value) return;
  const matchTime = new Date(match.value.scheduledAt || match.value.createdAt).getTime();
  const waitTime = 15 * 60 * 1000;
  timerInterval = setInterval(() => {
    const diff = Date.now() - matchTime;
    if (diff >= waitTime) {
      canFinish.value = true;
      if (timerInterval) clearInterval(timerInterval);
    } else {
      const s = Math.floor((waitTime - diff) / 1000);
      const m = Math.floor(s / 60);
      timeRemaining.value = `${m}:${(s % 60).toString().padStart(2, '0')}`;
    }
  }, 1000);
}

function markAsRead() {
  if (socket && match.value) socket.emit('markAsRead', { matchId: match.value.id });
}

async function loadMatch() {
  const token = localStorage.getItem('token');
  try {
    const res = await fetch(`${API_URL}/quests/match/${route.params.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    match.value = await res.json();

    // Если дата ещё не подтверждена — перенаправляем на экран планирования
    if (match.value.schedulingStatus !== 'CONFIRMED') {
      router.replace(`/match/${route.params.id}/schedule`);
      return;
    }

    messages.value = match.value.messages || [];
    startTimer();
    scrollToBottom();

    const wsUrl = API_URL.replace('/api', '');
    socket = io(wsUrl, { path: '/api-socket', auth: { token } });
    socket.emit('joinRoom', match.value.id);
    socket.on('newMessage', (msg) => {
      messages.value.push(msg);
      scrollToBottom();
      markAsRead();
    });
    markAsRead();
  } catch (e) {
    console.error('Ошибка загрузки мэтча:', e);
  }
}

function sendMessage() {
  if (!newMessage.value.trim() || !socket) return;
  socket.emit('sendMessage', { matchId: match.value.id, text: newMessage.value.trim() });
  newMessage.value = '';
}

async function setStatus(status: 'COMPLETED' | 'FAILED') {
  const token = localStorage.getItem('token');
  if (!canFinish.value || !token) return;
  await fetch(`${API_URL}/quests/match/${match.value.id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status }),
  });
  router.push('/dashboard');
}

function cancelMatch() { setStatus('FAILED'); }
function finishMatch() { setStatus('COMPLETED'); }

onMounted(loadMatch);
onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval);
  if (socket) socket.disconnect();
});
</script>

<style scoped>
.active-match { overflow: hidden; }

.match-hero {
  position: relative;
  height: 200px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 16px 20px;
  flex-shrink: 0;
}
.match-hero__overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.5) 100%);
  pointer-events: none;
}
.match-hero__content { position: relative; z-index: 1; color: #fff; display: flex; flex-direction: column; gap: 4px; }
.match-hero__content h2 { font-size: 1.375rem; font-weight: 800; line-height: 1.2; }
.hero-date { font-size: 0.8rem; opacity: 0.9; font-weight: 600; }

.pulse-dot {
  width: 8px; height: 8px; background: var(--success); border-radius: 50%;
  animation: pulse-glow 1.5s infinite;
}
@keyframes pulse-glow {
  0% { box-shadow: 0 0 0 0 rgba(126, 200, 160, 0.7); }
  70% { box-shadow: 0 0 0 8px rgba(126, 200, 160, 0); }
  100% { box-shadow: 0 0 0 0 rgba(126, 200, 160, 0); }
}

.partner-card {
  display: flex;
  gap: 16px;
  padding: 16px 20px;
  background: var(--surface);
  border-bottom: 1px solid #EDE8E5;
  flex-shrink: 0;
}
.partner-card__photo { position: relative; flex-shrink: 0; }
.partner-avatar-img { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; }
.verified-badge {
  position: absolute;
  bottom: -4px; left: 50%;
  transform: translateX(-50%);
  background: var(--success-soft);
  color: var(--success);
  font-size: 0.65rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 100px;
  white-space: nowrap;
}
.partner-card__info { display: flex; flex-direction: column; gap: 6px; }
.chips-wrap { display: flex; flex-wrap: wrap; gap: 4px; }
.chip-sm { padding: 3px 8px; font-size: 0.75rem; }

/* Чат */
.chat-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--surface-2);
}
.messages-list {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.empty-chat {
  text-align: center;
  color: var(--text-muted);
  font-size: 0.875rem;
  margin: auto;
}
.message-bubble {
  max-width: 78%;
  padding: 10px 14px;
  border-radius: 18px;
  font-size: 0.9rem;
  line-height: 1.45;
  word-wrap: break-word;
}
.my-message {
  align-self: flex-end;
  background: var(--primary);
  color: #fff;
  border-bottom-right-radius: 4px;
}
.partner-message {
  align-self: flex-start;
  background: var(--surface);
  color: var(--text);
  border-bottom-left-radius: 4px;
  box-shadow: var(--shadow-sm);
}
.chat-input-area { display: flex; padding: 12px 16px; background: var(--surface); gap: 8px; flex-shrink: 0; }
.chat-input { border-radius: 24px; padding: 10px 16px; font-size: 0.9rem; }
.send-btn {
  width: 44px; height: 44px; flex-shrink: 0;
  border-radius: 50%;
  background: var(--primary);
  color: #fff;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  display: flex; align-items: center; justify-content: center;
}
.send-btn:disabled { background: var(--text-light); cursor: not-allowed; }

/* Финал */
.finish-area {
  padding: 14px 20px;
  background: var(--surface);
  border-top: 1px solid #EDE8E5;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex-shrink: 0;
}
.finish-btns { display: flex; gap: 12px; }
.finish-btns .btn { flex: 1; }
</style>
