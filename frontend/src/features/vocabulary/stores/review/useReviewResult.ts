/**
 * 复习结果处理：submitResult, stopReviewWord, notification, loads cache
 */
import { ref } from 'vue'
import type { Ref } from 'vue'
import type { SpellingData, Word } from '@/shared/types'
import type { ReviewNotificationData } from '@/shared/api/words'
import type { ReviewMode } from '../review'
import { api } from '@/shared/api'
import {
  calculateReviewResult,
  persistReviewResult,
  calculateSpellingResult,
  persistSpellingResult,
  addDays,
} from '@/shared/services/wordResultService'
import { findOptimalDay } from '@/shared/core/loadBalancer'
import { calculateSpellStrength } from '@/shared/core/spellRepetition'
import { useSettings } from '@/shared/composables/useSettings'
import { reviewLogger as log } from '@/shared/utils/logger'

export interface ReviewNotificationState {
  show: boolean
  data: ReviewNotificationData | null
}

export function useReviewResult() {
  const { loadSettings } = useSettings()

  const wordResults = ref<Map<number, boolean>>(new Map())
  const notification = ref<ReviewNotificationState>({
    show: false,
    data: null
  })

  // 负荷缓存：会话内复用
  const reviewLoadsCache = ref<number[] | null>(null)
  const spellLoadsCache = ref<number[] | null>(null)

  const closeNotification = () => {
    notification.value = { show: false, data: null }
  }

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
      const source = wordForCalc.source || currentSource

      if (!result.is_spelling && mode === 'mode_review') {
        if (!reviewLoadsCache.value) {
          reviewLoadsCache.value = await api.words.getDailyReviewLoadsDirect(source, userSettings.learning.maxPrepDays || 45)
        }
        const calcResult = calculateReviewResult(
          wordForCalc, result.remembered, result.elapsed_time ?? 3, userSettings, reviewLoadsCache.value
        )

        const chosenIdx = calcResult.scheduledDay - 1
        if (reviewLoadsCache.value && chosenIdx >= 0 && chosenIdx < reviewLoadsCache.value.length) {
          reviewLoadsCache.value[chosenIdx]++
        }

        notification.value = { show: true, data: calcResult.notification }

        const idx = wordQueue.findIndex(w => w.id === wordId)
        if (idx !== -1) {
          const pd = calcResult.persistData
          wordQueue[idx] = {
            ...wordQueue[idx],
            ease_factor: pd.ease_factor,
            repetition: pd.repetition,
            interval: pd.interval,
            next_review: pd.next_review,
            lapse: pd.lapse,
            remember_count: pd.current_remember_count + pd.remember_inc,
            forget_count: pd.current_forget_count + pd.forget_inc,
            avg_elapsed_time: pd.avg_elapsed_time,
            stop_review: pd.should_stop_review ? 1 : wordQueue[idx].stop_review,
          }
        }

        persistReviewResult(calcResult.persistData, {
          source,
          elapsed_time: Math.round(result.elapsed_time ?? 3),
          score: calcResult.persistData.score,
        }).catch(err => log.error('Failed to persist review result:', err))

      } else if (result.is_spelling && mode === 'mode_spelling') {
        if (!result.spelling_data) {
          log.error('Missing spelling_data in spelling mode')
          return
        }
        if (!spellLoadsCache.value) {
          spellLoadsCache.value = await api.words.getDailySpellLoadsDirect(source, userSettings.learning.maxPrepDays || 45)
        }
        const calcResult = calculateSpellingResult(
          wordForCalc, result.remembered, result.spelling_data, userSettings, spellLoadsCache.value
        )

        const chosenIdx = calcResult.interval - 1
        if (spellLoadsCache.value && chosenIdx >= 0 && chosenIdx < spellLoadsCache.value.length) {
          spellLoadsCache.value[chosenIdx]++
        }

        notification.value = { show: true, data: calcResult.notification }

        const idx = wordQueue.findIndex(w => w.id === wordId)
        if (idx !== -1) {
          wordQueue[idx] = {
            ...wordQueue[idx],
            spell_strength: calcResult.persistData.new_strength,
            spell_next_review: calcResult.persistData.next_review,
            stop_spell: calcResult.persistData.should_stop_spell ? 1 : wordQueue[idx].stop_spell,
          }
        }

        persistSpellingResult(calcResult.persistData, {
          source,
          elapsed_time: Math.round((result.spelling_data?.inputAnalysis?.totalTypingTime ?? 0) / 1000),
          score: result.remembered ? 5 : 1,
        }).catch(err => log.error('Failed to persist spelling result:', err))

      } else if (!result.is_spelling && mode === 'mode_mastered_review') {
        // === 复习已掌握模式 ===
        const today = new Date().toISOString().split('T')[0]

        if (result.remembered) {
          // 记住了：更新 last_review + remember_count
          api.words.updateWordDirect(wordId, {
            last_review: today,
            remember_count: wordForCalc.remember_count + 1,
          }).catch(err => log.error('Failed to update last_review:', err))
        } else {
          // 没记住：重置学习参数 + 取消掌握状态
          if (!reviewLoadsCache.value) {
            reviewLoadsCache.value = await api.words.getDailyReviewLoadsDirect(source, userSettings.learning.maxPrepDays || 45)
          }

          const { chosenDay } = findOptimalDay({
            baseInterval: 1,
            dailyLimit: userSettings.learning.dailyReviewLimit || 100,
            currentLoads: reviewLoadsCache.value,
          })

          const nextReview = addDays(today, chosenDay)
          const newEaseFactor = parseFloat(Math.max(1.3, wordForCalc.ease_factor - 0.4).toFixed(2))

          const updatePayload = {
            repetition: 0,
            interval: 1,
            next_review: nextReview,
            ease_factor: newEaseFactor,
            lapse: 1,
            stop_review: 0,
            last_review: today,
            forget_count: wordForCalc.forget_count + 1,
          }

          // 更新 loads cache
          const chosenIdx = chosenDay - 1
          if (reviewLoadsCache.value && chosenIdx >= 0 && chosenIdx < reviewLoadsCache.value.length) {
            reviewLoadsCache.value[chosenIdx]++
          }

          // 更新 wordQueue 中对应单词
          const idx = wordQueue.findIndex(w => w.id === wordId)
          if (idx !== -1) {
            wordQueue[idx] = { ...wordQueue[idx], ...updatePayload }
          }

          // 通知
          const easeChange = Math.round((newEaseFactor - wordForCalc.ease_factor) * 100) / 100
          notification.value = {
            show: true,
            data: {
              word: wordForCalc.word,
              param_type: 'ease_factor',
              param_change: easeChange,
              new_param_value: newEaseFactor,
              next_review_date: nextReview,
              breakdown: {
                elapsed_time: Math.round(result.elapsed_time ?? 3),
                remembered: false,
                score: 0,
                repetition: 0,
                interval: chosenDay,
              }
            }
          }

          api.words.updateWordDirect(wordId, updatePayload)
            .catch(err => log.error('Failed to persist mastered review result:', err))
        }

      } else if (result.is_spelling && mode === 'mode_skilled_spelling') {
        // === 拼写已熟练模式 ===
        if (!result.spelling_data) {
          log.error('Missing spelling_data in skilled spelling mode')
          return
        }

        const needsReset = (() => {
          if (!result.remembered) return true
          // 计算 totalScore 判断是否需要重置
          const [, breakdownInfo] = calculateSpellStrength(
            result.spelling_data!, true, wordForCalc.word, wordForCalc.spell_strength
          )
          return (breakdownInfo.total_score ?? 0) < 0.55
        })()

        if (needsReset) {
          // resetSpelling 逻辑
          if (!spellLoadsCache.value) {
            spellLoadsCache.value = await api.words.getDailySpellLoadsDirect(source, userSettings.learning.maxPrepDays || 45)
          }

          const today = new Date().toISOString().split('T')[0]
          const { chosenDay } = findOptimalDay({
            baseInterval: 1,
            dailyLimit: userSettings.learning.dailySpellLimit || 200,
            currentLoads: spellLoadsCache.value,
          })

          const nextSpellReview = addDays(today, chosenDay)
          const updatePayload = {
            spell_strength: 0,
            spell_next_review: nextSpellReview,
            stop_spell: 0,
            last_spell: today,
          }

          // 更新 loads cache
          const chosenIdx = chosenDay - 1
          if (spellLoadsCache.value && chosenIdx >= 0 && chosenIdx < spellLoadsCache.value.length) {
            spellLoadsCache.value[chosenIdx]++
          }

          // 更新 wordQueue
          const idx = wordQueue.findIndex(w => w.id === wordId)
          if (idx !== -1) {
            wordQueue[idx] = { ...wordQueue[idx], ...updatePayload }
          }

          // 通知
          const oldStrength = wordForCalc.spell_strength ?? 0
          notification.value = {
            show: true,
            data: {
              word: wordForCalc.word,
              param_type: 'spell_strength',
              param_change: -oldStrength,
              new_param_value: 0,
              next_review_date: nextSpellReview,
              breakdown: {
                remembered: result.remembered,
                typed_count: 0,
                backspace_count: 0,
                word_length: wordForCalc.word.length,
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

          api.words.updateWordDirect(wordId, updatePayload)
            .catch(err => log.error('Failed to persist skilled spelling reset:', err))
        } else {
          // remembered 且 totalScore >= 0.55：只更新 last_spell 检查时间
          const today = new Date().toISOString().split('T')[0]
          api.words.updateWordDirect(wordId, { last_spell: today })
            .catch(err => log.error('Failed to update last_spell:', err))
        }
      }

      debouncedUpdateProgressIndex(globalIndex)
    } catch (err) {
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
    reviewLoadsCache.value = null
    spellLoadsCache.value = null
  }

  return {
    wordResults,
    notification,
    reviewLoadsCache,
    spellLoadsCache,
    closeNotification,
    processNonLapseResult,
    stopReviewWordNonLapse,
    stopSpellWordNonLapse,
    reset,
  }
}
