<template>
  <div class="admin-partners">

    <div class="page-header">
      <div>
        <h1 class="page-title">🤝 Партнёрские квесты</h1>
        <p class="page-subtitle">Спонсорские карточки — каждый 5-й в ленте при бюджете > 0</p>
      </div>
    </div>

    <!-- Статы -->
    <div class="stats-row" v-if="!loading">
      <span class="stat-chip">Активных: {{ quests.filter(q => q.sponsored && q.sponsorBudget > 0).length }}</span>
      <span class="stat-chip">Закончились: {{ quests.filter(q => q.sponsored && q.sponsorBudget === 0).length }}</span>
      <span class="stat-chip">Всего спонсорских: {{ quests.length }}</span>
    </div>

    <div v-if="loading" class="loading-state">Загрузка...</div>

    <div v-else-if="!quests.length" class="empty-state">
      <p>Нет партнёрских квестов. Отметьте обычные квесты как «Спонсорские» ниже.</p>
      <button class="btn-admin btn-admin--secondary" @click="searchAll = ' '; loadAllQuests()">
        📋 Показать все квесты
      </button>
    </div>

    <!-- Таблица партнёрских квестов -->
    <div v-else class="partners-grid">
      <div v-for="q in quests" :key="q.id" class="partner-card" :class="{ 'partner-card--inactive': q.sponsorBudget === 0 }">
        <div class="partner-card__header">
          <div class="partner-card__title">{{ q.title }}</div>
          <span class="badge-sponsored" :class="q.sponsorBudget > 0 ? 'active' : 'ended'">
            {{ q.sponsorBudget > 0 ? '🟢 Активен' : '🔴 Бюджет 0' }}
          </span>
        </div>

        <div class="partner-fields">
          <div class="field-row">
            <label>Партнёр</label>
            <input v-model="q.sponsorName" class="admin-input" placeholder="Название компании" />
          </div>
          <div class="field-row">
            <label>Логотип (URL)</label>
            <input v-model="q.sponsorLogo" class="admin-input" placeholder="https://..." />
          </div>
          <div class="field-row">
            <label>Бюджет показов</label>
            <input v-model.number="q.sponsorBudget" type="number" min="0" class="admin-input" />
          </div>
        </div>

        <div class="partner-card__actions">
          <button class="btn-admin btn-admin--primary btn-sm" @click="savePartner(q)" :disabled="saving === q.id">
            {{ saving === q.id ? 'Сохранение...' : '💾 Сохранить' }}
          </button>
          <button class="btn-admin btn-admin--danger btn-sm" @click="removePartner(q)">
            Убрать партнёра
          </button>
        </div>
      </div>
    </div>

    <!-- Блок «Добавить партнёра» — все квесты -->
    <div style="margin-top: 32px">
      <h3 style="color:#e5e7eb;margin-bottom:16px">➕ Назначить квест партнёрским</h3>
      <div class="filters-row">
        <input v-model="searchAll" class="admin-input search-input" placeholder="Поиск по названию..." @input="loadAllQuests" />
      </div>

      <div v-if="loadingAll" style="color:#9ca3af;margin-top:12px">Загрузка...</div>
      <div v-else class="all-quests-list">
        <div
          v-for="q in allQuests"
          :key="q.id"
          class="all-quest-row"
          @click="makeSponsor(q)"
        >
          <span class="all-quest-title">{{ q.title }}</span>
          <span class="all-quest-cat">{{ q.category }} / {{ q.subcategory }}</span>
          <span class="add-sponsor-btn">+ Партнёр</span>
        </div>
        <div v-if="!allQuests.length && searchAll" style="color:#9ca3af;padding:12px">Ничего не найдено</div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { API_URL } from '../../config';
import { adminFetch } from '../../utils/adminFetch';
import { useToast } from '../../composables/useToast';

const { success: toastSuccess, error: toastError } = useToast();

const loading = ref(true);
const loadingAll = ref(false);
const saving = ref<string | null>(null);
const quests = ref<any[]>([]);
const allQuests = ref<any[]>([]);
const searchAll = ref('');

async function loadPartners() {
  loading.value = true;
  try {
    const res = await adminFetch(`${API_URL}/admin/quests?limit=200`);
    const data = await res.json();
    quests.value = (data.quests || []).filter((q: any) => q.sponsored);
  } catch {
    toastError('Не удалось загрузить партнёров');
  } finally {
    loading.value = false;
  }
}

async function loadAllQuests() {
  if (!searchAll.value.trim()) {
    allQuests.value = [];
    return;
  }
  loadingAll.value = true;
  try {
    const res = await adminFetch(`${API_URL}/admin/quests?search=${encodeURIComponent(searchAll.value)}&limit=20`);
    const data = await res.json();
    allQuests.value = (data.quests || []).filter((q: any) => !q.sponsored);
  } catch {
    toastError('Ошибка поиска');
  } finally {
    loadingAll.value = false;
  }
}

async function savePartner(q: any) {
  saving.value = q.id;
  try {
    const res = await adminFetch(`${API_URL}/admin/quests/${q.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        sponsored: true,
        sponsorName: q.sponsorName || '',
        sponsorLogo: q.sponsorLogo || '',
        sponsorBudget: q.sponsorBudget ?? 0,
      }),
    });
    if (!res.ok) throw new Error();
    toastSuccess('Партнёр сохранён');
  } catch {
    toastError('Ошибка сохранения');
  } finally {
    saving.value = null;
  }
}

async function removePartner(q: any) {
  try {
    await adminFetch(`${API_URL}/admin/quests/${q.id}`, {
      method: 'PUT',
      body: JSON.stringify({ sponsored: false, sponsorName: '', sponsorLogo: '', sponsorBudget: 0 }),
    });
    quests.value = quests.value.filter(x => x.id !== q.id);
    toastSuccess('Партнёр убран');
  } catch {
    toastError('Ошибка');
  }
}

async function makeSponsor(q: any) {
  q.sponsored = true;
  q.sponsorBudget = q.sponsorBudget || 100;
  allQuests.value = allQuests.value.filter(x => x.id !== q.id);
  quests.value.push(q);
  await savePartner(q);
}

onMounted(loadPartners);
</script>

<style scoped>
.admin-partners { padding: 0 0 40px; }

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}
.page-title { font-size: 1.5rem; font-weight: 700; color: #fff; margin: 0 0 4px; }
.page-subtitle { font-size: 0.85rem; color: #9ca3af; margin: 0; }

.stats-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
.stat-chip {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 20px;
  padding: 4px 12px;
  font-size: 0.8rem;
  color: #d1d5db;
}

.empty-state { text-align: center; padding: 40px; color: #9ca3af; }

.partners-grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); }

.partner-card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 12px;
  padding: 16px;
  transition: border-color 0.2s;
}
.partner-card:hover { border-color: rgba(124,58,237,0.4); }
.partner-card--inactive { opacity: 0.6; }

.partner-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}
.partner-card__title { font-weight: 600; color: #e5e7eb; font-size: 0.95rem; }

.badge-sponsored {
  font-size: 0.75rem;
  padding: 3px 10px;
  border-radius: 100px;
  font-weight: 600;
}
.badge-sponsored.active { background: rgba(34,197,94,0.15); color: #4ade80; }
.badge-sponsored.ended { background: rgba(239,68,68,0.15); color: #f87171; }

.partner-fields { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; }
.field-row { display: flex; flex-direction: column; gap: 4px; }
.field-row label { font-size: 0.75rem; color: #9ca3af; }

.partner-card__actions { display: flex; gap: 8px; }
.btn-sm { padding: 6px 14px; font-size: 0.8rem; }

.btn-admin { padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-weight: 600; font-size: 0.875rem; transition: all 0.15s; }
.btn-admin--primary { background: rgba(124,58,237,0.2); color: #a78bfa; border: 1px solid rgba(124,58,237,0.3); }
.btn-admin--primary:hover { background: rgba(124,58,237,0.35); }
.btn-admin--secondary { background: rgba(255,255,255,0.06); color: #d1d5db; border: 1px solid rgba(255,255,255,0.1); }
.btn-admin--danger { background: rgba(239,68,68,0.1); color: #f87171; border: 1px solid rgba(239,68,68,0.2); }
.btn-admin--danger:hover { background: rgba(239,68,68,0.2); }

.filters-row { display: flex; gap: 12px; margin-bottom: 12px; }
.search-input { max-width: 360px; }

.all-quests-list { display: flex; flex-direction: column; gap: 4px; }
.all-quest-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}
.all-quest-row:hover { background: rgba(124,58,237,0.1); border-color: rgba(124,58,237,0.3); }
.all-quest-title { flex: 1; color: #e5e7eb; font-size: 0.875rem; }
.all-quest-cat { font-size: 0.75rem; color: #6b7280; }
.add-sponsor-btn { font-size: 0.75rem; color: #a78bfa; font-weight: 600; }

.loading-state { color: #9ca3af; padding: 20px; }
</style>
