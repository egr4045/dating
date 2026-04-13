<template>
  <Teleport to="body">
    <div class="toast-container">
      <TransitionGroup name="toast-anim" tag="div" class="toast-list">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="toast"
          :class="`toast--${toast.type}`"
          @click="dismiss(toast.id)"
        >
          <span class="toast__icon">{{ icons[toast.type] }}</span>
          <span class="toast__msg">{{ toast.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useToast } from '../composables/useToast';

const { toasts, dismiss } = useToast();

const icons: Record<string, string> = {
  success: '✅',
  error:   '❌',
  warning: '⚠️',
  info:    'ℹ️',
};
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  pointer-events: none;
  width: min(90vw, 380px);
}

.toast-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-radius: 14px;
  font-family: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.4;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  pointer-events: auto;
  cursor: pointer;
  backdrop-filter: blur(8px);
  border: 1.5px solid transparent;
}

.toast--success {
  background: rgba(126, 200, 160, 0.95);
  color: #1a4a2e;
  border-color: rgba(126, 200, 160, 0.5);
}
.toast--error {
  background: rgba(232, 100, 100, 0.95);
  color: #fff;
  border-color: rgba(220, 80, 80, 0.5);
}
.toast--warning {
  background: rgba(245, 197, 100, 0.95);
  color: #5a3e00;
  border-color: rgba(230, 180, 80, 0.5);
}
.toast--info {
  background: rgba(232, 146, 124, 0.95);
  color: #fff;
  border-color: rgba(220, 130, 110, 0.5);
}

.toast__icon { font-size: 1rem; flex-shrink: 0; }
.toast__msg  { flex: 1; }

/* Animations */
.toast-anim-enter-active {
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.toast-anim-leave-active {
  transition: all 0.25s ease-in;
}
.toast-anim-enter-from {
  opacity: 0;
  transform: translateY(-20px) scale(0.9);
}
.toast-anim-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.95);
}
.toast-anim-move {
  transition: transform 0.3s ease;
}
</style>
