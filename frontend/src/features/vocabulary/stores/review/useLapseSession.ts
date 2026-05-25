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
  // 真实毕业计数：仅在 processLapseResult 升级到顶级时递增，用于驱动毕业速率指标
  // graduatedCount 还会被 stopLapseWord 递增，会污染速率统计
  const realGraduatedCount = ref(0)
  // 有效推进次数：仅在 remembered=true 且 level 实际前进（含毕业）时 +1
  // 与 remainingCorrect 同语义（Σ(maxLevel - level)），保证 ETA 分子分母一致
  // 慢速答对（elapsedTime >= 4）不推进 level，故也不计入，避免 ETA 高估速率
  const totalCorrect = ref(0)

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
      if (newLevel > currentLevel) totalCorrect.value++

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
      realGraduatedCount.value++
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

    wordQueue.shift()
    graduatedCount.value++
    wordGapLevels.value.delete(wordId)

    api.words.clearLapseDirect(wordId).catch(log.error)
    api.progress.updateProgressSnapshotDirect(wordQueue.map(w => w.id))
      .catch(err => log.warn('Failed to update lapse snapshot:', err))
  }

  const removeWordFromLapseSession = (
    wordQueue: Word[],
    wordId: number,
    totalWordsRef: { value: number }
  ) => {
    const queueIndex = wordQueue.findIndex(w => w.id === wordId)
    if (queueIndex === -1) return
    wordQueue.splice(queueIndex, 1)
    wordGapLevels.value.delete(wordId)
    totalWordsRef.value = Math.max(0, totalWordsRef.value - 1)
    api.progress.updateProgressSnapshotDirect(wordQueue.map(w => w.id))
      .catch(err => log.warn('Failed to update lapse snapshot:', err))
  }

  const progress = (totalWords: number) => {
    if (totalWords === 0) return 0
    return Math.round((graduatedCount.value / totalWords) * 100)
  }

  const reset = () => {
    wordGapLevels.value = new Map()
    graduatedCount.value = 0
    realGraduatedCount.value = 0
    totalCorrect.value = 0
    lastLapseResult.value = null
  }

  return {
    wordGapLevels,
    graduatedCount,
    realGraduatedCount,
    totalCorrect,
    lastLapseResult,
    processLapseResult,
    stopLapseWord,
    removeWordFromLapseSession,
    progress,
    reset,
  }
}

export const LAPSE_GAP_SEQUENCE = GAP_SEQUENCE
