<template>
  <div class="review-page" :class="{ 'is-completed': isCompleted }">
    <!-- 右侧面板（通知 + AI 助手）- 桌面端固定 / 移动端浮动 -->
    <ReviewRightPanel
      :notification-data="notification.data"
      :current-word="displayWord"
    />

    <!-- 侧边栏 -->
    <WordSideBar
      v-if="!isInitializing"
      :words="sidebarWords"
      :remember-history="wordResults"
      :mode="mode"
      :word-gap-levels="wordGapLevels"
      :spell-weak-words="spellWeakWords"
      @sidebar-word-change="sidebarWordChange"
      @word-deleted="handleSidebarWordDeleted"
      @word-forgot="handleWordForgot"
      @word-spell-reset="handleWordSpellReset"
      @word-mastered="handleWordMastered"
    />

    <!-- 顶部栏 -->
    <TopBar show-home-button show-management-button show-stats-button @before-navigate="reviewStore.flushProgressIndex">
      <template #center>
        <div class="header-info">
          <!-- 单行布局：模式标签 + 速度/进度指示器 -->
          <div class="header-main-row">
            <!-- 模式标签 -->
            <div v-if="reviewInfo" class="mode-badges">
              <span class="badge source">{{ reviewStore.wordQueue[0]?.source || '' }}</span>
              <span class="badge mode" :class="modeClass">{{ modeLabel }}</span>
              <span class="badge shuffle">{{ shuffle ? '随机' : '顺序' }}</span>
            </div>

            <!-- 复习速度指示器（非lapse模式） -->
            <ReviewSpeedIndicator v-if="mode !== 'mode_lapse'" />

            <!-- Lapse 模式：进度指示器（同一行） -->
            <div v-if="mode === 'mode_lapse'" class="lapse-progress-inline">
              <span class="lapse-progress-value" :class="{ negative: progress < 0 }">
                {{ progress >= 0 ? '+' : '' }}{{ Math.round(progress) }}%
              </span>
            </div>
          </div>
        </div>
      </template>

      <template #right>
        <div v-if="displayTotal > 0 && displayIndex <= displayTotal" class="progress-counter">
          <span class="current">{{ displayIndex }}</span>
          <span class="separator">/</span>
          <span class="total">{{ displayTotal }}</span>
        </div>
      </template>
    </TopBar>

    <!-- 主内容区域 -->
    <main class="main-content">
      <!-- 加载状态 -->
      <LoadingComponent v-if="isLoading || isInitializing" :text="loadingText" />

      <!-- 复习/拼写组件 -->
      <component
        v-else-if="currentWord"
        :is="currentComponent"
        :key="mode"
        :word="currentWord"
        :audio-type="audioType"
        v-bind="spellingExtraProps"
        @result="handleResult"
        @skip="handleSkip"
      />

      <!-- 后台加载中：当前批次已用完但还有更多单词待加载 -->
      <LoadingComponent v-else-if="isBackgroundLoading || !isCompleted" text="加载中..." />

      <!-- 复习完成 -->
      <div v-else class="completion-screen">
        <div class="completion-card">
          <div class="completion-icon">
            <BaseIcon name="PartyPopper" size="xl" color="warning" />
            <div class="confetti"></div>
          </div>
          <h2 class="completion-title">恭喜完成！</h2>
          <p class="completion-message">
            {{ mode === 'mode_lapse' ? '所有遗忘单词已复习完成' : '当前批次复习完成' }}
          </p>
          <div v-if="sessionStartTime && sessionEndTime" class="session-time-info">
            <div class="time-duration">
              <span class="duration-value">{{ sessionDuration }}</span>
            </div>
            <div class="time-range">
              <span class="time-point">{{ formatTime(sessionStartTime) }}</span>
              <span class="time-separator">—</span>
              <span class="time-point">{{ formatTime(sessionEndTime) }}</span>
            </div>
          </div>
          <button @click="goHome" class="home-btn">
            <span class="btn-icon">←</span>
            <span class="btn-text">回到首页</span>
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useReviewStore } from '@/features/vocabulary/stores/review'
import type { ReviewMode, WordResult } from '@/features/vocabulary/stores/review'
import type { Word, SpellingData } from '@/shared/types'

interface CardResultEvent {
  remembered: boolean
  elapsedTime?: number
  spellingData?: SpellingData
}

import { clearPreloadCache, stopWordAudio } from '@/shared/utils/playWordAudio'
import ReviewCard from '@/features/vocabulary/review/ReviewCard.vue'
import SpellingCard from '@/features/vocabulary/spelling/SpellingCard.vue'
import TopBar from '@/shared/components/layout/TopBar.vue'
import LoadingComponent from '@/shared/components/feedback/Loading.vue'
import { BaseIcon } from '@/shared/components/base'
import WordSideBar from '@/features/vocabulary/sidebar/WordSideBar.vue'
import ReviewRightPanel from '@/features/vocabulary/review/ReviewRightPanel.vue'
import ReviewSpeedIndicator from '@/features/vocabulary/review/ReviewSpeedIndicator.vue'
import { useTimerPause } from '@/shared/composables/useTimerPause'
import { useToast } from '@/shared/composables/useToast'
import { provideReviewContext } from '@/features/vocabulary/review/context'
import { logger } from '@/shared/utils/logger'

interface RouteProps {
  mode?: string
  limit?: number
}

const props = withDefaults(defineProps<RouteProps>(), {
  mode: 'mode_review',
  limit: 50
})

const sidebarWordChange = (finalWord: Word) => {
  const index = reviewStore.wordQueue.findIndex(w => w.id === finalWord.id)
  if (index !== -1) {
    reviewStore.wordQueue.splice(index, 1, finalWord)
    return
  }
  // Lapse 模式：毕业词在 graduatedWords 中
  if (mode.value === 'mode_lapse') {
    const gradIndex = graduatedWords.value.findIndex(w => w.id === finalWord.id)
    if (gradIndex !== -1) {
      graduatedWords.value.splice(gradIndex, 1, finalWord)
    }
  }
}

const handleWordForgot = (wordId: number, updatedWord: Word, scheduledDay: number) => {
  wordResults.value.set(wordId, false)

  // 计算 ease_factor 变化量（queue 中还是旧数据）
  const queueWord = reviewStore.wordQueue.find(w => w.id === wordId)
  const oldEaseFactor = queueWord?.ease_factor ?? updatedWord.ease_factor
  const easeChange = Math.round((updatedWord.ease_factor - oldEaseFactor) * 100) / 100

  // 更新 queue 中的单词数据
  const index = reviewStore.wordQueue.findIndex(w => w.id === wordId)
  if (index !== -1) {
    reviewStore.wordQueue.splice(index, 1, updatedWord)
  }

  // 仅 review 模式：更新 loads cache + 触发 notification
  if (mode.value === 'mode_review') {
    if (reviewStore.reviewLoadsCache) {
      const idx = scheduledDay - 1
      if (idx >= 0 && idx < reviewStore.reviewLoadsCache.length) {
        reviewStore.reviewLoadsCache[idx]++
      }
    }

    reviewStore.notification = {
      show: true,
      data: {
        word: updatedWord.word,
        param_type: 'ease_factor',
        param_change: easeChange,
        new_param_value: updatedWord.ease_factor,
        next_review_date: updatedWord.next_review,
        breakdown: {
          elapsed_time: 0,
          remembered: false,
          score: 0,
          repetition: 0,
          interval: scheduledDay,
        }
      }
    }
  }
}

const handleWordSpellReset = (wordId: number, updatedWord: Word, scheduledDay: number) => {
  // 获取旧 spell_strength（splice 之前）
  const queueWord = reviewStore.wordQueue.find(w => w.id === wordId)
  const oldStrength = queueWord?.spell_strength ?? 0

  // 更新 queue
  const index = reviewStore.wordQueue.findIndex(w => w.id === wordId)
  if (index !== -1) {
    reviewStore.wordQueue.splice(index, 1, updatedWord)
  }

  // 仅 spelling 模式：更新 loads cache + 触发 notification
  if (mode.value === 'mode_spelling') {
    if (reviewStore.spellLoadsCache) {
      const idx = scheduledDay - 1
      if (idx >= 0 && idx < reviewStore.spellLoadsCache.length) {
        reviewStore.spellLoadsCache[idx]++
      }
    }

    reviewStore.notification = {
      show: true,
      data: {
        word: updatedWord.word,
        param_type: 'spell_strength',
        param_change: -oldStrength,
        new_param_value: 0,
        next_review_date: updatedWord.spell_next_review ?? '',
        breakdown: {
          remembered: false,
          typed_count: 0,
          backspace_count: 0,
          word_length: updatedWord.word.length,
          avg_key_interval: 0,
          longest_pause: 0,
          total_typing_time: 0,
          audio_requests: 0,
          accuracy_score: 0,
          fluency_score: 0,
          independence_score: 0,
          weighted_accuracy: 0,
          weighted_fluency: 0,
          weighted_independence: 0,
          total_score: 0,
          strength_gain: -oldStrength,
        }
      }
    }
  }
}

const handleSidebarWordDeleted = (wordId: number) => {
  if (mode.value === 'mode_lapse') {
    // Lapse 模式：统一由 store 方法处理（队列 + 毕业列表）
    reviewStore.removeWordFromLapseSession(wordId)
    wordResults.value.delete(wordId)
    return
  }

  const index = reviewStore.wordQueue.findIndex(w => w.id === wordId)
  if (index !== -1) {
    reviewStore.wordQueue.splice(index, 1)
    wordResults.value.delete(wordId)
    if (index < currentIndex.value) {
      reviewStore.currentIndex = Math.max(0, currentIndex.value - 1)
    }
    // 从全量快照移除 + 同步 DB
    reviewStore.removeWordFromSnapshot(wordId)
  }
}

const handleWordMastered = (wordId: number) => {
  wordResults.value.set(wordId, true)
}

const route = useRoute()
const router = useRouter()
const reviewStore = useReviewStore()

const {
  currentWord,
  mode,
  audioType,
  isLoading,
  isBackgroundLoading,
  isCompleted,
  totalWords,
  currentIndex,
  progress,
  wordResults,
  shuffle,
  globalIndex,
  notification,
  persistError,
  graduatedWords,
  graduatedCount,
  initialWordCount,
  wordGapLevels,
  spellWeakWords,
} = storeToRefs(reviewStore)

provideReviewContext({
  mode,
  audioType,
  currentWord,
  shuffle,
  submitResult: reviewStore.submitResult,
  stopReviewWord: reviewStore.stopReviewWord,
})

const toast = useToast()
watch(persistError, (err) => {
  if (err) {
    toast.error(err, { duration: 8000 })
    persistError.value = null
  }
})

const loadingText = ref('加载中...')
const isInitializing = ref(true)

// 会话时间跟踪
const sessionStartTime = ref<Date | null>(null)
const sessionEndTime = ref<Date | null>(null)

const formatTime = (date: Date | null): string => {
  if (!date) return '--:--'
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

const sessionDuration = computed(() => {
  if (!sessionStartTime.value || !sessionEndTime.value) return ''
  const diffMs = sessionEndTime.value.getTime() - sessionStartTime.value.getTime()
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}小时${minutes}分`
  if (minutes > 0) return `${minutes}分${seconds}秒`
  return `${seconds}秒`
})

useTimerPause()

// 计算属性
const displayIndex = computed(() => {
  if (mode.value === 'mode_lapse') {
    return graduatedCount.value
  }
  return currentWord.value ? globalIndex.value + 1 : 0
})

const displayTotal = computed(() => {
  if (mode.value === 'mode_lapse') {
    return initialWordCount.value
  }
  return currentWord.value ? totalWords.value : 0
})

const currentComponent = computed(() => {
  return (mode.value === 'mode_spelling' || mode.value === 'mode_skilled_spelling')
    ? SpellingCard : ReviewCard
})

// 拼写模式：传递前后单词用于画廊式展示
const spellingExtraProps = computed(() => {
  if (mode.value !== 'mode_spelling' && mode.value !== 'mode_skilled_spelling') return {}
  const idx = currentIndex.value
  const queue = reviewStore.wordQueue
  return {
    prevWord: idx > 0 ? queue[idx - 1] : null,
    nextWord: idx < queue.length - 1 ? queue[idx + 1] : null,
    nextNextWord: idx < queue.length - 2 ? queue[idx + 2] : null,
  }
})

// 复习真正完成时，取消 debounce + 清除 DB 进度，避免首页显示残留通知
// 注意：watch isCompleted 而非 currentWord，避免后台加载期间误清除进度
// guard isInitializing：lapse 模式下 reset() 后 queue 为空导致 isCompleted 短暂为 true
watch(isCompleted, (completed) => {
  if (completed && !isInitializing.value) {
    sessionEndTime.value = new Date()
    reviewStore.clearSessionProgress()
  }
})

const modeLabel = computed(() => {
  switch (mode.value) {
    case 'mode_lapse': return '复习错题'
    case 'mode_spelling': return '拼写熟练'
    case 'mode_mastered_review': return '复习已掌握'
    case 'mode_skilled_spelling': return '拼写已熟练'
    default: return '复习已有'
  }
})

const modeClass = computed(() => {
  switch (mode.value) {
    case 'mode_lapse': return 'lapse'
    case 'mode_spelling': return 'spelling'
    case 'mode_mastered_review': return 'mastered-review'
    case 'mode_skilled_spelling': return 'skilled-spelling'
    default: return 'review'
  }
})

const reviewInfo = computed(() => {
  if (reviewStore.wordQueue.length === 0) return ''
  const source = reviewStore.wordQueue[0]?.source || ''
  const modeText = modeLabel.value
  const shuffleText = shuffle.value ? '随机' : '顺序'
  return `${source} ${modeText} ${shuffleText}`
})

const sidebarWords = computed(() => {
  if (mode.value === 'mode_lapse') {
    // Lapse 模式：展示实时队列（spread 确保每次变化生成新引用触发更新）
    return [...reviewStore.wordQueue]
  }
  return reviewStore.wordQueue.slice(0, currentIndex.value)
})

// 完成后回退到队列末尾单词，供 AI 助手和右侧面板使用
const displayWord = computed(() => {
  if (currentWord.value) return currentWord.value
  const queue = reviewStore.wordQueue
  return queue.length > 0 ? queue[queue.length - 1] : null
})

// 方法
const initializeFromRoute = async () => {
  try {
    stopWordAudio()
    loadingText.value = '初始化复习...'

    const shouldResume = route.query.resume === 'true'

    if (shouldResume) {
      loadingText.value = '恢复学习进度...'
      reviewStore.reset()
      const restored = await reviewStore.restoreFromProgress()

      if (restored) {
        logger.log('Progress restored successfully')
        sessionStartTime.value = new Date()
        isInitializing.value = false
        return
      } else {
        logger.log('Failed to restore progress, falling back to normal initialization')
      }
    } else {
      reviewStore.reset()
    }

    const routeMode = props.mode || 'mode_review'
    let reviewMode: ReviewMode = 'mode_review'

    if (['mode_lapse', 'mode_spelling', 'mode_review', 'mode_mastered_review', 'mode_skilled_spelling'].includes(routeMode)) {
      reviewMode = routeMode as ReviewMode
    }

    reviewStore.settings.totalLimit = props.limit

    if (mode.value !== reviewMode) {
      await reviewStore.switchMode(reviewMode)
    } else if (reviewStore.wordQueue.length === 0) {
      await reviewStore.initializeShuffle()
      await reviewStore.loadWords(true)
    }

    sessionStartTime.value = new Date()
    isInitializing.value = false
  } catch (error) {
    logger.error('初始化失败:', error)
    loadingText.value = '加载失败，请重试'
    isInitializing.value = false
  }
}

const handleResult = async (result: CardResultEvent) => {
  if (!currentWord.value) return

  try {
    const isSpellingMode = mode.value === 'mode_spelling' || mode.value === 'mode_skilled_spelling'
    const wordResult: WordResult = {
      is_spelling: isSpellingMode,
      remembered: result.remembered,
      ...(isSpellingMode
        ? { spelling_data: result.spellingData }
        : { elapsed_time: result.elapsedTime }
      )
    }

    reviewStore.submitResult(currentWord.value.id, wordResult)
  } catch (error) {
    logger.error('提交结果失败:', error)
  }
}

const handleSkip = async () => {
  if (!currentWord.value) return
  // 新模式下按钮已隐藏，但保留防御性代码
  if (mode.value === 'mode_mastered_review' || mode.value === 'mode_skilled_spelling') return

  try {
    if (mode.value === 'mode_spelling') {
      reviewStore.stopSpellWord(currentWord.value.id)
    } else {
      reviewStore.stopReviewWord(currentWord.value.id)
    }
  } catch (error) {
    logger.error('停止复习单词失败:', error)
  }
}

const goHome = async () => {
  try {
    await router.push('/')
  } catch (error) {
    logger.error('导航失败:', error)
    window.location.href = '/'
  }
}

watch(() => route.query, async () => {
  if (route.name === 'review') {
    isInitializing.value = true
    await initializeFromRoute()
  }
})

onMounted(async () => {
  await initializeFromRoute()
})

onUnmounted(() => {
  stopWordAudio()
  clearPreloadCache(0)
})
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   Review Page - Neo-Editorial 风格
   ═══════════════════════════════════════════════════════════════════════════ */

.review-page {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--color-bg-page);
}

/* 桌面端：为左侧 WordSidebar 和右侧 RightPanel 留出空间 */
@media (min-width: 769px) {
  .review-page {
    --sidebar-left: 180px;
    --sidebar-right: 220px;
    padding-left: var(--sidebar-left);
    padding-right: var(--sidebar-right);
  }
}

@media (min-width: 1400px) {
  .review-page {
    --sidebar-left: 200px;
    --sidebar-right: 260px;
    padding-left: var(--sidebar-left);
    padding-right: var(--sidebar-right);
  }
}

/* ── 主内容区域 ── */
.main-content {
  display: flex;
  flex-direction: column;
  max-width: 900px;
  width: 100%;
  margin: 0 auto;
  padding: 0 1rem;
  padding-top: var(--topbar-height);
  /* Loading 居中需要的最小高度 */
  min-height: calc(100vh - var(--topbar-height));
  min-height: calc(100dvh - var(--topbar-height));
}

/* ── 桌面端三层居中对齐 ──
   TopBar 和 action-bar 是 position:fixed 以视口为参考系，
   main-content 以 sidebar 间可用区域为参考系。
   通过偏移 TopBar 中间内容和 action-bar 使三者中心对齐。 */
@media (min-width: 769px) {
  /* TopBar 中间区域：向 sidebar 间中心偏移 */
  .review-page :deep(.bar-section--center) {
    transform: translateX(calc((var(--sidebar-left) - var(--sidebar-right)) / 2));
  }

  /* 底部操作栏：添加 sidebar 偏移使居中对齐 */
  .review-page :deep(.action-bar) {
    padding-left: calc(var(--sidebar-left) + 1rem);
    padding-right: calc(var(--sidebar-right) + 1rem);
  }
}

/* ── 顶部栏信息 ── */
.header-info {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  overflow: hidden;
}

.header-main-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  min-width: 0;
}

.mode-badges {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.badge {
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.625rem;
  font-family: var(--font-ui);
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-radius: var(--radius-full);
  white-space: nowrap;
}

.badge.source {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.badge.mode {
  background: var(--color-success-light);
  color: var(--color-success);
}

.badge.mode.lapse {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

.badge.mode.spelling {
  background: var(--color-warning-light);
  color: var(--color-warning);
}

.badge.mode.mastered-review {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.badge.mode.skilled-spelling {
  background: var(--color-warning-light);
  color: var(--color-warning);
}

.badge.shuffle {
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
}

/* ══════════════════════════════════════════════════════════════════════════
   Lapse 进度指示器 - 内联紧凑设计
   ══════════════════════════════════════════════════════════════════════════ */

.lapse-progress-inline {
  display: flex;
  align-items: center;
  padding: 0.25rem 0.625rem;
  background: var(--primitive-paper-300);
  border-radius: var(--radius-full);
}

.lapse-progress-value {
  font-family: var(--font-data);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--primitive-olive-600);
  letter-spacing: 0.02em;
}

.lapse-progress-value.negative {
  color: var(--primitive-brick-600);
}

/* ── 进度计数器 ── */
.progress-counter {
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
  font-family: var(--font-data);
  font-variant-numeric: tabular-nums;
}

.progress-counter .current {
  font-size: 1rem;
  font-weight: 700;
  color: var(--color-primary);
}

.progress-counter .separator {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.progress-counter .total {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-secondary);
}

/* ══════════════════════════════════════════════════════════════════════════
   完成页面
   ══════════════════════════════════════════════════════════════════════════ */

.completion-screen {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.completion-card {
  text-align: center;
  max-width: 400px;
  padding: 3rem 2rem;
  background: var(--color-bg-primary);
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-lg);
}

.completion-icon {
  position: relative;
  margin-bottom: 1.5rem;
}

.icon-emoji {
  font-size: 4rem;
  line-height: 1;
  display: block;
  animation: bounce 1s ease infinite;
}

.completion-title {
  font-family: var(--font-serif);
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin-bottom: 0.75rem;
}

.completion-message {
  font-family: var(--font-serif);
  font-size: 1rem;
  color: var(--color-text-secondary);
  line-height: 1.6;
  margin-bottom: 1.5rem;
}

/* ── 会话时间信息 ── */
.session-time-info {
  margin-bottom: 1.75rem;
}

.time-duration {
  margin-bottom: 0.625rem;
}

.duration-value {
  font-family: var(--font-data);
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--color-primary);
  font-variant-numeric: tabular-nums;
}

.time-range {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.time-point {
  font-family: var(--font-data);
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
}

.time-separator {
  font-size: 0.75rem;
  color: var(--primitive-paper-500);
}

.home-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.625rem;
  padding: 0.875rem 2rem;
  font-family: var(--font-ui);
  font-size: 1rem;
  font-weight: 600;
  color: white;
  background: var(--gradient-primary);
  border: none;
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  box-shadow: 0 4px 12px rgba(153, 107, 61, 0.3);
}

.home-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(153, 107, 61, 0.4);
}

.home-btn:active {
  transform: translateY(0);
}

.home-btn .btn-icon {
  font-size: 1.2rem;
}

.home-btn .btn-text {
  letter-spacing: 0.02em;
}

/* ══════════════════════════════════════════════════════════════════════════
   动画
   ══════════════════════════════════════════════════════════════════════════ */

@keyframes bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   移动端适配
   ══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .main-content {
    padding: 0 0.75rem;
    padding-top: var(--topbar-height-mobile);
    min-height: calc(100vh - var(--topbar-height-mobile));
    min-height: calc(100dvh - var(--topbar-height-mobile));
  }

  .header-main-row {
    gap: 0.375rem;
  }

  .mode-badges {
    gap: 0.25rem;
  }

  .badge {
    padding: 0.15rem 0.4rem;
    font-size: 0.6rem;
  }

  .lapse-progress-inline {
    padding: 0.15rem 0.4rem;
  }

  .lapse-progress-value {
    font-size: 0.65rem;
  }

  .progress-counter .current {
    font-size: 0.9rem;
  }

  .progress-counter .separator,
  .progress-counter .total {
    font-size: 0.8rem;
  }

  /* 完成页面移动端 */
  .completion-screen {
    padding: 1rem;
  }

  .completion-card {
    padding: 2rem 1.5rem;
    border-radius: var(--radius-xl);
  }

  .icon-emoji {
    font-size: 3rem;
  }

  .completion-title {
    font-size: 1.5rem;
  }

  .completion-message {
    font-size: 0.9rem;
    margin-bottom: 1rem;
  }

  .session-time-info {
    margin-bottom: 1.25rem;
  }

  .duration-value {
    font-size: 1.25rem;
  }

  .time-point {
    font-size: 0.75rem;
  }

  .home-btn {
    padding: 0.75rem 1.5rem;
    font-size: 0.9rem;
    width: 100%;
  }
}

/* 横屏适配 */
@media (max-height: 500px) and (orientation: landscape) {
  .completion-screen {
    padding: 0.75rem;
  }

  .completion-card {
    padding: 1rem 1.5rem;
    max-width: 450px;
  }

  .completion-icon {
    margin-bottom: 0.75rem;
  }

  .icon-emoji {
    font-size: 2rem;
  }

  .completion-title {
    font-size: 1.1rem;
    margin-bottom: 0.375rem;
  }

  .completion-message {
    font-size: 0.8rem;
    margin-bottom: 0.5rem;
  }

  .session-time-info {
    margin-bottom: 0.5rem;
  }

  .time-duration {
    margin-bottom: 0.375rem;
  }

  .duration-value {
    font-size: 1.1rem;
  }

  .time-point {
    font-size: 0.7rem;
  }

  .home-btn {
    padding: 0.5rem 1.25rem;
    font-size: 0.85rem;
  }
}

</style>
