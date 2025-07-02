// stores/review.ts - 前端直连版本（无后端依赖，relation 除外）
import { defineStore } from 'pinia'
import { ref, shallowRef, computed, watch } from 'vue'
import type { SpellingData, Word } from '@/shared/types'
import type { ReviewNotificationData } from '@/shared/api/words'
import { api } from '@/shared/api'
import {
  calculateReviewResult,
  persistReviewResult,
  calculateSpellingResult,
  persistSpellingResult,
} from '@/shared/services/wordResultService'
import { useShuffleSelectionReadOnly } from '@/shared/composables/useShuffleSelection'
import { useSourceSelectionReadOnly } from '@/shared/composables/useSourceSelection'
import { preloadMultipleWordAudio, clearPreloadCache } from '@/shared/utils/playWordAudio'
import { useAudioAccent } from '@/shared/composables/useAudioAccent'
import { useAuth, getCurrentUserId } from '@/shared/composables/useAuth'
import { useSettings } from '@/shared/composables/useSettings'
import { reviewLogger as log } from '@/shared/utils/logger'

export interface WordResult {
  is_spelling: boolean
  remembered: boolean
  elapsed_time?: number
  spelling_data?: SpellingData
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

  // 设置管理
  const { loadSettings } = useSettings()
  const { session: authSession } = useAuth()

  // === Expanding Retrieval Practice 常量 ===
  const GAP_SEQUENCE = [1, 3, 7, 15] as const

  // 状态
  const wordQueue = ref<Word[]>([])
  const currentIndex = ref(0)
  const mode = ref<ReviewMode>('mode_review')
  const audioType = ref<AudioType>('us')
  const isLoading = ref(false)
  const isBackgroundLoading = ref(false)  // 后台预加载状态（不显示Loading UI）
  const hasMore = ref(true)
  const totalWords = ref(0)
  const wordResults = ref<Map<number, boolean>>(new Map())
  const initialOffset = ref(0)  // 初始偏移量（用于恢复进度）
  const allWordIds = shallowRef<number[]>([])  // 全量 word ID 快照（替代后端 session）

  // Lapse 模式状态（Expanding Retrieval Practice）
  const wordGapLevels = ref<Map<number, number>>(new Map())  // wordId → gap level index
  const graduatedCount = ref(0)
  const initialWordCount = ref(0)
  const graduatedWords = ref<Word[]>([])  // 已毕业的单词（用于 sidebar 展示）

  // Lapse 最近一次作答结果（用于右侧面板展示）
  const lastLapseResult = ref<{
    word: string
    remembered: boolean
    elapsed_time: number
    previousLevel: number
    newLevel: number
    graduated: boolean
  } | null>(null)

  // 通知状态（复习/拼写完成后显示参数变化）
  const notification = ref<ReviewNotificationState>({
    show: false,
    data: null
  })

  // 负荷缓存：会话内复用，避免每个单词都查 DB（fire-and-forget 导致 DB 数据滞后）
  const reviewLoadsCache = ref<number[] | null>(null)
  const spellLoadsCache = ref<number[] | null>(null)

  // Debounced progress index update：5 秒合并写入，减少 ~80% DB 写入
  let pendingIndexValue: number | null = null
  let indexDebounceTimer: ReturnType<typeof setTimeout> | null = null

  const flushProgressIndex = () => {
    if (pendingIndexValue !== null) {
      const value = pendingIndexValue
      pendingIndexValue = null
      if (indexDebounceTimer) {
        clearTimeout(indexDebounceTimer)
        indexDebounceTimer = null
      }
      api.progress.updateProgressIndexDirect(value)
        .catch(err => log.warn('Failed to flush progress index:', err))
    }
  }

  /** 丢弃待写入的索引（新会话启动时调用，防止旧 timer 覆写新会话的 index） */
  const cancelPendingIndex = () => {
    pendingIndexValue = null
    if (indexDebounceTimer) {
      clearTimeout(indexDebounceTimer)
      indexDebounceTimer = null
    }
  }

  const debouncedUpdateProgressIndex = (index: number) => {
    pendingIndexValue = index
    if (indexDebounceTimer) clearTimeout(indexDebounceTimer)
    indexDebounceTimer = setTimeout(flushProgressIndex, 5000)
  }

  // beforeunload: keepalive fetch 保证页面关闭时请求送达
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      try {
        if (pendingIndexValue === null) return
        const value = pendingIndexValue
        pendingIndexValue = null
        if (indexDebounceTimer) {
          clearTimeout(indexDebounceTimer)
          indexDebounceTimer = null
        }
        const token = authSession.value?.access_token
        if (!token) return
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/current_progress?user_id=eq.${getCurrentUserId()}`
        fetch(url, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${token}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ current_index: value }),
          keepalive: true
        }).catch(() => {})
      } catch {}
    })
  }

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
      // lapse模式：线性队列，始终从队首取词
      return wordQueue.value[0] || null
    } else {
      // 其他模式：线性队列（带索引）
      return currentIndex.value < wordQueue.value.length
        ? wordQueue.value[currentIndex.value]
        : null
    }
  })

  const progress = computed(() => {
    if (mode.value === 'mode_lapse') {
      if (initialWordCount.value === 0) return 0
      return Math.round((graduatedCount.value / initialWordCount.value) * 100)
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

  // 全局索引：在总队列中的当前位置（用于显示正确的进度）
  const globalIndex = computed(() => {
    if (mode.value === 'mode_lapse') return 0
    return initialOffset.value + currentIndex.value
  })

  // 主要方法
  const loadWords = async (resetQueue = false, silent = false): Promise<void> => {
    // 新会话：丢弃旧 debounce，防止旧 timer 覆写新会话的 current_index
    if (resetQueue) cancelPendingIndex()

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
        // lapse模式：从 Supabase 直接加载错题（不经过后端）
        // API 默认按首字母升序，shuffle 时前端打乱
        const lapseLimit = settings.value.totalLimit
        const source = currentSource.value || 'IELTS'
        const newWords = await api.words.getLapseWordsDirect(source, lapseLimit)

        // 如果启用 shuffle，打乱顺序（Fisher-Yates）
        if (shuffle.value) {
          for (let i = newWords.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[newWords[i], newWords[j]] = [newWords[j], newWords[i]]
          }
        }

        wordQueue.value = newWords
        currentIndex.value = 0
        totalWords.value = newWords.length
        initialWordCount.value = newWords.length
        graduatedCount.value = 0
        wordGapLevels.value = new Map()
        graduatedWords.value = []
        hasMore.value = false

        // 保存进度快照到 Supabase
        const allWordIds = newWords.map(w => w.id)
        api.progress.saveProgressDirect({
          mode: mode.value,
          source,
          shuffle: shuffle.value,
          word_ids: allWordIds,
          initial_lapse_count: newWords.length,
          initial_lapse_word_count: newWords.length
        }).catch(err => log.warn('Failed to save progress snapshot:', err))

      } else {
        // 其他模式：前端直连 Supabase
        const source = currentSource.value || 'IELTS'
        const userSettings = await loadSettings()

        if (resetQueue) {
          // 首次加载：获取全量 ID → 保存快照 → 分页加载详情
          // - review 模式：API 返回按首字母升序，shuffle 时前端打乱
          // - spelling 模式：API 内部处理分组排序/分组内随机
          const lowEfExtra = userSettings.learning.lowEfExtraCount || 0
          const totalLimit = settings.value.totalLimit
          let ids: number[]
          if (mode.value === 'mode_spelling') {
            // spelling: 传递 shuffle 参数，API 内部处理分组内排序/随机
            ids = await api.words.getSpellingWordIdsDirect(source, totalLimit, shuffle.value)
          } else {
            // review: API 返回按首字母升序，取前 totalLimit 个
            ids = await api.words.getReviewWordIdsDirect(source, totalLimit, lowEfExtra)
            // 前端 shuffle（Fisher-Yates）
            if (shuffle.value) {
              for (let i = ids.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1))
                ;[ids[i], ids[j]] = [ids[j], ids[i]]
              }
            }
          }

          allWordIds.value = ids
          currentIndex.value = 0
          initialOffset.value = 0
          totalWords.value = ids.length

          // 加载第一批详情
          const batchIds = ids.slice(0, settings.value.batchSize)
          const newWords = batchIds.length > 0
            ? await api.words.getWordsByIdsDirect(batchIds)
            : []
          wordQueue.value = newWords
          hasMore.value = settings.value.batchSize < ids.length

          // 保存快照到 Supabase（fire-and-forget）
          api.progress.saveProgressDirect({
            mode: mode.value,
            source,
            shuffle: shuffle.value,
            word_ids: ids,
            initial_lapse_count: 0,
            initial_lapse_word_count: 0
          }).catch(err => log.warn('Failed to save progress snapshot:', err))

        } else {
          // 后续分页：从 allWordIds 中取下一批
          const startIdx = initialOffset.value + wordQueue.value.length
          const batchIds = allWordIds.value.slice(startIdx, startIdx + settings.value.batchSize)
          if (batchIds.length > 0) {
            const newWords = await api.words.getWordsByIdsDirect(batchIds)
            wordQueue.value.push(...newWords)
          }
          hasMore.value = startIdx + settings.value.batchSize < allWordIds.value.length
        }
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

    // 在递增 currentIndex 之前，先保存当前 word 数据（用于本地算法计算）
    const wordForCalc = currentWord.value

    // === Lapse 模式：Expanding Retrieval Practice ===
    if (mode.value === 'mode_lapse') {
      if (wordQueue.value.length === 0) return

      const word = wordQueue.value[0]
      if (!word || word.id !== wordId) return

      // 从队首移除
      wordQueue.value.shift()

      const currentLevel = wordGapLevels.value.get(word.id) ?? 0
      const elapsed = result.elapsed_time ?? 3

      let graduated = false
      let newLevelForResult = currentLevel

      if (!result.remembered) {
        // 答错：gap level 重置为 0，始终重新插入（不毕业）
        newLevelForResult = 0
        wordGapLevels.value.set(word.id, 0)
        const insertPos = Math.min(GAP_SEQUENCE[0], wordQueue.value.length)
        wordQueue.value.splice(insertPos, 0, word)
      } else {
        // 答对：根据反应时间决定是否提升 gap level
        const newLevel = elapsed >= 4 ? currentLevel : currentLevel + 1
        newLevelForResult = newLevel

        if (newLevel >= GAP_SEQUENCE.length) {
          // 已通过所有间隔级别 → 毕业
          graduated = true
        } else {
          // 在 gap 位置重新插入（gap 超过队列长度时插入末尾）
          wordGapLevels.value.set(word.id, newLevel)
          const insertPos = Math.min(GAP_SEQUENCE[newLevel], wordQueue.value.length)
          wordQueue.value.splice(insertPos, 0, word)
        }
      }

      // 记录最近一次 lapse 作答结果
      lastLapseResult.value = {
        word: word.word,
        remembered: result.remembered,
        elapsed_time: elapsed,
        previousLevel: currentLevel,
        newLevel: newLevelForResult,
        graduated
      }

      if (graduated) {
        graduatedCount.value++
        graduatedWords.value.push(word)
        wordGapLevels.value.delete(word.id)
        api.words.clearLapseDirect(word.id).catch(log.error)
        // 同步更新快照，使首页"剩余"计数正确
        api.progress.updateProgressSnapshotDirect(wordQueue.value.map(w => w.id))
          .catch(err => log.warn('Failed to update lapse snapshot:', err))
      }

      return
    }

    // === 非 Lapse 模式：前端本地计算 + 直连 Supabase 持久化 ===
    currentIndex.value++
    if (shouldLoadMore.value && !isCompleted.value) {
      loadWords(false, true)  // silent = true，后台静默加载
    }

    if (!wordForCalc) return

    const source = wordForCalc.source || currentSource.value || 'IELTS'

    // 异步：获取负荷数据 → 本地计算 → 显示通知 → fire-and-forget 持久化
    ;(async () => {
      try {
        const userSettings = await loadSettings()

        if (!result.is_spelling && mode.value === 'mode_review') {
          // 复习模式：优先使用缓存，首次从 DB 获取
          if (!reviewLoadsCache.value) {
            reviewLoadsCache.value = await api.words.getDailyReviewLoadsDirect(source, userSettings.learning.maxPrepDays || 45)
          }
          const calcResult = calculateReviewResult(
            wordForCalc, result.remembered, result.elapsed_time ?? 3, userSettings, reviewLoadsCache.value
          )

          // 更新缓存：将选中天的负荷 +1
          const chosenIdx = calcResult.persistData.interval - 1
          if (reviewLoadsCache.value && chosenIdx >= 0 && chosenIdx < reviewLoadsCache.value.length) {
            reviewLoadsCache.value[chosenIdx]++
          }

          // 立即显示通知
          notification.value = { show: true, data: calcResult.notification }

          // 更新 wordQueue 中的 word 数据（本地更新，无需等待 DB）
          const idx = wordQueue.value.findIndex(w => w.id === wordId)
          if (idx !== -1) {
            const pd = calcResult.persistData
            wordQueue.value[idx] = {
              ...wordQueue.value[idx],
              ease_factor: pd.ease_factor,
              repetition: pd.repetition,
              interval: pd.interval,
              next_review: pd.next_review,
              lapse: pd.lapse,
              remember_count: pd.current_remember_count + pd.remember_inc,
              forget_count: pd.current_forget_count + pd.forget_inc,
              avg_elapsed_time: pd.avg_elapsed_time,
              stop_review: pd.should_stop_review ? 1 : wordQueue.value[idx].stop_review,
            }
          }

          // fire-and-forget 持久化 + 历史记录
          persistReviewResult(calcResult.persistData, {
            source,
            elapsed_time: Math.round(result.elapsed_time ?? 3),
            score: calcResult.persistData.score,
          }).catch(err => log.error('Failed to persist review result:', err))
        } else if (result.is_spelling && mode.value === 'mode_spelling') {
          // 拼写模式
          if (!result.spelling_data) {
            log.error('Missing spelling_data in spelling mode')
            return
          }
          // 拼写模式：优先使用缓存，首次从 DB 获取
          if (!spellLoadsCache.value) {
            spellLoadsCache.value = await api.words.getDailySpellLoadsDirect(source, userSettings.learning.maxPrepDays || 45)
          }
          const calcResult = calculateSpellingResult(
            wordForCalc, result.remembered, result.spelling_data, userSettings, spellLoadsCache.value
          )

          // 更新缓存：将选中天的负荷 +1
          const chosenIdx = calcResult.interval - 1
          if (spellLoadsCache.value && chosenIdx >= 0 && chosenIdx < spellLoadsCache.value.length) {
            spellLoadsCache.value[chosenIdx]++
          }

          notification.value = { show: true, data: calcResult.notification }

          // 更新 wordQueue 中的 word 数据
          const idx = wordQueue.value.findIndex(w => w.id === wordId)
          if (idx !== -1) {
            wordQueue.value[idx] = {
              ...wordQueue.value[idx],
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

        // 更新进度索引（debounced，5 秒合并写入）
        debouncedUpdateProgressIndex(globalIndex.value)
      } catch (err) {
        log.error('Failed to calculate/persist result:', err)
      }
    })()
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

      // 从队首移除并视为毕业
      const removedWord = wordQueue.value.shift()
      graduatedCount.value++
      if (removedWord) graduatedWords.value.push(removedWord)
      wordGapLevels.value.delete(wordId)

      // fire-and-forget：清除 lapse 标记
      api.words.clearLapseDirect(wordId).catch(log.error)
      // 同步更新快照，使首页"剩余"计数正确
      api.progress.updateProgressSnapshotDirect(wordQueue.value.map(w => w.id))
        .catch(err => log.warn('Failed to update lapse snapshot:', err))
    } else {
      currentIndex.value++
      if (shouldLoadMore.value && !isCompleted.value) {
        loadWords(false, true)
      }
    }

    // 非 lapse 模式：直连 Supabase 设置 stop_review
    if (mode.value !== 'mode_lapse') {
      api.words.updateWordDirect(wordId, { stop_review: 1 })
        .then((updatedWord) => {
          const index = wordQueue.value.findIndex(w => w.id === updatedWord.id)
          if (index !== -1) {
            wordQueue.value[index] = updatedWord
          }
          debouncedUpdateProgressIndex(globalIndex.value)
        })
        .catch(log.error)
    }
  }

  const switchMode = async (newMode: ReviewMode): Promise<void> => {
    mode.value = newMode
    currentIndex.value = 0
    initialOffset.value = 0  // 重置初始偏移量
    // 清理负荷缓存（新模式需要重新获取）
    reviewLoadsCache.value = null
    spellLoadsCache.value = null
    // 确保shuffle状态和设置是最新的
    await initializeShuffle()
    await loadSettings()
    await loadWords(true)
  }

  const setAudioType = (type: AudioType) => {
    audioType.value = type
  }

  /**
   * 从 allWordIds 快照中移除单词并同步 DB（review/spelling 模式，sidebar 删除时调用）
   */
  const removeWordFromSnapshot = (wordId: number): void => {
    const allIdx = allWordIds.value.indexOf(wordId)
    if (allIdx === -1) return

    allWordIds.value.splice(allIdx, 1)

    // 同步快照和索引到 DB
    api.progress.updateProgressSnapshotDirect(allWordIds.value)
      .catch(err => log.warn('Failed to update snapshot:', err))
    debouncedUpdateProgressIndex(globalIndex.value)
  }

  /**
   * Lapse 模式下从会话中移除单词（sidebar 删除/掌握时调用）
   * 处理队列和毕业列表两种情况
   */
  const removeWordFromLapseSession = (wordId: number): void => {
    // 先从队列中查找
    const queueIndex = wordQueue.value.findIndex(w => w.id === wordId)
    if (queueIndex !== -1) {
      wordQueue.value.splice(queueIndex, 1)
      wordGapLevels.value.delete(wordId)
      graduatedCount.value++
      // 同步更新快照，使首页"剩余"计数正确
      api.progress.updateProgressSnapshotDirect(wordQueue.value.map(w => w.id))
        .catch(err => log.warn('Failed to update lapse snapshot:', err))
      return
    }
    // 再从毕业列表中移除
    const gradIndex = graduatedWords.value.findIndex(w => w.id === wordId)
    if (gradIndex !== -1) {
      graduatedWords.value.splice(gradIndex, 1)
    }
  }

  const reset = () => {
    wordQueue.value = []
    currentIndex.value = 0
    totalWords.value = 0
    hasMore.value = true
    initialOffset.value = 0
    allWordIds.value = []
    wordResults.value.clear()
    // Expanding Retrieval Practice 状态
    wordGapLevels.value = new Map()
    graduatedCount.value = 0
    initialWordCount.value = 0
    graduatedWords.value = []
    lastLapseResult.value = null
    // 清理 notification，避免进入新复习时显示上次的通知
    notification.value = { show: false, data: null }
    // 清理负荷缓存
    reviewLoadsCache.value = null
    spellLoadsCache.value = null
  }

  const restoreFromProgress = async (): Promise<boolean> => {
    isLoading.value = true
    // 清理负荷缓存（恢复进度后需要重新获取）
    reviewLoadsCache.value = null
    spellLoadsCache.value = null

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
        // Lapse模式：从 Supabase 直接按 ID 加载单词
        const words = await api.words.getWordsByIdsDirect(wordIds)

        // 过滤掉已经不在错题集的单词（lapse 可能已被其他操作清除）
        const lapseWords = words.filter(w => w.lapse > 0)

        wordQueue.value = lapseWords
        // 恢复 initialWordCount（使用保存的初始值）
        initialWordCount.value = progress.initial_lapse_word_count || lapseWords.length
        // 已毕业数 = 初始数 - 当前剩余数
        graduatedCount.value = Math.max(0, initialWordCount.value - lapseWords.length)
        // 已毕业的单词无法恢复（可接受，sidebar 从空开始）
        graduatedWords.value = []
        // Gap levels 重置为 0（恢复后重新测试）
        wordGapLevels.value = new Map()
        hasMore.value = false
        currentIndex.value = 0
      } else {
        // 非lapse模式：直连 Supabase 加载
        const savedIndex = progress.current_index || 0
        const batchSize = settings.value.batchSize

        // 恢复全量 ID 快照
        allWordIds.value = wordIds

        // 从 savedIndex 位置开始加载一批
        const batchIds = wordIds.slice(savedIndex, savedIndex + batchSize)
        const words = batchIds.length > 0
          ? await api.words.getWordsByIdsDirect(batchIds)
          : []

        wordQueue.value = words
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
    const startIndex = mode.value === 'mode_lapse'
      ? (includeCurrent ? 0 : 1)  // lapse 模式：线性队列，从队首开始
      : (includeCurrent ? currentIndex.value : currentIndex.value + 1)
    const effectiveIndex = startIndex

    if (effectiveIndex >= wordQueue.value.length) return

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
    graduatedWords, // Lapse 模式已毕业单词（sidebar 展示）
    initialWordCount, // Lapse 模式初始单词数
    wordGapLevels, // Lapse 模式 gap level 映射
    graduatedCount, // Lapse 模式已毕业数
    lastLapseResult, // Lapse 模式最近一次作答结果

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
    removeWordFromLapseSession,
    removeWordFromSnapshot,
    switchMode,
    setAudioType,
    reset,
    initializeShuffle, // 暴露初始化方法
    restoreFromProgress, // 恢复进度方法
    preloadUpcomingAudio, // 预加载音频方法
    closeNotification, // 关闭通知方法
    flushProgressIndex, // 立即写入待保存的进度索引
  }
})