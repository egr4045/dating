<template>
  <div class="dtp" ref="dtpRoot">
    <!-- Trigger button -->
    <button type="button" class="dtp__trigger" @click="togglePicker">
      <span class="dtp__icon">📅</span>
      <span class="dtp__value">{{ displayValue }}</span>
    </button>

    <!-- Picker panel -->
    <Transition name="dtp-slide">
      <div v-if="open" class="dtp__panel">

        <!-- Calendar header -->
        <div class="dtp__cal-header">
          <button type="button" class="dtp__nav" @click="prevMonth">‹</button>
          <span class="dtp__month-label">{{ monthName }} {{ viewYear }}</span>
          <button type="button" class="dtp__nav" @click="nextMonth">›</button>
        </div>

        <!-- Day-of-week labels -->
        <div class="dtp__weekdays">
          <span v-for="d in weekdays" :key="d">{{ d }}</span>
        </div>

        <!-- Calendar days -->
        <div class="dtp__days">
          <span
            v-for="cell in calendarCells"
            :key="cell.key"
            class="dtp__day"
            :class="{
              'dtp__day--empty': !cell.day,
              'dtp__day--disabled': cell.disabled,
              'dtp__day--selected': cell.selected,
              'dtp__day--today': cell.today,
            }"
            @click="cell.day && !cell.disabled && selectDay(cell.day)"
          >{{ cell.day ?? '' }}</span>
        </div>

        <!-- Time picker -->
        <div v-if="selectedDay !== null" class="dtp__time">
          <span class="dtp__time-label">Время:</span>
          <select class="dtp__select" v-model="selectedHour">
            <option v-for="h in hours" :key="h" :value="h">{{ String(h).padStart(2, '0') }}</option>
          </select>
          <span class="dtp__sep">:</span>
          <select class="dtp__select" v-model="selectedMinute">
            <option v-for="m in minutes" :key="m" :value="m">{{ String(m).padStart(2, '0') }}</option>
          </select>
        </div>

        <!-- Confirm button -->
        <button
          v-if="selectedDay !== null"
          type="button"
          class="dtp__confirm"
          @click="confirm"
        >Выбрать →</button>

      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps<{
  modelValue: string;
  min?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void;
}>();

const open = ref(false);
const dtpRoot = ref<HTMLElement>();

const now = new Date();
const viewYear = ref(now.getFullYear());
const viewMonth = ref(now.getMonth()); // 0-indexed

const selectedDay = ref<number | null>(null);
const selectedHour = ref(12);
const selectedMinute = ref(0);

const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const monthNames = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

const hours = Array.from({ length: 24 }, (_, i) => i);
const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const monthName = computed(() => monthNames[viewMonth.value]);

const minDate = computed(() => props.min ? new Date(props.min) : null);

// Parse current modelValue to initialize state
watch(() => props.modelValue, (val) => {
  if (!val) return;
  const d = new Date(val);
  if (isNaN(d.getTime())) return;
  viewYear.value = d.getFullYear();
  viewMonth.value = d.getMonth();
  selectedDay.value = d.getDate();
  selectedHour.value = d.getHours();
  selectedMinute.value = Math.round(d.getMinutes() / 5) * 5;
}, { immediate: true });

const displayValue = computed(() => {
  if (!props.modelValue) return 'Выбери дату и время';
  const d = new Date(props.modelValue);
  if (isNaN(d.getTime())) return 'Выбери дату и время';
  return d.toLocaleString('ru-RU', {
    weekday: 'short', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit',
  });
});

const calendarCells = computed(() => {
  const cells: Array<{
    key: string; day: number | null;
    disabled: boolean; selected: boolean; today: boolean;
  }> = [];

  const firstDayOfMonth = new Date(viewYear.value, viewMonth.value, 1);
  // getDay(): 0=Sun, 1=Mon ... convert to Mon-first: (day+6)%7
  const startOffset = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear.value, viewMonth.value + 1, 0).getDate();

  for (let i = 0; i < startOffset; i++) {
    cells.push({ key: `e${i}`, day: null, disabled: false, selected: false, today: false });
  }

  const todayD = new Date();
  for (let d = 1; d <= daysInMonth; d++) {
    const cellDate = new Date(viewYear.value, viewMonth.value, d);
    const disabled = minDate.value ? cellDate < new Date(minDate.value.getFullYear(), minDate.value.getMonth(), minDate.value.getDate()) : false;
    const selected = selectedDay.value === d && viewYear.value === (props.modelValue ? new Date(props.modelValue).getFullYear() : -1) && viewMonth.value === (props.modelValue ? new Date(props.modelValue).getMonth() : -1);
    const today = d === todayD.getDate() && viewMonth.value === todayD.getMonth() && viewYear.value === todayD.getFullYear();
    cells.push({ key: `d${d}`, day: d, disabled, selected, today });
  }

  return cells;
});

function prevMonth() {
  if (viewMonth.value === 0) { viewMonth.value = 11; viewYear.value--; }
  else viewMonth.value--;
}
function nextMonth() {
  if (viewMonth.value === 11) { viewMonth.value = 0; viewYear.value++; }
  else viewMonth.value++;
}

function selectDay(day: number) {
  selectedDay.value = day;
}

function confirm() {
  if (selectedDay.value === null) return;
  const d = new Date(viewYear.value, viewMonth.value, selectedDay.value, selectedHour.value, selectedMinute.value);
  emit('update:modelValue', d.toISOString());
  open.value = false;
}

function togglePicker() {
  open.value = !open.value;
}

// Close on outside click
function onDocClick(e: MouseEvent) {
  if (dtpRoot.value && !dtpRoot.value.contains(e.target as Node)) {
    open.value = false;
  }
}
onMounted(() => document.addEventListener('click', onDocClick, true));
onBeforeUnmount(() => document.removeEventListener('click', onDocClick, true));
</script>

<style scoped>
.dtp {
  position: relative;
  width: 100%;
}

.dtp__trigger {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  background: var(--surface, #fff);
  border: 1.5px solid var(--border, #e0d6d0);
  border-radius: var(--radius-sm, 12px);
  padding: 12px 16px;
  font-family: inherit;
  font-size: 0.9rem;
  color: var(--text, #2d2020);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s;
}
.dtp__trigger:focus, .dtp__trigger:hover {
  border-color: var(--primary, #E8927C);
  outline: none;
}
.dtp__icon { font-size: 1.1rem; }
.dtp__value { flex: 1; }

.dtp__panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  background: var(--surface, #fff);
  border: 1.5px solid var(--border, #e0d6d0);
  border-radius: var(--radius-sm, 16px);
  box-shadow: 0 12px 40px rgba(61, 53, 53, 0.16);
  padding: 16px;
  z-index: 100;
}

.dtp__cal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.dtp__month-label {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--text, #2d2020);
}
.dtp__nav {
  background: none;
  border: 1.5px solid var(--border, #e0d6d0);
  border-radius: 8px;
  width: 32px;
  height: 32px;
  font-size: 1.1rem;
  cursor: pointer;
  color: var(--text-muted);
  transition: border-color 0.15s, color 0.15s;
}
.dtp__nav:hover { border-color: var(--primary, #E8927C); color: var(--primary, #E8927C); }

.dtp__weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  margin-bottom: 4px;
}
.dtp__weekdays span {
  text-align: center;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-muted);
  padding: 4px 0;
}

.dtp__days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}
.dtp__day {
  text-align: center;
  padding: 7px 4px;
  border-radius: 8px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
  color: var(--text, #2d2020);
}
.dtp__day:hover:not(.dtp__day--empty):not(.dtp__day--disabled) {
  background: rgba(232, 146, 124, 0.15);
}
.dtp__day--empty { cursor: default; }
.dtp__day--disabled { color: var(--text-muted); opacity: 0.4; cursor: not-allowed; }
.dtp__day--today { font-weight: 800; color: var(--primary, #E8927C); }
.dtp__day--selected {
  background: var(--primary, #E8927C);
  color: #fff;
}
.dtp__day--selected:hover { background: var(--primary, #E8927C); }

.dtp__time {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--border, #e0d6d0);
}
.dtp__time-label {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin-right: 4px;
}
.dtp__select {
  background: var(--surface-2, #f5ede8);
  border: 1.5px solid var(--border, #e0d6d0);
  border-radius: 8px;
  padding: 6px 10px;
  font-family: inherit;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text, #2d2020);
  cursor: pointer;
  outline: none;
}
.dtp__select:focus { border-color: var(--primary, #E8927C); }
.dtp__sep { font-weight: 800; color: var(--text-muted); font-size: 1.1rem; }

.dtp__confirm {
  margin-top: 12px;
  width: 100%;
  background: var(--primary, #E8927C);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm, 12px);
  padding: 12px;
  font-family: inherit;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
}
.dtp__confirm:hover { opacity: 0.88; }

/* Slide transition */
.dtp-slide-enter-active,
.dtp-slide-leave-active {
  transition: opacity 0.18s, transform 0.18s;
}
.dtp-slide-enter-from,
.dtp-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
