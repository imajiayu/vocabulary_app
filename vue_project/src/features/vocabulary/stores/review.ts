// stores/review.ts - 优化后的代码
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SpellingMetrics, Word, WordsApiResponse } from '@/shared/types'
import { api } from '@/shared/api'
import { useShuffleSelectionReadOnly } from '@/shared/composables/useShuffleSelection'

export interface WordResult {
  is_spelling: boolean
  remembered: boolean
  elapsed_time?: number
  spelling_data?: SpellingMetrics
  mode?: ReviewMode
}

export type ReviewMode = 'mode_review' | 'mode_lapse' | 'mode_spelling'
export type AudioType = 'us' | 'uk'

export const useReviewStore = defineStore('review', () => {
  // Shuffle状态管理
  const { shuffle, initializeFromData: initializeShuffle } = useShuffleSelectionReadOnly()

  // 状态
  const wordQueue = ref<Word[]>([])
  const currentIndex = ref(0)
  const mode = ref<ReviewMode>('mode_review')
  const audioType = ref<AudioType>('us')
  const isLoading = ref(false)
  const hasMore = ref(true)
  const totalWords = ref(0)
  const initialLapseCount = ref(0)
  const currentBatchId = ref(0)
  const wordResults = ref<Map<number, boolean>>(new Map())

  // 设置
  const settings = ref({
    queueThreshold: 5,
    batchSize: 20,
    totalLimit: 100
  })

  // 计算属性
  const currentWord = computed(() => {
    if (wordQueue.value.length === 0) return null

    if (mode.value === 'mode_lapse') {
      // lapse模式：循环队列
      return wordQueue.value[currentIndex.value % wordQueue.value.length] || null
    } else {
      // 其他模式：线性队列
      return currentIndex.value < wordQueue.value.length
        ? wordQueue.value[currentIndex.value]
        : null
    }
  })

  const progress = computed(() => {
    if (mode.value === 'mode_lapse') {
      if (initialLapseCount.value === 0) return 0
      return Math.round(((initialLapseCount.value - totalLapseSum.value) / initialLapseCount.value) * 100)
    }
    return 0;
  })

  const shouldLoadMore = computed(() => {
    if (mode.value === 'mode_lapse') return false
    const remaining = wordQueue.value.length - currentIndex.value
    return remaining <= settings.value.queueThreshold && hasMore.value && !isLoading.value
  })

  const isCompleted = computed(() => {
    if (mode.value === 'mode_lapse') {
      return wordQueue.value.length === 0
    }
    // For other modes: completed when we've reached the end of current queue AND no more data available
    return currentIndex.value >= wordQueue.value.length && !hasMore.value
  })

  const totalLapseSum = computed(() => {
    return wordQueue.value.reduce((sum, word) => sum + word.lapse, 0)
  })

  const sortByLapse = (words: Word[], shuffleEnabled: boolean = false): Word[] => {
    // Group words by lapse value
    const lapseGroups = new Map<number, Word[]>()

    words.forEach(word => {
      const lapse = word.lapse || 0
      if (!lapseGroups.has(lapse)) {
        lapseGroups.set(lapse, [])
      }
      lapseGroups.get(lapse)!.push(word)
    })

    // Sort groups by lapse value and apply sorting/shuffling within each group
    const result: Word[] = []
    const sortedLapseKeys = Array.from(lapseGroups.keys()).sort((a, b) => a - b)

    sortedLapseKeys.forEach(lapse => {
      const group = lapseGroups.get(lapse)!

      if (shuffleEnabled) {
        // Shuffle within each lapse group
        for (let i = group.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[group[i], group[j]] = [group[j], group[i]]
        }
      } else {
        // Sort by id within each lapse group
        group.sort((a, b) => a.id - b.id)
      }

      result.push(...group)
    })

    return result
  }

  // 主要方法
  const loadWords = async (resetQueue = false): Promise<void> => {
    if (isLoading.value) return

    isLoading.value = true
    try {
      if (mode.value === 'mode_lapse') {
        // lapse模式：一次性加载所有单词
        const data: WordsApiResponse = await api.words.getReviewWords({
          mode: mode.value,
          limit: settings.value.totalLimit,
          batch_id: 0,  // lapse模式使用batch_id=0获取所有数据
          batch_size: settings.value.totalLimit
        })
        const newWords = sortByLapse(data.words as Word[], shuffle.value)

        wordQueue.value = newWords
        currentIndex.value = 0
        totalWords.value = data.total
        initialLapseCount.value = totalLapseSum.value
        hasMore.value = false

      } else {
        // 其他模式：分页加载
        const batchIdToUse = resetQueue ? 0 : currentBatchId.value
        const offsetToUse = resetQueue ? 0 : currentBatchId.value * settings.value.batchSize

        const data: WordsApiResponse = await api.words.getReviewWords({
          mode: mode.value,
          limit: settings.value.totalLimit,
          batch_id: batchIdToUse,
          batch_size: settings.value.batchSize,
          offset: offsetToUse
        })
        let newWords = data.words as Word[]

        if (resetQueue) {
          wordQueue.value = newWords
          currentIndex.value = 0
          currentBatchId.value = 1
        } else {
          wordQueue.value.push(...newWords)
          currentBatchId.value++
        }

        totalWords.value = data.total
        hasMore.value = data.has_more
      }

    } catch (error) {
      console.error('Failed to load words:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  const submitResult = (wordId: number, result: WordResult): void => {
    if (mode.value === 'mode_lapse') {
      if (wordQueue.value.length === 0) return

      const currentWordIndex = currentIndex.value % wordQueue.value.length
      const word = wordQueue.value[currentWordIndex]

      if (word && word.id === wordId) {
        // 更新 lapse，记住时减1，没记住时加1，最大值为5（与后端一致）
        word.lapse = result.remembered
          ? Math.max(0, word.lapse - 1)  // 记住时减1，最小为0
          : Math.min(word.lapse + 1, 5)  // 没记住时加1，最大为5

        if (word.lapse === 0) {
          wordQueue.value.splice(currentWordIndex, 1)
          if (wordQueue.value.length === 0) {
            currentIndex.value = 0
          } else if (currentIndex.value >= wordQueue.value.length) {
            currentIndex.value = 0
            wordQueue.value = sortByLapse(wordQueue.value, shuffle.value)
          }
        } else {
          currentIndex.value++
          if (currentIndex.value >= wordQueue.value.length) {
            currentIndex.value = 0
            wordQueue.value = sortByLapse(wordQueue.value, shuffle.value)
          }
        }
      }
    } else {
      currentIndex.value++
      // Check if we need to load more data or if we're completed
      if (shouldLoadMore.value && !isCompleted.value) {
        loadWords(false)
      }
    }

    // 异步提交并更新最新word（直接使用返回的数据，包含related_words）
    // 添加mode参数到result中
    const resultWithMode = { ...result, mode: mode.value }
    api.words.submitWordResult(wordId, resultWithMode)
      .then((updatedWord) => {
        // 替换queue中的word
        const index = wordQueue.value.findIndex(w => w.id === updatedWord.id)
        if (index !== -1) {
          wordQueue.value[index] = updatedWord
        }
        // 更新wordResults，确保与最新数据同步
        wordResults.value.set(updatedWord.id, result.remembered)
      })
      .catch(console.error)
  }

  const stopReviewWord = (wordId: number): void => {
    if (mode.value === 'mode_lapse') {
      if (wordQueue.value.length === 0) return

      const currentWordIndex = currentIndex.value % wordQueue.value.length
      wordQueue.value.splice(currentWordIndex, 1)

      if (wordQueue.value.length > 0 && currentIndex.value >= wordQueue.value.length) {
        currentIndex.value = 0
        wordQueue.value = sortByLapse(wordQueue.value, shuffle.value)
      }
    } else {
      currentIndex.value++
      // Check if we need to load more data or if we're completed
      if (shouldLoadMore.value && !isCompleted.value) {
        loadWords(false)
      }
    }

    api.words.stopReview(wordId, mode.value)
      .then(async () => {
        const updatedWord = await api.words.getWord(wordId)
        const index = wordQueue.value.findIndex(w => w.id === updatedWord.id)
        if (index !== -1) {
          wordQueue.value[index] = updatedWord
        }
        wordResults.value.set(updatedWord.id, true)
      })
      .catch(console.error)
  }

  const switchMode = async (newMode: ReviewMode): Promise<void> => {
    mode.value = newMode
    currentIndex.value = 0
    currentBatchId.value = 0
    // 确保shuffle状态是最新的
    await initializeShuffle()
    await loadWords(true)
  }

  const setAudioType = (type: AudioType) => {
    audioType.value = type
  }

  const reset = () => {
    wordQueue.value = []
    currentIndex.value = 0
    totalWords.value = 0
    hasMore.value = true
    initialLapseCount.value = 0
    currentBatchId.value = 0
    wordResults.value.clear()
  }

  const restoreFromProgress = async (): Promise<boolean> => {
    isLoading.value = true

    try {
      const data = await api.progress.getRestoreData()

      if (!data.progress || !data.words) {
        console.log('No valid progress data to restore')
        return false
      }

      const { progress, words } = data

      // 恢复基本状态
      mode.value = progress.mode as ReviewMode
      totalWords.value = data.total

      // 对于lapse模式，特殊处理
      if (progress.mode === 'mode_lapse') {
        // 重新排序单词并恢复队列
        const sortedWords = sortByLapse(words as Word[], progress.shuffle)
        wordQueue.value = sortedWords
        // 恢复initial_lapse_count（关键修复：使用保存的初始值，而不是当前总和）
        initialLapseCount.value = progress.initial_lapse_count || 0
        hasMore.value = false

        // lapse模式索引始终为0（循环队列）
        currentIndex.value = 0
      } else {
        // 其他模式恢复保存的索引位置
        currentIndex.value = progress.current_index
        wordQueue.value = words as Word[]
        // 正确计算hasMore：还有服务器数据 AND 当前队列还没到最后一个
        hasMore.value = (words.length + progress.current_index) < totalWords.value
        // 如果已经到达最后但队列还有数据，标记为无更多数据
        if (currentIndex.value >= words.length && hasMore.value) {
          // 需要加载更多数据继续
        } else if (currentIndex.value >= words.length) {
          hasMore.value = false
        }
      }

      return true

    } catch (error) {
      console.error('Failed to restore progress:', error)
      return false
    } finally {
      isLoading.value = false
    }
  }

  return {
    // 状态
    wordQueue,
    currentIndex,
    mode,
    audioType,
    isLoading,
    totalWords,
    settings,
    wordResults,
    shuffle, // 暴露shuffle状态

    // 计算属性
    currentWord,
    progress,
    shouldLoadMore,
    isCompleted,

    // 方法
    loadWords,
    submitResult,
    stopReviewWord,
    switchMode,
    setAudioType,
    reset,
    initializeShuffle, // 暴露初始化方法
    restoreFromProgress, // 恢复进度方法
    sortByLapse, // 暴露排序方法
  }
})