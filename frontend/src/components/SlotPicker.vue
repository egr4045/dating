<template>
  <div class="slot-picker">
    <h3 class="picker-title">{{ title || 'Когда ты обычно свободен?' }}</h3>
    <p class="picker-subtitle">Выбери дни и укажи время</p>

    <div class="days-row">
      <button
        v-for="(label, idx) in dayLabels"
        :key="idx"
        :class="['day-btn', { active: isDayActive(idx) }]"
        @click="toggleDay(idx)"
      >
        {{ label }}
      </button>
    </div>

    <TransitionGroup name="slot-list" tag="div" class="slots-list">
      <div v-for="slot in modelValue" :key="`${slot.dayOfWeek}-${slot.timeFrom}`" class="slot-row">
        <span class="slot-day">{{ dayLabels[slot.dayOfWeek] }}</span>
        <input type="time" :value="slot.timeFrom" @input="updateSlot(slot, 'timeFrom', ($event.target as HTMLInputElement).value)" class="time-input" />
        <span class="slot-dash">—</span>
        <input type="time" :value="slot.timeTo" @input="updateSlot(slot, 'timeTo', ($event.target as HTMLInputElement).value)" class="time-input" />
        <button class="remove-slot" @click="removeSlot(slot)">✕</button>
      </div>
    </TransitionGroup>

    <p v-if="modelValue.length === 0" class="empty-hint">Нажми на день, чтобы добавить слот</p>
  </div>
</template>

<script setup lang="ts">
interface Slot {
  dayOfWeek: number;
  timeFrom: string;
  timeTo: string;
}

const props = defineProps<{
  modelValue: Slot[];
  title?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: Slot[]): void;
}>();

const dayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];


const isDayActive = (day: number) => props.modelValue.some(s => s.dayOfWeek === day);

const toggleDay = (day: number) => {
  if (isDayActive(day)) {
    emit('update:modelValue', props.modelValue.filter(s => s.dayOfWeek !== day));
  } else {
    const newSlots = [...props.modelValue, { dayOfWeek: day, timeFrom: '18:00', timeTo: '22:00' }];
    newSlots.sort((a, b) => a.dayOfWeek - b.dayOfWeek);
    emit('update:modelValue', newSlots);
  }
};

const updateSlot = (slot: Slot, field: 'timeFrom' | 'timeTo', value: string) => {
  const updated = props.modelValue.map(s =>
    s.dayOfWeek === slot.dayOfWeek && s.timeFrom === slot.timeFrom
      ? { ...s, [field]: value }
      : s
  );
  emit('update:modelValue', updated);
};

const removeSlot = (slot: Slot) => {
  emit('update:modelValue', props.modelValue.filter(s => s !== slot));
};
</script>

<style scoped>
.slot-picker {
  width: 100%;
}
.picker-title {
  font-size: 20px;
  font-weight: 800;
  color: #1d1d1f;
  margin-bottom: 4px;
}
.picker-subtitle {
  font-size: 14px;
  color: #86868b;
  margin-bottom: 20px;
}

.days-row {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}
.day-btn {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  border: 2px solid #f2f2f7;
  background: white;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #1d1d1f;
}
.day-btn:hover {
  background: #f2f2f7;
}
.day-btn.active {
  background: #4a6fff;
  color: white;
  border-color: #4a6fff;
  transform: scale(1.08);
  box-shadow: 0 4px 12px rgba(74, 111, 255, 0.3);
}

.slots-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.slot-row {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #f8f9fc;
  padding: 12px 16px;
  border-radius: 16px;
  transition: all 0.3s ease;
}

.slot-day {
  font-weight: 700;
  font-size: 14px;
  color: #4a6fff;
  min-width: 28px;
}

.time-input {
  padding: 8px 12px;
  border: 1.5px solid #e5e5ea;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  background: white;
  outline: none;
  transition: border-color 0.2s;
  width: 100px;
}
.time-input:focus {
  border-color: #4a6fff;
}

.slot-dash {
  color: #86868b;
  font-weight: 600;
}
.remove-slot {
  background: none;
  border: none;
  color: #ff5252;
  font-size: 16px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
  transition: background 0.2s;
}
.remove-slot:hover {
  background: #ffe5e5;
}

.empty-hint {
  text-align: center;
  color: #aeaeb2;
  font-size: 14px;
  padding: 20px 0;
}

/* Анимации списка */
.slot-list-enter-active,
.slot-list-leave-active {
  transition: all 0.3s ease;
}
.slot-list-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}
.slot-list-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
</style>
