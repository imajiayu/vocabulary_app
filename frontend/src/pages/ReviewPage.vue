<template>
  <div class="review-page">
    <!-- 复习参数更新通知 -->
    <ReviewParamsNotification
      v-if="notification.data"
      :show="notification.show"
      :word="notification.data.word"
      :param-type="notification.data.param_type"
      :param-change="notification.data.param_change"
      :new-param-value="notification.data.new_param_value"
      :next-review-date="notification.data.next_review_date"
      :breakdown="notification.data.breakdown"
      @close="handleCloseNotification"
    />

    <!-- 侧边栏 -->
    <WordSideBar
      v-if="displayIndex <= displayTotal"
      :words="sidebarWords"
      :remember-history="wordResults"
      :mode="mode"
      @sidebar-word-change="sidebarWordChange"
      @word-deleted="handleSidebarWordDeleted"
      @word-forgot="handleWordForgot"
      @word-mastered="handleWordMastered"
    />

    <!-- 顶部栏 -->
    <TopBar show-home-button show-management-button show-stats-button>
      <template #center>
        <div class="header-info">
          <!-- 模式标签 -->
          <div v-if="reviewInfo" class="mode-badges">
            <span class="badge source">{{ reviewStore.wordQueue[0]?.source || '' }}</span>
            <span class="badge mode" :class="modeClass">{{ modeLabel }}</span>
            <span class="badge shuffle">{{ shuffle ? '随机' : '顺序' }}</span>
          </div>

          <!-- 复习速度指示器 -->
          <ReviewSpeedIndicator />

          <!-- Lapse 模式进度条 -->
          <div v-if="mode === 'mode_lapse'" class="lapse-progress">
            <ProgressBar
              :progress="Math.abs(progress)"
              :fill-color="progress < 0 ? 'var(--color-danger)' : 'var(--color-success)'"
              :text="`${Math.round(progress)}%`"
            />
          </div>
        </div>
      </template>

      <template #right>
        <div v-if="displayIndex <= displayTotal && displayIndex > 0" class="progress-counter">
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
        @result="handleResult"
        @skip="handleSkip"
      />

      <!-- 复习完成 -->
      <div v-else class="completion-screen">
        <div class="completion-card">
          <div class="completion-icon">
            <span class="icon-emoji">🎉</span>
            <div class="confetti"></div>
          </div>
          <h2 class="completion-title">恭喜完成！</h2>
          <p class="completion-message">
            {{ mode === 'mode_lapse' ? '所有遗忘单词已复习完成' : '当前批次复习完成' }}
          </p>
          <button @click="goHome" class="home-btn">
            <span class="btn-icon">←</span>
            <span class="btn-text">回到首页</span>
          </button>
        </div>
      </div>
    </main>

    <!-- AI 词汇助手 -->
    <VocabularyAIChat :current-word="currentWord" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useReviewStore } from '@/features/vocabulary/stores/review'
import type { ReviewMode, WordResult } from '@/features/vocabulary/stores/review'
import type { Word, SpellingMetrics } from '@/shared/types'

interface CardResultEvent {
  remembered: boolean
  elapsedTime?: number
  spellingData?: SpellingMetrics
}

import { clearPreloadCache, stopWordAudio } from '@/shared/utils/playWordAudio'
import { initChatHistoryStorage } from '@/shared/utils/chatHistoryStorage'
import ReviewCard from '@/features/vocabulary/review/ReviewCard.vue'
import SpellingCard from '@/features/vocabulary/spelling/SpellingCard.vue'
import TopBar from '@/shared/components/layout/TopBar.vue'
import LoadingComponent from '@/shared/components/feedback/Loading.vue'
import ProgressBar from '@/shared/components/feedback/ProgressBar.vue'
import WordSideBar from '@/features/vocabulary/sidebar/WordSideBar.vue'
import ReviewParamsNotification from '@/features/vocabulary/review/ReviewParamsNotification.vue'
import VocabularyAIChat from '@/shared/components/overlay/VocabularyAIChat.vue'
import ReviewSpeedIndicator from '@/features/vocabulary/review/ReviewSpeedIndicator.vue'
import { useTimerPause } from '@/shared/composables/useTimerPause'
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
  }
}

const handleWordForgot = (wordId: number) => {
  wordResults.value.set(wordId, false)
}

const handleSidebarWordDeleted = (wordId: number) => {
  const index = reviewStore.wordQueue.findIndex(w => w.id === wordId)
  if (index !== -1) {
    reviewStore.wordQueue.splice(index, 1)
    wordResults.value.delete(wordId)
    if (index < currentIndex.value) {
      reviewStore.currentIndex = Math.max(0, currentIndex.value - 1)
    }
  }
}

const handleWordMastered = (wordId: number) => {
  if (mode.value === 'mode_lapse') {
    if (reviewStore.wordQueue.length === 0) return

    const wordIndex = reviewStore.wordQueue.findIndex(w => w.id === wordId)

    if (wordIndex !== -1) {
      reviewStore.wordQueue.splice(wordIndex, 1)

      if (wordIndex < currentIndex.value) {
        reviewStore.currentIndex = Math.max(0, currentIndex.value - 1)
      }

      if (reviewStore.wordQueue.length > 0 && currentIndex.value >= reviewStore.wordQueue.length) {
        reviewStore.currentIndex = 0
        reviewStore.wordQueue = reviewStore.sortByLapse(reviewStore.wordQueue, shuffle.value)
      }

      wordResults.value.set(wordId, true)
    }
  } else {
    wordResults.value.set(wordId, true)
  }
}

const route = useRoute()
const router = useRouter()
const reviewStore = useReviewStore()

const {
  currentWord,
  mode,
  audioType,
  isLoading,
  totalWords,
  currentIndex,
  progress,
  wordResults,
  shuffle,
  globalIndex,
  notification
} = storeToRefs(reviewStore)

provideReviewContext({
  mode,
  audioType,
  currentWord,
  shuffle,
  submitResult: reviewStore.submitResult,
  stopReviewWord: reviewStore.stopReviewWord,
})

const loadingText = ref('加载中...')
const isInitializing = ref(true)

const { requestPause, releasePause } = useTimerPause()

// 计算属性
const displayIndex = computed(() => {
  if (mode.value === 'mode_lapse') {
    return reviewStore.wordQueue.length === 0 ? 0 : (currentIndex.value % reviewStore.wordQueue.length) + 1
  }
  return currentWord.value ? globalIndex.value + 1 : 0
})

const displayTotal = computed(() => {
  if (mode.value === 'mode_lapse') {
    return reviewStore.wordQueue.length
  }
  return currentWord.value ? totalWords.value : 0
})

const currentComponent = computed(() => {
  return mode.value === 'mode_spelling' ? SpellingCard : ReviewCard
})

const modeLabel = computed(() => {
  switch (mode.value) {
    case 'mode_lapse': return '复习错题'
    case 'mode_spelling': return '拼写熟练'
    default: return '复习已有'
  }
})

const modeClass = computed(() => {
  switch (mode.value) {
    case 'mode_lapse': return 'lapse'
    case 'mode_spelling': return 'spelling'
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
  return reviewStore.wordQueue.slice(0, currentIndex.value)
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

    if (['mode_lapse', 'mode_spelling', 'mode_review'].includes(routeMode)) {
      reviewMode = routeMode as ReviewMode
    }

    reviewStore.settings.totalLimit = props.limit

    if (mode.value !== reviewMode) {
      await reviewStore.switchMode(reviewMode)
    } else if (reviewStore.wordQueue.length === 0) {
      await reviewStore.initializeShuffle()
      await reviewStore.loadWords(true)
    }

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
    const wordResult: WordResult = {
      is_spelling: mode.value === 'mode_spelling',
      remembered: result.remembered,
      ...(mode.value === 'mode_spelling'
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

  try {
    reviewStore.stopReviewWord(currentWord.value.id)
  } catch (error) {
    logger.error('停止复习单词失败:', error)
  }
}

const handleCloseNotification = () => {
  reviewStore.closeNotification()
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
  initChatHistoryStorage()
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

/* ── 顶部栏信息 ── */
.header-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.mode-badges {
  display: flex;
  align-items: center;
  gap: 0.5rem;
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

.badge.shuffle {
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
}

/* Lapse 进度条 */
.lapse-progress {
  min-width: 120px;
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
  font-family: var(--font-body);
  font-size: 1rem;
  color: var(--color-text-secondary);
  line-height: 1.6;
  margin-bottom: 2rem;
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

@media (max-width: 480px) {
  .main-content {
    padding: 0 0.75rem;
    padding-top: var(--topbar-height);
    min-height: calc(100vh - var(--topbar-height));
    min-height: calc(100dvh - var(--topbar-height));
  }

  .header-info {
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .mode-badges {
    gap: 0.375rem;
  }

  .badge {
    padding: 0.2rem 0.5rem;
    font-size: 0.65rem;
  }

  .lapse-progress {
    min-width: 80px;
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
    margin-bottom: 1.5rem;
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
    margin-bottom: 0.75rem;
  }

  .home-btn {
    padding: 0.5rem 1.25rem;
    font-size: 0.85rem;
  }
}

</style>
