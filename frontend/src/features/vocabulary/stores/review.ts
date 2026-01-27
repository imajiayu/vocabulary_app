// stores/review.ts - 优化后的代码
import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { SpellingMetrics, Word, WordsApiResponse } from '@/shared/types'
import type { ReviewNotificationData } from '@/shared/api/words'
import { api } from '@/shared/api'
import { useShuffleSelectionReadOnly } from '@/shared/composables/useShuffleSelection'
import { useSourceSelectionReadOnly } from '@/shared/composables/useSourceSelection'
import { preloadMultipleWordAudio, clearPreloadCache } from '@/shared/utils/playWordAudio'
import { useAudioAccent } from '@/shared/composables/useAudioAccent'
import { useSettings } from '@/shared/composables/useSettings'
import { reviewLogger as log } from '@/shared/utils/logger'

export interface WordResult {
  is_spelling: boolean
  remembered: boolean
  elapsed_time?: number
  spelling_data?: SpellingMetrics
  mode?: ReviewMode
}

export type ReviewMode = 'mode_review' | 'mode_lapse' | 'mode_spelling'
export type AudioType = 'us' | 'uk'

// 通知状态类型
export interface ReviewNotificationState {
  show: boolean
  data: ReviewNotificationData | null
}

export const useReviewStore = defineStore('review', () => {
  // Shuffle状态管理
  const { shuffle, initializeFromData: initializeShuffle } = useShuffleSelectionReadOnly()

  // Source状态管理 - 用于保存进度时获取当前source
  const { currentSource, initializeFromData: initializeSource } = useSourceSelectionReadOnly()

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
  const wordResults = ref<Map<number, boolean>>(new Map())
  const initialOffset = ref(0)  // 初始偏移量（用于恢复进度）

  // 通知状态（复习/拼写完成后显示参数变化）
  const notification = ref<ReviewNotificationState>({
    show: false,
    data: null
  })

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

  // 全局索引：在总队列中的当前位置（用于显示正确的进度）
  const globalIndex = computed(() => {
    if (mode.value === 'mode_lapse') {
      return wordQueue.value.length === 0 ? 0 : (currentIndex.value % wordQueue.value.length)
    }
    return initialOffset.value + currentIndex.value
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
      // 确保 source 已初始化（用于保存进度）
      if (!currentSource.value) {
        await initializeSource()
      }

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

        // 新增：前端直接保存进度快照到 Supabase
        const allWordIds = newWords.map(w => w.id)
        api.progress.saveProgressDirect({
          mode: mode.value,
          source: currentSource.value || 'IELTS',
          shuffle: shuffle.value,
          word_ids: allWordIds,
          initial_lapse_count: initialLapseCount.value,
          initial_lapse_word_count: allWordIds.length
        }).catch(err => log.warn('Failed to save progress snapshot:', err))

      } else {
        // 其他模式：分页加载
        // 简化逻辑：offset直接使用队列长度 + 初始偏移量
        const offsetToUse = resetQueue ? 0 : initialOffset.value + wordQueue.value.length

        const data: WordsApiResponse = await api.words.getReviewWords({
          mode: mode.value,
          limit: settings.value.totalLimit,
          batch_id: resetQueue ? 0 : 1,  // 0=创建新快照，1=使用session快照
          batch_size: settings.value.batchSize,
          offset: offsetToUse
        })
        let newWords = data.words as Word[]

        if (resetQueue) {
          wordQueue.value = newWords
          currentIndex.value = 0
          initialOffset.value = 0  // 重置初始偏移量

          // 新增：前端直接保存进度快照到 Supabase（非 lapse 模式）
          // 注意：这里只保存第一批数据的 ID，后端仍需要知道完整快照
          // 但因为后端 batch_id=0 会创建快照，这里只是为了前端恢复使用
          // 实际上，后端已经创建了快照，前端这里也保存一份到 current_progress
          api.progress.saveProgressDirect({
            mode: mode.value,
            source: currentSource.value || 'IELTS',
            shuffle: shuffle.value,
            word_ids: newWords.map(w => w.id),
            initial_lapse_count: 0,
            initial_lapse_word_count: 0
          }).catch(err => log.warn('Failed to save progress snapshot:', err))
        } else {
          wordQueue.value.push(...newWords)
        }

        totalWords.value = data.total
        hasMore.value = data.has_more
      }

    } catch (error) {
      log.error('Failed to load words:', error)
      throw error
    } finally {
      isLoading.value = false
      isBackgroundLoading.value = false
    }
  }

  const submitResult = (wordId: number, result: WordResult): void => {
    // 同步设置 wordResults，确保 sidebar 能立即显示
    wordResults.value.set(wordId, result.remembered)

    // 在递增 currentIndex 之前，先保存当前 word 数据（用于分离式 API）
    const wordForCalc = currentWord.value
    const wordDataForApi = wordForCalc ? {
      word: wordForCalc.word,
      interval: wordForCalc.interval,
      repetition: wordForCalc.repetition,
      ease_factor: wordForCalc.ease_factor,
      lapse: wordForCalc.lapse,
      source: wordForCalc.source,
      spell_strength: wordForCalc.spell_strength,
      remember_count: wordForCalc.remember_count,
      forget_count: wordForCalc.forget_count,
      avg_elapsed_time: wordForCalc.avg_elapsed_time,
    } : undefined

    if (mode.value === 'mode_lapse') {
      if (wordQueue.value.length === 0) return

      const currentWordIndex = currentIndex.value % wordQueue.value.length
      const word = wordQueue.value[currentWordIndex]

      if (word && word.id === wordId) {
        // 更新 lapse，与后端逻辑保持一致（使用配置值）
        const LAPSE_MAX_VALUE = userSettings.value?.learning.lapseMaxValue ?? 4
        const LAPSE_FAST_EXIT_THRESHOLD = userSettings.value?.learning.lapseConsecutiveThreshold ?? 4
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

    // 添加 mode 参数和 word_data 到 result 中
    const resultWithMode = { ...result, mode: mode.value, word_data: wordDataForApi }

    // lapse 模式：使用原同步 API（无 notification）
    if (mode.value === 'mode_lapse') {
      api.words.submitWordResult(wordId, resultWithMode)
        .then((response) => {
          const { word: updatedWord } = response
          const index = wordQueue.value.findIndex(w => w.id === updatedWord.id)
          if (index !== -1) {
            wordQueue.value[index] = updatedWord
          }
          // 新增：更新进度索引到 Supabase（lapse 模式始终为 0）
          api.progress.updateProgressIndexDirect(0)
            .catch(err => log.warn('Failed to update progress index:', err))
        })
        .catch(log.error)
      return
    }

    // review/spelling 模式：使用分离式 API，先计算立即显示通知，再异步持久化
    // word_data 已包含在 resultWithMode 中，后端无需查数据库
    api.words.calculateWordResult(wordId, resultWithMode)
      .then((calcResponse) => {
        const { notification: notificationData, persist_data } = calcResponse

        // 立即显示通知（不等待持久化）
        if (notificationData) {
          notification.value = {
            show: true,
            data: notificationData
          }
        }

        // fire-and-forget：异步持久化，不阻塞用户
        api.words.persistWordResult(wordId, {
          persist_data,
          mode: mode.value,
          is_spelling: result.is_spelling
        })
          .then((persistResponse) => {
            // 持久化完成后更新 word 数据
            const { word: updatedWord } = persistResponse
            const index = wordQueue.value.findIndex(w => w.id === updatedWord.id)
            if (index !== -1) {
              wordQueue.value[index] = updatedWord
            }
            // 新增：更新进度索引到 Supabase（非 lapse 模式）
            api.progress.updateProgressIndexDirect(globalIndex.value)
              .catch(err => log.warn('Failed to update progress index:', err))
          })
          .catch((err) => {
            log.error('Failed to persist word result:', err)
            // 持久化失败不影响用户体验，下次复习会重新计算
          })
      })
      .catch(log.error)
  }

  // 关闭通知
  const closeNotification = () => {
    notification.value = {
      show: false,
      data: null
    }
  }

  const stopReviewWord = (wordId: number): void => {
    // 同步设置 wordResults，确保 sidebar 能立即显示（跳过视为记住）
    wordResults.value.set(wordId, true)

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

    // 优化：直接使用 stopReview 返回的更新数据，避免额外 getWord 查询
    api.words.stopReview(wordId, mode.value)
      .then((updatedWord) => {
        const index = wordQueue.value.findIndex(w => w.id === updatedWord.id)
        if (index !== -1) {
          wordQueue.value[index] = updatedWord
        }
        // 新增：更新进度索引到 Supabase
        const indexToUpdate = mode.value === 'mode_lapse' ? 0 : globalIndex.value
        api.progress.updateProgressIndexDirect(indexToUpdate)
          .catch(err => log.warn('Failed to update progress index:', err))
      })
      .catch(log.error)
  }

  const switchMode = async (newMode: ReviewMode): Promise<void> => {
    mode.value = newMode
    currentIndex.value = 0
    initialOffset.value = 0  // 重置初始偏移量
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
    initialOffset.value = 0  // 重置初始偏移量
    wordResults.value.clear()
    // 清理 notification，避免进入新复习时显示上次的通知
    notification.value = { show: false, data: null }
  }

  const restoreFromProgress = async (): Promise<boolean> => {
    isLoading.value = true

    try {
      // 确保设置已加载
      await loadSettings()

      // 使用直连 Supabase 获取进度数据
      const data = await api.progress.getRestoreDataDirect()

      if (!data || !data.progress) {
        log.log('No valid progress data to restore')
        return false
      }

      const { progress } = data

      // 恢复基本状态
      mode.value = progress.mode as ReviewMode
      totalWords.value = data.total

      // 使用 word_ids 参数直接传递快照（不再依赖后端 session）
      const wordIds = progress.word_ids

      if (progress.mode === 'mode_lapse') {
        // Lapse模式：一次性加载所有单词
        const restoreData: WordsApiResponse = await api.words.getReviewWords({
          mode: mode.value,
          limit: data.total,
          batch_id: 1,  // 非0，不创建新快照
          batch_size: data.total,
          offset: 0,
          word_ids: wordIds  // 直接传递 word_ids
        })

        // 重新排序单词并恢复队列
        const sortedWords = sortByLapse(restoreData.words as Word[], progress.shuffle)
        wordQueue.value = sortedWords
        // 恢复initial_lapse_count（使用保存的初始值）
        initialLapseCount.value = progress.initial_lapse_count || 0
        hasMore.value = false

        // lapse模式索引始终为0（循环队列）
        currentIndex.value = 0
      } else {
        // 非lapse模式：分页加载
        const savedIndex = progress.current_index || 0
        const batchSize = settings.value.batchSize

        // 直接从savedIndex位置开始加载
        const restoreData: WordsApiResponse = await api.words.getReviewWords({
          mode: mode.value,
          limit: settings.value.totalLimit,
          batch_id: 1,  // 非0，不创建新快照
          batch_size: batchSize,
          offset: savedIndex,
          word_ids: wordIds  // 直接传递 word_ids
        })

        wordQueue.value = restoreData.words as Word[]
        currentIndex.value = 0  // 队列第一个就是当前单词
        initialOffset.value = savedIndex  // 设置初始偏移量
        hasMore.value = savedIndex + batchSize < data.total
      }

      return true

    } catch (error) {
      log.error('Failed to restore progress:', error)
      return false
    } finally {
      isLoading.value = false
    }
  }

  // 预加载接下来的单词音频（统一逻辑，所有模式相同）
  const preloadUpcomingAudio = async (
    audioAccent: 'us' | 'uk' = 'us',
    preloadCount: number = 5,
    includeCurrent: boolean = false
  ): Promise<void> => {
    if (wordQueue.value.length === 0) return

    // 统一逻辑：预加载接下来的 N 个单词
    const startIndex = includeCurrent ? currentIndex.value : currentIndex.value + 1
    const effectiveIndex = mode.value === 'mode_lapse'
      ? startIndex % wordQueue.value.length  // lapse 模式循环队列
      : startIndex

    if (effectiveIndex >= wordQueue.value.length && mode.value !== 'mode_lapse') return

    const endIndex = Math.min(effectiveIndex + preloadCount, wordQueue.value.length)
    const wordsToPreload = wordQueue.value.slice(effectiveIndex, endIndex).map(w => w.word)

    if (wordsToPreload.length > 0) {
      preloadMultipleWordAudio(wordsToPreload, audioAccent).catch(err => {
        log.warn('预加载音频失败:', err)
      })
    }
  }

  // 监听单词队列变化，自动预加载（统一逻辑）
  watch([wordQueue, currentIndex, audioType], ([newQueue, newIndex], [oldQueue, oldIndex]) => {
    const isQueueChanged = newQueue.length !== oldQueue?.length || newQueue !== oldQueue
    const isInitialLoad = oldQueue === undefined || oldQueue.length === 0

    if (isQueueChanged || isInitialLoad) {
      // 队列变化时，预加载包括当前单词在内的前5个
      preloadUpcomingAudio(audioType.value, 5, true)
    } else if (newIndex !== oldIndex) {
      // 索引变化时，预加载接下来的单词
      setTimeout(() => preloadUpcomingAudio(audioType.value, 5, false), 100)
    }
  }, { deep: false })

  // 定期清理缓存（所有模式统一）
  watch(currentIndex, (newIndex) => {
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
    notification, // 通知状态

    // 计算属性
    currentWord,
    progress,
    shouldLoadMore,
    isCompleted,
    globalIndex, // 全局索引（用于正确显示进度）

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
    closeNotification, // 关闭通知方法
  }
})