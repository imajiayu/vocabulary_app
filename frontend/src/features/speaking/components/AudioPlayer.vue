<template>
  <div class="audio-player">
    <!-- 播放按钮 -->
    <button
      class="play-btn"
      @click="togglePlay"
      :disabled="!audioFile"
      :class="{ playing: isPlaying }"
    >
      <svg v-if="!isPlaying" class="play-icon" viewBox="0 0 24 24" fill="none">
        <path d="M8 5V19L19 12L8 5Z" fill="currentColor"/>
      </svg>
      <svg v-else class="pause-icon" viewBox="0 0 24 24" fill="none">
        <rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor"/>
        <rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor"/>
      </svg>
    </button>

    <!-- 进度和波形 -->
    <div class="audio-track">
      <div class="waveform-bg">
        <div class="waveform-bars">
          <span v-for="i in 24" :key="i" :style="{ height: getBarHeight(i) + '%' }"></span>
        </div>
        <div class="waveform-progress" :style="{ width: progressPercent + '%' }">
          <div class="waveform-bars">
            <span v-for="i in 24" :key="i" :style="{ height: getBarHeight(i) + '%' }"></span>
          </div>
        </div>
      </div>
      <div class="progress-overlay" @click="seekTo"></div>
    </div>

    <!-- 时间显示 -->
    <div class="time-display">
      <span class="current-time">{{ formatDuration(currentTime) }}</span>
      <span class="time-separator">/</span>
      <span class="total-time">{{ formatDuration(duration) }}</span>
    </div>

    <audio
      ref="audioElement"
      :src="audioSrc"
      @loadedmetadata="onLoadedMetadata"
      @loadeddata="onLoadedData"
      @canplay="onCanPlay"
      @durationchange="onDurationChange"
      @timeupdate="onTimeUpdate"
      @ended="onEnded"
      preload="metadata"
    ></audio>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { speakingLogger } from '@/shared/utils/logger'

const props = defineProps<{
  audioFile: string | File
}>()

const audioElement = ref<HTMLAudioElement>()
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)

// 伪波形高度（基于位置生成）
const getBarHeight = (index: number) => {
  const seed = index * 7
  return 30 + Math.sin(seed) * 25 + Math.cos(seed * 0.5) * 20
}

const audioSrc = computed(() => {
  if (!props.audioFile) return ''

  if (typeof props.audioFile === 'string') {
    return props.audioFile
  } else if (props.audioFile instanceof File) {
    return URL.createObjectURL(props.audioFile)
  }

  return ''
})

const progressPercent = computed(() => {
  if (duration.value === 0) return 0
  return (currentTime.value / duration.value) * 100
})

const togglePlay = async () => {
  if (!audioElement.value || !props.audioFile) return

  if (isPlaying.value) {
    audioElement.value.pause()
  } else {
    try {
      await audioElement.value.play()
    } catch (error) {
      speakingLogger.error('播放音频失败:', error)
    }
  }
}

const seekTo = (event: MouseEvent) => {
  if (!audioElement.value || duration.value === 0) return

  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const percent = (event.clientX - rect.left) / rect.width
  const newTime = percent * duration.value

  audioElement.value.currentTime = newTime
}

const formatDuration = (seconds: number) => {
  if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00'

  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const onLoadedMetadata = () => {
  if (audioElement.value) {
    tryResolveDuration()
  }
}

/**
 * WebM (MediaRecorder) 经常不写时长到文件头，导致 duration === Infinity
 * 通过 seek 到极大值，迫使浏览器解析出真实时长
 */
const tryResolveDuration = () => {
  const audio = audioElement.value
  if (!audio) return

  if (audio.duration && isFinite(audio.duration)) {
    duration.value = audio.duration
    return
  }

  // Infinity → 用 seek 技巧让浏览器算出真实时长
  const onSeek = () => {
    audio.removeEventListener('timeupdate', onSeek)
    if (isFinite(audio.duration)) {
      duration.value = audio.duration
    }
    audio.currentTime = 0
  }
  audio.addEventListener('timeupdate', onSeek)
  audio.currentTime = 1e10 // seek 到极大值
}

const updateDuration = () => {
  if (audioElement.value && audioElement.value.duration && isFinite(audioElement.value.duration)) {
    duration.value = audioElement.value.duration
  }
}

const onLoadedData = () => updateDuration()
const onCanPlay = () => updateDuration()
const onDurationChange = () => updateDuration()

const onTimeUpdate = () => {
  if (audioElement.value) {
    currentTime.value = audioElement.value.currentTime
  }
}

const onEnded = () => {
  isPlaying.value = false
  currentTime.value = 0
}

watch(() => audioElement.value, (audio) => {
  if (audio) {
    const updatePlayingState = () => {
      isPlaying.value = !audio.paused && !audio.ended
    }

    audio.addEventListener('play', updatePlayingState)
    audio.addEventListener('pause', updatePlayingState)
    audio.addEventListener('ended', updatePlayingState)

    return () => {
      audio.removeEventListener('play', updatePlayingState)
      audio.removeEventListener('pause', updatePlayingState)
      audio.removeEventListener('ended', updatePlayingState)
    }
  }
})

onUnmounted(() => {
  if (props.audioFile instanceof File && audioSrc.value) {
    URL.revokeObjectURL(audioSrc.value)
  }
})
</script>

<style scoped>
.audio-player {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(250, 247, 242, 0.08);
  border-radius: var(--radius-md);
}

/* ═══════════════════════════════════════════════════════════════════════════
   播放按钮
   ═══════════════════════════════════════════════════════════════════════════ */

.play-btn {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--primitive-olive-500), var(--primitive-olive-600));
  border: none;
  border-radius: 50%;
  color: var(--primitive-paper-100);
  cursor: pointer;
  transition: all 0.2s ease;
}

.play-btn:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 4px 16px rgba(93, 122, 93, 0.4);
}

.play-btn:disabled {
  background: var(--primitive-ink-600);
  cursor: not-allowed;
  opacity: 0.5;
}

.play-btn.playing {
  background: linear-gradient(135deg, var(--primitive-gold-500), var(--primitive-copper-500));
}

.play-btn.playing:hover:not(:disabled) {
  box-shadow: 0 4px 16px rgba(184, 134, 11, 0.4);
}

.play-icon,
.pause-icon {
  width: 16px;
  height: 16px;
}

.play-icon {
  margin-left: 2px;
}

/* ═══════════════════════════════════════════════════════════════════════════
   音频轨道
   ═══════════════════════════════════════════════════════════════════════════ */

.audio-track {
  flex: 1;
  position: relative;
  height: 32px;
  cursor: pointer;
}

.waveform-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  border-radius: var(--radius-sm);
}

.waveform-bars {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  padding: 4px 0;
}

.waveform-bars span {
  width: 2px;
  background: var(--primitive-ink-600);
  border-radius: 1px;
  transition: background 0.15s ease;
}

.waveform-progress {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  overflow: hidden;
}

.waveform-progress .waveform-bars span {
  background: var(--primitive-olive-400);
}

.progress-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
}

/* ═══════════════════════════════════════════════════════════════════════════
   时间显示
   ═══════════════════════════════════════════════════════════════════════════ */

.time-display {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  font-family: var(--font-data);
  font-size: 12px;
  min-width: 70px;
  justify-content: flex-end;
}

.current-time {
  color: var(--primitive-paper-300);
  font-weight: 600;
}

.time-separator {
  color: var(--primitive-ink-500);
}

.total-time {
  color: var(--primitive-ink-400);
}

audio {
  display: none;
}

/* ═══════════════════════════════════════════════════════════════════════════
   移动端适配
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .audio-player {
    padding: 8px 12px;
    gap: 10px;
  }

  .play-btn {
    width: 32px;
    height: 32px;
  }

  .play-icon,
  .pause-icon {
    width: 14px;
    height: 14px;
  }

  .audio-track {
    height: 28px;
  }

  .time-display {
    font-size: 11px;
    min-width: 60px;
  }
}
</style>
