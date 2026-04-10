<template>
  <div
    ref="interactElement"
    class="event-card"
    :style="cardStyle"
  >
    <!-- Изображение / фон -->
    <div
      class="event-card__image"
      :style="{ background: quest.imageUrl
        ? `linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.55) 100%), url(${quest.imageUrl}) center/cover`
        : gradientForCategory(quest.category) }"
    >
      <!-- Категория -->
      <div class="event-card__category">{{ categoryEmoji(quest.category) }} {{ quest.subcategory }}</div>

      <!-- Плашки поверх фото -->
      <div class="event-card__badges">
        <div class="payment-badge">🤝 50/50</div>
        <div v-if="quest.price" class="badge badge-muted">💰 {{ quest.price }}</div>
      </div>

      <!-- Заголовок внутри фото -->
      <div class="event-card__title-area">
        <h2>{{ quest.title }}</h2>
        <div v-if="quest.address" class="event-card__address">📍 {{ quest.address }}</div>
      </div>
    </div>

    <!-- Описание -->
    <div class="event-card__body">
      <p>{{ quest.description }}</p>
    </div>

    <!-- Свайп-штампы -->
    <div class="stamp stamp-like" :style="{ opacity: likeOpacity }">ПОЙДУ!</div>
    <div class="stamp stamp-nope" :style="{ opacity: nopeOpacity }">НЕ СЕЙЧАС</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import interact from 'interactjs';

const props = defineProps<{
  quest: {
    id: string;
    title: string;
    description: string;
    category: string;
    subcategory: string;
    imageUrl?: string;
    address?: string;
    price?: string;
  }
}>();

const emit = defineEmits(['swipeRight', 'swipeLeft']);

const x = ref(0);
const y = ref(0);
const rotation = ref(0);
const isInteracting = ref(false);
const interactElement = ref<HTMLElement>();

const cardStyle = computed(() => ({
  transform: `translate3d(${x.value}px, ${y.value}px, 0) rotate(${rotation.value}deg)`,
  transition: isInteracting.value ? 'none' : 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
}));

const likeOpacity = computed(() => Math.max(0, Math.min(x.value / 120, 1)));
const nopeOpacity = computed(() => Math.max(0, Math.min(-x.value / 120, 1)));

function categoryEmoji(cat: string) {
  return { offline: '🌍', games: '🎮', online: '📱' }[cat] ?? '✨';
}

function gradientForCategory(cat: string) {
  const gradients: Record<string, string> = {
    offline: 'linear-gradient(135deg, #FAD7C8 0%, #E8A598 100%)',
    games:   'linear-gradient(135deg, #C8D4FA 0%, #8A98E8 100%)',
    online:  'linear-gradient(135deg, #C8FAE0 0%, #7EC8A0 100%)',
  };
  return gradients[cat] ?? 'linear-gradient(135deg, #FAF0E8 0%, #E8C8A0 100%)';
}

onMounted(() => {
  if (!interactElement.value) return;
  interact(interactElement.value).draggable({
    onstart: () => { isInteracting.value = true; },
    onmove: (e) => {
      x.value += e.dx;
      y.value += e.dy;
      rotation.value = x.value / 18;
    },
    onend: () => {
      isInteracting.value = false;
      if (x.value > 110) {
        x.value = 1000;
        emit('swipeRight', props.quest.id);
      } else if (x.value < -110) {
        x.value = -1000;
        emit('swipeLeft', props.quest.id);
      } else {
        x.value = 0;
        y.value = 0;
        rotation.value = 0;
      }
    },
  });
});
</script>

<style scoped>
.event-card {
  position: absolute;
  width: 100%;
  max-width: 360px;
  background: var(--surface);
  border-radius: 28px;
  box-shadow: 0 12px 40px rgba(61, 53, 53, 0.14);
  overflow: hidden;
  cursor: grab;
  touch-action: none;
  display: flex;
  flex-direction: column;
  user-select: none;
}
.event-card:active { cursor: grabbing; }

.event-card__image {
  position: relative;
  height: 320px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 16px;
}

.event-card__category {
  align-self: flex-start;
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(8px);
  padding: 5px 12px;
  border-radius: 100px;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text);
  text-transform: capitalize;
}

.event-card__badges {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-end;
}

.event-card__title-area {
  color: #fff;
}
.event-card__title-area h2 {
  font-size: 1.375rem;
  font-weight: 800;
  line-height: 1.2;
  text-shadow: 0 2px 8px rgba(0,0,0,0.3);
  margin-bottom: 4px;
}
.event-card__address {
  font-size: 0.8rem;
  opacity: 0.9;
  font-weight: 600;
}

.event-card__body {
  padding: 16px 20px 20px;
}
.event-card__body p {
  font-size: 0.9rem;
  line-height: 1.5;
  color: var(--text-muted);
  margin: 0;
}

/* Свайп штампы */
.stamp {
  position: absolute;
  top: 36px;
  padding: 8px 18px;
  border: 3.5px solid;
  border-radius: 10px;
  font-size: 1.25rem;
  font-weight: 900;
  pointer-events: none;
  letter-spacing: 0.05em;
  backdrop-filter: blur(4px);
}
.stamp-like {
  right: 24px;
  color: var(--success);
  border-color: var(--success);
  background: var(--success-soft);
  transform: rotate(12deg);
}
.stamp-nope {
  left: 24px;
  color: var(--danger);
  border-color: var(--danger);
  background: var(--danger-soft);
  transform: rotate(-12deg);
}
</style>
