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
      <div class="partner-card__photo" @click="nextPhoto">
        <img v-if="currentPartnerPhoto" :src="currentPartnerPhoto" class="partner-avatar-img" />
        <div v-else class="avatar avatar-lg">{{ partner.firstName?.[0] }}</div>
        
        <div v-if="partner.photos?.length > 1" class="carousel-dots">
          <span v-for="(p, i) in partner.photos" :key="p.id" class="dot" :class="{ active: i === currentPhotoIdx }"></span>
        </div>

        <div v-if="partner.videoVerified" class="verified-badge">✅ Верифицирован</div>
      </div>
      <div class="partner-card__info" style="width: 100%">
        <div class="flex items-center gap-8" style="width: 100%">
          <h3>{{ partner.firstName }}</h3>
          <span v-if="partner.xp !== undefined" class="badge" style="background: var(--primary); color: #fff;">Ур. {{ getLevelInfo(partner.xp).level }}</span>
          <span v-if="partner.streakDays > 0" class="text-sm font-bold" style="color: #ff4757; text-shadow: 0 0 8px rgba(255,71,87,0.4)">🔥{{ partner.streakDays }}</span>
          <span v-if="partner.age" class="badge badge-muted">{{ partner.age }} лет</span>
          <span v-if="partner.city" class="badge badge-muted">📍 {{ partner.city }}</span>
          
          <button class="icon-btn" style="margin-left:auto; color:var(--text-muted); font-size:1.3rem" @click="showReportDialog = true">⋮</button>
        </div>

        <div v-if="partner.achievements?.length" style="display:flex; gap: 4px; flex-wrap: wrap; margin-bottom: 4px;">
          <span v-for="b in partner.achievements" :key="b.badgeId" class="badge" style="background: var(--surface-2); font-size: 0.75rem; border: 1px solid #EDE8E5;">
            {{ getBadge(b.badgeId).icon }} {{ getBadge(b.badgeId).label }}
          </span>
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
          <p class="empty-chat__hint">Начни разговор — выбери первое сообщение:</p>
          <div class="quick-replies">
            <button
              v-for="reply in quickReplies"
              :key="reply"
              class="quick-reply-chip"
              @click="sendQuickReply(reply)"
            >{{ reply }}</button>
          </div>
        </div>
        <div
          v-for="msg in messages"
          :key="msg.id"
          class="message-wrapper"
        >
          <div
            :class="['message-bubble', msg.senderId === currentUserId ? 'my-message' : 'partner-message']"
            @touchstart="startPress($event, msg.id)"
            @touchend="endPress"
            @touchmove="cancelPress"
            @mousedown="startPress($event, msg.id)"
            @mouseup="endPress"
            @mouseleave="cancelPress"
            @contextmenu.prevent="openReactions(msg.id)"
            style="position: relative; align-self: flex-start"
            :style="msg.senderId === currentUserId ? 'align-self: flex-end;' : ''"
          >
            <span>{{ msg.text }}</span>
            <span v-if="msg.senderId === currentUserId" class="read-tick" :class="{ read: msg.readByPartner }">✓✓</span>

            <!-- Попап реакций -->
            <div v-if="activeReactionMsgId === msg.id" class="reaction-popover" @click.stop>
              <button v-for="em in availableEmojis" :key="em" @click.stop="toggleReaction(msg.id, em)" class="reaction-popover-btn">{{ em }}</button>
            </div>
          </div>

          <div v-if="groupedReactions(msg.reactions)?.length > 0" class="reactions-row" :class="msg.senderId === currentUserId ? 'reactions-right' : 'reactions-left'">
            <span 
              v-for="r in groupedReactions(msg.reactions)" 
              :key="r.emoji" 
              class="reaction-pill"
              :class="{ 'mine': r.hasMine }"
              @click.stop="toggleReaction(msg.id, r.emoji)"
            >
              {{ r.emoji }} {{ r.count > 1 ? r.count : '' }}
            </span>
          </div>
        </div>
        <!-- Индикатор набора -->
        <div v-if="isPartnerTyping" class="message-bubble partner-message typing-bubble">
          <span class="typing-dot" /><span class="typing-dot" /><span class="typing-dot" />
        </div>
      </div>

      <div class="chat-input-area">
        <input
          v-model="newMessage"
          @keyup.enter="sendMessage"
          @input="onTyping"
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

    <!-- Confirm-диалог завершения матча -->
    <Teleport to="body">
      <div v-if="confirmDialog" class="confirm-overlay" @click.self="confirmDialog = null">
        <div class="confirm-card anim-scale-in">
          <div class="confirm-icon">{{ confirmDialog.icon }}</div>
          <h3>{{ confirmDialog.title }}</h3>
          <p>{{ confirmDialog.text }}</p>
          <div class="confirm-btns">
            <button class="btn btn-ghost btn-sm" @click="confirmDialog = null">Отмена</button>
            <button :class="['btn btn-sm', confirmDialog.btnClass]" @click="confirmDialog.onConfirm()">
              {{ confirmDialog.btnLabel }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Review-диалог -->
    <Teleport to="body">
      <div v-if="showReviewDialog" class="confirm-overlay" @click.self="skipReview">
        <div class="confirm-card anim-scale-in">
          <div class="confirm-icon">⭐</div>
          <h3>Оцени партнера и получи + к рейтингу</h3>
          <p>Анонимно. Это поможет нам улучшить подбор.</p>
          <div class="stars-container">
            <span v-for="star in 5" :key="star" 
                  class="star" 
                  :class="{ active: star <= reviewRating }"
                  @click="reviewRating = star"
            >★</span>
          </div>
          <input v-model="reviewComment" placeholder="Комментарий (необязательно)" class="input chat-input" style="width:100%; margin: 10px 0; border: 1px solid var(--surface-2)"/>
          <div class="confirm-btns">
            <button class="btn btn-ghost btn-sm" @click="skipReview">Пропустить</button>
            <button class="btn btn-sm btn-success" @click="submitReview" :disabled="reviewRating === 0">
              Отправить
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <ReportBlockDialog 
      v-if="partner"
      v-model="showReportDialog" 
      :userId="partner.id" 
      @blocked="onUserBlocked" 
    />

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, nextTick, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '../config';
import { track } from '../analytics';
import { useToast } from '../composables/useToast';
import ReportBlockDialog from './ReportBlockDialog.vue';
import { getBadge } from '../utils/badges';
import { getLevelInfo } from '../utils/levels';

const route = useRoute();
const router = useRouter();
const { error: toastError, success: toastSuccess } = useToast();
const match = ref<any>(null);
const currentUserId = parseInt(localStorage.getItem('userId') || '0');
const messages = ref<any[]>([]);
const newMessage = ref('');
const chatContainer = ref<HTMLElement | null>(null);
const canFinish = ref(false);
const timeRemaining = ref('15:00');
const confirmDialog = ref<{
  icon: string; title: string; text: string;
  btnLabel: string; btnClass: string; onConfirm: () => void;
} | null>(null);

const showReportDialog = ref(false);
const showReviewDialog = ref(false);
const reviewRating = ref(0);
const reviewComment = ref('');

function onUserBlocked() {
  toastSuccess('Встреча отменена');
  router.push('/dashboard');
}

// Typing indicator
const isPartnerTyping = ref(false);
let partnerTypingTimer: ReturnType<typeof setTimeout> | null = null;
let typingThrottle: ReturnType<typeof setTimeout> | null = null;

let socket: Socket;
let timerInterval: ReturnType<typeof setInterval> | null = null;

const availableEmojis = ['❤️', '😂', '👍', '🔥', '😮', '😢'];
const activeReactionMsgId = ref<number | null>(null);
let pressTimer: ReturnType<typeof setTimeout> | null = null;

function startPress(_e: Event, msgId: number) {
  if (pressTimer) clearTimeout(pressTimer);
  pressTimer = setTimeout(() => {
    openReactions(msgId);
    if (navigator.vibrate) navigator.vibrate(50);
  }, 500);
}
function endPress() { if (pressTimer) clearTimeout(pressTimer); }
function cancelPress() { if (pressTimer) clearTimeout(pressTimer); }
function openReactions(msgId: number) {
  activeReactionMsgId.value = activeReactionMsgId.value === msgId ? null : msgId;
}

function toggleReaction(messageId: number, emoji: string) {
  activeReactionMsgId.value = null;
  socket?.emit('toggleReaction', { messageId, emoji });
  
  // Optimistic UI
  const msg = messages.value.find(m => m.id === messageId);
  if (msg) {
    if (!msg.reactions) msg.reactions = [];
    const idx = msg.reactions.findIndex((r: any) => r.emoji === emoji && r.userId === currentUserId);
    if (idx !== -1) msg.reactions.splice(idx, 1);
    else msg.reactions.push({ emoji, userId: currentUserId });
  }
}

function groupedReactions(reactions: any[]) {
  if (!reactions || !reactions.length) return [];
  const map = new Map<string, { emoji: string, count: number, hasMine: boolean }>();
  for (const r of reactions) {
    const existing = map.get(r.emoji);
    if (existing) {
      existing.count++;
      if (r.userId === currentUserId) existing.hasMine = true;
    } else {
      map.set(r.emoji, { emoji: r.emoji, count: 1, hasMine: r.userId === currentUserId });
    }
  }
  return Array.from(map.values());
}

const partner = computed(() => {
  if (!match.value) return null;
  return match.value.hostId === currentUserId ? match.value.participant : match.value.host;
});

const currentPhotoIdx = ref(0);
function nextPhoto() {
  if (partner.value?.photos?.length > 1) {
    currentPhotoIdx.value = (currentPhotoIdx.value + 1) % partner.value.photos.length;
  }
}
const currentPartnerPhoto = computed(() => {
  if (partner.value?.photos?.length > 0) {
    return partner.value.photos[currentPhotoIdx.value].url;
  }
  return partner.value?.photoUrl;
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
      track('message_received', { matchId: route.params.id });
      markAsRead();
      // сбрасываем индикатор "печатает" при получении сообщения
      isPartnerTyping.value = false;
      if (partnerTypingTimer) clearTimeout(partnerTypingTimer);
    });
    socket.on('partnerTyping', () => {
      isPartnerTyping.value = true;
      if (partnerTypingTimer) clearTimeout(partnerTypingTimer);
      partnerTypingTimer = setTimeout(() => { isPartnerTyping.value = false; }, 3000);
      scrollToBottom();
    });
    socket.on('messagesRead', () => {
      // Помечаем все мои сообщения как прочитанные
      messages.value = messages.value.map(m =>
        m.senderId === currentUserId ? { ...m, readByPartner: true } : m
      );
    });
    socket.on('reactionUpdated', (data: { messageId: number, userId: number, emoji: string, action: string }) => {
      if (data.userId === currentUserId) return; // Optimistic update already handles this
      const msg = messages.value.find(m => m.id === data.messageId);
      if (!msg) return;
      if (!msg.reactions) msg.reactions = [];
      
      const rIdx = msg.reactions.findIndex((r: any) => r.userId === data.userId && r.emoji === data.emoji);
      if (data.action === 'added' && rIdx === -1) {
        msg.reactions.push({ emoji: data.emoji, userId: data.userId });
      } else if (data.action === 'removed' && rIdx !== -1) {
        msg.reactions.splice(rIdx, 1);
      }
    });
    markAsRead();
  } catch (e) {
    console.error('Ошибка загрузки мэтча:', e);
    toastError('Ошибка загрузки встречи');
  }
}

function onTyping() {
  if (!socket || !match.value) return;
  // Throttle: не чаще раза в 2 секунды
  if (typingThrottle) return;
  socket.emit('typing', { matchId: match.value.id });
  typingThrottle = setTimeout(() => { typingThrottle = null; }, 2000);
}

function sendMessage() {
  const text = newMessage.value.trim();
  if (!text || !socket) return;
  socket.emit('sendMessage', { matchId: match.value.id, text });
  track('message_sent', { matchId: route.params.id });
  newMessage.value = '';
  if (typingThrottle) { clearTimeout(typingThrottle); typingThrottle = null; }
}

const quickReplies = [
  'Привет! 👋',
  'Не могу дождаться нашей встречи!',
  'Расскажи о себе 😊',
  'Уже считаю дни до встречи ✨',
];

function sendQuickReply(text: string) {
  if (!socket || !match.value) return;
  socket.emit('sendMessage', { matchId: match.value.id, text });
  track('quick_reply_sent', { matchId: route.params.id });
  navigator.vibrate?.(20);
}

async function setStatus(status: 'COMPLETED' | 'FAILED') {
  const token = localStorage.getItem('token');
  if (!canFinish.value || !token) return;
  confirmDialog.value = null;
  try {
    const res = await fetch(`${API_URL}/quests/match/${match.value.id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error('Status failed');
    toastSuccess('Статус встречи обновлен');
    track('match_status_updated', { matchId: route.params.id, status });
    
    if (status === 'COMPLETED') {
      showReviewDialog.value = true;
    } else {
      router.push('/dashboard');
    }
  } catch (e) {
    console.error('Ошибка статуса:', e);
    toastError('Не удалось изменить статус');
  }
}

function cancelMatch() {
  confirmDialog.value = {
    icon: '😔',
    title: 'Встреча сорвалась?',
    text: 'Это снизит репутацию обоих участников. Действие нельзя отменить.',
    btnLabel: 'Да, сорвалось',
    btnClass: 'btn-danger',
    onConfirm: () => setStatus('FAILED'),
  };
}

function finishMatch() {
  confirmDialog.value = {
    icon: '🎉',
    title: 'Встреча прошла?',
    text: 'Отметь завершение — это повысит вашу репутацию. Действие нельзя отменить.',
    btnLabel: 'Да, всё прошло!',
    btnClass: 'btn-success',
    onConfirm: () => setStatus('COMPLETED'),
  };
}

async function submitReview() {
  const token = localStorage.getItem('token');
  if (!token || !match.value) return;
  try {
    const res = await fetch(`${API_URL}/quests/match/${match.value.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ rating: reviewRating.value, comment: reviewComment.value }),
    });
    if (!res.ok) throw new Error('Review failed');
    toastSuccess('Отзыв отправлен, репутация повышена!');
    router.push('/dashboard');
  } catch (e) {
    toastError('Не удалось отправить отзыв');
  }
}

function skipReview() {
  router.push('/dashboard');
}

onMounted(() => {
  loadMatch();
  // Клик мимо попапа реакций закрывает его
  document.addEventListener('click', () => { activeReactionMsgId.value = null; });
});
onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval);
  if (partnerTypingTimer) clearTimeout(partnerTypingTimer);
  if (typingThrottle) clearTimeout(typingThrottle);
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
.carousel-dots {
  position: absolute; bottom: 10px; left: 50%; transform: translateX(-50%);
  display: flex; gap: 4px; pointer-events: none; z-index: 2;
}
.carousel-dots .dot {
  width: 5px; height: 5px; border-radius: 50%; background: rgba(255,255,255,0.4);
  transition: background 0.2s;
}
.carousel-dots .dot.active { background: #fff; box-shadow: 0 0 2px rgba(0,0,0,0.5); }

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
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  margin: auto;
  padding: 16px;
  width: 100%;
}
.empty-chat__hint {
  font-size: 0.8rem;
  color: var(--text-muted);
  text-align: center;
  margin: 0;
}
.quick-replies {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  max-width: 280px;
}
.quick-reply-chip {
  background: var(--surface);
  border: 2px solid rgba(232, 146, 124, 0.3);
  border-radius: 14px;
  padding: 10px 16px;
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--primary);
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, border-color 0.15s, transform 0.1s;
}
.quick-reply-chip:hover { background: rgba(232, 146, 124, 0.08); border-color: var(--primary); }
.quick-reply-chip:active { transform: scale(0.97); }
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

.confirm-overlay {
  position: fixed; inset: 0; z-index: 200;
  background: rgba(61, 53, 53, 0.45);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center; padding: 24px;
}
.confirm-card {
  background: var(--surface); border-radius: var(--radius);
  padding: 28px 24px; width: 100%; max-width: 340px;
  display: flex; flex-direction: column; gap: 12px; text-align: center;
  box-shadow: var(--shadow-lg);
}
.confirm-icon { font-size: 2.5rem; }
.confirm-card h3 { margin: 0; }
.confirm-card p { font-size: 0.9rem; }
.confirm-btns { display: flex; gap: 10px; margin-top: 4px; }
.confirm-btns .btn { flex: 1; }

.stars-container {
  display: flex; gap: 8px; justify-content: center; margin: 16px 0; font-size: 2.2rem; cursor: pointer;
}
.star {
  color: var(--text-light); transition: color 0.15s, transform 0.15s;
}
.star:hover { transform: scale(1.15); }
.star.active { color: var(--warning); }

/* Read receipts */
.message-wrapper { display: flex; flex-direction: column; margin-bottom: 8px; width: 100%; }
.reaction-popover {
  position: absolute; bottom: calc(100% + 4px); left: 50%; transform: translateX(-50%);
  background: var(--surface-2); border: 1px solid var(--border); border-radius: 20px;
  padding: 4px 8px; display: flex; gap: 4px; z-index: 100; box-shadow: 0 4px 12px rgba(0,0,0,0.4);
}
.reaction-popover-btn { background: none; border: none; font-size: 1.4rem; cursor: pointer; transition: transform 0.1s; display:flex; align-items:center; }
.reaction-popover-btn:active { transform: scale(1.3); }

.reactions-row { display: flex; gap: 4px; margin-top: -6px; z-index: 1; flex-wrap: wrap; margin-bottom: 4px; }
.reactions-left { margin-left: 12px; align-self: flex-start; }
.reactions-right { margin-right: 12px; align-self: flex-end; }
.reaction-pill {
  background: var(--surface-1); border: 1px solid var(--border); border-radius: 12px;
  padding: 2px 6px; font-size: 0.8rem; cursor: pointer; user-select: none; color: var(--text-muted); display:flex; gap: 2px;
}
.reaction-pill.mine { background: rgba(99, 102, 241, 0.2); border-color: rgba(99, 102, 241, 0.5); color: #fff; }

.message-bubble { display: flex; align-items: flex-end; gap: 4px; }
.my-message { flex-direction: row-reverse; }
.read-tick {
  font-size: 0.65rem;
  color: rgba(255,255,255,0.5);
  line-height: 1;
  flex-shrink: 0;
  margin-bottom: 1px;
}
.read-tick.read { color: rgba(255,255,255,0.95); }

/* Typing indicator */
.typing-bubble {
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 4px;
}
@keyframes typing-bounce {
  0%, 80%, 100% { transform: scale(0.7); opacity: 0.5; }
  40%            { transform: scale(1);   opacity: 1; }
}
.typing-dot {
  width: 7px; height: 7px;
  background: var(--text-muted);
  border-radius: 50%;
  animation: typing-bounce 1.2s infinite ease-in-out;
}
.typing-dot:nth-child(2) { animation-delay: 0.15s; }
.typing-dot:nth-child(3) { animation-delay: 0.3s; }
</style>
