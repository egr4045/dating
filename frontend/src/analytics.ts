import { API_URL } from './config';

// Уникальный ID сессии — генерируется один раз при загрузке страницы
const SESSION_ID = Math.random().toString(36).slice(2) + Date.now().toString(36);

export function track(event: string, meta?: Record<string, unknown>) {
  const userIdStr = localStorage.getItem('userId');
  const userId = userIdStr ? parseInt(userIdStr) : null;

  // Fire-and-forget: не блокируем UI и не бросаем ошибки
  fetch(`${API_URL}/admin/analytics/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, meta, userId, sessionId: SESSION_ID }),
  }).catch(() => {});
}
