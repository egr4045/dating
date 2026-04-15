<template>
  <div class="admin-partners">

    <!-- Заголовок -->
    <div class="page-header">
      <div>
        <h1 class="page-title">🤝 Партнёры</h1>
        <p class="page-subtitle">Спонсорские события — вставляются каждым 5-м в ленту</p>
      </div>
      <button class="btn-primary" @click="openNewPartner">+ Новый партнёр</button>
    </div>

    <!-- Статы -->
    <div class="stats-row" v-if="!loading">
      <span class="stat-chip">Партнёров: {{ partners.length }}</span>
      <span class="stat-chip">Активных событий: {{ totalActiveQuests }}</span>
      <span class="stat-chip">Закончился бюджет: {{ totalEmptyBudget }}</span>
    </div>

    <div v-if="loading" class="loading-state">Загрузка...</div>

    <!-- Нет партнёров -->
    <div v-else-if="!partners.length" class="empty-state">
      <div class="empty-icon">🤝</div>
      <p>Партнёров пока нет</p>
      <button class="btn-primary" @click="openNewPartner">Добавить первого партнёра</button>
    </div>

    <!-- Карточки партнёров -->
    <div v-else class="partners-list">
      <div v-for="partner in partners" :key="partner.name" class="partner-card">

        <!-- Шапка партнёра -->
        <div class="partner-head">
          <div class="partner-identity">
            <img v-if="partner.logo" :src="partner.logo" class="partner-logo" @error="(e: any) => e.target.style.display='none'" />
            <div v-else class="partner-logo-placeholder">🏢</div>
            <div>
              <div class="partner-name">{{ partner.name }}</div>
              <div class="partner-meta">{{ partner.quests.length }} {{ plural(partner.quests.length, 'событие', 'события', 'событий') }}</div>
            </div>
          </div>
          <div class="partner-head-actions">
            <button class="btn-ghost btn-sm" @click="openEditPartner(partner)">✏️ Изменить</button>
            <button class="btn-add btn-sm" @click="openAddQuest(partner)">+ Добавить событие</button>
          </div>
        </div>

        <!-- Список квестов партнёра -->
        <div class="quests-table">
          <div class="quests-table-head">
            <span>Событие</span>
            <span>Бюджет показов</span>
            <span>Статус</span>
            <span></span>
          </div>
          <div v-for="q in partner.quests" :key="q.id" class="quest-row">
            <div class="quest-info">
              <img v-if="q.imageUrl" :src="q.imageUrl" class="quest-thumb" @error="(e: any) => e.target.style.display='none'" />
              <div>
                <div class="quest-title">{{ q.title }}</div>
                <div class="quest-sub">{{ q.category }} · {{ q.subcategory }}</div>
              </div>
            </div>
            <div class="budget-cell">
              <input
                v-model.number="q.sponsorBudget"
                type="number" min="0"
                class="budget-input"
                @change="saveQuestBudget(q)"
              />
              <span class="budget-unit">показов</span>
            </div>
            <div>
              <span class="status-badge" :class="q.sponsorBudget > 0 ? 'active' : 'ended'">
                {{ q.sponsorBudget > 0 ? '🟢 Активен' : '🔴 Бюджет 0' }}
              </span>
            </div>
            <div class="quest-actions">
              <button class="icon-btn" title="Убрать из партнёров" @click="removeQuestFromPartner(q)">✕</button>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- ── Модалка: новый партнёр ──────────────────────────────────────── -->
    <Transition name="modal">
      <div v-if="showNewPartnerModal" class="modal-overlay" @click.self="showNewPartnerModal = false">
        <div class="modal-card">
          <div class="modal-header">
            <h2>{{ editingPartner ? 'Изменить партнёра' : 'Новый партнёр' }}</h2>
            <button class="icon-btn" @click="showNewPartnerModal = false">✕</button>
          </div>
          <div class="modal-body">
            <div class="field">
              <label>Название компании *</label>
              <input v-model="partnerForm.name" class="admin-input" placeholder="Например: Red Bull" />
            </div>
            <div class="field">
              <label>Логотип (URL картинки)</label>
              <input v-model="partnerForm.logo" class="admin-input" placeholder="https://..." />
              <img v-if="partnerForm.logo" :src="partnerForm.logo" class="logo-preview" @error="(e: any) => e.target.style.display='none'" />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn-ghost" @click="showNewPartnerModal = false">Отмена</button>
            <button class="btn-primary" :disabled="!partnerForm.name.trim() || saving" @click="savePartnerMeta">
              {{ saving ? 'Сохранение...' : (editingPartner ? 'Сохранить' : 'Создать и добавить событие') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ── Модалка: добавить квест к партнёру ─────────────────────────── -->
    <Transition name="modal">
      <div v-if="showAddQuestModal" class="modal-overlay" @click.self="showAddQuestModal = false">
        <div class="modal-card modal-card--wide">
          <div class="modal-header">
            <h2>Добавить событие → <span class="accent">{{ targetPartnerName }}</span></h2>
            <button class="icon-btn" @click="showAddQuestModal = false">✕</button>
          </div>
          <div class="modal-body">
            <input
              v-model="questSearch"
              class="admin-input"
              placeholder="Поиск по названию..."
              @input="onQuestSearch"
              autofocus
            />
            <div v-if="loadingQuests" class="search-loading">Поиск...</div>
            <div v-else class="quest-picker">
              <div v-if="!pickerQuests.length && questSearch" class="empty-search">Ничего не найдено</div>
              <div v-else-if="!pickerQuests.length" class="empty-search">Введите название для поиска</div>
              <div
                v-for="q in pickerQuests"
                :key="q.id"
                class="picker-row"
                @click="assignQuestToPartner(q)"
              >
                <img v-if="q.imageUrl" :src="q.imageUrl" class="picker-thumb" @error="(e: any) => e.target.style.display='none'" />
                <div class="picker-info">
                  <div class="picker-title">{{ q.title }}</div>
                  <div class="picker-sub">{{ q.category }} · {{ q.subcategory }}</div>
                </div>
                <span class="picker-add">+ Добавить</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { API_URL } from '../../config';
import { adminFetch } from '../../utils/adminFetch';
import { useToast } from '../../composables/useToast';

const { success: toastOk, error: toastErr } = useToast();

// ── State ────────────────────────────────────────────────────────────────────

const loading    = ref(true);
const saving     = ref(false);
const loadingQuests = ref(false);

// Все спонсорские квесты с бэка
const sponsoredQuests = ref<any[]>([]);

// Группируем по sponsorName → массив партнёров
const partners = computed(() => {
  const map = new Map<string, { name: string; logo: string; quests: any[] }>();
  for (const q of sponsoredQuests.value) {
    const key = q.sponsorName || '(без названия)';
    if (!map.has(key)) {
      map.set(key, { name: key, logo: q.sponsorLogo || '', quests: [] });
    }
    map.get(key)!.quests.push(q);
  }
  // Сортируем: у кого есть активный бюджет — наверх
  return [...map.values()].sort((a, b) => {
    const aActive = a.quests.some(q => q.sponsorBudget > 0) ? 1 : 0;
    const bActive = b.quests.some(q => q.sponsorBudget > 0) ? 1 : 0;
    return bActive - aActive;
  });
});

const totalActiveQuests = computed(() =>
  sponsoredQuests.value.filter(q => q.sponsorBudget > 0).length
);
const totalEmptyBudget = computed(() =>
  sponsoredQuests.value.filter(q => q.sponsored && q.sponsorBudget === 0).length
);

// ── Загрузка ─────────────────────────────────────────────────────────────────

async function loadSponsored() {
  loading.value = true;
  try {
    const res = await adminFetch(`${API_URL}/admin/quests?limit=500`);
    const data = await res.json();
    sponsoredQuests.value = (data.quests || []).filter((q: any) => q.sponsored);
  } catch {
    toastErr('Не удалось загрузить партнёров');
  } finally {
    loading.value = false;
  }
}

// ── Новый партнёр / редактирование мета ──────────────────────────────────────

const showNewPartnerModal = ref(false);
const editingPartner = ref<{ name: string; logo: string; quests: any[] } | null>(null);
const partnerForm = ref({ name: '', logo: '' });

function openNewPartner() {
  editingPartner.value = null;
  partnerForm.value = { name: '', logo: '' };
  showNewPartnerModal.value = true;
}

function openEditPartner(partner: { name: string; logo: string; quests: any[] }) {
  editingPartner.value = partner;
  partnerForm.value = { name: partner.name, logo: partner.logo };
  showNewPartnerModal.value = true;
}

async function savePartnerMeta() {
  if (!partnerForm.value.name.trim()) return;
  saving.value = true;
  try {
    if (editingPartner.value) {
      // Обновляем sponsorName/sponsorLogo у всех квестов этого партнёра
      const results = await Promise.allSettled(
        editingPartner.value.quests.map(q =>
          adminFetch(`${API_URL}/admin/quests/${q.id}`, {
            method: 'PUT',
            body: JSON.stringify({
              sponsorName: partnerForm.value.name.trim(),
              sponsorLogo: partnerForm.value.logo.trim() || '',
            }),
          })
        )
      );
      const failed = results.filter(r => r.status === 'rejected').length;
      toastOk(failed > 0 ? `Обновлено с ошибками (${failed} из ${results.length} не сохранились)` : 'Партнёр обновлён');
      showNewPartnerModal.value = false;
      await loadSponsored();
    } else {
      // Новый партнёр — сразу открываем выбор квеста
      showNewPartnerModal.value = false;
      targetPartnerName.value = partnerForm.value.name.trim();
      targetPartnerLogo.value = partnerForm.value.logo.trim();
      questSearch.value = '';
      pickerQuests.value = [];
      showAddQuestModal.value = true;
    }
  } catch {
    toastErr('Ошибка сохранения');
  } finally {
    saving.value = false;
  }
}

// ── Добавить квест к партнёру ─────────────────────────────────────────────────

const showAddQuestModal = ref(false);
const targetPartnerName = ref('');
const targetPartnerLogo = ref('');
const questSearch = ref('');
const pickerQuests = ref<any[]>([]);
let searchTimer: ReturnType<typeof setTimeout> | null = null;

function openAddQuest(partner: { name: string; logo: string; quests: any[] }) {
  targetPartnerName.value = partner.name;
  targetPartnerLogo.value = partner.logo;
  questSearch.value = '';
  pickerQuests.value = [];
  showAddQuestModal.value = true;
}

function onQuestSearch() {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(fetchPickerQuests, 300);
}

async function fetchPickerQuests() {
  const q = questSearch.value.trim();
  if (!q) { pickerQuests.value = []; return; }
  loadingQuests.value = true;
  try {
    const res = await adminFetch(`${API_URL}/admin/quests?search=${encodeURIComponent(q)}&limit=30`);
    const data = await res.json();
    // Исключаем уже спонсорские с этим же партнёром
    const partnerQuestIds = new Set(
      (partners.value.find(p => p.name === targetPartnerName.value)?.quests || []).map((x: any) => x.id)
    );
    pickerQuests.value = (data.quests || []).filter((x: any) => !partnerQuestIds.has(x.id));
  } catch {
    toastErr('Ошибка поиска');
  } finally {
    loadingQuests.value = false;
  }
}

async function assignQuestToPartner(q: any) {
  try {
    const res = await adminFetch(`${API_URL}/admin/quests/${q.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        sponsored: true,
        sponsorName: targetPartnerName.value,
        sponsorLogo: targetPartnerLogo.value,
        sponsorBudget: q.sponsorBudget || 100,
      }),
    });
    if (!res.ok) throw new Error();
    toastOk(`«${q.title}» добавлено к ${targetPartnerName.value}`);
    // Убираем из пикера
    pickerQuests.value = pickerQuests.value.filter((x: any) => x.id !== q.id);
    // Добавляем локально без перезагрузки
    q.sponsored = true;
    q.sponsorName = targetPartnerName.value;
    q.sponsorLogo = targetPartnerLogo.value;
    q.sponsorBudget = q.sponsorBudget || 100;
    sponsoredQuests.value.push({ ...q });
  } catch {
    toastErr('Не удалось добавить событие');
  }
}

// ── Сохранить бюджет квеста ───────────────────────────────────────────────────

async function saveQuestBudget(q: any) {
  try {
    const res = await adminFetch(`${API_URL}/admin/quests/${q.id}`, {
      method: 'PUT',
      body: JSON.stringify({ sponsorBudget: q.sponsorBudget ?? 0 }),
    });
    if (!res.ok) throw new Error();
    toastOk('Бюджет обновлён');
  } catch {
    toastErr('Ошибка сохранения бюджета');
  }
}

// ── Убрать квест из партнёров ─────────────────────────────────────────────────

async function removeQuestFromPartner(q: any) {
  try {
    const res = await adminFetch(`${API_URL}/admin/quests/${q.id}`, {
      method: 'PUT',
      body: JSON.stringify({ sponsored: false, sponsorName: '', sponsorLogo: '', sponsorBudget: 0 }),
    });
    if (!res.ok) throw new Error();
    sponsoredQuests.value = sponsoredQuests.value.filter((x: any) => x.id !== q.id);
    toastOk('Событие убрано из партнёров');
  } catch {
    toastErr('Ошибка');
  }
}

// ── Утилиты ───────────────────────────────────────────────────────────────────

function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

onMounted(loadSponsored);
</script>

<style scoped>
.admin-partners { display: flex; flex-direction: column; gap: 24px; }

/* Header */
.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-title { font-size: 1.5rem; font-weight: 800; color: #fff; margin: 0 0 4px; }
.page-subtitle { font-size: 0.85rem; color: #6b7280; margin: 0; }

/* Stats */
.stats-row { display: flex; gap: 8px; flex-wrap: wrap; }
.stat-chip {
  padding: 4px 12px; background: #1a1d27; border: 1px solid #2a2d3a;
  border-radius: 100px; font-size: 0.8rem; color: #9ca3af;
}

/* Empty / loading */
.loading-state { color: #9ca3af; padding: 40px; text-align: center; }
.empty-state { text-align: center; padding: 60px 20px; color: #9ca3af; display: flex; flex-direction: column; align-items: center; gap: 12px; }
.empty-icon { font-size: 3rem; }

/* Partners list */
.partners-list { display: flex; flex-direction: column; gap: 16px; }

/* Partner card */
.partner-card {
  background: #1a1d27; border: 1px solid #2a2d3a; border-radius: 16px;
  overflow: hidden;
}
.partner-head {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 16px 20px; border-bottom: 1px solid #2a2d3a;
  background: #151720;
}
.partner-identity { display: flex; align-items: center; gap: 12px; }
.partner-logo {
  width: 44px; height: 44px; border-radius: 10px; object-fit: contain;
  background: #0f1117; border: 1px solid #2a2d3a; padding: 4px;
}
.partner-logo-placeholder {
  width: 44px; height: 44px; border-radius: 10px; background: #252836;
  border: 1px solid #2a2d3a; display: flex; align-items: center; justify-content: center;
  font-size: 1.4rem;
}
.partner-name { font-weight: 700; color: #e5e7eb; font-size: 1rem; }
.partner-meta { font-size: 0.8rem; color: #6b7280; margin-top: 2px; }
.partner-head-actions { display: flex; gap: 8px; flex-shrink: 0; }

/* Quests table */
.quests-table { padding: 0; }
.quests-table-head {
  display: grid; grid-template-columns: 1fr 180px 130px 40px;
  padding: 8px 20px; gap: 12px;
  font-size: 0.72rem; font-weight: 700; color: #4b5563;
  text-transform: uppercase; letter-spacing: 0.05em;
  border-bottom: 1px solid #1e2130;
}
.quest-row {
  display: grid; grid-template-columns: 1fr 180px 130px 40px;
  padding: 12px 20px; gap: 12px; align-items: center;
  border-bottom: 1px solid #1e2130;
  transition: background 0.15s;
}
.quest-row:last-child { border-bottom: none; }
.quest-row:hover { background: rgba(255,255,255,0.02); }

.quest-info { display: flex; align-items: center; gap: 10px; }
.quest-thumb {
  width: 36px; height: 36px; border-radius: 8px; object-fit: cover;
  background: #0f1117; flex-shrink: 0;
}
.quest-title { font-weight: 600; color: #e5e7eb; font-size: 0.875rem; }
.quest-sub { font-size: 0.75rem; color: #6b7280; margin-top: 1px; }

.budget-cell { display: flex; align-items: center; gap: 6px; }
.budget-input {
  width: 80px; background: #0f1117; border: 1px solid #2a2d3a; border-radius: 8px;
  color: #e5e7eb; font-size: 0.875rem; padding: 6px 10px;
  font-family: inherit; transition: border-color 0.15s;
}
.budget-input:focus { outline: none; border-color: #6366f1; }
.budget-unit { font-size: 0.75rem; color: #4b5563; }

.status-badge {
  font-size: 0.75rem; padding: 3px 10px; border-radius: 100px; font-weight: 600;
  white-space: nowrap;
}
.status-badge.active { background: rgba(34,197,94,0.12); color: #4ade80; }
.status-badge.ended  { background: rgba(239,68,68,0.12); color: #f87171; }

.quest-actions { display: flex; justify-content: flex-end; }

/* Buttons */
.btn-primary {
  padding: 9px 18px; background: #6366f1; color: #fff; border: none;
  border-radius: 10px; font-weight: 700; font-size: 0.875rem; cursor: pointer;
  transition: background 0.15s; font-family: inherit;
}
.btn-primary:hover:not(:disabled) { background: #4f46e5; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-ghost {
  padding: 9px 18px; background: #252836; color: #9ca3af; border: none;
  border-radius: 10px; font-weight: 700; font-size: 0.875rem; cursor: pointer;
  transition: all 0.15s; font-family: inherit;
}
.btn-ghost:hover { background: #2e3347; color: #e5e7eb; }

.btn-add {
  padding: 7px 14px; background: rgba(99,102,241,0.12); color: #818cf8;
  border: 1px solid rgba(99,102,241,0.3); border-radius: 8px;
  font-weight: 700; font-size: 0.8rem; cursor: pointer;
  transition: all 0.15s; font-family: inherit;
}
.btn-add:hover { background: rgba(99,102,241,0.25); }

.btn-sm { padding: 6px 12px !important; font-size: 0.8rem !important; }

.icon-btn {
  width: 30px; height: 30px; border-radius: 7px; border: 1px solid #2a2d3a;
  background: transparent; color: #6b7280; cursor: pointer; font-size: 0.85rem;
  display: flex; align-items: center; justify-content: center; transition: all 0.15s;
  font-family: inherit;
}
.icon-btn:hover { background: rgba(239,68,68,0.1); border-color: #ef4444; color: #f87171; }

/* Modal */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(4px);
  z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 24px;
}
.modal-card {
  background: #1a1d27; border: 1px solid #2a2d3a; border-radius: 16px;
  width: 100%; max-width: 480px; max-height: 88dvh;
  display: flex; flex-direction: column; box-shadow: 0 25px 50px rgba(0,0,0,0.5);
}
.modal-card--wide { max-width: 560px; }
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 18px 22px; border-bottom: 1px solid #2a2d3a; flex-shrink: 0;
}
.modal-header h2 { margin: 0; font-size: 1rem; color: #fff; font-weight: 700; }
.accent { color: #818cf8; }
.modal-body { padding: 20px 22px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 14px; }
.modal-footer {
  display: flex; gap: 10px; justify-content: flex-end;
  padding: 14px 22px; border-top: 1px solid #2a2d3a; flex-shrink: 0;
}

/* Form fields */
.field { display: flex; flex-direction: column; gap: 6px; }
.field label { font-size: 0.78rem; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.04em; }
.admin-input {
  background: #0f1117; border: 1px solid #2a2d3a; border-radius: 8px;
  color: #e5e7eb; font-size: 0.875rem; padding: 9px 12px;
  font-family: inherit; transition: border-color 0.15s; width: 100%; box-sizing: border-box;
}
.admin-input:focus { outline: none; border-color: #6366f1; }
.logo-preview {
  margin-top: 6px; max-height: 60px; border-radius: 8px;
  border: 1px solid #2a2d3a; object-fit: contain; background: #0f1117; padding: 4px;
}

/* Quest picker */
.search-loading { color: #9ca3af; font-size: 0.875rem; padding: 12px 0; }
.quest-picker { display: flex; flex-direction: column; gap: 4px; margin-top: 4px; }
.empty-search { color: #6b7280; font-size: 0.875rem; padding: 20px; text-align: center; }
.picker-row {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; background: #151720; border: 1px solid #2a2d3a;
  border-radius: 10px; cursor: pointer; transition: all 0.15s;
}
.picker-row:hover { border-color: #6366f1; background: rgba(99,102,241,0.06); }
.picker-thumb {
  width: 40px; height: 40px; border-radius: 8px; object-fit: cover;
  background: #252836; flex-shrink: 0;
}
.picker-info { flex: 1; min-width: 0; }
.picker-title { font-weight: 600; color: #e5e7eb; font-size: 0.875rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.picker-sub { font-size: 0.75rem; color: #6b7280; margin-top: 1px; }
.picker-add { font-size: 0.78rem; color: #818cf8; font-weight: 700; flex-shrink: 0; }

/* Transitions */
.modal-enter-active, .modal-leave-active { transition: opacity 0.2s; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
