<template>
  <div class="onboarding-container">
    <div class="glass-card">
      
      <!-- ШАГ 0: Обучающий экран -->
      <div v-if="currentStep === 0" class="step-fade">
        <div class="welcome-icon">🎯</div>
        <h1 class="huge-title">Добро пожаловать в&nbsp;Quests!</h1>
        <p class="welcome-lead">Это не знакомства. Это поиск приятеля на конкретное занятие.</p>
        
        <div class="rules-list">
          <div class="rule-item">
            <span class="rule-emoji">1️⃣</span>
            <p>Ты выбираешь интересы и время, когда свободен.</p>
          </div>
          <div class="rule-item">
            <span class="rule-emoji">2️⃣</span>
            <p>Мы находим тебе напарника, который хочет того же.</p>
          </div>
          <div class="rule-item">
            <span class="rule-emoji">3️⃣</span>
            <p>Встреча состоялась? Отметь «Всё супер!» — и репутация растёт.</p>
          </div>
        </div>

        <div class="warning-block">
          <h4>⚠️ Важно — правила платформы:</h4>
          <ul>
            <li>Одновременно может быть только <strong>один активный метч</strong> — чтобы не подводить людей.</li>
            <li>Если ты пропустил встречу без отмены — <strong>репутация упадёт</strong>.</li>
            <li>Репутация ниже 2.0 → <strong>бан на 30 дней</strong>. Мы относимся к чужому времени серьёзно.</li>
          </ul>
          <p class="warning-note">Это не страшно — просто будь честным. Если не можешь — отмени заранее.</p>
        </div>
      </div>

      <!-- ШАГ 1: Выбор категорий -->
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

      <!-- ШАГ 2: Детали интересов -->
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

      <!-- ШАГ 3: Выбор времени -->
      <div v-if="currentStep === 3" class="step-fade">
        <h1 class="huge-title">Когда ты свободен?</h1>
        <p class="subtitle">Укажи дни и время — мы будем искать напарников под твоё расписание</p>
        
        <SlotPicker v-model="timeSlots" title="" />
      </div>

      <footer class="onboarding-footer">
        <button v-if="currentStep > 0" class="secondary-btn" @click="currentStep--">
          Назад
        </button>
        <button 
          class="primary-btn" 
          :disabled="isNextDisabled"
          @click="handleNext"
        >
          {{ stepButtonLabel }}
        </button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { API_URL } from '../config';
import SlotPicker from './SlotPicker.vue';

const currentStep = ref(0);
const selectedGroups = ref<string[]>([]);
const selectedInterests = ref<string[]>([]);
const timeSlots = ref<{ dayOfWeek: number; timeFrom: string; timeTo: string }[]>([]);
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
  if (currentStep.value === 0) return false;
  if (currentStep.value === 1) return selectedGroups.value.length === 0;
  if (currentStep.value === 2) return selectedInterests.value.length < 2;
  if (currentStep.value === 3) return timeSlots.value.length === 0;
  return false;
});

const stepButtonLabel = computed(() => {
  if (currentStep.value === 0) return 'Понятно, поехали! 🚀';
  if (currentStep.value === 3) return 'Готово';
  return 'Далее';
});

const handleNext = async () => {
  if (currentStep.value < 3) {
    currentStep.value++;
    return;
  }

  // Финальный шаг — сохраняем всё
  const token = localStorage.getItem('token');
  if (!token) {
    alert('Ошибка: сессия не найдена.');
    router.push('/');
    return;
  }

  try {
    // Сохраняем интересы
    const resInterests = await fetch(`${API_URL}/users/interests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ interests: selectedInterests.value }),
    });

    // Сохраняем слоты
    const resSlots = await fetch(`${API_URL}/users/slots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ slots: timeSlots.value }),
    });

    if (resInterests.ok && resSlots.ok) {
      router.push('/dashboard'); 
    } else {
      alert('Не удалось сохранить данные. Попробуйте позже.');
    }
  } catch (e) {
    console.error('Ошибка при сохранении:', e);
    alert('Проблема с соединением');
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

/* Шаг 0: Добро пожаловать */
.welcome-icon {
  font-size: 56px;
  margin-bottom: 16px;
}
.welcome-lead {
  font-size: 18px;
  color: #555;
  margin-bottom: 32px;
  line-height: 1.5;
}

.rules-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 28px;
}
.rule-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  background: #f8f9fc;
  padding: 16px;
  border-radius: 16px;
}
.rule-emoji {
  font-size: 20px;
  flex-shrink: 0;
}
.rule-item p {
  margin: 0;
  font-size: 15px;
  color: #333;
  line-height: 1.4;
}

.warning-block {
  background: linear-gradient(135deg, #fff8e1, #fff3cd);
  border-radius: 20px;
  padding: 20px 24px;
  border-left: 4px solid #ffb300;
}
.warning-block h4 {
  margin: 0 0 12px;
  font-size: 15px;
  color: #1d1d1f;
}
.warning-block ul {
  margin: 0;
  padding-left: 20px;
}
.warning-block li {
  font-size: 14px;
  color: #555;
  line-height: 1.6;
}
.warning-note {
  margin: 12px 0 0;
  font-size: 13px;
  color: #888;
  font-style: italic;
}

/* Общие стили заголовков */
.huge-title { 
  font-size: 36px; 
  font-weight: 800; 
  color: #1d1d1f; 
  margin-bottom: 12px; 
  letter-spacing: -1px; 
}

.subtitle { color: #86868b; font-size: 18px; margin-bottom: 40px; }

/* Сетка категорий */
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

.primary-btn {
  flex: 2;
  padding: 20px;
  border-radius: 20px;
  background: #4a6fff;
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

.step-fade {
  animation: fadeIn 0.4s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>