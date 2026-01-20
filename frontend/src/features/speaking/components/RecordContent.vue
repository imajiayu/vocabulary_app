<!-- RecordContent.vue -->
<template>
  <div class="record-content" :class="{ 'practicing': isPracticing }">
    <!-- 用户答案部分 -->
    <div class="user-section">
      <div class="content-wrapper">
        <div class="audio-section" v-if="record.audio_file">
          <AudioPlayer :audio-file="record.audio_file" />
        </div>
        <div class="text-section">
          <p class="answer-text">{{ getDisplayText() }}</p>
        </div>
      </div>
      
      <!-- 状态指示器 -->
      <div class="status-section">
        <div class="status-indicator" :class="currentStatus" v-if="isPracticing && (currentStatus === 'recording' || isProcessing)">
          <div class="pulse-ring"></div>
          <div class="status-content">
            <div class="status-icon">
              <svg v-if="currentStatus === 'recording'" width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="8" fill="currentColor"/>
              </svg>
              <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2V6M12 18V22M4.93 4.93L7.76 7.76M16.24 16.24L19.07 19.07M2 12H6M18 12H22M4.93 19.07L7.76 16.24M16.24 7.76L19.07 4.93" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </div>
            <div class="status-time" v-if="currentStatus === 'recording' && recordingTime && recordingTime > 0">
              {{ formatTime(recordingTime) }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- AI反馈部分 -->
    <div class="ai-section">
      <div class="feedback-content">
        <div class="score-badge" v-if="record.score || isProcessing">
          <span class="score-text">得分</span>
          <span class="score-value">{{ record.score || '评分中...' }}</span>
        </div>
        <p class="feedback-text">{{ record.ai_feedback || '正在生成反馈中...' }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { SpeakingRecord } from '@/shared/types'
import AudioPlayer from './AudioPlayer.vue'

const props = defineProps<{
  record: SpeakingRecord
  isPracticing?: boolean
  currentStatus?: string
  recordingTime?: number
}>()

defineEmits<{
  delete: []
}>()

const isProcessing = computed(() => {
  return props.currentStatus === 'transcribing' || props.currentStatus === 'analyzing'
})

const getDisplayText = () => {
  // If we have user_answer, show it (could be real-time transcription or final result)
  if (props.record.user_answer) {
    return props.record.user_answer
  }

  // If we're in recording mode during practice, show appropriate message
  if (props.isPracticing && props.currentStatus === 'recording') {
    return '请开始说话...'
  }

  // If we're processing, show processing message
  if (props.isPracticing && isProcessing.value) {
    return '正在转录中...'
  }

  // Default message
  return '正在等待录音...'
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
</script>

<style scoped>
.record-content {
  background: var(--color-bg-glass-light);
  backdrop-filter: blur(10px);
  border: 1px solid var(--color-bg-glass);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  position: relative;
  transition: all 0.3s ease;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.record-content.practicing {
  background: var(--color-bg-glass-strong);
  border: 2px solid var(--color-purple-vivid-light);
  box-shadow: 0 15px 35px var(--color-purple-vivid-bg);
}

.record-content:not(.practicing):hover {
  background: var(--color-bg-glass);
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.user-section {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.content-wrapper {
  flex: 1;
  background: linear-gradient(135deg, var(--color-blue-bg), rgba(147, 197, 253, 0.04));
  border: 1px solid var(--color-blue-light);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
}

.status-section {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.status-indicator {
  position: relative;
  width: 44px;
  height: 44px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-primary);
  box-shadow: var(--shadow-sm);
}

.pulse-ring {
  position: absolute;
  top: -2px;
  left: -2px;
  right: -2px;
  bottom: -2px;
  border-radius: var(--radius-full);
  animation: pulse-ring 2s ease-in-out infinite;
}

.status-indicator.recording .pulse-ring {
  background: var(--color-recording-light);
  animation: pulse-ring 1s ease-in-out infinite;
}

.status-indicator.transcribing .pulse-ring,
.status-indicator.analyzing .pulse-ring {
  background: var(--color-processing-light);
}

.status-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.status-icon {
  width: 16px;
  height: 16px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-inverse);
}

.status-indicator.recording .status-icon {
  background: linear-gradient(135deg, var(--color-recording), var(--color-recording-dark));
}

.status-indicator.transcribing .status-icon,
.status-indicator.analyzing .status-icon {
  background: linear-gradient(135deg, var(--color-processing), var(--color-processing-dark));
  animation: rotate 2s linear infinite;
}

.status-time {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-recording);
  min-width: 30px;
  text-align: center;
}

.audio-section {
  margin-bottom: 8px;
}

.answer-text, .feedback-text {
  margin: 0;
  line-height: 1.4;
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  word-wrap: break-word;
  word-break: break-word;
  white-space: pre-wrap;
}

.ai-section {
  background: linear-gradient(135deg, var(--color-purple-vivid-bg), rgba(196, 181, 253, 0.04));
  border: 1px solid var(--color-purple-vivid-light);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
}

.feedback-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.score-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: linear-gradient(135deg, var(--color-purple-vivid), var(--color-purple-vivid-dark));
  color: var(--color-text-inverse);
  padding: 3px 10px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: 600;
  align-self: flex-start;
}

.score-text {
  opacity: 0.9;
}

.score-value {
  font-size: 12px;
  font-weight: 700;
}

@keyframes pulse-ring {
  0% { transform: scale(0.8); opacity: 1; }
  100% { transform: scale(1.4); opacity: 0; }
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>