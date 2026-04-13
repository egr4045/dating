import { createApp } from 'vue'
import * as Sentry from '@sentry/vue'
import App from './App.vue'
import { router } from './router'
import './assets/global.css'
import './style.css'

const app = createApp(App)

// Sentry — подключаем только если задан DSN
const sentryDsn = import.meta.env.VITE_SENTRY_DSN
if (sentryDsn) {
  Sentry.init({
    app,
    dsn: sentryDsn,
    integrations: [
      Sentry.browserTracingIntegration({ router }),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    // Собираем 10% транзакций производительности
    tracesSampleRate: 0.1,
    // Replay только при ошибках
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    environment: import.meta.env.MODE,
  })
}

app.use(router).mount('#app')
