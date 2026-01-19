// stores/wordEditor.ts - Word Editor Modal 状态管理
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/shared/api'
import type { Word } from '@/shared/types'
import { logger } from '@/shared/utils/logger'

const log = logger.create('WordEditor')

export const useWordEditorStore = defineStore('wordEditor', () => {
  // ── State ──
  const currentWord = ref<Word | null>(null)
  const originalWord = ref<Word | null>(null)
  const isOpen = ref(false)
  const isEditing = ref(false)
  const isSaving = ref(false)
  const mode = ref<string>('') // 复习模式，如 'mode_lapse', 'mode_review', 'mode_spelling'

  // 回调函数：用于通知调用方单词已被更新/删除/标记
  const onWordUpdatedCallbacks = ref<Array<(word: Word) => void>>([])
  const onWordDeletedCallbacks = ref<Array<(wordId: number) => void>>([])
  const onWordForgotCallbacks = ref<Array<(wordId: number) => void>>([])
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

    // 清空回调
    clearCallbacks()
  }

  /**
   * 进入编辑模式
   */
  function startEdit() {
    isEditing.value = true
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

    isSaving.value = true
    try {
      const updatedWord = await api.words.updateWord(currentWord.value.id, currentWord.value)
      currentWord.value = updatedWord
      originalWord.value = { ...updatedWord }
      isEditing.value = false

      // 触发更新回调
      onWordUpdatedCallbacks.value.forEach(cb => cb(updatedWord))

      return true
    } catch (error) {
      log.error('保存单词失败:', error)
      return false
    } finally {
      isSaving.value = false
    }
  }

  /**
   * 删除单词
   */
  async function deleteWord(): Promise<boolean> {
    if (!currentWord.value) return false

    const wordId = currentWord.value.id
    try {
      await api.words.deleteWord(wordId)

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
   * 重置学习进度，设置 lapse 为初始值
   * @param lapseInitialValue lapse 初始值，默认为 3
   */
  async function markForgot(lapseInitialValue = 3): Promise<boolean> {
    if (!currentWord.value) return false

    const wordId = currentWord.value.id
    const word = currentWord.value

    // 计算明天的日期
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const nextReview = tomorrow.getFullYear() + '-' +
      String(tomorrow.getMonth() + 1).padStart(2, '0') + '-' +
      String(tomorrow.getDate()).padStart(2, '0')

    try {
      const updatedWord = await api.words.updateWord(wordId, {
        repetition: 0,
        interval: 1,
        next_review: nextReview,
        ease_factor: parseFloat(Math.max(1.3, word.ease_factor - 0.4).toFixed(2)),
        lapse: lapseInitialValue,
        stop_review: 0
      })

      // 更新本地数据
      currentWord.value = updatedWord
      originalWord.value = { ...updatedWord }

      // 触发忘记回调
      onWordForgotCallbacks.value.forEach(cb => cb(wordId))
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
    const word = currentWord.value

    try {
      let updatedWord: Word

      // 如果存在 mode，使用 stopReview API（会更新进度索引）
      // 如果不存在 mode，使用 updateWord API（仅更新字段）
      if (mode.value) {
        await api.words.stopReview(wordId, mode.value)
        updatedWord = await api.words.getWord(wordId)
      } else {
        updatedWord = await api.words.updateWord(wordId, {
          stop_review: 1
        })
      }

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
      const updatedWord = await api.words.updateWord(wordId, {
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

  function onWordForgot(callback: (wordId: number) => void) {
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
