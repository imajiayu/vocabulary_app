/**
 * 复习队列管理：wordQueue, currentIndex, allWordIds, 分页加载
 */
import { ref, shallowRef } from 'vue'
import type { Word } from '@/shared/types'
import type { ReviewMode } from '../review'
import { api } from '@/shared/api'
import { useShuffleSelection } from '@/shared/composables/useShuffleSelection'
import { useSourceSelectionReadOnly } from '@/shared/composables/useSourceSelection'
import { useSettings } from '@/shared/composables/useSettings'
import { reviewLogger as log } from '@/shared/utils/logger'

const QUEUE_THRESHOLD = 5      // 剩余词数低于此值时触发后台加载
const BATCH_SIZE = 20           // 每次分页加载的单词数
const TOTAL_LIMIT = 100         // 单次会话的最大单词数

export function useReviewQueue() {
  const { shuffle, initializeFromData: initializeShuffleFromData } = useShuffleSelection()
  const initializeShuffle = () => initializeShuffleFromData(currentSource.value)
  const { currentSource, initializeFromData: initializeSource } = useSourceSelectionReadOnly()
  const { loadSettings } = useSettings()

  const wordQueue = ref<Word[]>([])
  const currentIndex = ref(0)
  const isLoading = ref(false)
  const isBackgroundLoading = ref(false)
  const hasMore = ref(true)
  const totalWords = ref(0)
  const initialOffset = ref(0)
  const allWordIds = shallowRef<number[]>([])
  let loadGeneration = 0

  const settings = ref({
    queueThreshold: QUEUE_THRESHOLD,
    batchSize: BATCH_SIZE,
    totalLimit: TOTAL_LIMIT
  })

  const shouldLoadMore = (mode: ReviewMode) => {
    if (mode === 'mode_lapse') return false
    const remaining = wordQueue.value.length - currentIndex.value
    return remaining <= settings.value.queueThreshold && hasMore.value && !isLoading.value && !isBackgroundLoading.value
  }

  const isCompleted = (mode: ReviewMode) => {
    if (mode === 'mode_lapse') {
      return wordQueue.value.length === 0
    }
    return currentIndex.value >= wordQueue.value.length && !hasMore.value
  }

  const globalIndex = (mode: ReviewMode) => {
    if (mode === 'mode_lapse') return 0
    return initialOffset.value + currentIndex.value
  }

  const currentWord = (mode: ReviewMode) => {
    if (wordQueue.value.length === 0) return null
    if (mode === 'mode_lapse') {
      return wordQueue.value[0] || null
    }
    return currentIndex.value < wordQueue.value.length
      ? wordQueue.value[currentIndex.value]
      : null
  }

  const loadWords = async (
    mode: ReviewMode,
    resetQueue = false,
    silent = false,
    cancelPendingIndex: () => void,
    initialWordCountRef?: { value: number },
    graduatedCountRef?: { value: number },
    wordGapLevelsRef?: { value: Map<number, number> },
    graduatedWordsRef?: { value: Word[] }
  ): Promise<void> => {
    if (resetQueue) cancelPendingIndex()

    if (resetQueue) {
      // resetQueue 时强制中断进行中的加载
      loadGeneration++
      isLoading.value = false
      isBackgroundLoading.value = false
    } else if (isLoading.value || isBackgroundLoading.value) {
      return
    }

    const myGeneration = loadGeneration

    if (silent) {
      isBackgroundLoading.value = true
    } else {
      isLoading.value = true
    }

    try {
      if (resetQueue || !currentSource.value) {
        await initializeSource()
      }

      if (mode === 'mode_lapse') {
        const lapseLimit = settings.value.totalLimit
        const source = currentSource.value || 'IELTS'
        const newWords = await api.words.getLapseWordsDirect(source, lapseLimit)

        if (shuffle.value) {
          for (let i = newWords.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[newWords[i], newWords[j]] = [newWords[j], newWords[i]]
          }
        }

        wordQueue.value = newWords
        currentIndex.value = 0
        totalWords.value = newWords.length
        if (initialWordCountRef) initialWordCountRef.value = newWords.length
        if (graduatedCountRef) graduatedCountRef.value = 0
        if (wordGapLevelsRef) wordGapLevelsRef.value = new Map()
        if (graduatedWordsRef) graduatedWordsRef.value = []
        hasMore.value = false

        const lapseWordIds = newWords.map(w => w.id)
        api.progress.saveProgressDirect({
          mode,
          source,
          shuffle: shuffle.value,
          word_ids: lapseWordIds,
          initial_lapse_count: newWords.length,
          initial_lapse_word_count: newWords.length
        }).catch(err => log.warn('Failed to save progress snapshot:', err))

      } else {
        const source = currentSource.value || 'IELTS'
        const userSettings = await loadSettings()

        if (resetQueue) {
          const lowEfExtra = userSettings.sourceSettings[source]?.learning?.lowEfExtraCount || 0
          const totalLimit = settings.value.totalLimit
          let ids: number[]
          if (mode === 'mode_spelling') {
            ids = await api.words.getSpellingWordIdsDirect(source, totalLimit, shuffle.value)
          } else if (mode === 'mode_mastered_review') {
            ids = await api.words.getMasteredReviewWordIdsDirect(source)
          } else if (mode === 'mode_skilled_spelling') {
            ids = await api.words.getSkilledSpellingWordIdsDirect(source)
          } else {
            ids = await api.words.getReviewWordIdsDirect(source, totalLimit, lowEfExtra)
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

          const batchIds = ids.slice(0, settings.value.batchSize)
          const newWords = batchIds.length > 0
            ? await api.words.getWordsByIdsDirect(batchIds)
            : []
          wordQueue.value = newWords
          hasMore.value = settings.value.batchSize < ids.length

          api.progress.saveProgressDirect({
            mode,
            source,
            shuffle: shuffle.value,
            word_ids: ids,
            initial_lapse_count: 0,
            initial_lapse_word_count: 0
          }).catch(err => log.warn('Failed to save progress snapshot:', err))

        } else {
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
      if (myGeneration !== loadGeneration) return
      log.error('Failed to load words:', error)
      throw error
    } finally {
      if (myGeneration === loadGeneration) {
        isLoading.value = false
        isBackgroundLoading.value = false
      }
    }
  }

  const restoreFromProgress = async (
    modeRef: { value: ReviewMode },
    initialWordCountRef: { value: number },
    graduatedCountRef: { value: number },
    wordGapLevelsRef: { value: Map<number, number> },
    graduatedWordsRef: { value: Word[] }
  ): Promise<boolean> => {
    isLoading.value = true

    try {
      await loadSettings()

      const data = await api.progress.getRestoreDataDirect()

      if (!data || !data.progress) {
        log.log('No valid progress data to restore')
        return false
      }

      const { progress } = data

      modeRef.value = progress.mode as ReviewMode
      totalWords.value = data.total

      const wordIds = progress.word_ids

      if (progress.mode === 'mode_lapse') {
        const words = await api.words.getWordsByIdsDirect(wordIds)
        const lapseWords = words.filter(w => w.lapse > 0)

        wordQueue.value = lapseWords
        initialWordCountRef.value = progress.initial_lapse_word_count || lapseWords.length
        graduatedCountRef.value = Math.max(0, initialWordCountRef.value - lapseWords.length)
        graduatedWordsRef.value = []
        wordGapLevelsRef.value = new Map()
        hasMore.value = false
        currentIndex.value = 0
      } else {
        const savedIndex = progress.current_index || 0
        const batchSize = settings.value.batchSize

        allWordIds.value = wordIds

        const batchIds = wordIds.slice(savedIndex, savedIndex + batchSize)
        const words = batchIds.length > 0
          ? await api.words.getWordsByIdsDirect(batchIds)
          : []

        wordQueue.value = words
        currentIndex.value = 0
        initialOffset.value = savedIndex
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

  const removeWordFromSnapshot = (wordId: number, debouncedUpdateProgressIndex: (idx: number) => void, mode: ReviewMode): void => {
    const allIdx = allWordIds.value.indexOf(wordId)
    if (allIdx === -1) return

    allWordIds.value.splice(allIdx, 1)

    api.progress.updateProgressSnapshotDirect(allWordIds.value)
      .catch(err => log.warn('Failed to update snapshot:', err))
    debouncedUpdateProgressIndex(globalIndex(mode))
  }

  const reset = () => {
    wordQueue.value = []
    currentIndex.value = 0
    totalWords.value = 0
    hasMore.value = true
    initialOffset.value = 0
    allWordIds.value = []
  }

  return {
    wordQueue,
    currentIndex,
    isLoading,
    isBackgroundLoading,
    hasMore,
    totalWords,
    initialOffset,
    allWordIds,
    settings,
    shuffle,
    currentSource,
    initializeShuffle,
    loadSettings,
    shouldLoadMore,
    isCompleted,
    globalIndex,
    currentWord,
    loadWords,
    restoreFromProgress,
    removeWordFromSnapshot,
    reset,
  }
}
