<template>
  <div 
    ref="interactElement" 
    class="quest-card" 
    :style="cardStyle"
  >
    <div class="card-image" :style="{ background: quest.imageUrl ? `url(${quest.imageUrl}) center/cover` : 'linear-gradient(45deg, #a1c4fd, #c2e9fb)' }">
      <div class="category-tag">{{ quest.subcategory }}</div>
    </div>

    <div class="card-content">
      <h2>{{ quest.title }}</h2>
      <p>{{ quest.description }}</p>
    </div>

    <div class="stamp stamp-like" :style="{ opacity: likeOpacity }">ПОГНАЛИ</div>
    <div class="stamp stamp-nope" :style="{ opacity: nopeOpacity }">МЬЕ...</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import interact from 'interactjs';

const props = defineProps<{
  quest: { id: string, title: string, description: string, subcategory: string, imageUrl?: string }
}>();

const emit = defineEmits(['swipeRight', 'swipeLeft']);

const x = ref(0);
const y = ref(0);
const rotation = ref(0);
const isInteracting = ref(false);

const cardStyle = computed(() => ({
  transform: `translate3d(${x.value}px, ${y.value}px, 0) rotate(${rotation.value}deg)`,
  transition: isInteracting.value ? 'none' : 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
}));

// Прозрачность штампов "Like/Nope" в зависимости от сдвига
const likeOpacity = computed(() => Math.min(x.value / 150, 1));
const nopeOpacity = computed(() => Math.min(-x.value / 150, 1));

const interactElement = ref(null);

onMounted(() => {
  // Добавляем проверку на существование элемента
  if (interactElement.value) {
    interact(interactElement.value as HTMLElement).draggable({
      onstart: () => { 
        isInteracting.value = true; 
      },
      onmove: (event) => {
        x.value += event.dx;
        y.value += event.dy;
        rotation.value = x.value / 15;
      },
      onend: () => {
        isInteracting.value = false;
        if (x.value > 120) {
          x.value = 1000;
          emit('swipeRight', props.quest.id);
        } else if (x.value < -120) {
          x.value = -1000;
          emit('swipeLeft', props.quest.id);
        } else {
          x.value = 0; 
          y.value = 0; 
          rotation.value = 0;
        }
      }
    });
  }
});
</script>

<style scoped>
.quest-card {
  position: absolute;
  width: 100%;
  max-width: 380px;
  height: 520px;
  background: white;
  border-radius: 32px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.1);
  overflow: hidden;
  cursor: grab;
  touch-action: none;
  display: flex;
  flex-direction: column;
}

.card-image {
  flex: 1;
  position: relative;
  min-height: 300px;
}

.category-tag {
  position: absolute;
  top: 20px; left: 20px;
  background: rgba(255,255,255,0.9);
  padding: 6px 14px;
  border-radius: 100px;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
}

.card-content {
  padding: 24px;
}

h2 { margin: 0 0 10px; font-size: 24px; color: #1d1d1f; }
p { color: #86868b; font-size: 16px; line-height: 1.4; margin: 0; }

.stamp {
  position: absolute;
  top: 40px;
  padding: 10px 20px;
  border: 4px solid;
  border-radius: 12px;
  font-size: 32px;
  font-weight: 900;
  pointer-events: none;
}
.stamp-like { right: 40px; color: #43E97B; border-color: #43E97B; transform: rotate(15deg); }
.stamp-nope { left: 40px; color: #FF6B6B; border-color: #FF6B6B; transform: rotate(-15deg); }
</style>