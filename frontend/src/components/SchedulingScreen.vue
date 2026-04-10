<template>
  <div class="page scheduling">

    <header class="app-header">
      <button class="icon-btn" @click="$router.push('/dashboard')">←</button>
      <div class="app-header__logo">🎉 Мэтч!</div>
      <div style="width:40px" />
    </header>

    <div v-if="loading" class="page-content" style="align-items:center;justify-content:center">
      <div style="font-size:2.5rem;animation:spin 1.2s linear infinite">🌀</div>
    </div>

    <div v-else class="page-content anim-fade-up">

      <!-- Карточка события -->
      <div class="event-banner" :style="bannerStyle">
        <div class="event-banner__overlay" />
        <div class="event-banner__content">
          <div class="badge badge-primary">{{ match?.template?.category }}</div>
          <h2>{{ match?.template?.title }}</h2>
          <div v-if="match?.template?.address" class="text-sm" style="color:rgba(255,255,255,0.85)">
            📍 {{ match.template.address }}
          </div>
        </div>
        <div class="payment-badge" style="position:absolute;top:14px;right:14px">🤝 50/50</div>
      </div>

      <!-- Партнёр (только имя — анкета откроется после подтверждения даты) -->
      <div class="partner-preview card">
        <div class="avatar avatar-md">{{ partnerInitial }}</div>
        <div>
          <div class="font-bold">{{ partnerName }}</div>
          <div class="text-sm text-muted">Ваш напарник по событию</div>
        </div>
        <div class="badge badge-warning" style="margin-left:auto">🔒 Анкета после встречи</div>
      </div>

      <!-- Статус согласования -->
      <div class="scheduling-card card">

        <!-- PENDING — хост предлагает дату -->
        <template v-if="schedulingStatus === 'PENDING' && isHost">
          <h3>📅 Предложи дату и время</h3>
          <p>Выбери, когда вам удобно встретиться</p>
          <div class="field-group">
            <label class="input-label">Дата и время</label>
            <input type="datetime-local" class="input" v-model="proposedDateInput" :min="minDatetime" />
          </div>
          <button class="btn btn-primary btn-full" :disabled="!proposedDateInput || submitting" @click="proposeDate">
            {{ submitting ? 'Отправка...' : 'Предложить дату →' }}
          </button>
        </template>

        <!-- PENDING — участник ждёт -->
        <template v-else-if="schedulingStatus === 'PENDING' && !isHost">
          <div class="waiting-state">
            <div style="font-size:2rem">⏳</div>
            <h3>Ждём предложения</h3>
            <p>{{ partnerName }} скоро предложит удобную дату</p>
          </div>
        </template>

        <!-- PROPOSED — кто-то предложил дату -->
        <template v-else-if="schedulingStatus === 'PROPOSED'">
          <div v-if="proposedBy === currentUserId">
            <!-- Я предложил — жду ответа -->
            <div class="waiting-state">
              <div style="font-size:2rem">📤</div>
              <h3>Ждём ответа</h3>
              <p>Ты предложил встречу:</p>
              <div class="proposed-date-badge">📅 {{ formatDate(match?.proposedDate) }}</div>
              <p class="text-sm text-muted">{{ partnerName }} пока не ответил</p>
            </div>
            <button class="btn btn-ghost btn-sm btn-full" @click="resetProposal">Изменить дату</button>
          </div>

          <div v-else>
            <!-- Партнёр предложил — мне надо ответить -->
            <h3>{{ partnerName }} предлагает встречу</h3>
            <div class="proposed-date-badge big">📅 {{ formatDate(match?.proposedDate) }}</div>
            <div class="date-actions">
              <button class="btn btn-success btn-full" :disabled="submitting" @click="confirmDate(true)">
                ✅ Подходит!
              </button>
              <button class="btn btn-outline btn-full" :disabled="submitting" @click="showCounter = !showCounter">
                📅 Предложить другое
              </button>
            </div>
            <div v-if="showCounter" class="field-group" style="margin-top:12px">
              <label class="input-label">Другая дата</label>
              <input type="datetime-local" class="input" v-model="counterDateInput" :min="minDatetime" />
              <button class="btn btn-primary btn-full btn-sm" :disabled="!counterDateInput || submitting" @click="confirmDate(false)">
                Отправить встречную дату
              </button>
            </div>
          </div>
        </template>

        <!-- CONFIRMED — всё согласовано, переходим в чат -->
        <template v-else-if="schedulingStatus === 'CONFIRMED'">
          <div class="confirmed-state">
            <div style="font-size:3rem">🎊</div>
            <h3>Встреча подтверждена!</h3>
            <div class="proposed-date-badge big">📅 {{ formatDate(match?.scheduledAt) }}</div>
            <button class="btn btn-primary btn-full" @click="goToChat">Открыть чат →</button>
          </div>
        </template>

      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { io, Socket } from 'socket.io-client';
import { API_URL } from '../config';

const route = useRoute();
const router = useRouter();
const matchId = Number(route.params.id);
const currentUserId = Number(localStorage.getItem('userId'));

const match = ref<any>(null);
const loading = ref(true);
const submitting = ref(false);
const proposedDateInput = ref('');
const counterDateInput = ref('');
const showCounter = ref(false);

let socket: Socket | null = null;

const schedulingStatus = computed(() => match.value?.schedulingStatus ?? 'PENDING');
const proposedBy = computed(() => match.value?.proposedBy ?? null);
const isHost = computed(() => match.value?.hostId === currentUserId);
const partner = computed(() => isHost.value ? match.value?.participant : match.value?.host);
const partnerName = computed(() => partner.value?.firstName ?? '...');
const partnerInitial = computed(() => partnerName.value[0]?.toUpperCase() ?? '?');

const bannerStyle = computed(() => {
  const img = match.value?.template?.imageUrl;
  if (img) return { background: `linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.6) 100%), url(${img}) center/cover` };
  return { background: 'linear-gradient(135deg, var(--primary-soft) 0%, var(--primary) 100%)' };
});

const minDatetime = computed(() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 16);
});

function formatDate(dateStr?: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('ru-RU', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
  });
}

async function loadMatch() {
  const token = localStorage.getItem('token');
  if (!token) { router.push('/'); return; }
  try {
    const res = await fetch(`${API_URL}/quests/match/${matchId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    match.value = await res.json();
    if (schedulingStatus.value === 'CONFIRMED') {
      router.replace(`/match/${matchId}`);
    }
  } finally {
    loading.value = false;
  }
}

async function proposeDate() {
  submitting.value = true;
  const token = localStorage.getItem('token');
  await fetch(`${API_URL}/quests/match/${matchId}/propose-date`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ proposedDate: new Date(proposedDateInput.value).toISOString() }),
  });
  await loadMatch();
  submitting.value = false;
}

async function confirmDate(accept: boolean) {
  submitting.value = true;
  const token = localStorage.getItem('token');
  const body: any = { accept };
  if (!accept && counterDateInput.value) {
    body.counterDate = new Date(counterDateInput.value).toISOString();
  }
  await fetch(`${API_URL}/quests/match/${matchId}/confirm-date`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  await loadMatch();
  submitting.value = false;
}

async function resetProposal() {
  proposedDateInput.value = '';
  // Сбрасываем на PENDING — просто обновляем локальное состояние для показа формы
  if (match.value) match.value.schedulingStatus = 'PENDING';
}

function goToChat() {
  router.push(`/match/${matchId}`);
}

function connectSocket() {
  const token = localStorage.getItem('token');
  if (!token) return;
  const wsUrl = API_URL.replace('/api', '');
  socket = io(wsUrl, { auth: { token }, path: '/api-socket' });

  socket.on('dateProposed', () => { loadMatch(); });
  socket.on('dateConfirmed', () => { router.push(`/match/${matchId}`); });
}

onMounted(() => {
  loadMatch();
  connectSocket();
});

onUnmounted(() => { socket?.disconnect(); });
</script>

<style scoped>
.scheduling { background: var(--bg); }

.event-banner {
  border-radius: var(--radius);
  height: 180px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 16px;
  position: relative;
  overflow: hidden;
}
.event-banner__content { position: relative; z-index: 1; color: #fff; display: flex; flex-direction: column; gap: 4px; }
.event-banner__content h2 { font-size: 1.25rem; font-weight: 800; line-height: 1.2; }

.partner-preview {
  display: flex;
  align-items: center;
  gap: 14px;
}

.scheduling-card { display: flex; flex-direction: column; gap: 16px; }

.waiting-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
  padding: 8px 0;
}

.proposed-date-badge {
  background: var(--primary-soft);
  color: var(--primary);
  padding: 10px 16px;
  border-radius: var(--radius-sm);
  font-weight: 700;
  text-align: center;
}
.proposed-date-badge.big { font-size: 1.1rem; padding: 14px 20px; }

.date-actions { display: flex; flex-direction: column; gap: 10px; }

.confirmed-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  text-align: center;
  padding: 8px 0;
}

.field-group { display: flex; flex-direction: column; gap: 8px; }

@keyframes spin { to { transform: rotate(360deg); } }
</style>
