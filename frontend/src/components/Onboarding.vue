<template>
  <div class="onboarding-container">
    <div class="glass-card">
      
      <div v-if="currentStep === 1" class="step-fade">
        <h1 class="huge-title">С чего начнем?</h1>
        <p class="subtitle">Выбери основные направления (можно несколько)</p>
        
        <div class="spotify-grid">
          <div 
            v-for="(val, groupKey) in categories" 
            :key="groupKey"
            :class="['spotify-card', { active: selectedGroups.includes(groupKey as string) }]"
            :style="{ background: val.color }"
            @click="toggleGroup(groupKey as string)"
          >
            <span class="card-label">{{ val.title }}</span>
            <div class="card-check" v-if="selectedGroups.includes(groupKey as string)">✓</div>
          </div>
        </div>
      </div>

      <div v-if="currentStep === 2" class="step-fade">
        <h1 class="huge-title">Уточним детали</h1>
        <p class="subtitle">Что именно тебя интересует в этих сферах?</p>
        
        <div class="details-stack">
          <div v-for="groupKey in selectedGroups" :key="groupKey" class="detail-section">
            <h3 class="section-title">{{ categories[groupKey].title }}</h3>
            <div class="chips-wrap">
              <button 
                v-for="item in categories[groupKey].items" 
                :key="item.id"
                :class="['modern-chip', { active: selectedInterests.includes(item.id) }]"
                @click="toggleInterest(item.id)"
              >
                {{ item.label }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <footer class="onboarding-footer">
        <button v-if="currentStep === 2" class="secondary-btn" @click="currentStep = 1">
          Назад
        </button>
        <button 
          class="primary-btn" 
          :disabled="isNextDisabled"
          @click="handleNext"
        >
          {{ currentStep === 1 ? 'Далее' : 'Готово' }}
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';

const currentStep = ref(1);
const selectedGroups = ref<string[]>([]);
const selectedInterests = ref<string[]>([]);
const router = useRouter();

const categories: any = {
  offline: {
    title: '📍 Оффлайн',
    color: 'linear-gradient(135deg, #FF6B6B, #FF8E53)',
    items: [
      { id: 'hookah', label: '💨 Кальян' }, { id: 'bar', label: '🍻 Бар' },
      { id: 'sport', label: '⚽ Спорт' }, { id: 'movie_theatre', label: '🍿 Кино' },
      { id: 'picnic', label: '🌳 Прогулка' }
    ]
  },
  games: {
    title: '🎮 Игры',
    color: 'linear-gradient(135deg, #4facfe, #00f2fe)',
    items: [
      { id: 'dota', label: '⚔️ Dota 2' }, { id: 'cs', label: '🔫 CS 2' },
      { id: 'mc', label: '⛏️ Minecraft' }, { id: 'wow', label: '🐉 WoW' },
      { id: 'itt', label: '👫 It Takes Two' }, { id: 'split', label: '🎮 Split Screen' }
    ]
  },
  online: {
    title: '💻 Онлайн',
    color: 'linear-gradient(135deg, #a18cd1, #fbc2eb)',
    items: [
      { id: 'movie_online', label: '🎬 Кино' }, { id: 'series', label: '📺 Сериалы' },
      { id: 'chatting', label: '💬 Just Chatting' }
    ]
  }
};

const toggleGroup = (key: string) => {
  if (selectedGroups.value.includes(key)) {
    selectedGroups.value = selectedGroups.value.filter(k => k !== key);
  } else {
    selectedGroups.value.push(key);
  }
};

const toggleInterest = (id: string) => {
  if (selectedInterests.value.includes(id)) {
    selectedInterests.value = selectedInterests.value.filter(i => i !== id);
  } else {
    selectedInterests.value.push(id);
  }
};

const isNextDisabled = computed(() => {
  if (currentStep.value === 1) return selectedGroups.value.length === 0;
  return selectedInterests.value.length < 2;
});

const handleNext = async () => {
  if (currentStep.value === 1) {
    currentStep.value = 2;
  } else {
    const userId = localStorage.getItem('userId');
    
    if (!userId) {
      alert('Ошибка: пользователь не найден. Попробуйте войти снова.');
      router.push('/');
      return;
    }

    try {
      const res = await fetch('http://localhost:3000/users/interests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: parseInt(userId), 
          interests: selectedInterests.value 
        }),
      });

      if (res.ok) {
        // После успеха отправляем пользователя на главный экран приложения
        // Пока его нет, создадим пустую заглушку /dashboard
        router.push('/dashboard'); 
      } else {
        alert('Не удалось сохранить интересы. Попробуйте позже.');
      }
    } catch (e) {
      console.error('Ошибка при сохранении:', e);
      alert('Проблема с соединением');
    }
  }
};
</script>

<style scoped>
.onboarding-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 24px;
}

.glass-card {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  border-radius: 32px;
  padding: 48px;
  width: 100%;
  max-width: 600px;
  box-shadow: 0 30px 60px rgba(0,0,0,0.08);
}

.huge-title { 
  font-size: 36px; 
  font-weight: 800; 
  color: #1d1d1f; 
  margin-bottom: 12px; 
  letter-spacing: -1px; 
}

.subtitle { color: #86868b; font-size: 18px; margin-bottom: 40px; }

/* Исправленная сетка: карточки больше не слипаются */
.spotify-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24px;
}

.spotify-card {
  height: 160px;
  border-radius: 24px;
  padding: 24px;
  color: white;
  cursor: pointer;
  position: relative;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: flex-end;
}

/* Анимация наведения */
.spotify-card:hover {
  transform: translateY(-5px) scale(1.02);
  box-shadow: 0 15px 30px rgba(0,0,0,0.15);
}

.spotify-card:active { transform: scale(0.98); }

.spotify-card.active {
  box-shadow: 0 0 0 4px #7c9aff;
}

.card-label { font-size: 22px; font-weight: 800; }

.card-check {
  position: absolute;
  top: 16px; right: 16px;
  background: white; color: black;
  width: 32px; height: 32px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-weight: bold;
}

.details-stack { display: flex; flex-direction: column; gap: 32px; }
.section-title { font-size: 14px; text-transform: uppercase; color: #86868b; font-weight: 700; letter-spacing: 1.2px; }

.chips-wrap { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 16px; }

.modern-chip {
  padding: 14px 24px;
  border-radius: 100px;
  border: 2px solid #f2f2f7;
  background: white;
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.modern-chip:hover {
  background: #f2f2f7;
  border-color: #e5e5ea;
}

.modern-chip.active {
  background: #1d1d1f;
  color: white;
  border-color: #1d1d1f;
  transform: scale(1.05);
}

.onboarding-footer {
  margin-top: 50px;
  display: flex;
  gap: 16px;
}

/* Контрастная кнопка "Далее" */
.primary-btn {
  flex: 2;
  padding: 20px;
  border-radius: 20px;
  background: #4a6fff; /* Более насыщенный синий для контраста */
  color: white;
  border: none;
  font-weight: 800;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 10px 25px rgba(74, 111, 255, 0.25);
}

.primary-btn:hover:not(:disabled) {
  background: #365cf5;
  transform: translateY(-2px);
  box-shadow: 0 15px 30px rgba(74, 111, 255, 0.35);
}

.primary-btn:disabled {
  background: #e5e5ea;
  color: #aeaeb2;
  box-shadow: none;
  cursor: not-allowed;
}

.secondary-btn {
  flex: 1;
  padding: 20px;
  border-radius: 20px;
  background: #f2f2f7;
  border: none;
  font-weight: 700;
  color: #1d1d1f;
  cursor: pointer;
  transition: background 0.2s;
}

.secondary-btn:hover { background: #e5e5ea; }

/* Плавное появление шагов */
.step-fade {
  animation: fadeIn 0.4s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>