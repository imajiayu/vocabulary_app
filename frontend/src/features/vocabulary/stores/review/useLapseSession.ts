/**
 * Lapse 模式：Expanding Retrieval Practice
 * wordGapLevels, graduation, GAP_SEQUENCE
 */
import { ref } from 'vue'
import type { Word } from '@/shared/types'
import { api } from '@/shared/api'
import { reviewLogger as log } from '@/shared/utils/logger'

// Expanding Retrieval Practice 常量
const GAP_SEQUENCE = [1, 3, 7, 15] as const

export function useLapseSession() {
  const wordGapLevels = ref<Map<number, number>>(new Map())
  const graduatedCount = ref(0)
  const initialWordCount = ref(0)
  const graduatedWords = ref<Word[]>([])

  const lastLapseResult = ref<{
    word: string
    remembered: boolean
    elapsed_time: number
    previousLevel: number
    newLevel: number
    graduated: boolean
  } | null>(null)

  const processLapseResult = (
    wordQueue: Word[],
    wordId: number,
    remembered: boolean,
    elapsedTime: number
  ) => {
    if (wordQueue.length === 0) return

    const word = wordQueue[0]
    if (!word || word.id !== wordId) return

    // 从队首移除
    wordQueue.shift()

    const currentLevel = wordGapLevels.value.get(word.id) ?? 0

    let graduated = false
    let newLevelForResult = currentLevel

    if (!remembered) {
      newLevelForResult = 0
      wordGapLevels.value.set(word.id, 0)
      const insertPos = Math.min(GAP_SEQUENCE[0], wordQueue.length)
      wordQueue.splice(insertPos, 0, word)
    } else {
      const newLevel = elapsedTime >= 4 ? currentLevel : currentLevel + 1
      newLevelForResult = newLevel

      if (newLevel >= GAP_SEQUENCE.length) {
        graduated = true
      } else {
        wordGapLevels.value.set(word.id, newLevel)
        const insertPos = Math.min(GAP_SEQUENCE[newLevel], wordQueue.length)
        wordQueue.splice(insertPos, 0, word)
      }
    }

    lastLapseResult.value = {
      word: word.word,
      remembered,
      elapsed_time: elapsedTime,
      previousLevel: currentLevel,
      newLevel: newLevelForResult,
      graduated
    }

    if (graduated) {
      graduatedCount.value++
      graduatedWords.value.push(word)
      wordGapLevels.value.delete(word.id)
      api.words.clearLapseDirect(word.id).catch(log.error)
      api.progress.updateProgressSnapshotDirect(wordQueue.map(w => w.id))
        .catch(err => log.warn('Failed to update lapse snapshot:', err))
    }
  }

  const stopLapseWord = (
    wordQueue: Word[],
    wordId: number
  ) => {
    if (wordQueue.length === 0) return

    const removedWord = wordQueue.shift()
    graduatedCount.value++
    if (removedWord) graduatedWords.value.push(removedWord)
    wordGapLevels.value.delete(wordId)

    api.words.clearLapseDirect(wordId).catch(log.error)
    api.progress.updateProgressSnapshotDirect(wordQueue.map(w => w.id))
      .catch(err => log.warn('Failed to update lapse snapshot:', err))
  }

  const removeWordFromLapseSession = (
    wordQueue: Word[],
    wordId: number
  ) => {
    const queueIndex = wordQueue.findIndex(w => w.id === wordId)
    if (queueIndex !== -1) {
      wordQueue.splice(queueIndex, 1)
      wordGapLevels.value.delete(wordId)
      graduatedCount.value++
      api.progress.updateProgressSnapshotDirect(wordQueue.map(w => w.id))
        .catch(err => log.warn('Failed to update lapse snapshot:', err))
      return
    }
    const gradIndex = graduatedWords.value.findIndex(w => w.id === wordId)
    if (gradIndex !== -1) {
      graduatedWords.value.splice(gradIndex, 1)
    }
  }

  const progress = () => {
    if (initialWordCount.value === 0) return 0
    return Math.round((graduatedCount.value / initialWordCount.value) * 100)
  }

  const reset = () => {
    wordGapLevels.value = new Map()
    graduatedCount.value = 0
    initialWordCount.value = 0
    graduatedWords.value = []
    lastLapseResult.value = null
  }

  return {
    wordGapLevels,
    graduatedCount,
    initialWordCount,
    graduatedWords,
    lastLapseResult,
    processLapseResult,
    stopLapseWord,
    removeWordFromLapseSession,
    progress,
    reset,
  }
}
