<template>
  <div v-if="shouldDisplay" class="speed-indicator">
    <span class="speed-value">{{ speedText }}</span>
    <span class="separator">·</span>
    <span class="eta-value">{{ etaText }}</span>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useReviewStore } from '@/features/vocabulary/stores/review'

const reviewStore = useReviewStore()
const { currentIndex, mode, globalIndex, totalWords } = storeToRefs(reviewStore)

// 复习时间记录：存储每个单词的复习时间（秒）
const reviewTimes = ref<number[]>([])
const lastIndexChangeTime = ref<number>(0)
const lastRecordedIndex = ref<number>(-1)

// 是否应该显示（非lapse模式）
const shouldDisplay = computed(() => {
  return mode.value !== 'mode_lapse' && reviewTimes.value.length > 0
})

// 获取用于计算的样本数量（动态调整）
const getSampleSize = computed(() => {
  const totalReviewed = reviewTimes.value.length
  if (totalReviewed < 5) return totalReviewed
  if (totalReviewed < 15) return Math.min(10, totalReviewed)
  return Math.min(30, totalReviewed)
})

// 计算复习速度（单词/分钟）
const reviewSpeed = computed(() => {
  if (reviewTimes.value.length === 0) return 0

  const sampleSize = getSampleSize.value
  const recentTimes = reviewTimes.value.slice(-sampleSize)
  const totalSeconds = recentTimes.reduce((sum, time) => sum + time, 0)

  if (totalSeconds === 0) return 0

  // 单词/分钟 = (单词数 / 总秒数) * 60
  return (recentTimes.length / totalSeconds) * 60
})

// 格式化速度文本
const speedText = computed(() => {
  if (reviewSpeed.value === 0) return '计算中...'
  return `${reviewSpeed.value.toFixed(1)} 词/分`
})

// 计算预估完成时间
const estimatedCompletionTime = computed(() => {
  if (reviewSpeed.value === 0) return null

  // 剩余单词数 = 总数 - 已复习数（globalIndex + 1）
  const remainingWords = totalWords.value - (globalIndex.value + 1)
  if (remainingWords <= 0) return null

  // 剩余时间（分钟）= 剩余单词数 / 速度
  const remainingMinutes = remainingWords / reviewSpeed.value

  // 计算完成时间（当前时间 + 剩余时间）
  const now = new Date()
  const completionTime = new Date(now.getTime() + remainingMinutes * 60 * 1000)

  return {
    time: completionTime,
    minutes: remainingMinutes
  }
})

// 格式化预估完成时间文本
const etaText = computed(() => {
  if (!estimatedCompletionTime.value) return ''

  const { time, minutes } = estimatedCompletionTime.value

  // 如果少于60分钟，显示相对时间
  if (minutes < 60) {
    return `约${Math.ceil(minutes)}分钟后`
  }

  // 如果超过60分钟，显示具体时间
  const hours = time.getHours()
  const mins = time.getMinutes()
  return `预计${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
})

// 记录单词复习时间
const recordReviewTime = () => {
  const now = Date.now()

  // 第一次记录，只记录时间戳
  if (lastIndexChangeTime.value === 0) {
    lastIndexChangeTime.value = now
    lastRecordedIndex.value = globalIndex.value
    return
  }

  // 计算时间差（秒）
  const elapsedSeconds = (now - lastIndexChangeTime.value) / 1000

  // 只记录合理的时间（1-30秒），过滤异常值
  if (elapsedSeconds >= 1 && elapsedSeconds <= 30) {
    reviewTimes.value.push(elapsedSeconds)

    // 限制数组大小，最多保留最近50个记录
    if (reviewTimes.value.length > 50) {
      reviewTimes.value.shift()
    }
  }

  // 更新最后记录时间和索引
  lastIndexChangeTime.value = now
  lastRecordedIndex.value = globalIndex.value
}

// 监听globalIndex变化，记录复习时间
watch(globalIndex, (newIndex, oldIndex) => {
  // 确保索引确实增加了（向前推进）
  if (newIndex > oldIndex && newIndex !== lastRecordedIndex.value) {
    recordReviewTime()
  }
})

// 监听模式变化，重置数据
watch(mode, () => {
  reviewTimes.value = []
  lastIndexChangeTime.value = 0
  lastRecordedIndex.value = -1
})

onMounted(() => {
  // 初始化时间戳
  lastIndexChangeTime.value = Date.now()
  lastRecordedIndex.value = globalIndex.value
})

onUnmounted(() => {
  // 清理数据
  reviewTimes.value = []
})
</script>

<style scoped>
.speed-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}

.speed-value {
  color: var(--color-primary);
}

.separator {
  color: var(--color-text-muted);
}

.eta-value {
  color: var(--color-edit);
}

/* 移动端适配 */
@media (max-width: 768px) {
  .speed-indicator {
    font-size: 12px;
    gap: 4px;
  }
}
</style>
