// stores/wordEditor.ts - Word Editor Modal 状态管理
import { defineStore } from 'pinia'
import { ref, shallowRef, computed } from 'vue'
import { api } from '@/shared/api'
import type { Word, RelatedWord } from '@/shared/types'
import { logger } from '@/shared/utils/logger'
import { applyBoldToDefinition, stripBoldFromDefinition } from '@/shared/utils/definition'
import { findOptimalDay } from '@/shared/core/loadBalancer'
import { addDays } from '@/shared/services/wordResultService'
import { useSettings } from '@/shared/composables/useSettings'

const log = logger.create('WordEditor')

export const useWordEditorStore = defineStore('wordEditor', () => {
  // ── State ──
  const currentWord = ref<Word | null>(null)
  const originalWord = ref<Word | null>(null)
  const isOpen = ref(false)
  const isEditing = ref(false)
  const isSaving = ref(false)
  const mode = ref<string>('') // 复习模式，如 'mode_lapse', 'mode_review', 'mode_spelling'
  const relatedWords = shallowRef<RelatedWord[]>([])
  const isLoadingRelated = ref(false)

  // 回调函数：用于通知调用方单词已被更新/删除/标记
  const onWordUpdatedCallbacks = ref<Array<(word: Word) => void>>([])
  const onWordDeletedCallbacks = ref<Array<(wordId: number) => void>>([])
  const onWordForgotCallbacks = ref<Array<(wordId: number, updatedWord: Word, scheduledDay: number) => void>>([])
  const onWordMasteredCallbacks = ref<Array<(wordId: number) => void>>([])
  const onCloseCallbacks = ref<Array<(finalWord: Word | undefined) => void>>([])

  // ── Getters ──
  const hasChanges = computed(() => {
    if (!currentWord.value || !originalWord.value) return false
    return JSON.stringify(currentWord.value) !== JSON.stringify(originalWord.value)
  })

  const canSave = computed(() => {
    return isEditing.value && hasChanges.value && !isSaving.value
  })

  // ── Actions ──

  /**
   * 打开单词编辑器
   * @param word 要编辑的单词
   * @param editMode 是否直接进入编辑模式
   * @param reviewMode 当前复习模式（可选）
   */
  function open(word: Word, editMode = false, reviewMode = '') {
    currentWord.value = { ...word }
    originalWord.value = { ...word }
    isEditing.value = editMode
    mode.value = reviewMode
    isOpen.value = true

    // 重置关联词状态
    relatedWords.value = []
    isLoadingRelated.value = false

    // 编辑模式下 strip bold，让用户看到纯文本
    if (editMode && currentWord.value.definition) {
      currentWord.value = {
        ...currentWord.value,
        definition: stripBoldFromDefinition(currentWord.value.definition)
      }
    }

    // 异步加载关联词（不阻塞 modal 打开）
    loadRelatedWords(word.id)
  }

  /**
   * 加载单词的关联词
   */
  async function loadRelatedWords(wordId: number) {
    isLoadingRelated.value = true
    try {
      relatedWords.value = await api.words.getRelatedWordsDirect(wordId)
    } catch (error) {
      log.error('加载关联词失败:', error)
      relatedWords.value = []
    } finally {
      isLoadingRelated.value = false
    }
  }

  /**
   * 关闭单词编辑器
   */
  function close() {
    // 触发关闭回调，传递最终数据
    onCloseCallbacks.value.forEach(cb => cb(currentWord.value ?? undefined))

    // 重置状态
    isOpen.value = false
    isEditing.value = false
    currentWord.value = null
    originalWord.value = null
    mode.value = ''
    relatedWords.value = []
    isLoadingRelated.value = false

    // 清空回调
    clearCallbacks()
  }

  /**
   * 进入编辑模式
   */
  function startEdit() {
    isEditing.value = true
    // strip bold，让编辑时看到纯文本
    if (currentWord.value?.definition) {
      currentWord.value = {
        ...currentWord.value,
        definition: stripBoldFromDefinition(currentWord.value.definition)
      }
    }
  }

  /**
   * 取消编辑，恢复原始数据
   */
  function cancelEdit() {
    if (originalWord.value) {
      currentWord.value = { ...originalWord.value }
    }
    isEditing.value = false
  }

  /**
   * 保存单词更改
   */
  async function save(): Promise<boolean> {
    if (!currentWord.value || !canSave.value) return false

    const wordFieldChanged = originalWord.value && currentWord.value.word !== originalWord.value.word

    // 保存前：strip → re-bold（基于当前 word 文本重新加粗）
    const wordText = currentWord.value.word
    const strippedDef = stripBoldFromDefinition(currentWord.value.definition)
    const boldedDef = applyBoldToDefinition(strippedDef, wordText)

    isSaving.value = true
    try {
      const updatedWord = await api.words.updateWordDirect(currentWord.value.id, {
        word: currentWord.value.word,
        definition: boldedDef
      })

      // 立即更新状态并退出编辑模式
      currentWord.value = updatedWord
      originalWord.value = { ...updatedWord }
      isEditing.value = false
      isSaving.value = false

      // 触发更新回调（先用当前数据）
      onWordUpdatedCallbacks.value.forEach(cb => cb(updatedWord))

      // 单词文本变了 → 异步爬取新释义（内部会加粗 + 写入 DB）
      if (wordFieldChanged) {
        fetchDefinitionAsync(updatedWord.id)
      }

      return true
    } catch (error) {
      log.error('保存单词失败:', error)
      isSaving.value = false
      return false
    }
  }

  /**
   * 异步获取释义并更新状态
   */
  async function fetchDefinitionAsync(wordId: number) {
    try {
      const wordWithDefinition = await api.words.fetchDefinition(wordId)

      // 只有当 modal 还在显示同一个单词时才更新
      if (currentWord.value?.id === wordId) {
        currentWord.value = wordWithDefinition
        originalWord.value = { ...wordWithDefinition }
      }

      // 再次触发回调，用新释义更新外部 UI（如 hover tooltip）
      onWordUpdatedCallbacks.value.forEach(cb => cb(wordWithDefinition))
    } catch (defError) {
      log.error('获取释义失败:', defError)
    }
  }

  /**
   * 删除单词
   */
  async function deleteWord(): Promise<boolean> {
    if (!currentWord.value) return false

    const wordId = currentWord.value.id
    try {
      await api.words.deleteWordDirect(wordId)

      // 触发删除回调
      onWordDeletedCallbacks.value.forEach(cb => cb(wordId))

      close()
      return true
    } catch (error) {
      log.error('删除单词失败:', error)
      return false
    }
  }

  /**
   * 标记单词为"忘记"（进入错题集）
   * 重置学习进度，设置 lapse = 1（二值标记，前端维护 expanding retrieval）
   * 通过负载均衡选择最优复习日期，避免某天负荷堆积
   */
  async function markForgot(): Promise<boolean> {
    if (!currentWord.value) return false

    const wordId = currentWord.value.id
    const word = currentWord.value
    const { loadSettings } = useSettings()

    try {
      // 1. 获取设置和负荷数据
      const userSettings = await loadSettings()
      const dailyLimit = userSettings.learning.dailyReviewLimit || 50
      const maxPrepDays = userSettings.learning.maxPrepDays || 45
      const source = word.source || 'IELTS'

      // 优先从 reviewStore 缓存读取，null 则 fetch fresh
      let loads: number[]
      try {
        const { useReviewStore } = await import('../stores/review')
        const reviewStore = useReviewStore()
        loads = reviewStore.reviewLoadsCache ?? await api.words.getDailyReviewLoadsDirect(source, maxPrepDays)
      } catch {
        loads = await api.words.getDailyReviewLoadsDirect(source, maxPrepDays)
      }

      // 2. 负载均衡选择最优日期
      const { chosenDay } = findOptimalDay({
        baseInterval: 1,
        dailyLimit,
        currentLoads: loads,
      })

      // 3. 计算日期
      const today = new Date().toISOString().split('T')[0]
      const nextReview = addDays(today, chosenDay)

      const updatedWord = await api.words.updateWordDirect(wordId, {
        repetition: 0,
        interval: chosenDay,
        next_review: nextReview,
        ease_factor: parseFloat(Math.max(1.3, word.ease_factor - 0.4).toFixed(2)),
        lapse: 1,
        stop_review: 0
      })

      // 更新本地数据
      currentWord.value = updatedWord
      originalWord.value = { ...updatedWord }

      // 触发忘记回调（传递扩展参数）
      onWordForgotCallbacks.value.forEach(cb => cb(wordId, updatedWord, chosenDay))
      onWordUpdatedCallbacks.value.forEach(cb => cb(updatedWord))

      return true
    } catch (error) {
      log.error('标记忘记失败:', error)
      return false
    }
  }

  /**
   * 标记单词为"已掌握"（停止复习）
   * @param closeAfter 是否在操作后关闭模态框
   */
  async function markMastered(closeAfter = true): Promise<boolean> {
    if (!currentWord.value) return false

    const wordId = currentWord.value.id

    try {
      const updatedWord = await api.words.updateWordDirect(wordId, {
        stop_review: 1
      })

      // 更新本地数据
      currentWord.value = updatedWord
      originalWord.value = { ...updatedWord }

      // 触发掌握回调
      onWordMasteredCallbacks.value.forEach(cb => cb(wordId))
      onWordUpdatedCallbacks.value.forEach(cb => cb(updatedWord))

      if (closeAfter) {
        close()
      }
      return true
    } catch (error) {
      log.error('标记掌握失败:', error)
      return false
    }
  }

  /**
   * 恢复复习（取消"已掌握"状态）
   */
  async function restoreReview(): Promise<boolean> {
    if (!currentWord.value) return false

    const wordId = currentWord.value.id

    try {
      const updatedWord = await api.words.updateWordDirect(wordId, {
        stop_review: 0
      })

      // 更新本地数据
      currentWord.value = updatedWord
      originalWord.value = { ...updatedWord }

      // 触发更新回调
      onWordUpdatedCallbacks.value.forEach(cb => cb(updatedWord))

      return true
    } catch (error) {
      log.error('恢复复习失败:', error)
      return false
    }
  }

  /**
   * 更新当前单词数据（用于外部WebSocket更新等场景）
   */
  function updateCurrentWord(word: Partial<Word>) {
    if (currentWord.value) {
      currentWord.value = { ...currentWord.value, ...word }
    }
  }

  // ── 回调注册 ──

  function onWordUpdated(callback: (word: Word) => void) {
    onWordUpdatedCallbacks.value.push(callback)
  }

  function onWordDeleted(callback: (wordId: number) => void) {
    onWordDeletedCallbacks.value.push(callback)
  }

  function onWordForgot(callback: (wordId: number, updatedWord: Word, scheduledDay: number) => void) {
    onWordForgotCallbacks.value.push(callback)
  }

  function onWordMastered(callback: (wordId: number) => void) {
    onWordMasteredCallbacks.value.push(callback)
  }

  function onClose(callback: (finalWord: Word | undefined) => void) {
    onCloseCallbacks.value.push(callback)
  }

  function clearCallbacks() {
    onWordUpdatedCallbacks.value = []
    onWordDeletedCallbacks.value = []
    onWordForgotCallbacks.value = []
    onWordMasteredCallbacks.value = []
    onCloseCallbacks.value = []
  }

  return {
    // State
    currentWord,
    isOpen,
    isEditing,
    isSaving,
    mode,
    relatedWords,
    isLoadingRelated,

    // Getters
    hasChanges,
    canSave,

    // Actions
    open,
    close,
    startEdit,
    cancelEdit,
    save,
    deleteWord,
    markForgot,
    markMastered,
    restoreReview,
    updateCurrentWord,

    // 回调注册
    onWordUpdated,
    onWordDeleted,
    onWordForgot,
    onWordMastered,
    onClose,
    clearCallbacks,
  }
})
