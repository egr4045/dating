<template>
  <div class="settings-container">
    <div class="glass-card">
      <header class="settings-header">
        <button class="back-btn" @click="$router.push('/dashboard')">← Назад</button>
        <h1 class="page-title">Настройки</h1>
      </header>

      <div v-if="loading" class="loading-state">Загрузка...</div>

      <template v-else>
        <!-- Репутация -->
        <div class="reputation-block">
          <div class="rep-header">
            <span class="rep-label">Твоя репутация</span>
            <span class="rep-value" :class="repClass">{{ profile?.reputation?.toFixed(1) }}</span>
          </div>
          <div class="rep-bar-bg">
            <div class="rep-bar-fill" :style="{ width: repPercent + '%' }"></div>
          </div>
        </div>

        <!-- Интересы -->
        <section class="settings-section">
          <h2 class="section-heading">🎯 Мои интересы</h2>

          <div class="spotify-grid">
            <div 
              v-for="(val, groupKey) in categories" 
              :key="groupKey"
              :class="['spotify-card-mini', { active: isGroupActive(groupKey as string) }]"
              :style="{ background: val.color }"
              @click="toggleGroup(groupKey as string)"
            >
              <span class="card-label">{{ val.title }}</span>
              <div class="card-check" v-if="isGroupActive(groupKey as string)">✓</div>
            </div>
          </div>

          <div class="details-stack" v-if="activeGroups.length > 0">
            <div v-for="groupKey in activeGroups" :key="groupKey" class="detail-section">
              <h3 class="section-title-sm">{{ categories[groupKey].title }}</h3>
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

          <button class="save-btn" @click="saveInterests" :disabled="savingInterests">
            {{ savingInterests ? 'Сохранение...' : 'Сохранить интересы' }}
          </button>
        </section>

        <!-- Слоты -->
        <section class="settings-section">
          <h2 class="section-heading">🕐 Моё расписание</h2>
          <SlotPicker v-model="timeSlots" title="" />
          <button class="save-btn" @click="saveSlots" :disabled="savingSlots">
            {{ savingSlots ? 'Сохранение...' : 'Сохранить расписание' }}
          </button>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { API_URL } from '../config';
import SlotPicker from './SlotPicker.vue';

const loading = ref(true);
const savingInterests = ref(false);
const savingSlots = ref(false);
const profile = ref<any>(null);
const selectedInterests = ref<string[]>([]);
const timeSlots = ref<{ dayOfWeek: number; timeFrom: string; timeTo: string }[]>([]);

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

// Определяем активные группы на основе выбранных интересов
const activeGroups = computed(() => {
  const groups: string[] = [];
  for (const [key, val] of Object.entries(categories)) {
    if ((val as any).items.some((item: any) => selectedInterests.value.includes(item.id))) {
      groups.push(key);
    }
  }
  return groups;
});

const isGroupActive = (key: string) => activeGroups.value.includes(key);

const toggleGroup = (key: string) => {
  const groupItems = categories[key].items.map((i: any) => i.id);
  if (isGroupActive(key)) {
    selectedInterests.value = selectedInterests.value.filter(id => !groupItems.includes(id));
  } else {
    // Добавляем все айтемы группы, которых ещё нет
    groupItems.forEach((id: string) => {
      if (!selectedInterests.value.includes(id)) {
        selectedInterests.value.push(id);
      }
    });
  }
};

const toggleInterest = (id: string) => {
  if (selectedInterests.value.includes(id)) {
    selectedInterests.value = selectedInterests.value.filter(i => i !== id);
  } else {
    selectedInterests.value.push(id);
  }
};

const repPercent = computed(() => Math.min(100, Math.max(0, ((profile.value?.reputation || 0) / 10) * 100)));
const repClass = computed(() => {
  const r = profile.value?.reputation || 0;
  if (r >= 4) return 'rep-good';
  if (r >= 2) return 'rep-warn';
  return 'rep-bad';
});

const loadProfile = async () => {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    const res = await fetch(`${API_URL}/users/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    profile.value = await res.json();
    selectedInterests.value = [...(profile.value.interests || [])];
    timeSlots.value = (profile.value.timeSlots || []).map((s: any) => ({
      dayOfWeek: s.dayOfWeek,
      timeFrom: s.timeFrom,
      timeTo: s.timeTo,
    }));
  } catch (e) {
    console.error('Ошибка загрузки профиля:', e);
  } finally {
    loading.value = false;
  }
};

const saveInterests = async () => {
  const token = localStorage.getItem('token');
  if (!token) return;
  savingInterests.value = true;
  try {
    await fetch(`${API_URL}/users/interests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ interests: selectedInterests.value }),
    });
    alert('Интересы сохранены! ✅');
  } catch (e) {
    alert('Ошибка сохранения');
  } finally {
    savingInterests.value = false;
  }
};

const saveSlots = async () => {
  const token = localStorage.getItem('token');
  if (!token) return;
  savingSlots.value = true;
  try {
    await fetch(`${API_URL}/users/slots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ slots: timeSlots.value }),
    });
    alert('Расписание сохранено! ✅');
  } catch (e) {
    alert('Ошибка сохранения');
  } finally {
    savingSlots.value = false;
  }
};

onMounted(loadProfile);
</script>

<style scoped>
.settings-container {
  display: flex;
  justify-content: center;
  padding: 24px;
  min-height: 100vh;
}

.glass-card {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  border-radius: 32px;
  padding: 40px;
  width: 100%;
  max-width: 600px;
  box-shadow: 0 30px 60px rgba(0,0,0,0.08);
}

.settings-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 32px;
}
.back-btn {
  background: #f2f2f7;
  border: none;
  padding: 10px 16px;
  border-radius: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s;
}
.back-btn:hover { background: #e5e5ea; }
.page-title { font-size: 28px; font-weight: 800; color: #1d1d1f; margin: 0; }

.loading-state { text-align: center; padding: 40px; color: #86868b; }

/* Репутация */
.reputation-block {
  background: #f8f9fc;
  border-radius: 20px;
  padding: 20px 24px;
  margin-bottom: 32px;
}
.rep-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.rep-label { font-weight: 600; color: #86868b; font-size: 14px; }
.rep-value { font-weight: 800; font-size: 20px; }
.rep-good { color: #43E97B; }
.rep-warn { color: #ffb300; }
.rep-bad { color: #ff5252; }
.rep-bar-bg { height: 8px; background: #e5e5ea; border-radius: 4px; overflow: hidden; }
.rep-bar-fill { height: 100%; background: linear-gradient(90deg, #43E97B, #38f9d7); border-radius: 4px; transition: width 0.5s ease; }

/* Секции */
.settings-section {
  border-top: 1px solid #f0f0f0;
  padding-top: 28px;
  margin-top: 28px;
}
.section-heading { font-size: 20px; font-weight: 800; color: #1d1d1f; margin: 0 0 20px; }

/* Мини-карточки категорий */
.spotify-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}
.spotify-card-mini {
  height: 80px;
  border-radius: 16px;
  padding: 14px;
  color: white;
  cursor: pointer;
  position: relative;
  transition: all 0.3s ease;
  display: flex;
  align-items: flex-end;
  font-size: 14px;
}
.spotify-card-mini:hover { transform: scale(1.03); }
.spotify-card-mini.active { box-shadow: 0 0 0 3px #7c9aff; }
.card-label { font-weight: 800; font-size: 14px; }
.card-check {
  position: absolute;
  top: 8px; right: 8px;
  background: white; color: black;
  width: 24px; height: 24px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-weight: bold; font-size: 12px;
}

.details-stack { display: flex; flex-direction: column; gap: 20px; margin-bottom: 20px; }
.section-title-sm { font-size: 12px; text-transform: uppercase; color: #86868b; font-weight: 700; letter-spacing: 1px; }
.chips-wrap { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.modern-chip {
  padding: 10px 18px;
  border-radius: 100px;
  border: 2px solid #f2f2f7;
  background: white;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.modern-chip:hover { background: #f2f2f7; }
.modern-chip.active { background: #1d1d1f; color: white; border-color: #1d1d1f; }

.save-btn {
  width: 100%;
  padding: 16px;
  border-radius: 16px;
  border: none;
  background: #4a6fff;
  color: white;
  font-weight: 800;
  font-size: 16px;
  cursor: pointer;
  margin-top: 20px;
  transition: all 0.2s;
  box-shadow: 0 8px 20px rgba(74, 111, 255, 0.2);
}
.save-btn:hover:not(:disabled) { background: #365cf5; transform: translateY(-1px); }
.save-btn:disabled { background: #e5e5ea; color: #aeaeb2; box-shadow: none; cursor: not-allowed; }
</style>
