<template>
  <div class="dual-range">
    <div class="dual-range__label" v-if="label">
      {{ label }}: <strong>{{ localMin }}–{{ localMax }} лет</strong>
    </div>
    <div class="dual-range__track-wrap">
      <div class="dual-range__track" />
      <div
        class="dual-range__fill"
        :style="{ left: leftPct + '%', width: widthPct + '%' }"
      />
      <input
        type="range"
        class="dual-range__input dual-range__input--min"
        :min="min"
        :max="max"
        :value="localMin"
        @input="onMinInput"
      />
      <input
        type="range"
        class="dual-range__input dual-range__input--max"
        :min="min"
        :max="max"
        :value="localMax"
        @input="onMaxInput"
      />
    </div>
    <div class="dual-range__ticks">
      <span>{{ min }}</span>
      <span>{{ max }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

const props = defineProps<{
  min: number;
  max: number;
  modelValueMin: number;
  modelValueMax: number;
  label?: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValueMin', v: number): void;
  (e: 'update:modelValueMax', v: number): void;
}>();

const localMin = ref(props.modelValueMin);
const localMax = ref(props.modelValueMax);

watch(() => props.modelValueMin, v => { localMin.value = v; });
watch(() => props.modelValueMax, v => { localMax.value = v; });

const leftPct = computed(() =>
  ((localMin.value - props.min) / (props.max - props.min)) * 100
);
const widthPct = computed(() =>
  ((localMax.value - localMin.value) / (props.max - props.min)) * 100
);

function onMinInput(e: Event) {
  const val = Number((e.target as HTMLInputElement).value);
  localMin.value = Math.min(val, localMax.value - 1);
  emit('update:modelValueMin', localMin.value);
}

function onMaxInput(e: Event) {
  const val = Number((e.target as HTMLInputElement).value);
  localMax.value = Math.max(val, localMin.value + 1);
  emit('update:modelValueMax', localMax.value);
}
</script>

<style scoped>
.dual-range {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
}

.dual-range__label {
  font-size: 0.875rem;
  color: var(--text-muted);
}
.dual-range__label strong {
  color: var(--text);
}

.dual-range__track-wrap {
  position: relative;
  height: 36px;
  display: flex;
  align-items: center;
}

.dual-range__track {
  position: absolute;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--border, #e0d6d0);
  border-radius: 4px;
}

.dual-range__fill {
  position: absolute;
  height: 4px;
  background: var(--primary, #E8927C);
  border-radius: 4px;
  pointer-events: none;
}

.dual-range__input {
  position: absolute;
  width: 100%;
  height: 4px;
  background: transparent;
  -webkit-appearance: none;
  appearance: none;
  pointer-events: none;
  outline: none;
}

.dual-range__input::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--primary, #E8927C);
  border: 3px solid #fff;
  box-shadow: 0 2px 6px rgba(0,0,0,0.15);
  pointer-events: auto;
  cursor: pointer;
  transition: transform 0.15s;
}
.dual-range__input::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}
.dual-range__input::-moz-range-thumb {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--primary, #E8927C);
  border: 3px solid #fff;
  box-shadow: 0 2px 6px rgba(0,0,0,0.15);
  pointer-events: auto;
  cursor: pointer;
}

.dual-range__input--max {
  z-index: 1;
}

.dual-range__ticks {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--text-muted);
}
</style>
