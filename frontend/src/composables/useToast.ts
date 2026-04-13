import { ref } from 'vue';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

const toasts = ref<Toast[]>([]);
let nextId = 1;

export function useToast() {
  function showToast(message: string, type: ToastType = 'info', duration = 3500) {
    const id = nextId++;
    toasts.value.push({ id, message, type });
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id);
    }, duration);
  }

  function success(message: string) { showToast(message, 'success'); }
  function error(message: string)   { showToast(message, 'error', 4500); }
  function info(message: string)    { showToast(message, 'info'); }
  function warning(message: string) { showToast(message, 'warning'); }

  function dismiss(id: number) {
    toasts.value = toasts.value.filter(t => t.id !== id);
  }

  return { toasts, showToast, success, error, info, warning, dismiss };
}
