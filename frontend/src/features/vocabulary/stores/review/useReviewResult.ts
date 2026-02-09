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
} from '@/shared/services/wordResultService'
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

        const chosenIdx = calcResult.persistData.interval - 1
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
          }
        }

        persistSpellingResult(calcResult.persistData, {
          source,
          elapsed_time: Math.round((result.spelling_data?.inputAnalysis?.totalTypingTime ?? 0) / 1000),
          score: result.remembered ? 5 : 1,
        }).catch(err => log.error('Failed to persist spelling result:', err))
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
    reset,
  }
}
