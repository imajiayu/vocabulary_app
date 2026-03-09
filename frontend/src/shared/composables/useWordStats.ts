import { computed, type Ref } from 'vue'

export interface Word {
  stop_review?: number // 0 或 1
  ease_factor: number
  repetition: number
  source: string
}

export type WordStats = {
  total: number
  remembered: number
  unremembered: number
}

export function useWordStats(words: Ref<Word[]>) {
  const calculateStats = (wordList: Word[]): WordStats => {
    const total = wordList.length
    const remembered = wordList.filter(w => w.stop_review === 1).length
    const unremembered = total - remembered
    return { total, remembered, unremembered }
  }

  const allStats = computed(() => calculateStats(words.value))

  const getStatsBySource = (source: string): WordStats => {
    const filteredWords = words.value.filter(w => w.source === source)
    return calculateStats(filteredWords)
  }

  const filterWordsBySource = (source: string) => {
    if (source === 'all') {
      return words.value
    }
    return words.value.filter(word => word.source === source)
  }

  return {
    allStats,
    getStatsBySource,
    calculateStats,
    filterWordsBySource
  }
}