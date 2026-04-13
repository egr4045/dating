import { ref } from 'vue';
import { API_URL } from '../config';

const VAPID_PUBLIC_KEY = 'BMDQ8x_T5jCE22D-55zavyMXWY44VDHbzTTMAjtzBsGLnS_U7cEQesmYeHmTBW-yXOshORUFiQ_-gTgvmoMELMY';

export function usePush() {
  const isSupported = ref('serviceWorker' in navigator && 'PushManager' in window);
  const isSubscribed = ref(false);
  const loading = ref(false);

  // Конвертация base64 VAPID ключа для PushManager
  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  async function checkSubscription() {
    if (!isSupported.value) return;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    isSubscribed.value = !!subscription;
  }

  async function subscribe() {
    if (!isSupported.value) return;
    loading.value = true;
    try {
      // 1. Запрос разрешения
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Разрешение не получено');
      }

      // 2. Регистрация SW (если еще нет)
      await navigator.serviceWorker.register('/sw.js');
      const registration = await navigator.serviceWorker.ready;
      
      // 3. Подписка
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });

      // 4. Отправка на бэкенд
      const token = localStorage.getItem('token');
      await fetch(`${API_URL}/users/push-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(subscription)
      });

      isSubscribed.value = true;
      return true;
    } catch (err) {
      console.error('Push subscription failed:', err);
      return false;
    } finally {
      loading.value = false;
    }
  }

  return {
    isSupported,
    isSubscribed,
    loading,
    subscribe,
    checkSubscription
  };
}
