// Автоматическое определение API_URL.
// Если открыли localhost:5173 -> бэкенд ищется на localhost:3000
// Если открыли 2.59.40.15 -> бэкенд ищется на 2.59.40.15:3000
// Если открыли safechill.ru -> бэкенд ищется на safechill.ru:3000
const hostname = window.location.hostname;
const protocol = window.location.protocol;

// Если вы используете Nginx как прокси (например, https://safechill.ru/api), 
// то можете переопределить это через VITE_API_URL в .env
export const API_URL = import.meta.env.VITE_API_URL || `${protocol}//${hostname}:3000`;
