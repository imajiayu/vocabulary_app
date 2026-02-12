/**
 * 复习 Store — 薄编排层
 *
 * 组合 5 个子模块，保持对外接口不变：
 * - useReviewQueue:    队列管理、分页加载、进度恢复
 * - useReviewProgress: debounced index 持久化、beforeunload
 * - useReviewResult:   结果计算、通知、负荷缓存
 * - useLapseSession:   Expanding Retrieval Practice
 * - useAudioPreloader: 音频预加载、缓存清理
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SpellingData } from '@/shared/types'

import { useReviewQueue } from './review/useReviewQueue'
import { useReviewProgress } from './review/useReviewProgress'
import { useReviewResult } from './review/useReviewResult'
import { useLapseSession } from './review/useLapseSession'
import { useAudioPreloader } from './review/useAudioPreloader'

export interface WordResult {
  is_spelling: boolean
  remembered: boolean
  elapsed_time?: number
  spelling_data?: SpellingData
  mode?: ReviewMode
}

export type ReviewMode = 'mode_review' | 'mode_lapse' | 'mode_spelling'
export type AudioType = 'us' | 'uk'

export type { ReviewNotificationState } from './review/useReviewResult'

export const useReviewStore = defineStore('review', () => {
  // === 子模块 ===
  const queue = useReviewQueue()
  const progress = useReviewProgress()
  const result = useReviewResult()
  const lapse = useLapseSession()

  // 状态
  const mode = ref<ReviewMode>('mode_review')
  const audioType = ref<AudioType>('us')

  // 音频预加载（需要传入 refs）
  const audio = useAudioPreloader(queue.wordQueue, queue.currentIndex, audioType, mode)

  // === 计算属性（代理到子模块） ===
  const currentWord = computed(() => queue.currentWord(mode.value))

  const progressPercent = computed(() => {
    if (mode.value === 'mode_lapse') {
      return lapse.progress()
    }
    return 0
  })

  const shouldLoadMore = computed(() => queue.shouldLoadMore(mode.value))
  const isCompleted = computed(() => queue.isCompleted(mode.value))
  const globalIndex = computed(() => queue.globalIndex(mode.value))

  // === 方法 ===
  const loadWords = async (resetQueue = false, silent = false): Promise<void> => {
    await queue.loadWords(
      mode.value,
      resetQueue,
      silent,
      progress.cancelPendingIndex,
      lapse.initialWordCount,
      lapse.graduatedCount,
      lapse.wordGapLevels,
      lapse.graduatedWords
    )
  }

  const submitResult = (wordId: number, wordResult: WordResult): void => {
    result.wordResults.value.set(wordId, wordResult.remembered)

    const wordForCalc = currentWord.value

    // === Lapse 模式 ===
    if (mode.value === 'mode_lapse') {
      lapse.processLapseResult(
        queue.wordQueue.value,
        wordId,
        wordResult.remembered,
        wordResult.elapsed_time ?? 3
      )
      return
    }

    // === 非 Lapse 模式 ===
    queue.currentIndex.value++
    if (shouldLoadMore.value && !isCompleted.value) {
      loadWords(false, true)
    }

    if (!wordForCalc) return

    const source = wordForCalc.source || queue.currentSource.value || 'IELTS'

    result.processNonLapseResult(
      wordForCalc,
      wordResult,
      mode.value,
      source,
      globalIndex.value,
      queue.wordQueue.value,
      wordId,
      progress.debouncedUpdateProgressIndex
    )
  }

  const stopReviewWord = (wordId: number): void => {
    result.wordResults.value.set(wordId, true)

    if (mode.value === 'mode_lapse') {
      lapse.stopLapseWord(queue.wordQueue.value, wordId)
    } else {
      queue.currentIndex.value++
      if (shouldLoadMore.value && !isCompleted.value) {
        loadWords(false, true)
      }
    }

    if (mode.value !== 'mode_lapse') {
      result.stopReviewWordNonLapse(
        wordId,
        queue.wordQueue,
        progress.debouncedUpdateProgressIndex,
        () => globalIndex.value
      )
    }
  }

  const removeWordFromLapseSession = (wordId: number): void => {
    lapse.removeWordFromLapseSession(queue.wordQueue.value, wordId)
  }

  const removeWordFromSnapshot = (wordId: number): void => {
    queue.removeWordFromSnapshot(wordId, progress.debouncedUpdateProgressIndex, mode.value)
  }

  const switchMode = async (newMode: ReviewMode): Promise<void> => {
    mode.value = newMode
    queue.currentIndex.value = 0
    queue.initialOffset.value = 0
    result.reviewLoadsCache.value = null
    result.spellLoadsCache.value = null
    await queue.initializeShuffle()
    await queue.loadSettings()
    await loadWords(true)
  }

  const setAudioType = (type: AudioType) => {
    audioType.value = type
  }

  const restoreFromProgress = async (): Promise<boolean> => {
    result.reviewLoadsCache.value = null
    result.spellLoadsCache.value = null

    return queue.restoreFromProgress(
      mode,
      lapse.initialWordCount,
      lapse.graduatedCount,
      lapse.wordGapLevels,
      lapse.graduatedWords
    )
  }

  const reset = () => {
    queue.reset()
    result.reset()
    lapse.reset()
  }

  return {
    // 状态
    wordQueue: queue.wordQueue,
    currentIndex: queue.currentIndex,
    mode,
    audioType,
    isLoading: queue.isLoading,
    isBackgroundLoading: queue.isBackgroundLoading,
    totalWords: queue.totalWords,
    settings: queue.settings,
    wordResults: result.wordResults,
    shuffle: queue.shuffle,
    notification: result.notification,
    reviewLoadsCache: result.reviewLoadsCache,
    spellLoadsCache: result.spellLoadsCache,
    graduatedWords: lapse.graduatedWords,
    initialWordCount: lapse.initialWordCount,
    wordGapLevels: lapse.wordGapLevels,
    graduatedCount: lapse.graduatedCount,
    lastLapseResult: lapse.lastLapseResult,

    // 计算属性
    currentWord,
    progress: progressPercent,
    shouldLoadMore,
    isCompleted,
    globalIndex,

    // 方法
    loadWords,
    submitResult,
    stopReviewWord,
    removeWordFromLapseSession,
    removeWordFromSnapshot,
    switchMode,
    setAudioType,
    reset,
    initializeShuffle: queue.initializeShuffle,
    restoreFromProgress,
    preloadUpcomingAudio: audio.preloadUpcomingAudio,
    closeNotification: result.closeNotification,
    flushProgressIndex: progress.flushProgressIndex,
    clearSessionProgress: progress.clearSessionProgress,
  }
})
