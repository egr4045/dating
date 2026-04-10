<template>
  <div class="slot-overlay" v-if="visible">
    <div class="slot-modal">
      <h2 class="modal-title">Выбери время встречи ⏰</h2>
      <p class="modal-subtitle">Напарник доступен в следующие дни:</p>

      <div v-if="hostSlots.length > 0" class="slots-grid">
        <button  
          v-for="(slot, idx) in hostSlots" 
          :key="idx"
          :class="['slot-option', { selected: selectedIdx === idx }]"
          @click="selectedIdx = idx"
        >
          <span class="slot-day-label">{{ dayLabels[slot.dayOfWeek] }}</span>
          <span class="slot-time-label">{{ slot.timeFrom }} — {{ slot.timeTo }}</span>
        </button>
      </div>

      <div v-else class="no-slots">
        <p>Напарник не указал слоты. Выбери «Не подходит», чтобы создать своё лобби.</p>
      </div>

      <div class="modal-actions">
        <button class="decline-btn" @click="$emit('decline')">
          Не подходит
        </button>
        <button 
          class="confirm-btn" 
          :disabled="selectedIdx === null" 
          @click="emitConfirm"
        >
          Подтвердить ✓
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface Slot {
  dayOfWeek: number;
  timeFrom: string;
  timeTo: string;
}

const props = defineProps<{
  visible: boolean;
  hostSlots: Slot[];
  lobbyId: number;
  questId: string;
}>();

const emit = defineEmits<{
  (e: 'confirm', slot: Slot): void;
  (e: 'decline'): void;
}>();

const dayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const selectedIdx = ref<number | null>(null);

const emitConfirm = () => {
  if (selectedIdx.value !== null) {
    emit('confirm', props.hostSlots[selectedIdx.value]);
    selectedIdx.value = null;
  }
};
</script>

<style scoped>
.slot-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease;
}

.slot-modal {
  background: white;
  border-radius: 32px;
  padding: 40px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 30px 60px rgba(0, 0, 0, 0.15);
  animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-title {
  font-size: 24px;
  font-weight: 800;
  color: #1d1d1f;
  margin: 0 0 8px;
}
.modal-subtitle {
  font-size: 15px;
  color: #86868b;
  margin: 0 0 24px;
}

.slots-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 28px;
}

.slot-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-radius: 16px;
  border: 2px solid #f2f2f7;
  background: white;
  cursor: pointer;
  transition: all 0.2s ease;
}
.slot-option:hover {
  background: #f8f9fc;
  border-color: #e0e0e0;
}
.slot-option.selected {
  background: #eef2ff;
  border-color: #4a6fff;
  box-shadow: 0 4px 12px rgba(74, 111, 255, 0.15);
}

.slot-day-label {
  font-weight: 700;
  font-size: 16px;
  color: #4a6fff;
}
.slot-time-label {
  font-weight: 600;
  font-size: 15px;
  color: #1d1d1f;
}

.no-slots {
  text-align: center;
  padding: 20px;
  color: #86868b;
  font-size: 14px;
}

.modal-actions {
  display: flex;
  gap: 12px;
}

.decline-btn {
  flex: 1;
  padding: 16px;
  border-radius: 16px;
  border: none;
  background: #f2f2f7;
  color: #1d1d1f;
  font-weight: 700;
  font-size: 15px;
  cursor: pointer;
  transition: background 0.2s;
}
.decline-btn:hover { background: #e5e5ea; }

.confirm-btn {
  flex: 1.5;
  padding: 16px;
  border-radius: 16px;
  border: none;
  background: #4a6fff;
  color: white;
  font-weight: 800;
  font-size: 15px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 8px 20px rgba(74, 111, 255, 0.25);
}
.confirm-btn:hover:not(:disabled) {
  background: #365cf5;
  transform: translateY(-1px);
}
.confirm-btn:disabled {
  background: #e5e5ea;
  color: #aeaeb2;
  box-shadow: none;
  cursor: not-allowed;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes slideUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
