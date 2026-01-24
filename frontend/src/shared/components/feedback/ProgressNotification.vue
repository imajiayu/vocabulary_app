<template>
  <div v-if="show" class="progress-notification">
    <div class="progress-notification-content" @click="$emit('resume')">
      <div class="progress-notification-icon">📚</div>
      <div class="progress-notification-text">
        <div class="progress-notification-title">发现未完成的学习进度</div>
        <div class="progress-notification-details">
          <span class="progress-source">{{ progressInfo.source }}</span>
          <span class="progress-mode">{{ getModeDisplayName(progressInfo.mode) }}</span>
          <span class="progress-shuffle">{{ progressInfo.shuffle ? '随机' : '顺序' }}</span>
          <span class="progress-stats">
            已完成 <span class="progress-number">{{ completedCount }}/{{ totalCount }}</span> 个单词，
            还剩 <span class="progress-remaining">{{ remainingCount }}</span> 个
          </span>
        </div>
      </div>
      <button @click.stop="$emit('dismiss')" class="progress-notification-close">
        ✕
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface ProgressInfo {
  mode: string
  source: string
  shuffle: boolean
  current_index: number
  total_words: number
  remaining_words: number
  initial_lapse_word_count: number
}

interface Props {
  show: boolean
  progressInfo: ProgressInfo
}

const props = defineProps<Props>()

defineEmits<{
  resume: []
  dismiss: []
}>()

const getModeDisplayName = (mode: string) => {
  const modeMap: Record<string, string> = {
    'mode_review': '复习已有',
    'mode_lapse': '复习错题',
    'mode_spelling': '拼写熟练'
  }
  return modeMap[mode] || mode
}

// 根据模式计算已完成单词数
const completedCount = computed(() => {
  if (props.progressInfo.mode === 'mode_lapse') {
    return props.progressInfo.initial_lapse_word_count - props.progressInfo.total_words
  }
  return props.progressInfo.current_index
})

// 根据模式计算总单词数
const totalCount = computed(() => {
  if (props.progressInfo.mode === 'mode_lapse') {
    return props.progressInfo.initial_lapse_word_count
  }
  return props.progressInfo.total_words
})

// 根据模式计算剩余单词数
const remainingCount = computed(() => {
  if (props.progressInfo.mode === 'mode_lapse') {
    return props.progressInfo.total_words
  }
  return props.progressInfo.remaining_words
})
</script>

<style scoped>
/* 进度恢复通知条样式 */
.progress-notification {
  margin-bottom: 1.5rem;
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%);
  border: 1px solid rgba(34, 197, 94, 0.2);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.progress-notification-content {
  display: flex;
  align-items: flex-start;
  padding: 1rem;
  gap: 0.75rem;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.progress-notification-content:hover {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%);
}

.progress-notification-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
  margin-top: 0.125rem;
}

.progress-notification-text {
  flex: 1;
  min-width: 0;
}

.progress-notification-title {
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 0.25rem;
  font-size: 0.9rem;
}

.progress-notification-details {
  color: var(--color-text-secondary);
  font-size: 0.8rem;
  line-height: 1.4;
}

/* 进度通知高亮元素 */
.progress-source {
  color: var(--color-primary);
  font-weight: 600;
}

.progress-mode {
  color: var(--color-success);
  font-weight: 600;
}

.progress-mode::before {
  content: '·';
  margin: 0 0.25rem;
  color: var(--color-text-tertiary);
}

.progress-shuffle {
  color: var(--color-edit);
  font-weight: 600;
  margin-right: 0.5rem;
}

.progress-shuffle::before {
  content: '·';
  margin: 0 0.25rem;
  color: var(--color-text-tertiary);
}

.progress-stats {
  color: var(--color-text-secondary);
}

.progress-number {
  color: var(--color-primary);
  font-weight: 600;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
}

.progress-remaining {
  color: var(--color-delete);
  font-weight: 600;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
}

.progress-notification-close {
  background: none;
  border: none;
  color: var(--color-text-tertiary);
  cursor: pointer;
  padding: 0.25rem;
  border-radius: var(--radius-xs);
  flex-shrink: 0;
  transition: all 0.2s ease;
  font-size: 1rem;
  line-height: 1;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.progress-notification-close:hover {
  background: rgba(0, 0, 0, 0.1);
  color: var(--color-text-primary);
}

/* 移动端通知条适配 */
@media (max-width: 480px) {
  .progress-notification {
    margin-bottom: 1.25rem;
  }

  .progress-notification-content {
    padding: 0.875rem;
    gap: 0.625rem;
  }

  .progress-notification-icon {
    font-size: 1.125rem;
  }

  .progress-notification-title {
    font-size: 0.85rem;
  }

  .progress-notification-details {
    font-size: 0.75rem;
  }
}

/* 小屏手机通知条优化 */
@media (max-width: 480px) {
  .progress-notification-content {
    padding: 0.75rem;
    gap: 0.5rem;
  }

  .progress-notification-icon {
    font-size: 1rem;
  }

  .progress-notification-title {
    font-size: 0.8rem;
  }

  .progress-notification-details {
    font-size: 0.7rem;
  }

  .progress-notification-close {
    width: 20px;
    height: 20px;
    font-size: 0.9rem;
  }
}
</style>
