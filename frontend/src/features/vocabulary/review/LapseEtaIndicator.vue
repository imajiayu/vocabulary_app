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
const { mode, graduatedCount, realGraduatedCount, initialWordCount } = storeToRefs(reviewStore)

// 真实毕业时间间隔（秒）：相邻两次真实毕业之间的耗时
// 不含手动停学/删除事件，避免速率被高估
const graduateIntervals = ref<number[]>([])
const lastGraduateTime = ref<number>(0)
const sessionStartTime = ref<number>(0)

const shouldDisplay = computed(() => {
  return mode.value === 'mode_lapse' && initialWordCount.value > 0
})

// 每个单词毕业的平均耗时（秒），仅基于真实毕业事件
const avgGraduateSeconds = computed(() => {
  // 优先使用滑动窗口的近期数据
  if (graduateIntervals.value.length >= 3) {
    const sample = graduateIntervals.value.slice(-10)
    const total = sample.reduce((sum, t) => sum + t, 0)
    return total / sample.length
  }
  // 数据不足时使用累积平均：从开始到现在 / 真实毕业数
  if (realGraduatedCount.value > 0 && sessionStartTime.value > 0) {
    const elapsed = (Date.now() - sessionStartTime.value) / 1000
    return elapsed / realGraduatedCount.value
  }
  return 0
})

// 毕业速度（词/分钟）
const graduateSpeed = computed(() => {
  if (avgGraduateSeconds.value === 0) return 0
  return 60 / avgGraduateSeconds.value
})

const speedText = computed(() => {
  if (graduateSpeed.value === 0) return '计算中...'
  return `${graduateSpeed.value.toFixed(1)} 词毕业/分`
})

// 预估剩余完成时间
const estimatedCompletion = computed(() => {
  if (avgGraduateSeconds.value === 0) return null

  const remaining = initialWordCount.value - graduatedCount.value
  if (remaining <= 0) return null

  const remainingSeconds = remaining * avgGraduateSeconds.value
  const remainingMinutes = remainingSeconds / 60

  const completionTime = new Date(Date.now() + remainingSeconds * 1000)

  return {
    time: completionTime,
    minutes: remainingMinutes
  }
})

const etaText = computed(() => {
  if (!estimatedCompletion.value) return ''

  const { time, minutes } = estimatedCompletion.value

  if (minutes < 60) {
    return `约${Math.ceil(minutes)}分钟后`
  }

  const hours = time.getHours()
  const mins = time.getMinutes()
  return `预计${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
})

// 监听真实毕业计数增加，记录每次毕业的时间间隔
watch(realGraduatedCount, (newCount, oldCount) => {
  if (newCount <= oldCount) return

  const now = Date.now()
  const reference = lastGraduateTime.value || sessionStartTime.value
  if (reference > 0) {
    const interval = (now - reference) / 1000
    // 每次 realGraduatedCount 可能跳多个（罕见），按毕业数均摊
    const delta = newCount - oldCount
    if (delta > 0 && interval > 0.5) {
      const perWord = interval / delta
      for (let i = 0; i < delta; i++) {
        graduateIntervals.value.push(perWord)
      }
      // 仅保留最近 30 条
      if (graduateIntervals.value.length > 30) {
        graduateIntervals.value.splice(0, graduateIntervals.value.length - 30)
      }
    }
  }
  lastGraduateTime.value = now
})

// 模式切换时重置
watch(mode, () => {
  graduateIntervals.value = []
  lastGraduateTime.value = 0
  sessionStartTime.value = mode.value === 'mode_lapse' ? Date.now() : 0
})

// initialWordCount 变化（新会话开始）时重置
watch(initialWordCount, (newVal) => {
  if (newVal > 0) {
    graduateIntervals.value = []
    lastGraduateTime.value = 0
    sessionStartTime.value = Date.now()
  }
})

onMounted(() => {
  if (mode.value === 'mode_lapse') {
    sessionStartTime.value = Date.now()
  }
})

onUnmounted(() => {
  graduateIntervals.value = []
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

@media (max-width: 768px) {
  .speed-indicator {
    font-size: 12px;
    gap: 4px;
  }
}
</style>
