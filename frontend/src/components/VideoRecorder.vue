<template>
  <div class="video-recorder">
    <!-- Превью камеры / записанное видео -->
    <div class="video-wrap">
      <video
        v-if="state !== 'done'"
        ref="videoEl"
        class="video-preview"
        autoplay
        muted
        playsinline
      />
      <video
        v-else
        ref="playbackEl"
        class="video-preview"
        :src="recordedUrl"
        controls
        playsinline
      />

      <!-- Оверлей статуса -->
      <div v-if="state === 'idle'" class="video-overlay">
        <span class="camera-icon">📷</span>
        <span>Камера готова</span>
      </div>
      <div v-if="state === 'recording'" class="video-overlay recording-badge">
        <span class="rec-dot" />
        REC {{ timer }}с
      </div>
    </div>

    <!-- Кнопки управления -->
    <div class="recorder-actions">
      <button v-if="state === 'idle'" class="btn btn-primary" @click="startRecording">
        🎥 Начать запись
      </button>

      <button v-if="state === 'recording'" class="btn btn-danger" @click="stopRecording">
        ⏹ Остановить
      </button>

      <template v-if="state === 'done'">
        <button class="btn btn-success" @click="submitVideo" :disabled="uploading">
          {{ uploading ? 'Отправка...' : '✅ Отправить' }}
        </button>
        <button class="btn btn-ghost btn-sm" @click="retake">Снова</button>
      </template>
    </div>

    <div v-if="error" class="text-sm" style="color:var(--danger);text-align:center">{{ error }}</div>
    <div class="text-xs text-muted text-center">
      Запись 5–15 секунд · Видео видят только модераторы
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from 'vue';

const emit = defineEmits<{ (e: 'recorded', videoUrl: string): void }>();

type State = 'idle' | 'recording' | 'done';
const state = ref<State>('idle');
const error = ref('');
const uploading = ref(false);
const timer = ref(0);
const recordedUrl = ref('');
const recordedBlob = ref<Blob | null>(null);

const videoEl = ref<HTMLVideoElement>();

let stream: MediaStream | null = null;
let recorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let timerInterval: ReturnType<typeof setInterval> | null = null;
let maxTimeout: ReturnType<typeof setTimeout> | null = null;

async function startRecording() {
  error.value = '';
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    if (videoEl.value) {
      videoEl.value.srcObject = stream;
    }

    chunks = [];
    recorder = new MediaRecorder(stream, { mimeType: getSupportedMimeType() });
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = finalize;
    recorder.start(200);

    state.value = 'recording';
    timer.value = 0;
    timerInterval = setInterval(() => { timer.value++; }, 1000);
    maxTimeout = setTimeout(stopRecording, 15_000);
  } catch {
    error.value = 'Не удалось получить доступ к камере. Проверь разрешения.';
  }
}

function stopRecording() {
  if (recorder && recorder.state !== 'inactive') recorder.stop();
  if (timerInterval) clearInterval(timerInterval);
  if (maxTimeout) clearTimeout(maxTimeout);
  stopStream();
}

function finalize() {
  const mimeType = getSupportedMimeType();
  recordedBlob.value = new Blob(chunks, { type: mimeType });
  recordedUrl.value = URL.createObjectURL(recordedBlob.value);
  state.value = 'done';
}

function retake() {
  if (recordedUrl.value) URL.revokeObjectURL(recordedUrl.value);
  recordedUrl.value = '';
  recordedBlob.value = null;
  state.value = 'idle';
  timer.value = 0;
}

async function submitVideo() {
  if (!recordedBlob.value) return;
  uploading.value = true;

  // Конвертируем в base64 и отдаём родителю
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result as string;
    emit('recorded', dataUrl);
    uploading.value = false;
  };
  reader.readAsDataURL(recordedBlob.value);
}

function stopStream() {
  stream?.getTracks().forEach(t => t.stop());
  stream = null;
}

function getSupportedMimeType(): string {
  const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4'];
  return types.find(t => MediaRecorder.isTypeSupported(t)) ?? '';
}

onUnmounted(() => {
  stopStream();
  if (timerInterval) clearInterval(timerInterval);
  if (maxTimeout) clearTimeout(maxTimeout);
  if (recordedUrl.value) URL.revokeObjectURL(recordedUrl.value);
});
</script>

<style scoped>
.video-recorder {
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: center;
}

.video-wrap {
  position: relative;
  width: 100%;
  max-width: 320px;
  aspect-ratio: 4/3;
  border-radius: var(--radius);
  overflow: hidden;
  background: #1a1a2e;
}

.video-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.video-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #fff;
  font-size: 0.875rem;
  font-weight: 600;
  background: rgba(0,0,0,0.4);
}

.camera-icon { font-size: 2.5rem; }

.recording-badge {
  flex-direction: row;
  inset: auto;
  top: 12px;
  right: 12px;
  background: rgba(220, 60, 60, 0.85);
  border-radius: 100px;
  padding: 6px 14px;
  font-size: 0.8rem;
}

.rec-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #fff;
  animation: pulse 1s infinite;
}

.recorder-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
</style>
