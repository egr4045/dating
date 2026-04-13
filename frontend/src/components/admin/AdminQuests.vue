<template>
  <div class="admin-quests">

    <!-- Заголовок + кнопка добавления -->
    <div class="page-header">
      <div>
        <h1 class="page-title">🃏 Карточки событий</h1>
        <p class="page-subtitle">Шаблоны квестов — то, что видят пользователи в ленте</p>
      </div>
      <button class="btn-admin btn-admin--primary" @click="openCreate">+ Добавить карточку</button>
    </div>

    <!-- Фильтры -->
    <div class="filters-row">
      <input
        v-model="search"
        @input="onSearch"
        class="admin-input search-input"
        placeholder="Поиск по названию, подкатегории..."
      />
      <div class="category-filter">
        <button
          v-for="cat in categoryOptions"
          :key="cat.value"
          class="cat-btn"
          :class="{ active: filterCategory === cat.value }"
          @click="setCategory(cat.value)"
        >{{ cat.label }}</button>
      </div>
    </div>

    <!-- Статистика -->
    <div class="stats-row" v-if="!loading">
      <span class="stat-chip">Всего: {{ total }}</span>
      <span class="stat-chip">Offline: {{ quests.filter(q => q.category === 'offline').length }}</span>
      <span class="stat-chip">Игры: {{ quests.filter(q => q.category === 'games').length }}</span>
      <span class="stat-chip">Онлайн: {{ quests.filter(q => q.category === 'online').length }}</span>
    </div>

    <!-- Таблица -->
    <div class="admin-table-wrap">
      <table class="admin-table">
        <thead>
          <tr>
            <th class="sortable-th" @click="sortBy('id')">ID {{ sortIcon('id') }}</th>
            <th class="sortable-th" @click="sortBy('title')">Название {{ sortIcon('title') }}</th>
            <th class="sortable-th" @click="sortBy('category')">Категория {{ sortIcon('category') }}</th>
            <th>Подкатегория</th>
            <th>Цена</th>
            <th class="sortable-th" @click="sortBy('lobbies')">Лобби {{ sortIcon('lobbies') }}</th>
            <th style="text-align:right">Действия</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="7" class="loading-cell">Загрузка...</td>
          </tr>
          <tr v-else-if="quests.length === 0">
            <td colspan="7" class="empty-cell">Карточки не найдены</td>
          </tr>
          <tr v-for="q in quests" :key="q.id" class="quest-row">
            <td class="id-cell">{{ q.id }}</td>
            <td>
              <div class="quest-title">{{ q.title }}</div>
              <div class="quest-desc">{{ (q.description || '').slice(0, 60) }}{{ (q.description || '').length > 60 ? '…' : '' }}</div>
            </td>
            <td>
              <span class="cat-badge" :class="'cat-' + q.category">{{ catLabel(q.category) }}</span>
            </td>
            <td class="text-muted">{{ q.subcategory }}</td>
            <td class="text-muted">{{ q.price || '—' }}</td>
            <td>
              <span class="lobby-count" :class="{ 'has-lobbies': q._count?.lobbies > 0 }">
                {{ q._count?.lobbies ?? 0 }}
              </span>
            </td>
            <td>
              <div class="action-btns">
                <button class="btn-icon" title="Редактировать" @click="openEdit(q)">✏️</button>
                <button class="btn-icon btn-icon--danger" title="Удалить" @click="confirmDelete(q)">🗑️</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Пагинация -->
    <div v-if="totalPages > 1" class="pagination">
      <button class="page-btn" :disabled="page <= 1" @click="goPage(page - 1)">←</button>
      <span class="page-info">{{ page }} / {{ totalPages }}</span>
      <button class="page-btn" :disabled="page >= totalPages" @click="goPage(page + 1)">→</button>
    </div>

    <!-- Тост -->
    <Transition name="toast">
      <div v-if="toast" class="admin-toast" :class="'admin-toast--' + toast.type">{{ toast.message }}</div>
    </Transition>

    <!-- Модалка: создание / редактирование -->
    <Transition name="modal">
      <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
        <div class="modal-card">
          <div class="modal-header">
            <h2>{{ editMode ? 'Редактировать карточку' : 'Добавить карточку' }}</h2>
            <button class="btn-icon" @click="closeModal">✕</button>
          </div>

          <div class="modal-body">
            <div class="form-grid">
              <!-- ID (только при создании) -->
              <div class="field" v-if="!editMode">
                <label class="field-label">ID <span class="req">*</span></label>
                <input v-model="form.id" class="admin-input" placeholder="hookah, cs2, movie_theatre…" />
                <div class="field-hint">Уникальный ключ, латиница и подчёркивание</div>
              </div>

              <!-- Название -->
              <div class="field">
                <label class="field-label">Название <span class="req">*</span></label>
                <input v-model="form.title" class="admin-input" placeholder="Кальян вдвоём" />
              </div>

              <!-- Описание -->
              <div class="field field--full">
                <label class="field-label">Описание <span class="req">*</span></label>
                <textarea v-model="form.description" class="admin-input admin-textarea" rows="3"
                  placeholder="Уютный вечер с кальяном..." />
              </div>

              <!-- Категория -->
              <div class="field">
                <label class="field-label">Категория <span class="req">*</span></label>
                <select v-model="form.category" class="admin-input admin-select">
                  <option value="offline">🌍 Offline (активности)</option>
                  <option value="games">🎮 Игры</option>
                  <option value="online">📱 Онлайн</option>
                </select>
              </div>

              <!-- Подкатегория -->
              <div class="field">
                <label class="field-label">Подкатегория (ключ интереса) <span class="req">*</span></label>
                <input v-model="form.subcategory" class="admin-input" placeholder="hookah, cs, movie_online…" />
                <div class="field-hint">Совпадает с ключами интересов пользователя</div>
              </div>

              <!-- Цена -->
              <div class="field">
                <label class="field-label">Цена</label>
                <input v-model="form.price" class="admin-input" placeholder="~500₽/чел, бесплатно" />
              </div>

              <!-- Оплата -->
              <div class="field">
                <label class="field-label">Правило оплаты</label>
                <select v-model="form.paymentRule" class="admin-input admin-select">
                  <option value="50/50">50/50</option>
                  <option value="host">Платит хост</option>
                  <option value="guest">Платит гость</option>
                  <option value="free">Бесплатно</option>
                </select>
              </div>

              <!-- Адрес -->
              <div class="field field--full">
                <label class="field-label">Адрес / место</label>
                <input v-model="form.address" class="admin-input" placeholder="ул. Ленина, 10 или онлайн" />
              </div>

              <!-- URL картинки -->
              <div class="field field--full">
                <label class="field-label">URL изображения</label>
                <input v-model="form.imageUrl" class="admin-input" placeholder="https://…" />
                <div v-if="form.imageUrl" class="img-preview">
                  <img :src="form.imageUrl" alt="preview" @error="imgError = true" />
                  <span v-if="imgError" class="img-error">Не удалось загрузить изображение</span>
                </div>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn-admin btn-admin--ghost" @click="closeModal">Отмена</button>
            <button class="btn-admin btn-admin--primary" :disabled="saving" @click="save">
              {{ saving ? 'Сохранение…' : (editMode ? 'Сохранить' : 'Создать') }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Подтверждение удаления -->
    <Transition name="modal">
      <div v-if="deleteTarget" class="modal-overlay" @click.self="deleteTarget = null">
        <div class="modal-card modal-card--sm">
          <div class="modal-header">
            <h2>Удалить карточку?</h2>
            <button class="btn-icon" @click="deleteTarget = null">✕</button>
          </div>
          <div class="modal-body">
            <p>«<strong>{{ deleteTarget.title }}</strong>» (ID: {{ deleteTarget.id }}) будет удалена навсегда.</p>
            <p v-if="deleteTarget._count?.lobbies > 0" class="warn-text">
              ⚠️ У этой карточки {{ deleteTarget._count.lobbies }} лобби. Активные матчи нельзя удалять.
            </p>
          </div>
          <div class="modal-footer">
            <button class="btn-admin btn-admin--ghost" @click="deleteTarget = null">Отмена</button>
            <button class="btn-admin btn-admin--danger" :disabled="deleting" @click="doDelete">
              {{ deleting ? 'Удаление…' : 'Удалить' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { adminFetch } from '../../utils/adminFetch';
import { API_URL } from '../../config';

const ADMIN_URL = API_URL;

// ── State ───────────────────────────────────────────────────────────────────
const quests = ref<any[]>([]);
const total = ref(0);
const loading = ref(true);
const page = ref(1);
const search = ref('');
const filterCategory = ref('all');
const sortField = ref('id');
const sortDir = ref<'asc' | 'desc'>('desc');
let searchDebounce: ReturnType<typeof setTimeout> | null = null;

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / 50)));

function sortBy(field: string) {
  if (sortField.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortField.value = field;
    sortDir.value = 'asc';
  }
  page.value = 1;
  loadQuests();
}

function sortIcon(field: string) {
  if (sortField.value !== field) return '⇅';
  return sortDir.value === 'asc' ? '↑' : '↓';
}

const categoryOptions = [
  { value: 'all',     label: '✨ Все' },
  { value: 'offline', label: '🌍 Offline' },
  { value: 'games',   label: '🎮 Игры' },
  { value: 'online',  label: '📱 Онлайн' },
];

const catLabel = (c: string) => ({ offline: '🌍 Offline', games: '🎮 Игры', online: '📱 Онлайн' })[c] ?? c;

// ── Toast ───────────────────────────────────────────────────────────────────
const toast = ref<{ message: string; type: 'ok' | 'err' } | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | null = null;
function showToast(message: string, type: 'ok' | 'err' = 'ok') {
  if (toastTimer) clearTimeout(toastTimer);
  toast.value = { message, type };
  toastTimer = setTimeout(() => { toast.value = null; }, 3500);
}

// ── Load ────────────────────────────────────────────────────────────────────
async function loadQuests() {
  loading.value = true;
  try {
    const params = new URLSearchParams({
      page: String(page.value),
      limit: '50',
      sort: sortField.value,
      dir: sortDir.value,
      ...(search.value ? { search: search.value } : {}),
      ...(filterCategory.value !== 'all' ? { category: filterCategory.value } : {}),
    });
    const res = await adminFetch(`${ADMIN_URL}/admin/quests?${params}`);
    const data = await res.json();
    quests.value = data.quests;
    total.value = data.total;
  } catch {
    showToast('Ошибка загрузки', 'err');
  } finally {
    loading.value = false;
  }
}

function onSearch() {
  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => { page.value = 1; loadQuests(); }, 350);
}

function setCategory(cat: string) {
  filterCategory.value = cat;
  page.value = 1;
  loadQuests();
}

function goPage(p: number) {
  page.value = p;
  loadQuests();
}

onMounted(loadQuests);

// ── Form modal ──────────────────────────────────────────────────────────────
const showModal = ref(false);
const editMode = ref(false);
const saving = ref(false);
const imgError = ref(false);

const emptyForm = () => ({
  id: '', title: '', description: '',
  category: 'offline', subcategory: '',
  price: '', paymentRule: '50/50',
  address: '', imageUrl: '',
});
const form = ref(emptyForm());
let editId = '';

function openCreate() {
  form.value = emptyForm();
  editId = '';
  editMode.value = false;
  imgError.value = false;
  showModal.value = true;
}

function openEdit(q: any) {
  form.value = {
    id:          q.id,
    title:       q.title,
    description: q.description,
    category:    q.category,
    subcategory: q.subcategory,
    price:       q.price ?? '',
    paymentRule: q.paymentRule ?? '50/50',
    address:     q.address ?? '',
    imageUrl:    q.imageUrl ?? '',
  };
  editId = q.id;
  editMode.value = true;
  imgError.value = false;
  showModal.value = true;
}

function closeModal() { showModal.value = false; }

async function save() {
  const f = form.value;
  if (!editMode.value && !f.id.trim()) return showToast('Укажите ID', 'err');
  if (!f.title.trim())       return showToast('Укажите название', 'err');
  if (!f.description.trim()) return showToast('Укажите описание', 'err');
  if (!f.subcategory.trim()) return showToast('Укажите подкатегорию', 'err');

  saving.value = true;
  try {
    const url = editMode.value
      ? `${ADMIN_URL}/admin/quests/${editId}`
      : `${ADMIN_URL}/admin/quests`;
    const method = editMode.value ? 'PUT' : 'POST';

    const res = await adminFetch(url, {
      method,
      body: JSON.stringify(f),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Ошибка сервера');
    }

    showToast(editMode.value ? 'Карточка обновлена' : 'Карточка создана');
    closeModal();
    loadQuests();
  } catch (e: any) {
    showToast(e.message, 'err');
  } finally {
    saving.value = false;
  }
}

// ── Delete ──────────────────────────────────────────────────────────────────
const deleteTarget = ref<any>(null);
const deleting = ref(false);

function confirmDelete(q: any) { deleteTarget.value = q; }

async function doDelete() {
  if (!deleteTarget.value) return;
  deleting.value = true;
  try {
    const res = await adminFetch(`${ADMIN_URL}/admin/quests/${deleteTarget.value.id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Ошибка удаления');
    }
    showToast('Карточка удалена');
    deleteTarget.value = null;
    loadQuests();
  } catch (e: any) {
    showToast(e.message, 'err');
  } finally {
    deleting.value = false;
  }
}
</script>

<style scoped>
.admin-quests { display: flex; flex-direction: column; gap: 20px; }

/* Header */
.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.page-title  { font-size: 1.5rem; font-weight: 800; color: #fff; margin: 0 0 4px; }
.page-subtitle { font-size: 0.85rem; color: #6b7280; margin: 0; }

/* Filters */
.filters-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.search-input { flex: 1; min-width: 220px; }
.category-filter { display: flex; gap: 6px; flex-wrap: wrap; }
.cat-btn {
  padding: 6px 14px; border-radius: 8px; border: 1px solid #2a2d3a;
  background: #1a1d27; color: #9ca3af; font-size: 0.8rem; font-weight: 600;
  cursor: pointer; transition: all 0.15s; white-space: nowrap;
}
.cat-btn:hover { border-color: #6366f1; color: #818cf8; }
.cat-btn.active { background: rgba(99,102,241,0.15); border-color: #6366f1; color: #818cf8; }

/* Stats */
.stats-row { display: flex; gap: 8px; flex-wrap: wrap; }
.stat-chip {
  padding: 4px 12px; background: #1a1d27; border: 1px solid #2a2d3a;
  border-radius: 100px; font-size: 0.8rem; color: #9ca3af;
}

/* Table */
.admin-table-wrap { background: #1a1d27; border: 1px solid #2a2d3a; border-radius: 12px; overflow: hidden; }
.sortable-th { cursor: pointer; user-select: none; white-space: nowrap; }
.sortable-th:hover { color: #818cf8; }
.admin-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.admin-table th {
  padding: 12px 16px; text-align: left; font-size: 0.75rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280;
  border-bottom: 1px solid #2a2d3a; background: #151720;
}
.admin-table td { padding: 12px 16px; border-bottom: 1px solid #1e2130; vertical-align: middle; }
.quest-row:last-child td { border-bottom: none; }
.quest-row:hover td { background: rgba(255,255,255,0.02); }

.id-cell { font-family: monospace; font-size: 0.8rem; color: #6b7280; max-width: 120px; word-break: break-all; }
.quest-title { font-weight: 700; color: #e5e7eb; margin-bottom: 2px; }
.quest-desc  { font-size: 0.8rem; color: #6b7280; }
.text-muted  { color: #6b7280; }

.cat-badge {
  padding: 3px 10px; border-radius: 100px; font-size: 0.75rem; font-weight: 700;
}
.cat-offline { background: rgba(34,197,94,0.15);  color: #4ade80; }
.cat-games   { background: rgba(99,102,241,0.15); color: #818cf8; }
.cat-online  { background: rgba(251,146,60,0.15); color: #fb923c; }

.lobby-count { font-weight: 700; color: #6b7280; }
.lobby-count.has-lobbies { color: #4ade80; }

.action-btns { display: flex; gap: 6px; justify-content: flex-end; }
.btn-icon {
  width: 32px; height: 32px; border-radius: 8px; border: 1px solid #2a2d3a;
  background: transparent; cursor: pointer; font-size: 1rem; display: flex;
  align-items: center; justify-content: center; transition: all 0.15s;
}
.btn-icon:hover { background: #252836; }
.btn-icon--danger:hover { background: rgba(239,68,68,0.1); border-color: #ef4444; }

.loading-cell, .empty-cell {
  text-align: center; padding: 40px; color: #6b7280; font-size: 0.9rem;
}

/* Pagination */
.pagination { display: flex; align-items: center; gap: 12px; justify-content: center; }
.page-btn {
  width: 36px; height: 36px; border-radius: 8px; border: 1px solid #2a2d3a;
  background: #1a1d27; color: #9ca3af; cursor: pointer; font-size: 1rem;
  transition: all 0.15s;
}
.page-btn:hover:not(:disabled) { border-color: #6366f1; color: #818cf8; }
.page-btn:disabled { opacity: 0.3; cursor: not-allowed; }
.page-info { font-size: 0.875rem; color: #9ca3af; }

/* Modal */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px);
  z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 24px;
}
.modal-card {
  background: #1a1d27; border: 1px solid #2a2d3a; border-radius: 16px;
  width: 100%; max-width: 680px; max-height: 92dvh;
  display: flex; flex-direction: column; box-shadow: 0 25px 50px rgba(0,0,0,0.5);
}
.modal-card--sm { max-width: 420px; }
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 20px 24px; border-bottom: 1px solid #2a2d3a; flex-shrink: 0;
}
.modal-header h2 { margin: 0; font-size: 1.1rem; color: #fff; }
.modal-body { padding: 24px; overflow-y: auto; flex: 1; }
.modal-footer {
  display: flex; gap: 10px; justify-content: flex-end;
  padding: 16px 24px; border-top: 1px solid #2a2d3a; flex-shrink: 0;
}

/* Form */
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.field { display: flex; flex-direction: column; gap: 6px; }
.field--full { grid-column: 1 / -1; }
.field-label { font-size: 0.8rem; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.04em; }
.req { color: #f87171; }
.field-hint { font-size: 0.75rem; color: #4b5563; }
.admin-input {
  background: #0f1117; border: 1px solid #2a2d3a; border-radius: 8px;
  color: #e5e7eb; font-size: 0.875rem; padding: 9px 12px;
  font-family: 'Nunito', system-ui, sans-serif; transition: border-color 0.15s;
  width: 100%; box-sizing: border-box;
}
.admin-input:focus { outline: none; border-color: #6366f1; }
.admin-textarea { resize: vertical; min-height: 80px; }
.admin-select { cursor: pointer; }

.img-preview { margin-top: 8px; }
.img-preview img { max-height: 120px; border-radius: 8px; border: 1px solid #2a2d3a; }
.img-error { font-size: 0.8rem; color: #f87171; }

.warn-text { color: #fbbf24; font-size: 0.875rem; margin-top: 8px; }

/* Buttons */
.btn-admin {
  padding: 9px 20px; border-radius: 10px; border: none;
  font-family: 'Nunito', system-ui, sans-serif; font-size: 0.875rem;
  font-weight: 700; cursor: pointer; transition: all 0.15s;
}
.btn-admin:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-admin--primary  { background: #6366f1; color: #fff; }
.btn-admin--primary:hover:not(:disabled) { background: #4f46e5; }
.btn-admin--ghost    { background: #252836; color: #9ca3af; }
.btn-admin--ghost:hover { background: #2e3347; color: #e5e7eb; }
.btn-admin--danger   { background: rgba(239,68,68,0.15); color: #f87171; border: 1px solid rgba(239,68,68,0.3); }
.btn-admin--danger:hover:not(:disabled) { background: rgba(239,68,68,0.25); }

/* Toast */
.admin-toast {
  position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
  padding: 12px 22px; border-radius: 10px; font-weight: 700; font-size: 0.875rem;
  z-index: 2000; box-shadow: 0 8px 24px rgba(0,0,0,0.4); white-space: nowrap;
}
.admin-toast--ok  { background: #22c55e; color: #fff; }
.admin-toast--err { background: #ef4444; color: #fff; }
.toast-enter-active, .toast-leave-active { transition: opacity 0.2s, transform 0.2s; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(8px); }

/* Modal transitions */
.modal-enter-active, .modal-leave-active { transition: opacity 0.2s; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
