<template>
  <div class="admin-page">
    <div class="admin-page-header">
      <button class="back-btn" @click="$router.back()">← Назад</button>
      <h1 v-if="match">🤝 Матч #{{ match.id }}</h1>
    </div>

    <div v-if="loading" class="admin-loading">Загружаем...</div>

    <template v-else-if="match">
      <div class="detail-grid">
        <!-- Информация -->
        <div class="admin-card">
          <h3>Детали</h3>
          <div class="detail-row"><span>Квест</span><b>{{ match.template.title }}</b></div>
          <div class="detail-row"><span>Категория</span><b>{{ match.template.category }}</b></div>
          <div class="detail-row"><span>Статус</span><b><span :class="statusClass(match.status)">{{ match.status }}</span></b></div>
          <div class="detail-row"><span>Расписание</span><b>{{ match.schedulingStatus }}</b></div>
          <div class="detail-row"><span>Дата встречи</span><b>{{ match.scheduledAt ? formatDate(match.scheduledAt) : '—' }}</b></div>
          <div class="detail-row"><span>Предложенная дата</span><b>{{ match.proposedDate ? formatDate(match.proposedDate) : '—' }}</b></div>
          <div class="detail-row"><span>Создан</span><b>{{ formatDate(match.createdAt) }}</b></div>
        </div>

        <!-- Участники -->
        <div class="admin-card">
          <h3>Участники</h3>
          <div v-if="match.host" class="participant-card" @click="$router.push(`/admin/users/${match.host.id}`)">
            <div class="participant-avatar">{{ match.host.firstName[0] }}</div>
            <div>
              <div class="participant-name">{{ match.host.firstName }}</div>
              <div class="participant-role">Хост</div>
            </div>
          </div>
          <div v-if="match.participant" class="participant-card" @click="$router.push(`/admin/users/${match.participant.id}`)">
            <div class="participant-avatar">{{ match.participant.firstName[0] }}</div>
            <div>
              <div class="participant-name">{{ match.participant.firstName }}</div>
              <div class="participant-role">Участник</div>
            </div>
          </div>
          <div v-else class="admin-empty" style="margin-top:8px">Участник не найден</div>
        </div>
      </div>

      <!-- Чат -->
      <div class="admin-card">
        <h3>💬 Чат ({{ match.messages.length }} сообщений)</h3>
        <div v-if="!match.messages.length" class="admin-empty">Нет сообщений</div>
        <div v-else class="chat-log">
          <div v-for="msg in match.messages" :key="msg.id" class="chat-message">
            <div class="chat-message__meta">
              <span class="chat-sender">{{ senderName(msg.senderId) }}</span>
              <span class="chat-time">{{ formatDate(msg.createdAt) }}</span>
            </div>
            <div class="chat-message__text">{{ msg.text }}</div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { API_URL } from '../../config';

const route = useRoute();
const match = ref<any>(null);
const loading = ref(true);

async function load() {
  const token = localStorage.getItem('adminToken');
  const res = await fetch(`${API_URL}/admin/matches/${route.params.id}`, {
    headers: { 'X-Admin-Token': token ?? '' },
  });
  match.value = await res.json();
  loading.value = false;
}

function senderName(senderId: number) {
  if (!match.value) return senderId;
  if (match.value.host?.id === senderId) return match.value.host.firstName;
  if (match.value.participant?.id === senderId) return match.value.participant.firstName;
  return `#${senderId}`;
}

function statusClass(s: string) {
  const m: Record<string, string> = {
    MATCHED: 'status-badge status-active', COMPLETED: 'status-badge status-active',
    WAITING: 'status-badge status-waiting', EXPIRED: 'status-badge status-banned',
    CANCELLED: 'status-badge status-banned', FAILED: 'status-badge status-banned',
  };
  return m[s] ?? 'status-badge';
}

function formatDate(d: string) {
  return new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

onMounted(load);
</script>

<style scoped>
@import '../../assets/admin-common.css';
.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
.detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #1e2130; font-size: 0.9rem; gap: 12px; }
.detail-row span { color: #6b7280; }
.participant-card { display: flex; align-items: center; gap: 12px; padding: 12px; background: #0f1117; border-radius: 10px; cursor: pointer; transition: background 0.15s; margin-bottom: 8px; }
.participant-card:hover { background: #1e2130; }
.participant-avatar { width: 40px; height: 40px; border-radius: 50%; background: #6366f1; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.1rem; color: #fff; flex-shrink: 0; }
.participant-name { font-weight: 700; }
.participant-role { font-size: 0.8rem; color: #6b7280; }
.chat-log { display: flex; flex-direction: column; gap: 10px; max-height: 500px; overflow-y: auto; }
.chat-message { background: #0f1117; border-radius: 10px; padding: 10px 14px; }
.chat-message__meta { display: flex; align-items: center; gap: 12px; margin-bottom: 4px; }
.chat-sender { font-weight: 700; font-size: 0.85rem; color: #818cf8; }
.chat-time { font-size: 0.75rem; color: #4b5563; }
.chat-message__text { font-size: 0.9rem; line-height: 1.5; }
</style>
