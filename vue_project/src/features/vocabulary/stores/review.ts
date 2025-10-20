// stores/review.ts - 优化后的代码
import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { SpellingMetrics, Word, WordsApiResponse } from '@/shared/types'
import { api } from '@/shared/api'
import { useShuffleSelectionReadOnly } from '@/shared/composables/useShuffleSelection'
import { preloadMultipleWordAudio, clearPreloadCache, clearCacheNotInWords } from '@/shared/utils/playWordAudio'
import { useAudioAccent } from '@/shared/composables/useAudioAccent'
import { useSettings } from '@/shared/composables/useSettings'

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

  // 音频口音状态管理 - 与全局设置同步
  const { audioAccent } = useAudioAccent()

  // 设置管理 - 用于获取lapse配置
  const { settings: userSettings, loadSettings } = useSettings()

  // 状态
  const wordQueue = ref<Word[]>([])
  const currentIndex = ref(0)
  const mode = ref<ReviewMode>('mode_review')
  const audioType = ref<AudioType>('us')
  const isLoading = ref(false)
  const isBackgroundLoading = ref(false)  // 后台预加载状态（不显示Loading UI）
  const hasMore = ref(true)
  const totalWords = ref(0)
  const initialLapseCount = ref(0)
  const currentBatchId = ref(0)
  const wordResults = ref<Map<number, boolean>>(new Map())

  // 同步 audioType 与全局 audioAccent
  watch(audioAccent, (newAccent) => {
    if (audioType.value !== newAccent) {
      audioType.value = newAccent
      // 切换口音时清理旧缓存
      clearPreloadCache(0) // 清除所有缓存
    }
  }, { immediate: true })

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
    return remaining <= settings.value.queueThreshold && hasMore.value && !isLoading.value && !isBackgroundLoading.value
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
  const loadWords = async (resetQueue = false, silent = false): Promise<void> => {
    // 防止重复加载
    if (isLoading.value || isBackgroundLoading.value) return

    // silent = true 时使用后台加载（不显示 Loading UI）
    if (silent) {
      isBackgroundLoading.value = true
    } else {
      isLoading.value = true
    }
    try {
      if (mode.value === 'mode_lapse') {
        // lapse模式：一次性加载所有单词，使用从WordIndex传入的limit
        const lapseLimit = settings.value.totalLimit
        const data: WordsApiResponse = await api.words.getReviewWords({
          mode: mode.value,
          limit: lapseLimit,
          batch_id: 0,  // lapse模式使用batch_id=0获取所有数据
          batch_size: lapseLimit
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
      isBackgroundLoading.value = false
    }
  }

  const submitResult = (wordId: number, result: WordResult): void => {
    if (mode.value === 'mode_lapse') {
      if (wordQueue.value.length === 0) return

      const currentWordIndex = currentIndex.value % wordQueue.value.length
      const word = wordQueue.value[currentWordIndex]

      if (word && word.id === wordId) {
        // 更新 lapse，与后端逻辑保持一致（使用配置值）
        const LAPSE_MAX_VALUE = userSettings.value?.learning.lapseMaxValue ?? 4
        const LAPSE_FAST_EXIT_THRESHOLD = userSettings.value?.learning.lapseConsecutiveThreshold ?? 2
        const LAPSE_FAST_EXIT_ENABLED = userSettings.value?.learning.lapseFastExitEnabled ?? true

        if (!result.remembered) {
          // 答错：lapse+1，最大为配置的最大值
          word.lapse = Math.min(word.lapse + 1, LAPSE_MAX_VALUE)
        } else {
          // 答对：根据配置和lapse值决定是否加速退出
          if (LAPSE_FAST_EXIT_ENABLED && word.lapse >= LAPSE_FAST_EXIT_THRESHOLD) {
            // 加速退出：当lapse≥阈值（默认2）时，答对一次-2
            word.lapse = Math.max(0, word.lapse - 2)
          } else {
            // 正常退出：lapse<阈值时，答对一次-1
            word.lapse = Math.max(0, word.lapse - 1)
          }
        }

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
        loadWords(false, true)  // silent = true，后台静默加载
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
        loadWords(false, true)  // silent = true，后台静默加载
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
    // 确保shuffle状态和设置是最新的
    await initializeShuffle()
    await loadSettings()
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
      // 确保设置已加载
      await loadSettings()

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

  // 预加载接下来的单词音频
  const preloadUpcomingAudio = async (
    audioAccent: 'us' | 'uk' = 'us',
    preloadCount: number = 5,
    includeCurrent: boolean = false  // 是否包含当前单词
  ): Promise<void> => {
    if (wordQueue.value.length === 0) return

    if (mode.value === 'mode_lapse') {
      // lapse 模式：一次性预加载所有单词的音频
      const allWords = wordQueue.value.map(w => w.word)
      if (allWords.length > 0) {
        // 异步预加载所有单词，不阻塞主流程
        preloadMultipleWordAudio(allWords, audioAccent, 5).catch(err => {
          console.warn('Lapse模式预加载所有音频失败:', err)
        })
      }
      return
    }

    // 其他模式：只预加载接下来的几个单词
    // 如果 includeCurrent 为 true，从当前索引开始；否则从下一个开始
    const startIndex = includeCurrent ? currentIndex.value : currentIndex.value + 1
    const endIndex = Math.min(startIndex + preloadCount, wordQueue.value.length)

    // 确保 startIndex 不超出范围
    if (startIndex >= wordQueue.value.length) return

    const wordsToPreload = wordQueue.value.slice(startIndex, endIndex).map(w => w.word)

    if (wordsToPreload.length > 0) {
      // 异步预加载，不阻塞主流程
      preloadMultipleWordAudio(wordsToPreload, audioAccent, 3).catch(err => {
        console.warn('预加载音频失败:', err)
      })
    }
  }

  // 监听单词队列变化，自动预加载
  watch([wordQueue, currentIndex, audioType], ([newQueue, newIndex], [oldQueue, oldIndex]) => {
    // 队列首次加载或队列内容变化时，包含当前单词立即预加载
    const isQueueChanged = newQueue.length !== oldQueue?.length || newQueue !== oldQueue
    const isInitialLoad = oldQueue === undefined || oldQueue.length === 0

    if (mode.value === 'mode_lapse') {
      // lapse 模式：只在初始加载时预加载一次所有音频
      if (isInitialLoad && newQueue.length > 0) {
        preloadUpcomingAudio(audioType.value, 0, true)
      } else if (isQueueChanged && !isInitialLoad && oldQueue && oldQueue.length > 0) {
        // 队列变化时（单词被移除/重排），清理不在队列中的单词的音频缓存
        const currentWords = newQueue.map(w => w.word)
        clearCacheNotInWords(currentWords, audioType.value)
      }
      return
    }

    // 其他模式的预加载逻辑
    if (isQueueChanged || isInitialLoad) {
      // 队列变化时，立即预加载包括当前单词在内的前5个
      preloadUpcomingAudio(audioType.value, 5, true)
    } else if (newIndex !== oldIndex) {
      // 只是索引变化时，预加载接下来的单词（不包含当前）
      setTimeout(() => {
        preloadUpcomingAudio(audioType.value, 5, false)
      }, 100)
    }
  }, { deep: false })

  // 监听索引变化，定期清理缓存
  watch(currentIndex, (newIndex) => {
    // lapse 模式不清理缓存，保留所有音频直到组件卸载
    if (mode.value === 'mode_lapse') return

    // 其他模式：每复习10个单词，清理一次缓存，保留最近15个
    if (newIndex > 0 && newIndex % 10 === 0) {
      clearPreloadCache(15)
    }
  })

  return {
    // 状态
    wordQueue,
    currentIndex,
    mode,
    audioType,
    isLoading,
    isBackgroundLoading,  // 暴露后台加载状态
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
    preloadUpcomingAudio, // 预加载音频方法
    sortByLapse, // 暴露排序方法
  }
})