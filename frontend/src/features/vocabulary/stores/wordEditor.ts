// stores/wordEditor.ts - Word Editor Modal 状态管理
import { defineStore } from 'pinia'
import { ref, shallowRef, computed, watch } from 'vue'
import { api } from '@/shared/api'
import type { Word, RelatedWord } from '@/shared/types'
import { logger } from '@/shared/utils/logger'
import { applyBoldToDefinition, stripBoldFromDefinition } from '@/shared/utils/definition'
import { findOptimalDay } from '@/shared/core/loadBalancer'
import { addDays } from '@/shared/utils/date'
import { useSettings } from '@/shared/composables/useSettings'

const log = logger.create('WordEditor')

export type DuplicateCheckState = 'idle' | 'checking' | 'duplicate' | 'clear'
export type DuplicateCheckerFn = (word: string, excludeId: number) => Promise<boolean>

export const useWordEditorStore = defineStore('wordEditor', () => {
  // ── State ──
  const currentWord = ref<Word | null>(null)
  const originalWord = ref<Word | null>(null)
  const isOpen = ref(false)
  const isEditing = ref(false)
  const mode = ref<string>('') // 复习模式，如 'mode_lapse', 'mode_review', 'mode_spelling'
  const relatedWords = shallowRef<RelatedWord[]>([])
  const isLoadingRelated = ref(false)

  // ── 重复检测 ──
  const duplicateCheckState = ref<DuplicateCheckState>('idle')
  const duplicateChecker = ref<DuplicateCheckerFn | null>(null)

  // 当 word 文本变化时重置检测状态
  watch(() => currentWord.value?.word, () => {
    if (duplicateCheckState.value !== 'idle') {
      duplicateCheckState.value = 'idle'
    }
  })

  // 回调函数：用于通知调用方单词已被更新/删除/标记
  const onWordUpdatedCallbacks = ref<Array<(word: Word) => void>>([])
  const onWordDeletedCallbacks = ref<Array<(wordId: number) => void>>([])
  const onWordForgotCallbacks = ref<Array<(wordId: number, updatedWord: Word, scheduledDay: number) => void>>([])
  const onWordSpellResetCallbacks = ref<Array<(wordId: number, updatedWord: Word, scheduledDay: number) => void>>([])
  const onWordMasteredCallbacks = ref<Array<(wordId: number) => void>>([])
  const onCloseCallbacks = ref<Array<(finalWord: Word | undefined) => void>>([])

  // ── Getters ──
  const hasChanges = computed(() => {
    if (!currentWord.value || !originalWord.value) return false
    return JSON.stringify(currentWord.value) !== JSON.stringify(originalWord.value)
  })

  const canSave = computed(() => {
    return isEditing.value && hasChanges.value
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
    duplicateCheckState.value = 'idle'

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
    duplicateCheckState.value = 'idle'
  }

  /**
   * 保存单词更改 — 乐观更新
   *
   * 如果 word 字段被修改，第一次点击触发重复检测（返回 false），
   * 检测通过后第二次点击才执行实际保存。
   * 如果只修改了 definition，直接保存。
   */
  async function save(): Promise<boolean> {
    if (!currentWord.value || !canSave.value) return false

    const wordId = currentWord.value.id
    const wordFieldChanged = !!originalWord.value && currentWord.value.word !== originalWord.value.word

    // ── 重复检测阶段 ──
    if (wordFieldChanged && duplicateCheckState.value === 'idle') {
      duplicateCheckState.value = 'checking'
      const wordTextSnapshot = currentWord.value.word

      try {
        const checker = duplicateChecker.value ?? api.words.checkWordExistsDirect
        const exists = await checker(wordTextSnapshot, wordId)

        // 防止竞态：检测期间用户已修改 word 文本，watcher 已重置为 idle
        if (duplicateCheckState.value !== 'checking') return false

        // 再次确认文本未变
        if (currentWord.value?.word !== wordTextSnapshot) {
          duplicateCheckState.value = 'idle'
          return false
        }

        duplicateCheckState.value = exists ? 'duplicate' : 'clear'
      } catch (error) {
        log.error('重复检测失败:', error)
        // 网络错误时放行，让后端 constraint 兜底
        duplicateCheckState.value = 'clear'
      }
      return false
    }

    // ── 实际保存 ──
    // 保存前：strip → re-bold（基于当前 word 文本重新加粗）
    const wordText = currentWord.value.word
    const strippedDef = stripBoldFromDefinition(currentWord.value.definition)
    const boldedDef = applyBoldToDefinition(strippedDef, wordText)

    // 乐观更新
    currentWord.value = { ...currentWord.value, definition: boldedDef }
    originalWord.value = { ...currentWord.value }
    isEditing.value = false
    duplicateCheckState.value = 'idle'

    onWordUpdatedCallbacks.value.forEach(cb => cb({ ...currentWord.value! }))

    // 后台持久化
    api.words.updateWordDirect(wordId, {
      word: wordText,
      definition: boldedDef
    })
      .then(() => {
        if (wordFieldChanged) fetchDefinitionAsync(wordId)
      })
      .catch(error => {
        log.error('保存单词失败:', error)
      })

    return true
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
   * 标记单词为"忘记"（进入错题集）— 计算阶段 await，DB 写入乐观
   * 重置学习进度，设置 lapse = 1（二值标记，前端维护 expanding retrieval）
   * 通过负载均衡选择最优复习日期，避免某天负荷堆积
   */
  async function markForgot(): Promise<boolean> {
    if (!currentWord.value) return false

    const wordId = currentWord.value.id
    const word = currentWord.value
    const { loadSettings } = useSettings()

    try {
      // 计算阶段（需 await）
      const userSettings = await loadSettings()
      const dailyLimit = userSettings.learning.dailyReviewLimit || 50
      const maxPrepDays = userSettings.learning.maxPrepDays || 45
      const source = word.source || 'IELTS'

      let loads: number[]
      try {
        const { useReviewStore } = await import('../stores/review')
        loads = useReviewStore().reviewLoadsCache ?? await api.words.getDailyReviewLoadsDirect(source, maxPrepDays)
      } catch {
        loads = await api.words.getDailyReviewLoadsDirect(source, maxPrepDays)
      }

      const { chosenDay } = findOptimalDay({
        baseInterval: 1,
        dailyLimit,
        currentLoads: loads,
      })

      const today = new Date().toISOString().split('T')[0]
      const nextReview = addDays(today, chosenDay)
      const newEaseFactor = parseFloat(Math.max(1.3, word.ease_factor - 0.4).toFixed(2))

      const updatePayload = {
        repetition: 0,
        interval: 1,
        next_review: nextReview,
        ease_factor: newEaseFactor,
        lapse: 1,
        stop_review: 0,
        last_review: today,
        forget_count: word.forget_count + 1,
      }

      // 乐观更新
      currentWord.value = { ...currentWord.value, ...updatePayload }
      originalWord.value = { ...currentWord.value }

      const optimisticWord = { ...currentWord.value }
      onWordForgotCallbacks.value.forEach(cb => cb(wordId, optimisticWord, chosenDay))
      onWordUpdatedCallbacks.value.forEach(cb => cb(optimisticWord))

      // 后台持久化
      api.words.updateWordDirect(wordId, updatePayload)
        .catch(error => {
          log.error('标记忘记失败:', error)
        })

      return true
    } catch (error) {
      log.error('标记忘记失败:', error)
      return false
    }
  }

  /**
   * 重置拼写进度 — 计算阶段 await，DB 写入乐观
   * 将 spell_strength 归零，通过负载均衡选择最优拼写日期
   */
  async function resetSpelling(): Promise<boolean> {
    if (!currentWord.value) return false

    const wordId = currentWord.value.id
    const word = currentWord.value
    const { loadSettings } = useSettings()

    try {
      // 计算阶段（需 await）
      const userSettings = await loadSettings()
      const dailyLimit = userSettings.learning.dailySpellLimit || 200
      const maxPrepDays = userSettings.learning.maxPrepDays || 45
      const source = word.source || 'IELTS'

      let loads: number[]
      try {
        const { useReviewStore } = await import('../stores/review')
        loads = useReviewStore().spellLoadsCache ?? await api.words.getDailySpellLoadsDirect(source, maxPrepDays)
      } catch {
        loads = await api.words.getDailySpellLoadsDirect(source, maxPrepDays)
      }

      const { chosenDay } = findOptimalDay({
        baseInterval: 1,
        dailyLimit,
        currentLoads: loads,
      })

      const today = new Date().toISOString().split('T')[0]
      const nextSpellReview = addDays(today, chosenDay)

      const updatePayload = {
        spell_strength: 0,
        spell_next_review: nextSpellReview,
        stop_spell: 0,
      }

      // 乐观更新
      currentWord.value = { ...currentWord.value, ...updatePayload }
      originalWord.value = { ...currentWord.value }

      const optimisticWord = { ...currentWord.value }
      onWordSpellResetCallbacks.value.forEach(cb => cb(wordId, optimisticWord, chosenDay))
      onWordUpdatedCallbacks.value.forEach(cb => cb(optimisticWord))

      // 后台持久化
      api.words.updateWordDirect(wordId, updatePayload)
        .catch(error => {
          log.error('重置拼写失败:', error)
        })

      return true
    } catch (error) {
      log.error('重置拼写失败:', error)
      return false
    }
  }

  /**
   * 标记单词为"已掌握"（停止复习）— 乐观更新
   * @param closeAfter 是否在操作后关闭模态框
   */
  function markMastered(closeAfter = true): boolean {
    if (!currentWord.value) return false

    const wordId = currentWord.value.id

    currentWord.value = { ...currentWord.value, stop_review: 1 }
    originalWord.value = { ...currentWord.value }

    onWordMasteredCallbacks.value.forEach(cb => cb(wordId))
    onWordUpdatedCallbacks.value.forEach(cb => cb({ ...currentWord.value! }))

    if (closeAfter) close()

    api.words.updateWordDirect(wordId, { stop_review: 1 })
      .catch(error => {
        log.error('标记掌握失败:', error)
      })

    return true
  }

  /**
   * 标记单词为"不再拼写"（停止拼写）— 乐观更新
   */
  function markSpellMastered(closeAfter = true): boolean {
    if (!currentWord.value) return false

    const wordId = currentWord.value.id

    currentWord.value = { ...currentWord.value, stop_spell: 1 }
    originalWord.value = { ...currentWord.value }

    onWordUpdatedCallbacks.value.forEach(cb => cb({ ...currentWord.value! }))

    if (closeAfter) close()

    api.words.updateWordDirect(wordId, { stop_spell: 1 })
      .catch(error => {
        log.error('停止拼写失败:', error)
      })

    return true
  }

  /**
   * 恢复拼写（取消"不再拼写"状态）— 乐观更新
   */
  function restoreSpell(): boolean {
    if (!currentWord.value) return false

    const wordId = currentWord.value.id

    currentWord.value = { ...currentWord.value, stop_spell: 0 }
    originalWord.value = { ...currentWord.value }

    onWordUpdatedCallbacks.value.forEach(cb => cb({ ...currentWord.value! }))

    api.words.updateWordDirect(wordId, { stop_spell: 0 })
      .catch(error => {
        log.error('恢复拼写失败:', error)
      })

    return true
  }

  /**
   * 恢复复习（取消"已掌握"状态）— 乐观更新
   */
  function restoreReview(): boolean {
    if (!currentWord.value) return false

    const wordId = currentWord.value.id

    currentWord.value = { ...currentWord.value, stop_review: 0 }
    originalWord.value = { ...currentWord.value }

    onWordUpdatedCallbacks.value.forEach(cb => cb({ ...currentWord.value! }))

    api.words.updateWordDirect(wordId, { stop_review: 0 })
      .catch(error => {
        log.error('恢复复习失败:', error)
      })

    return true
  }

  /**
   * 更新当前单词数据（用于外部更新，如释义获取完成）
   * 非编辑模式下同步 originalWord，避免 hasChanges 误判
   */
  function updateCurrentWord(word: Partial<Word>) {
    if (currentWord.value) {
      currentWord.value = { ...currentWord.value, ...word }
      if (!isEditing.value) {
        originalWord.value = { ...currentWord.value }
      }
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

  function onWordSpellReset(callback: (wordId: number, updatedWord: Word, scheduledDay: number) => void) {
    onWordSpellResetCallbacks.value.push(callback)
  }

  function onWordMastered(callback: (wordId: number) => void) {
    onWordMasteredCallbacks.value.push(callback)
  }

  function onClose(callback: (finalWord: Word | undefined) => void) {
    onCloseCallbacks.value.push(callback)
  }

  function setDuplicateChecker(fn: DuplicateCheckerFn) {
    duplicateChecker.value = fn
  }

  function clearCallbacks() {
    onWordUpdatedCallbacks.value = []
    onWordDeletedCallbacks.value = []
    onWordForgotCallbacks.value = []
    onWordSpellResetCallbacks.value = []
    onWordMasteredCallbacks.value = []
    onCloseCallbacks.value = []
    duplicateChecker.value = null
  }

  return {
    // State
    currentWord,
    isOpen,
    isEditing,
    mode,
    relatedWords,
    isLoadingRelated,

    // Getters
    hasChanges,
    canSave,
    duplicateCheckState,

    // Actions
    open,
    close,
    startEdit,
    cancelEdit,
    save,
    deleteWord,
    markForgot,
    resetSpelling,
    markMastered,
    markSpellMastered,
    restoreSpell,
    restoreReview,
    updateCurrentWord,

    // 回调注册
    onWordUpdated,
    onWordDeleted,
    onWordForgot,
    onWordSpellReset,
    onWordMastered,
    onClose,
    setDuplicateChecker,
    clearCallbacks,
  }
})
