<template>
  <div class="status-display">
    <div class="status-indicator" :class="currentStatus">
      <div class="pulse-ring"></div>
      <div class="status-content">
        <div class="status-icon">
          <svg v-if="currentStatus === 'recording'" width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="8" fill="currentColor" />
          </svg>
          <svg v-else-if="currentStatus === 'transcribing'" width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2V6M12 18V22M4.93 4.93L7.76 7.76M16.24 16.24L19.07 19.07M2 12H6M18 12H22M4.93 19.07L7.76 16.24M16.24 7.76L19.07 4.93"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
          <svg v-else-if="currentStatus === 'analyzing'" width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L15.09 8.26L22 9L17 14L18.18 21L12 17.77L5.82 21L7 14L2 9L8.91 8.26L12 2Z"
              stroke="currentColor" stroke-width="2" fill="none" />
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M9 12L11 14L15 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"
              stroke-linejoin="round" />
          </svg>
        </div>
        <div class="status-time" v-if="currentStatus === 'recording'">
          {{ formatTime(recordingTime) }}
        </div>
      </div>
    </div>

    <div class="status-text">
      <div class="primary-text">{{ primaryText }}</div>
      <div class="secondary-text">{{ secondaryText }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface StatusPanelProps {
  status: 'idle' | 'recording' | 'transcribing' | 'analyzing' | 'completed' | 'error'
  recordingTime: number
  score?: number
  error?: string
}

const props = defineProps<StatusPanelProps>()

const currentStatus = computed(() => props.status)

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const primaryText = computed(() => {
  switch (props.status) {
    case 'recording': return '正在录音'
    case 'transcribing': return '正在转录'
    case 'analyzing': return '正在分析'
    case 'completed': return `得分：${props.score}`
    case 'error': return '出现错误'
    default: return '等待开始'
  }
})

const secondaryText = computed(() => {
  switch (props.status) {
    case 'recording': return '清楚地表达你的回答'
    case 'transcribing': return '识别语音内容中...'
    case 'analyzing': return '生成反馈建议中...'
    case 'completed': return '已生成详细反馈'
    case 'error': return props.error || '请重试'
    default: return '等待处理结果'
  }
})
</script>

<style scoped>
.status-display {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  overflow: visible;
}

.status-indicator {
  z-index: 10;
  overflow: visible;
  position: relative;
  width: 56px;
  height: 56px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
}

.pulse-ring {
  position: absolute;
  top: -3px;
  left: -3px;
  right: -3px;
  bottom: -3px;
  border-radius: var(--radius-full);
  animation: pulse-ring 2s ease-in-out infinite;
}

.status-indicator.recording .pulse-ring {
  background: rgba(239, 68, 68, 0.2);
  animation: pulse-ring 1s ease-in-out infinite;
}

.status-indicator.transcribing .pulse-ring,
.status-indicator.analyzing .pulse-ring {
  background: rgba(245, 158, 11, 0.2);
}

.status-indicator.completed .pulse-ring {
  background: rgba(34, 197, 94, 0.2);
  animation: pulse-ring 3s ease-in-out infinite;
}

.status-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.status-icon {
  width: 20px;
  height: 20px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.status-indicator.recording .status-icon {
  background: linear-gradient(135deg, var(--color-delete), #dc2626);
}

.status-indicator.transcribing .status-icon,
.status-indicator.analyzing .status-icon {
  background: linear-gradient(135deg, var(--color-edit), #d97706);
  animation: rotate 2s linear infinite;
}

.status-indicator.completed .status-icon {
  background: linear-gradient(135deg, #22c55e, #16a34a);
}

.status-time {
  font-size: 10px;
  font-weight: 600;
  color: var(--color-delete);
  min-width: 30px;
  text-align: center;
}

.status-text {
  text-align: left;
  flex: 1;
}

.primary-text {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin-bottom: 2px;
}

.secondary-text {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.3;
}

@keyframes pulse-ring {
  0% {
    transform: scale(0.8);
    opacity: 1;
  }

  100% {
    transform: scale(1.0);
    opacity: 0;
  }
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>