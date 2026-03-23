/**
 * 复习结果处理：submitResult, stopReviewWord, notification, loads cache
 */
import { ref } from 'vue'
import type { Ref } from 'vue'
import type { SpellingData, Word, UserSettings } from '@/shared/types'
import type { ReviewNotificationData } from '@/shared/api/words'
import type { ReviewMode } from '../review'
import { api } from '@/shared/api'
import {
  calculateReviewResult,
  persistReviewResult,
  calculateSpellingResult,
  persistSpellingResult,
} from '@/shared/services/wordResultService'
import { addDays } from '@/shared/utils/date'
import { findOptimalDay } from '@/shared/core/loadBalancer'
import { calculateSpellStrength } from '@/shared/core/spellRepetition'
import { useSettings } from '@/shared/composables/useSettings'
import { reviewLogger as log } from '@/shared/utils/logger'

export interface ReviewNotificationState {
  show: boolean
  data: ReviewNotificationData | null
}

// 处理上下文：各模式处理函数共用的参数
interface ProcessContext {
  wordForCalc: Word
  result: { is_spelling: boolean; remembered: boolean; elapsed_time?: number; spelling_data?: SpellingData }
  source: string
  wordQueue: Word[]
  wordId: number
  userSettings: UserSettings
}

// 辅助：递增 loads cache 中对应天的负荷
function incrementLoadsCache(cache: number[] | null, dayIndex: number): void {
  if (cache && dayIndex >= 0 && dayIndex < cache.length) {
    cache[dayIndex]++
  }
}

// 辅助：更新 wordQueue 中对应单词的字段
function updateWordInQueue(wordQueue: Word[], wordId: number, updates: Partial<Word>): void {
  const idx = wordQueue.findIndex(w => w.id === wordId)
  if (idx !== -1) {
    wordQueue[idx] = { ...wordQueue[idx], ...updates }
  }
}

export function useReviewResult() {
  const { loadSettings } = useSettings()

  const wordResults = ref<Map<number, boolean>>(new Map())
  const notification = ref<ReviewNotificationState>({
    show: false,
    data: null
  })
  const persistError = ref<string | null>(null)

  // 负荷缓存：会话内复用
  const reviewLoadsCache = ref<number[] | null>(null)
  const spellLoadsCache = ref<number[] | null>(null)

  const closeNotification = () => {
    notification.value = { show: false, data: null }
  }

  // === 模式 1：普通复习 ===
  const handleReviewMode = async (ctx: ProcessContext) => {
    if (!reviewLoadsCache.value) {
      reviewLoadsCache.value = await api.words.getDailyReviewLoadsDirect(
        ctx.source, ctx.userSettings.sourceSettings[ctx.source]?.learning?.maxPrepDays || 45
      )
    }
    const calcResult = calculateReviewResult(
      ctx.wordForCalc, ctx.result.remembered, ctx.result.elapsed_time ?? 3,
      ctx.userSettings, reviewLoadsCache.value
    )

    incrementLoadsCache(reviewLoadsCache.value, calcResult.scheduledDay - 1)
    notification.value = { show: true, data: calcResult.notification }

    const pd = calcResult.persistData
    updateWordInQueue(ctx.wordQueue, ctx.wordId, {
      ease_factor: pd.ease_factor,
      repetition: pd.repetition,
      interval: pd.interval,
      next_review: pd.next_review,
      lapse: pd.lapse,
      remember_count: pd.current_remember_count + pd.remember_inc,
      forget_count: pd.current_forget_count + pd.forget_inc,
      avg_elapsed_time: pd.avg_elapsed_time,
      stop_review: pd.should_stop_review ? 1 : ctx.wordForCalc.stop_review,
    })

    await persistReviewResult(calcResult.persistData, {
      source: ctx.source,
      elapsed_time: Math.round(ctx.result.elapsed_time ?? 3),
      score: calcResult.persistData.score,
    })
  }

  // === 模式 2：拼写练习 ===
  const handleSpellingMode = async (ctx: ProcessContext) => {
    if (!ctx.result.spelling_data) {
      log.error('Missing spelling_data in spelling mode')
      return
    }
    if (!spellLoadsCache.value) {
      spellLoadsCache.value = await api.words.getDailySpellLoadsDirect(
        ctx.source, ctx.userSettings.sourceSettings[ctx.source]?.learning?.maxPrepDays || 45
      )
    }
    const calcResult = calculateSpellingResult(
      ctx.wordForCalc, ctx.result.remembered, ctx.result.spelling_data,
      ctx.userSettings, spellLoadsCache.value
    )

    incrementLoadsCache(spellLoadsCache.value, calcResult.interval - 1)
    notification.value = { show: true, data: calcResult.notification }

    updateWordInQueue(ctx.wordQueue, ctx.wordId, {
      spell_strength: calcResult.persistData.new_strength,
      spell_next_review: calcResult.persistData.next_review,
      stop_spell: calcResult.persistData.should_stop_spell ? 1 : ctx.wordForCalc.stop_spell,
    })

    await persistSpellingResult(calcResult.persistData, {
      source: ctx.source,
      elapsed_time: Math.round((ctx.result.spelling_data?.inputAnalysis?.totalTypingTime ?? 0) / 1000),
      score: ctx.result.remembered ? 5 : 1,
    })
  }

  // === 模式 3：已掌握复习 ===
  const handleMasteredReview = async (ctx: ProcessContext) => {
    const today = new Date().toISOString().split('T')[0]

    if (ctx.result.remembered) {
      // 记住了：更新 last_review + remember_count
      await api.words.updateWordDirect(ctx.wordId, {
        last_review: today,
        remember_count: ctx.wordForCalc.remember_count + 1,
      })
      return
    }

    // 没记住：重置学习参数 + 取消掌握状态
    if (!reviewLoadsCache.value) {
      reviewLoadsCache.value = await api.words.getDailyReviewLoadsDirect(
        ctx.source, ctx.userSettings.sourceSettings[ctx.source]?.learning?.maxPrepDays || 45
      )
    }

    const { chosenDay } = findOptimalDay({
      baseInterval: 1,
      dailyLimit: ctx.userSettings.sourceSettings[ctx.source]?.learning?.dailyReviewLimit || 100,
      currentLoads: reviewLoadsCache.value,
    })

    const nextReview = addDays(today, chosenDay)
    const newEaseFactor = parseFloat(Math.max(1.3, ctx.wordForCalc.ease_factor - 0.4).toFixed(2))

    const updatePayload = {
      repetition: 0,
      interval: 1,
      next_review: nextReview,
      ease_factor: newEaseFactor,
      lapse: 1,
      stop_review: 0,
      last_review: today,
      forget_count: ctx.wordForCalc.forget_count + 1,
    }

    incrementLoadsCache(reviewLoadsCache.value, chosenDay - 1)
    updateWordInQueue(ctx.wordQueue, ctx.wordId, updatePayload)

    const easeChange = Math.round((newEaseFactor - ctx.wordForCalc.ease_factor) * 100) / 100
    notification.value = {
      show: true,
      data: {
        word: ctx.wordForCalc.word,
        param_type: 'ease_factor',
        param_change: easeChange,
        new_param_value: newEaseFactor,
        next_review_date: nextReview,
        breakdown: {
          elapsed_time: Math.round(ctx.result.elapsed_time ?? 3),
          remembered: false,
          score: 0,
          repetition: 0,
          interval: chosenDay,
        }
      }
    }

    await api.words.updateWordDirect(ctx.wordId, updatePayload)
  }

  // === 模式 4：已熟练拼写 ===
  const handleSkilledSpelling = async (ctx: ProcessContext) => {
    if (!ctx.result.spelling_data) {
      log.error('Missing spelling_data in skilled spelling mode')
      return
    }

    const needsReset = (() => {
      if (!ctx.result.remembered) return true
      const [, breakdownInfo] = calculateSpellStrength(
        ctx.result.spelling_data!, true, ctx.wordForCalc.word, ctx.wordForCalc.spell_strength
      )
      return (breakdownInfo.total_score ?? 0) < 0.55
    })()

    if (!needsReset) {
      // remembered 且 totalScore >= 0.55：只更新 last_spell 检查时间
      const today = new Date().toISOString().split('T')[0]
      await api.words.updateWordDirect(ctx.wordId, { last_spell: today })
      return
    }

    // 需要重置拼写进度
    if (!spellLoadsCache.value) {
      spellLoadsCache.value = await api.words.getDailySpellLoadsDirect(
        ctx.source, ctx.userSettings.sourceSettings[ctx.source]?.learning?.maxPrepDays || 45
      )
    }

    const today = new Date().toISOString().split('T')[0]
    const { chosenDay } = findOptimalDay({
      baseInterval: 1,
      dailyLimit: ctx.userSettings.sourceSettings[ctx.source]?.learning?.dailySpellLimit || 200,
      currentLoads: spellLoadsCache.value,
    })

    const nextSpellReview = addDays(today, chosenDay)
    const updatePayload = {
      spell_strength: 0,
      spell_next_review: nextSpellReview,
      stop_spell: 0,
      last_spell: today,
    }

    incrementLoadsCache(spellLoadsCache.value, chosenDay - 1)
    updateWordInQueue(ctx.wordQueue, ctx.wordId, updatePayload)

    const oldStrength = ctx.wordForCalc.spell_strength ?? 0
    notification.value = {
      show: true,
      data: {
        word: ctx.wordForCalc.word,
        param_type: 'spell_strength',
        param_change: -oldStrength,
        new_param_value: 0,
        next_review_date: nextSpellReview,
        breakdown: {
          remembered: ctx.result.remembered,
          typed_count: 0,
          backspace_count: 0,
          word_length: ctx.wordForCalc.word.length,
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

    await api.words.updateWordDirect(ctx.wordId, updatePayload)
  }

  // === 主调度函数 ===
  const processNonLapseResult = async (
    wordForCalc: Word,
    result: { is_spelling: boolean; remembered: boolean; elapsed_time?: number; spelling_data?: SpellingData },
    mode: ReviewMode,
    currentSource: string,
    globalIndex: number,
    wordQueue: Word[],
    wordId: number,
    debouncedUpdateProgressIndex: (idx: number) => void
  ) => {
    try {
      const userSettings = await loadSettings()
      const ctx: ProcessContext = {
        wordForCalc, result, wordQueue, wordId, userSettings,
        source: wordForCalc.source || currentSource,
      }

      if (!result.is_spelling && mode === 'mode_review') {
        await handleReviewMode(ctx)
      } else if (result.is_spelling && mode === 'mode_spelling') {
        await handleSpellingMode(ctx)
      } else if (!result.is_spelling && mode === 'mode_mastered_review') {
        await handleMasteredReview(ctx)
      } else if (result.is_spelling && mode === 'mode_skilled_spelling') {
        await handleSkilledSpelling(ctx)
      }

      api.stats.invalidateCache(ctx.source)
      debouncedUpdateProgressIndex(globalIndex)
    } catch (err) {
      persistError.value = '结果保存失败，请检查网络连接后重试'
      log.error('Failed to calculate/persist result:', err)
    }
  }

  const stopReviewWordNonLapse = (
    wordId: number,
    wordQueue: Ref<Word[]>,
    debouncedUpdateProgressIndex: (idx: number) => void,
    getGlobalIndex: () => number
  ) => {
    api.words.updateWordDirect(wordId, { stop_review: 1 })
      .then((updatedWord) => {
        const index = wordQueue.value.findIndex(w => w.id === updatedWord.id)
        if (index !== -1) {
          wordQueue.value[index] = updatedWord
        }
        debouncedUpdateProgressIndex(getGlobalIndex())
      })
      .catch(log.error)
  }

  const stopSpellWordNonLapse = (
    wordId: number,
    wordQueue: Ref<Word[]>,
    debouncedUpdateProgressIndex: (idx: number) => void,
    getGlobalIndex: () => number
  ) => {
    api.words.updateWordDirect(wordId, { stop_spell: 1 })
      .then((updatedWord) => {
        const index = wordQueue.value.findIndex(w => w.id === updatedWord.id)
        if (index !== -1) {
          wordQueue.value[index] = updatedWord
        }
        debouncedUpdateProgressIndex(getGlobalIndex())
      })
      .catch(log.error)
  }

  const reset = () => {
    wordResults.value.clear()
    notification.value = { show: false, data: null }
    persistError.value = null
    reviewLoadsCache.value = null
    spellLoadsCache.value = null
  }

  return {
    wordResults,
    notification,
    persistError,
    reviewLoadsCache,
    spellLoadsCache,
    closeNotification,
    processNonLapseResult,
    stopReviewWordNonLapse,
    stopSpellWordNonLapse,
    reset,
  }
}
