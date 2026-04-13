<template>
  <div class="admin-page">
    <div class="admin-page-header">
      <button class="back-btn" @click="$router.back()">← Назад</button>
      <h1 v-if="user">👤 {{ user.firstName }}</h1>
    </div>

    <div v-if="loading" class="admin-loading">Загружаем...</div>

    <template v-else-if="user">
      <!-- Профиль -->
      <div class="detail-grid">
        <div class="admin-card">
          <h3>Профиль</h3>
          <div class="detail-row"><span>ID</span><b>#{{ user.id }}</b></div>
          <div class="detail-row"><span>Имя</span><b>{{ user.firstName }}</b></div>
          <div class="detail-row"><span>Username</span><b>{{ user.username ? '@' + user.username : '—' }}</b></div>
          <div class="detail-row"><span>Telegram ID</span><b>{{ user.telegramId }}</b></div>
          <div class="detail-row"><span>Возраст</span><b>{{ user.age ?? '—' }}</b></div>
          <div class="detail-row"><span>Пол</span><b>{{ user.gender ?? '—' }}</b></div>
          <div class="detail-row"><span>Город</span><b>{{ user.city ?? '—' }}</b></div>
          <div class="detail-row"><span>Репутация</span><b :class="reputationClass(user.reputation)">⭐ {{ user.reputation.toFixed(1) }}</b></div>
          <div class="detail-row">
            <span>Верификация видео</span>
            <div style="text-align: right">
              <b :class="user.videoVerified ? 'rep rep-good' : 'rep rep-bad'">{{ user.videoVerified ? '✅ Верифицирован' : '❌ Не верифицирован' }}</b>
              <div v-if="user.videoUrl" style="margin-top: 6px;">
                <a :href="user.videoUrl" target="_blank" style="color: #6366f1; text-decoration: none; font-weight: bold; font-size: 0.85rem;">🎥 Смотреть видео</a>
              </div>
            </div>
          </div>
          <div class="detail-row"><span>Забанен до</span><b>{{ user.bannedUntil ? formatDate(user.bannedUntil) : 'Не забанен' }}</b></div>
          <div class="detail-row"><span>Регистрация</span><b>{{ formatDate(user.createdAt) }}</b></div>
          <div class="detail-row"><span>Интересы</span>
            <div class="interests-wrap">
              <span v-for="i in user.interests" :key="i" class="interest-chip">{{ i }}</span>
            </div>
          </div>
        </div>

        <!-- Действия -->
        <div class="admin-card">
          <h3>Действия</h3>
          <div class="action-group">
            <button
              v-if="!user.videoVerified && user.videoUrl"
              class="admin-btn-outline"
              @click="doVerify"
            >✅ Верифицировать видео</button>
            <button
              v-if="!user.videoVerified && user.videoUrl"
              class="admin-btn-danger"
              @click="doRejectVideo"
              style="margin-top: 8px; margin-left: 8px;"
            >❌ Отклонить видео</button>
            <div v-if="user.videoVerified" class="admin-verified-badge">✅ Видео верифицировано</div>
          </div>
          <hr class="divider" />
          <div class="action-group">
            <label class="field-label">Бан (дней)</label>
            <div class="ban-row">
              <input v-model.number="banDays" type="number" min="1" max="365" class="admin-input" placeholder="30" />
              <button class="admin-btn-danger" @click="doBan">Забанить</button>
            </div>
            <button class="admin-btn-outline" @click="doUnban">Снять бан</button>
          </div>
          <hr class="divider" />
          <button class="admin-btn-danger" @click="doDelete">🗑️ Удалить аккаунт</button>
        </div>

        <!-- Достижения -->
        <div class="admin-card" style="grid-column: 1 / -1; max-width: 600px;">
          <h3>Достижения и Бейджи</h3>
          <div class="badges-list" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px;">
            <div v-for="b in user.achievements" :key="b.badgeId" class="admin-badge-chip">
              <span style="font-size: 1.1rem; margin-right: 4px;">{{ getBadge(b.badgeId).icon }}</span>
              {{ getBadge(b.badgeId).label }}
              <button class="remove-badge-btn" @click="doRemoveBadge(b.badgeId)">✕</button>
            </div>
            <div v-if="!user.achievements?.length" style="font-size: 0.85rem; color: #6b7280;">Нет достижений</div>
          </div>
          <div class="action-group" style="flex-direction: row; align-items: center;">
            <select v-model="selectedBadgeId" class="admin-input" style="flex: 1;">
              <option value="" disabled>Выберите бейдж...</option>
              <option v-for="(badge, id) in availableBadges" :key="id" :value="id">
                {{ badge.icon }} {{ badge.label }}
              </option>
            </select>
            <button class="admin-btn-outline" @click="doAddBadge" :disabled="!selectedBadgeId" style="color: #4ade80; border-color: #4ade80;"> Выдать бейдж </button>
          </div>
        </div>
      </div>

      <!-- Ожидания матча -->
      <div class="admin-card">
        <h3>⏳ Ожидает матча ({{ user.waitingLobbies.length }})</h3>
        <div v-if="!user.waitingLobbies.length" class="admin-empty">Нет активных ожиданий</div>
        <table v-else class="admin-table">
          <thead><tr><th>ID</th><th>Квест</th><th>Создан</th></tr></thead>
          <tbody>
            <tr v-for="l in user.waitingLobbies" :key="l.id">
              <td>#{{ l.id }}</td>
              <td>{{ l.template.title }}</td>
              <td>{{ formatDate(l.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- История матчей -->
      <div class="admin-card">
        <h3>🤝 История матчей ({{ allLobbies.length }})</h3>
        <div v-if="!allLobbies.length" class="admin-empty">Нет матчей</div>
        <table v-else class="admin-table">
          <thead><tr><th>ID</th><th>Квест</th><th>Роль</th><th>Партнёр</th><th>Статус</th><th>Создан</th></tr></thead>
          <tbody>
            <tr
              v-for="l in allLobbies"
              :key="l.id"
              class="admin-table__row"
              @click="$router.push(`/admin/matches/${l.id}`)"
            >
              <td>#{{ l.id }}</td>
              <td>{{ l.template.title }}</td>
              <td>{{ l.role }}</td>
              <td>{{ l.partner?.firstName ?? '—' }}</td>
              <td><span :class="statusClass(l.status)">{{ l.status }}</span></td>
              <td>{{ formatDate(l.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { API_URL } from '../../config';
import { adminFetch } from '../../utils/adminFetch';
import { BADGES, getBadge } from '../../utils/badges';

const route = useRoute();
const router = useRouter();
const user = ref<any>(null);
const loading = ref(true);
const banDays = ref(30);

const allLobbies = computed(() => {
  if (!user.value) return [];
  const hosted = (user.value.hostedLobbies ?? []).map((l: any) => ({ ...l, role: 'Хост', partner: l.participant }));
  const joined = (user.value.joinedLobbies ?? []).map((l: any) => ({ ...l, role: 'Участник', partner: l.host }));
  return [...hosted, ...joined].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
});

async function load() {
  const res = await adminFetch(`${API_URL}/admin/users/${route.params.id}`);
  user.value = await res.json();
  loading.value = false;
}

const selectedBadgeId = ref('');
const availableBadges = computed(() => {
  const userBadgeIds = user.value?.achievements?.map((a: any) => a.badgeId) || [];
  const res: Record<string, any> = {};
  for (const [id, badge] of Object.entries(BADGES)) {
    if (!userBadgeIds.includes(id)) {
      res[id] = badge;
    }
  }
  return res;
});

async function doAddBadge() {
  if (!selectedBadgeId.value) return;
  const res = await adminFetch(`${API_URL}/admin/users/${route.params.id}/achievements`, {
    method: 'POST',
    body: JSON.stringify({ badgeId: selectedBadgeId.value })
  });
  const data = await res.json();
  if (data.success) {
    selectedBadgeId.value = '';
    await load();
  } else {
    alert(data.message || 'Ошибка');
  }
}

async function doRemoveBadge(badgeId: string) {
  if (!confirm('Забрать достижение?')) return;
  await adminFetch(`${API_URL}/admin/users/${route.params.id}/achievements/${badgeId}`, {
    method: 'DELETE'
  });
  await load();
}

async function doVerify() {
  if (!confirm('Подтвердить верификацию? Видео будет удалено с диска.')) return;
  await adminFetch(`${API_URL}/admin/users/${route.params.id}/verify`, { method: 'PATCH' });
  await load();
}

async function doRejectVideo() {
  if (!confirm('Отклонить видео? Файл будет удален.')) return;
  await adminFetch(`${API_URL}/admin/users/${route.params.id}/reject-video`, { method: 'PATCH' });
  await load();
}

async function doBan() {
  await adminFetch(`${API_URL}/admin/users/${route.params.id}/ban`, {
    method: 'PATCH',
    body: JSON.stringify({ days: banDays.value }),
  });
  await load();
}

async function doUnban() {
  await adminFetch(`${API_URL}/admin/users/${route.params.id}/ban`, {
    method: 'PATCH',
    body: JSON.stringify({ days: 0 }),
  });
  await load();
}

async function doDelete() {
  if (!confirm('Удалить аккаунт и все связанные данные? Это нельзя отменить.')) return;
  await adminFetch(`${API_URL}/admin/users/${route.params.id}`, { method: 'DELETE' });
  router.push('/admin/users');
}

function reputationClass(rep: number) {
  if (rep >= 4) return 'rep rep-good';
  if (rep >= 2.5) return 'rep rep-mid';
  return 'rep rep-bad';
}

function statusClass(s: string) {
  const m: Record<string, string> = {
    MATCHED: 'status-badge status-active',
    COMPLETED: 'status-badge status-active',
    WAITING: 'status-badge status-waiting',
    EXPIRED: 'status-badge status-banned',
    CANCELLED: 'status-badge status-banned',
    FAILED: 'status-badge status-banned',
  };
  return m[s] ?? 'status-badge';
}

function formatDate(d: string) {
  return new Date(d).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

onMounted(load);
</script>

<style scoped>
@import '../../assets/admin-common.css';
.detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
.detail-row { display: flex; justify-content: space-between; align-items: flex-start; padding: 8px 0; border-bottom: 1px solid #1e2130; font-size: 0.9rem; gap: 12px; }
.detail-row span { color: #6b7280; flex-shrink: 0; }
.action-group { display: flex; flex-direction: column; gap: 10px; }
.ban-row { display: flex; gap: 8px; }
.admin-input {
  flex: 1; background: #0f1117; border: 1px solid #2a2d3a; border-radius: 8px;
  padding: 8px 12px; color: #fff; font-size: 0.9rem; outline: none;
}
.admin-btn-outline {
  background: transparent; border: 1px solid #6366f1; color: #818cf8;
  border-radius: 8px; padding: 8px 14px; cursor: pointer; font-size: 0.875rem; font-weight: 600;
  transition: background 0.15s;
}
.admin-btn-outline:hover { background: rgba(99,102,241,0.1); }
.admin-btn-outline:disabled { opacity: 0.5; pointer-events: none; }
.divider { border: none; border-top: 1px solid #2a2d3a; margin: 8px 0; }
.admin-verified-badge { color: #4ade80; font-size: 0.875rem; font-weight: 600; padding: 8px 0; }
.admin-badge-chip {
  background: #1e2130; padding: 4px 10px; border-radius: 12px; font-size: 0.85rem; font-weight: 600;
  display: flex; align-items: center; border: 1px solid #2a2d3a; color: #fff;
}
.remove-badge-btn { margin-left: 6px; background: none; border: none; color: #ef4444; cursor: pointer; font-size: 1rem; padding: 0 4px; font-weight: bold; }
.remove-badge-btn:hover { color: #dc2626; }
</style>
