<template>
  <div class="record-content">
    <!-- 用户答案部分 -->
    <div class="content-section user-section">
      <div class="section-header">
        <svg class="section-icon" viewBox="0 0 24 24" fill="none">
          <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2Z" stroke="currentColor" stroke-width="1.5"/>
          <circle cx="12" cy="10" r="3" stroke="currentColor" stroke-width="1.5"/>
          <path d="M6 20.5C6 17.46 8.69 15 12 15C15.31 15 18 17.46 18 20.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span class="section-label">你的回答</span>
      </div>

      <div class="section-body">
        <!-- 音频播放器 -->
        <div class="audio-wrapper" v-if="record.audio_file">
          <AudioPlayer :audio-file="record.audio_file" />
        </div>

        <!-- 转录文字 -->
        <p class="transcript-text">{{ getDisplayText() }}</p>
      </div>
    </div>

    <!-- AI 点评部分 -->
    <div class="content-section ai-section comment-section">
      <div class="section-header">
        <svg class="section-icon" viewBox="0 0 24 24" fill="none">
          <path d="M12 2L15.09 8.26L22 9L17 14L18.18 21L12 17.77L5.82 21L7 14L2 9L8.91 8.26L12 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
        </svg>
        <span class="section-label">点评</span>

        <!-- 分数徽章 -->
        <div class="score-badge" v-if="record.score || isProcessing">
          <span class="score-number">{{ record.score || '...' }}</span>
          <span class="score-unit">/9</span>
        </div>
      </div>

      <div class="section-body">
        <p class="feedback-text">{{ feedbackParts.chinese || '正在生成反馈...' }}</p>
      </div>
    </div>

    <!-- 英文优化部分 -->
    <div class="content-section ai-section improved-section" v-if="feedbackParts.english">
      <div class="section-header">
        <svg class="section-icon" viewBox="0 0 24 24" fill="none">
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="section-label">优化版本</span>
      </div>

      <div class="section-body">
        <p class="improved-text">{{ feedbackParts.english }}</p>
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

const isProcessing = computed(() => {
  return props.currentStatus === 'transcribing' || props.currentStatus === 'analyzing'
})

// 将 ai_feedback 拆分为中文点评和英文优化两部分
// 新格式用 \n---\n 分隔；旧记录无分隔符时整体作为点评显示
const feedbackParts = computed(() => {
  const raw = props.record.ai_feedback || ''
  const idx = raw.indexOf('\n---\n')
  if (idx === -1) return { chinese: raw, english: '' }
  return {
    chinese: raw.slice(0, idx).trim(),
    english: raw.slice(idx + 5).trim()
  }
})

const getDisplayText = () => {
  if (props.record.user_answer) {
    return props.record.user_answer
  }

  if (props.isPracticing && props.currentStatus === 'recording') {
    return '正在聆听...'
  }

  if (props.isPracticing && isProcessing.value) {
    return '转录中...'
  }

  return '等待录音...'
}
</script>

<style scoped>
.record-content {
  display: flex;
  flex-direction: column;
  gap: 1px;
  background: rgba(0, 0, 0, 0.1);
}

/* ═══════════════════════════════════════════════════════════════════════════
   内容区块
   ═══════════════════════════════════════════════════════════════════════════ */

.content-section {
  background: rgba(250, 247, 242, 0.02);
  padding: 16px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.section-icon {
  width: 16px;
  height: 16px;
  color: var(--primitive-ink-400);
  flex-shrink: 0;
}

.section-label {
  font-family: var(--font-ui);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--primitive-ink-400);
}

.section-body {
  padding-left: 24px;
}

/* ═══════════════════════════════════════════════════════════════════════════
   用户回答部分
   ═══════════════════════════════════════════════════════════════════════════ */

.user-section {
  border-left: 2px solid rgba(93, 122, 93, 0.4);
}

.user-section .section-icon {
  color: var(--primitive-olive-400);
}

.user-section .section-label {
  color: var(--primitive-olive-400);
}

.audio-wrapper {
  margin-bottom: 12px;
}

.transcript-text {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 14px;
  line-height: 1.65;
  color: var(--primitive-paper-300);
  white-space: pre-wrap;
  word-break: break-word;
}

/* ═══════════════════════════════════════════════════════════════════════════
   AI反馈部分
   ═══════════════════════════════════════════════════════════════════════════ */

.ai-section {
  border-left: 2px solid rgba(184, 134, 11, 0.4);
}

.ai-section .section-icon {
  color: var(--primitive-gold-400);
}

.ai-section .section-label {
  color: var(--primitive-gold-400);
}

.score-badge {
  margin-left: auto;
  display: flex;
  align-items: baseline;
  gap: 2px;
  padding: 4px 10px;
  background: linear-gradient(135deg, rgba(184, 134, 11, 0.2), rgba(153, 107, 61, 0.15));
  border: 1px solid rgba(184, 134, 11, 0.3);
  border-radius: var(--radius-full);
}

.score-number {
  font-family: var(--font-data);
  font-size: 14px;
  font-weight: 700;
  color: var(--primitive-gold-400);
}

.score-unit {
  font-family: var(--font-ui);
  font-size: 10px;
  color: var(--primitive-gold-500);
  opacity: 0.8;
}

.feedback-text {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 14px;
  line-height: 1.65;
  color: var(--primitive-paper-400);
  white-space: pre-wrap;
  word-break: break-word;
}

/* 英文优化版本区块 */
.improved-section {
  border-left-color: rgba(93, 122, 93, 0.3);
}

.improved-section .section-icon {
  color: var(--primitive-olive-500);
}

.improved-section .section-label {
  color: var(--primitive-olive-500);
}

.improved-text {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 14px;
  line-height: 1.75;
  color: var(--primitive-paper-300);
  white-space: pre-wrap;
  word-break: break-word;
  font-style: italic;
}

/* ═══════════════════════════════════════════════════════════════════════════
   移动端适配
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .content-section {
    padding: 14px;
  }

  .section-body {
    padding-left: 20px;
  }

  .transcript-text,
  .feedback-text,
  .improved-text {
    font-size: 13px;
    line-height: 1.6;
  }

  .score-number {
    font-size: 13px;
  }
}
</style>
