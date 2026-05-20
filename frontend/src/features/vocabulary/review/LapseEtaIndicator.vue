<template>
  <div v-if="shouldDisplay" class="speed-indicator">
    <span class="speed-value">{{ correctRateText }}</span>
    <span class="separator">·</span>
    <span class="grad-value">{{ gradRateText }}</span>
    <span v-if="etaText" class="separator">·</span>
    <span v-if="etaText" class="eta-value">{{ etaText }}</span>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useReviewStore } from '@/features/vocabulary/stores/review'
import { LAPSE_GAP_SEQUENCE } from '@/features/vocabulary/stores/review/useLapseSession'

const reviewStore = useReviewStore()
const {
  mode,
  initialWordCount,
  realGraduatedCount,
  totalCorrect,
  wordQueue,
  wordGapLevels,
  lastLapseResult,
} = storeToRefs(reviewStore)

// 距离上次作答超过该阈值视为挂机，elapsed 暂停累加
const IDLE_THRESHOLD_MS = 60_000
const TICK_MS = 1000

// 每秒主动 tick，让 elapsed / 速率 / ETA 即使无答题事件也能平滑刷新
const now = ref(Date.now())
const sessionStartTime = ref(0)
const lastAnswerAt = ref(0)
// 累计活跃秒数（已剔除挂机时间）— 直接用作 elapsedSeconds
const activeSeconds = ref(0)
let tickHandle: number | null = null

// EMA 平滑 ETA，避免答错让 level 重置时 ETA 暴涨
const smoothedEtaSeconds = ref<number | null>(null)
const EMA_ALPHA = 0.3

const shouldDisplay = computed(() => {
  return mode.value === 'mode_lapse' && initialWordCount.value > 0
})

const elapsedSeconds = computed(() => activeSeconds.value)

// 队列中所有词剩余还需答对几次才能毕业（已毕业的词已从 queue 中移除，故不计入）
const remainingCorrect = computed(() => {
  const maxLevel = LAPSE_GAP_SEQUENCE.length
  let sum = 0
  for (const w of wordQueue.value) {
    const lv = wordGapLevels.value.get(w.id) ?? 0
    sum += Math.max(0, maxLevel - lv)
  }
  return sum
})

// 答对速率（次/秒）
const correctPerSec = computed(() => {
  if (totalCorrect.value <= 0 || elapsedSeconds.value <= 0) return 0
  return totalCorrect.value / elapsedSeconds.value
})

// 毕业速率（词/秒）：会话内累积平均
const graduatePerSec = computed(() => {
  if (realGraduatedCount.value <= 0 || elapsedSeconds.value <= 0) return 0
  return realGraduatedCount.value / elapsedSeconds.value
})

const correctRateText = computed(() => {
  if (correctPerSec.value === 0) return '计算中...'
  return `${(correctPerSec.value * 60).toFixed(1)} 答对/分`
})

const gradRateText = computed(() => {
  if (graduatePerSec.value === 0) return '0.0 毕业/分'
  return `${(graduatePerSec.value * 60).toFixed(1)} 毕业/分`
})

// 基于「剩余答对次数 / 答对速率」估算 ETA
// 这样即使长间隔窗口期内无毕业事件，每次答对都会让 remainingCorrect -1，ETA 平滑下降
const rawEtaSeconds = computed(() => {
  if (correctPerSec.value === 0) return null
  if (remainingCorrect.value <= 0) return null
  return remainingCorrect.value / correctPerSec.value
})

watch(rawEtaSeconds, (val) => {
  if (val === null) return
  if (smoothedEtaSeconds.value === null) {
    smoothedEtaSeconds.value = val
  } else {
    smoothedEtaSeconds.value = EMA_ALPHA * val + (1 - EMA_ALPHA) * smoothedEtaSeconds.value
  }
})

const etaText = computed(() => {
  const seconds = smoothedEtaSeconds.value
  if (seconds === null || seconds <= 0) return ''

  const minutes = seconds / 60
  if (minutes < 60) {
    return `约${Math.ceil(minutes)}分钟后`
  }

  const completion = new Date(now.value + seconds * 1000)
  const hours = completion.getHours()
  const mins = completion.getMinutes()
  return `预计${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
})

const startSession = () => {
  const t = Date.now()
  sessionStartTime.value = t
  now.value = t
  lastAnswerAt.value = t
  activeSeconds.value = 0
  smoothedEtaSeconds.value = null
}

watch(mode, () => {
  if (mode.value === 'mode_lapse') {
    startSession()
  } else {
    sessionStartTime.value = 0
    lastAnswerAt.value = 0
    activeSeconds.value = 0
    smoothedEtaSeconds.value = null
  }
})

watch(initialWordCount, (newVal) => {
  if (newVal > 0 && mode.value === 'mode_lapse') {
    startSession()
  }
})

// 任何作答（答对/答错/慢速答对）都会刷新 lastLapseResult，作为活跃信号
watch(lastLapseResult, () => {
  lastAnswerAt.value = Date.now()
})

onMounted(() => {
  if (mode.value === 'mode_lapse') {
    startSession()
  }
  tickHandle = window.setInterval(() => {
    const t = Date.now()
    now.value = t
    if (
      sessionStartTime.value > 0 &&
      t - lastAnswerAt.value <= IDLE_THRESHOLD_MS
    ) {
      activeSeconds.value += TICK_MS / 1000
    }
  }, TICK_MS)
})

onUnmounted(() => {
  if (tickHandle !== null) {
    clearInterval(tickHandle)
    tickHandle = null
  }
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

.grad-value {
  color: var(--color-success, var(--color-primary));
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
