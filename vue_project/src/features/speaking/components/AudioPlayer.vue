<template>
  <div class="audio-player">
    <button 
      class="play-btn"
      @click="togglePlay"
      :disabled="!audioFile"
    >
      <svg v-if="!isPlaying" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 5V19L19 12L8 5Z" fill="currentColor"/>
      </svg>
      <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 4H10V20H6V4Z" fill="currentColor"/>
        <path d="M14 4H18V20H14V4Z" fill="currentColor"/>
      </svg>
    </button>
    
    <div class="audio-info">
      <div class="duration">{{ formatDuration(currentTime) }} / {{ formatDuration(duration) }}</div>
      <div class="progress-bar" @click="seekTo">
        <div class="progress-track"></div>
        <div 
          class="progress-fill" 
          :style="{ width: progressPercent + '%' }"
        ></div>
      </div>
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

const props = defineProps<{
  audioFile: string | File
}>()

const audioElement = ref<HTMLAudioElement>()
const isPlaying = ref(false)
const currentTime = ref(0)
const duration = ref(0)

const BACKEND_ORIGIN = 'http://localhost:5001' 
const audioSrc = computed(() => {
  if (!props.audioFile) return ''

  if (typeof props.audioFile === 'string') {
    // 如果以 / 开头，认为是静态资源路径，加上当前域名
    if (props.audioFile.startsWith('/')) {
      return BACKEND_ORIGIN + props.audioFile
    }
    // 否则当作完整 URL
    return props.audioFile
  } else if (props.audioFile instanceof File) {
    // File 对象，创建 Object URL
    return URL.createObjectURL(props.audioFile)
  }

  return ''
})

// 计算进度百分比
const progressPercent = computed(() => {
  if (duration.value === 0) return 0
  return (currentTime.value / duration.value) * 100
})

// 切换播放/暂停
const togglePlay = async () => {
  if (!audioElement.value || !props.audioFile) return
  
  if (isPlaying.value) {
    audioElement.value.pause()
  } else {
    try {
      await audioElement.value.play()
    } catch (error) {
      console.error('播放音频失败:', error)
    }
  }
}

// 跳转到指定位置
const seekTo = (event: MouseEvent) => {
  if (!audioElement.value || duration.value === 0) return
  
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const percent = (event.clientX - rect.left) / rect.width
  const newTime = percent * duration.value
  
  audioElement.value.currentTime = newTime
}

// 格式化时间
const formatDuration = (seconds: number) => {
  if (isNaN(seconds) || seconds === 0) return '0:00'
  
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// 音频事件处理
const onLoadedMetadata = () => {
  if (audioElement.value) {
    duration.value = audioElement.value.duration || 0
  }
}

// 更新时长的通用函数
const updateDuration = () => {
  if (audioElement.value && audioElement.value.duration && !isNaN(audioElement.value.duration)) {
    duration.value = audioElement.value.duration
  }
}

const onLoadedData = () => {
  updateDuration()
}

const onCanPlay = () => {
  updateDuration()
}

const onDurationChange = () => {
  updateDuration()
}

const onTimeUpdate = () => {
  if (audioElement.value) {
    currentTime.value = audioElement.value.currentTime
  }
}

const onEnded = () => {
  isPlaying.value = false
  currentTime.value = 0
}

// 监听播放状态变化
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

// 清理资源
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
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  backdrop-filter: blur(5px);
}

.play-btn {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border: none;
  background: linear-gradient(135deg, #3b82f6, #1d4ed8);
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.play-btn:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.play-btn:disabled {
  background: #d1d5db;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.audio-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.duration {
  font-size: 12px;
  color: #6b7280;
  font-weight: 500;
  white-space: nowrap;
}

.progress-bar {
  position: relative;
  height: 4px;
  cursor: pointer;
  border-radius: 2px;
  overflow: hidden;
}

.progress-track {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.1);
}

.progress-fill {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  background: linear-gradient(90deg, #3b82f6, #1d4ed8);
  transition: width 0.1s ease;
}

audio {
  display: none;
}
</style>