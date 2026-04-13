<template>
  <div class="public-quest-page">
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Загружаем квест...</p>
    </div>

    <div v-else-if="!quest" class="error-state">
      <div class="emoji">🔍</div>
      <h2>Квест не найден</h2>
      <p>Похоже, эта ссылка больше не работает.</p>
      <router-link to="/" class="btn btn-primary">На главную</router-link>
    </div>

    <div v-else class="quest-content anim-scale-in">
      <div class="quest-hero" :style="heroStyle">
        <div class="hero-overlay"></div>
        <div class="hero-header">
          <div class="category-badge">{{ categoryEmoji(quest.category) }} {{ quest.subcategory }}</div>
          <div class="share-btn" @click="copyLink">🔗</div>
        </div>
        <div class="hero-footer">
          <h1>{{ quest.title }}</h1>
          <div v-if="quest.address" class="address">📍 {{ quest.address }}</div>
        </div>
      </div>

      <div class="quest-body">
        <div class="info-row">
          <div class="info-item">
            <span class="label">Оплата</span>
            <span class="value">🤝 50/50</span>
          </div>
          <div v-if="quest.price" class="info-item">
            <span class="label">Бюджет</span>
            <span class="value">💰 {{ quest.price }}</span>
          </div>
          <div v-if="quest.waitingCount > 0" class="info-item">
            <span class="label">Участники</span>
            <span class="value">🔥 {{ quest.waitingCount }} ждут пару</span>
          </div>
        </div>

        <div class="description">
          <h3>О событии</h3>
          <p>{{ quest.description }}</p>
        </div>

        <div class="cta-section">
          <div class="cta-card">
            <div class="cta-emoji">✨</div>
            <h3>Хочешь пойти?</h3>
            <p>Заходи через Telegram — мы подберем тебе идеальную компанию для этого квеста!</p>
            <router-link to="/" class="btn btn-primary btn-full">
              Войти и откликнуться 🚀
            </router-link>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { API_URL } from '../config';
import { useToast } from '../composables/useToast';

const route = useRoute();
const { success: toastSuccess } = useToast();
const loading = ref(true);
const quest = ref<any>(null);

async function loadQuest() {
  try {
    const res = await fetch(`${API_URL}/quests/public/${route.params.id}`);
    if (!res.ok) throw new Error('Not found');
    quest.value = await res.json();
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

const heroStyle = computed(() => {
  if (!quest.value?.imageUrl) return { background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)' };
  return {
    backgroundImage: `url(${quest.value.imageUrl})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center'
  };
});

function categoryEmoji(cat: string) {
  return { offline: '🌍', games: '🎮', online: '📱' }[cat] ?? '✨';
}

function copyLink() {
  navigator.clipboard.writeText(window.location.href);
  toastSuccess('Ссылка скопирована!');
}

onMounted(loadQuest);
</script>

<style scoped>
.public-quest-page {
  min-height: 100dvh;
  background: var(--bg);
  color: var(--text);
  display: flex;
  flex-direction: column;
}

.loading-state, .error-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 40px;
  text-align: center;
}

.quest-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  max-width: 500px;
  margin: 0 auto;
  width: 100%;
}

.quest-hero {
  position: relative;
  height: 40vh;
  min-height: 300px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 20px;
  color: #fff;
}

.hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%);
}

.hero-header, .hero-footer {
  position: relative;
  z-index: 1;
}

.hero-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.category-badge {
  background: rgba(255,255,255,0.2);
  backdrop-filter: blur(10px);
  padding: 6px 14px;
  border-radius: 100px;
  font-size: 0.85rem;
  font-weight: 700;
  border: 1px solid rgba(255,255,255,0.2);
}

.share-btn {
  width: 36px;
  height: 36px;
  background: rgba(255,255,255,0.2);
  backdrop-filter: blur(10px);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1.1rem;
}

.hero-footer h1 {
  font-size: 2rem;
  font-weight: 800;
  margin: 0 0 4px;
  line-height: 1.1;
}

.address {
  font-size: 0.9rem;
  opacity: 0.9;
  font-weight: 500;
}

.quest-body {
  flex: 1;
  background: var(--surface);
  border-top-left-radius: 32px;
  border-top-right-radius: 32px;
  margin-top: -30px;
  position: relative;
  z-index: 2;
  padding: 30px 24px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.info-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.info-item {
  background: var(--surface-2);
  padding: 10px 16px;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 100px;
}

.info-item .label {
  font-size: 0.7rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 2px;
}

.info-item .value {
  font-weight: 700;
  font-size: 0.9rem;
}

.description h3 {
  font-size: 1.1rem;
  margin-bottom: 8px;
}

.description p {
  color: var(--text-muted);
  line-height: 1.6;
}

.cta-section {
  margin-top: auto;
  padding-top: 20px;
}

.cta-card {
  background: linear-gradient(135deg, var(--surface-2) 0%, var(--surface-1) 100%);
  border: 1px solid var(--border);
  padding: 24px;
  border-radius: 24px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cta-emoji {
  font-size: 2.5rem;
}

.cta-card h3 { margin: 0; }
.cta-card p {
  font-size: 0.85rem;
  color: var(--text-muted);
  margin: 0 0 8px;
}
</style>
