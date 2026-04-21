// stores/wordEditor.ts - Word Editor Modal 状态管理
import { defineStore } from 'pinia'
import { ref, shallowRef, computed, watch } from 'vue'
import { api } from '@/shared/api'
import type { Word, RelatedWord, SourceLang } from '@/shared/types'
import { logger } from '@/shared/utils/logger'
import { applyBoldToDefinition, stripBoldFromDefinition } from '@/shared/utils/definition'
import { findOptimalDay } from '@/shared/core/loadBalancer'
import { addDays } from '@/shared/utils/date'
import { useSettings } from '@/shared/composables/useSettings'
import { getSourceLangConfig } from '@/shared/config/sourceLanguage'
import { deleteTtsCache } from '@/shared/utils/playWordAudio'

const log = logger.create('WordEditor')

export type DuplicateCheckState = 'idle' | 'checking' | 'duplicate' | 'clear'
export type DuplicateCheckerFn = (word: string, excludeId: number) => Promise<boolean>

export interface WordCreateContext {
  source: string
  lang: SourceLang
}

/** 构造空白 Word 占位（id=-1，尚未写入 DB）— 供新建 / 课程点词未命中时使用 */
function buildBlankWord(source: string, text = '', definition?: string): Word {
  return {
    id: -1,
    word: text,
    definition: definition ? { definitions: [definition] } : {},
    ease_factor: 0,
    stop_review: 0,
    stop_spell: 0,
    date_added: '',
    repetition: 0,
    interval: 0,
    next_review: '',
    lapse: 0,
    spell_strength: null,
    spell_next_review: null,
    source,
    related_words: [],
    last_review: null,
    last_spell: null,
    remember_count: 0,
    forget_count: 0,
    avg_elapsed_time: 0,
  }
}

export const useWordEditorStore = defineStore('wordEditor', () => {
  // ── State ──
  const currentWord = ref<Word | null>(null)
  const originalWord = ref<Word | null>(null)
  const isOpen = ref(false)
  const isEditing = ref(false)
  const mode = ref<string>('') // 复习模式，如 'mode_lapse', 'mode_review', 'mode_spelling'
  const relatedWords = shallowRef<RelatedWord[]>([])
  const isLoadingRelated = ref(false)

  // ── 创建模式（课程页未命中 / 用户主动添加 → 进入编辑态空白页） ──
  const isCreating = ref(false)
  const createContext = ref<WordCreateContext | null>(null)

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
    if (!currentWord.value || !isEditing.value) return false
    if (isCreating.value) return !!currentWord.value.word.trim()
    return hasChanges.value
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
    isCreating.value = false
    createContext.value = null

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

    // 异步加载关联词（不阻塞 modal 打开，非英语源跳过）
    loadRelatedWords(word)
  }

  /**
   * 课程页点词调用：先查 (user, source, word) 是否存在
   *  - 命中：走 open() 进入正常模式
   *  - 未命中：进入创建态（openForCreate），预填单词和释义
   */
  async function openForCourse(
    wordText: string,
    definition: string | undefined,
    ctx: WordCreateContext
  ): Promise<void> {
    const cleaned = wordText.trim()
    if (!cleaned) return

    let existing: Word | null = null
    try {
      existing = await api.words.getWordByTextAndSourceDirect(cleaned, ctx.source, ctx.lang)
    } catch (error) {
      log.error('查询课程单词失败:', error)
    }

    if (existing) {
      open(existing)
      return
    }

    openForCreate(ctx, cleaned, definition)
  }

  /**
   * 打开空白编辑器（新建单词）
   *  - 用户从课程导航栏/选中文本点"添加"时调用
   *  - 课程点词未命中时由 openForCourse 转发进来
   */
  function openForCreate(
    ctx: WordCreateContext,
    initialWord = '',
    initialDef?: string
  ) {
    currentWord.value = buildBlankWord(ctx.source, initialWord, initialDef)
    originalWord.value = { ...currentWord.value }
    isOpen.value = true
    isEditing.value = true
    isCreating.value = true
    createContext.value = { ...ctx }
    mode.value = ''
    relatedWords.value = []
    isLoadingRelated.value = false
    duplicateCheckState.value = 'idle'
  }

  /**
   * 保存新建：负荷均衡 → createWordDirect → 切到正常模式
   * 成功后触发 onWordUpdated（列表视图可监听以刷新）
   */
  async function saveCreate(): Promise<boolean> {
    if (!createContext.value || !currentWord.value) return false

    const ctx = createContext.value
    const wordText = currentWord.value.word.trim()
    if (!wordText) return false

    // 重复检测：第一次点击查询 → 第二次点击确认保存（与 update 路径同步 UX）
    if (duplicateCheckState.value === 'idle') {
      duplicateCheckState.value = 'checking'
      try {
        const exists = await api.words.checkWordExistsDirect(wordText, -1, ctx.lang)
        if (currentWord.value?.word.trim() !== wordText) {
          duplicateCheckState.value = 'idle'
          return false
        }
        duplicateCheckState.value = exists ? 'duplicate' : 'clear'
      } catch (error) {
        log.error('重复检测失败:', error)
        duplicateCheckState.value = 'clear'
      }
      return false
    }

    if (duplicateCheckState.value === 'duplicate') return false

    // 释义加粗（与 update 路径一致）
    const strippedDef = stripBoldFromDefinition(currentWord.value.definition)
    const boldedDef = applyBoldToDefinition(strippedDef, wordText)
    const hasDef = !!(boldedDef?.definitions && boldedDef.definitions.length)

    try {
      const settings = await api.settings.getSettings()
      const learning = settings.sourceSettings[ctx.source]?.learning
      const dailyLimit = learning?.dailyReviewLimit ?? 50
      const maxPrepDays = learning?.maxPrepDays ?? 90

      const [todayDue, futureLoads] = await Promise.all([
        api.words.getTodayDueCountDirect(ctx.source),
        api.words.getDailyReviewLoadsDirect(ctx.source, maxPrepDays),
      ])

      const created = await api.words.createWordDirect(
        wordText,
        ctx.source,
        { dailyLimit, loadsWithToday: [todayDue, ...futureLoads] },
        ctx.lang,
        hasDef ? { definition: boldedDef } : undefined
      )

      // 切到正常模式
      currentWord.value = { ...created }
      originalWord.value = { ...created }
      isEditing.value = false
      isCreating.value = false
      createContext.value = null
      duplicateCheckState.value = 'idle'

      onWordUpdatedCallbacks.value.forEach(cb => cb({ ...created }))
      loadRelatedWords(created)

      // 无预填释义 → 后台爬取
      if (!hasDef) fetchDefinitionAsync(created.id, ctx.lang)

      return true
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      log.error('创建单词失败:', error)
      // 并发竞态：刚好被其他入口创建 → 查询后切到正常模式
      if (msg.includes('已存在')) {
        try {
          const found = await api.words.getWordByTextAndSourceDirect(wordText, ctx.source, ctx.lang)
          if (found) {
            currentWord.value = { ...found }
            originalWord.value = { ...found }
            isEditing.value = false
            isCreating.value = false
            createContext.value = null
            duplicateCheckState.value = 'idle'
            loadRelatedWords(found)
            return true
          }
        } catch {
          // 忽略，回退到 duplicate
        }
        duplicateCheckState.value = 'duplicate'
      }
      return false
    }
  }

  /**
   * 加载单词的关联词（非英语源跳过）
   */
  async function loadRelatedWords(word: Word) {
    const { settings } = useSettings()
    const customSources = settings.value?.sources?.customSources || {}
    const langConfig = getSourceLangConfig(word.source || '', customSources)
    if (!langConfig.supportsRelations) return

    isLoadingRelated.value = true
    try {
      relatedWords.value = await api.words.getRelatedWordsDirect(word.id)
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
    isCreating.value = false
    createContext.value = null

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
   * 取消编辑，恢复原始数据；创建态下直接关闭
   */
  function cancelEdit() {
    if (isCreating.value) {
      close()
      return
    }
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

    // 创建态走独立路径
    if (isCreating.value) return saveCreate()

    const wordId = currentWord.value.id
    const wordFieldChanged = !!originalWord.value && currentWord.value.word !== originalWord.value.word
    const oldWordText = originalWord.value?.word

    // ── 重复检测阶段 ──
    if (wordFieldChanged && duplicateCheckState.value === 'idle') {
      duplicateCheckState.value = 'checking'
      const wordTextSnapshot = currentWord.value.word

      try {
        let exists: boolean
        if (duplicateChecker.value) {
          exists = await duplicateChecker.value(wordTextSnapshot, wordId)
        } else {
          const { settings } = useSettings()
          const customSources = settings.value?.sources?.customSources as Record<string, SourceLang> | undefined
          const lang: SourceLang = customSources?.[currentWord.value?.source || ''] ?? 'en'
          exists = await api.words.checkWordExistsDirect(wordTextSnapshot, wordId, lang)
        }

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

    // 修改单词文本时，清理旧文本的 TTS 缓存（fire-and-forget）
    if (wordFieldChanged && oldWordText) {
      const source = currentWord.value.source
      if (source) {
        const { settings } = useSettings()
        const customSources = settings.value?.sources?.customSources || {}
        const ttsLang = getSourceLangConfig(source, customSources).ttsLang
        if (ttsLang) deleteTtsCache([oldWordText], source)
      }
    }

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
   * @param lang 可选语言：传入可避免后端查 user_config 解析 source → lang
   */
  async function fetchDefinitionAsync(wordId: number, lang?: SourceLang) {
    try {
      const wordWithDefinition = await api.words.fetchDefinition(wordId, lang)

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
  function deleteWord(): boolean {
    if (!currentWord.value) return false

    const wordId = currentWord.value.id
    const wordText = currentWord.value.word
    const wordSource = currentWord.value.source

    // 乐观删除：立即触发回调 + 关闭浮窗，网络请求异步完成
    onWordDeletedCallbacks.value.forEach(cb => cb(wordId))
    close()

    // 异步：DB 删除 + TTS 缓存清理
    api.words.deleteWordDirect(wordId).then(() => {
      if (wordSource) {
        const { settings } = useSettings()
        const customSources = settings.value?.sources?.customSources || {}
        const ttsLang = getSourceLangConfig(wordSource, customSources).ttsLang
        if (ttsLang) deleteTtsCache([wordText], wordSource)
      }
    }).catch(error => {
      log.error('删除单词失败:', error)
    })

    return true
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
      const source = word.source || 'IELTS'
      const sourceLearning = userSettings.sourceSettings[source]?.learning
      const dailyLimit = sourceLearning?.dailyReviewLimit || 50
      const maxPrepDays = sourceLearning?.maxPrepDays || 45

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
      const source = word.source || 'IELTS'
      const sourceLearning = userSettings.sourceSettings[source]?.learning
      const dailyLimit = sourceLearning?.dailySpellLimit || 200
      const maxPrepDays = sourceLearning?.maxPrepDays || 45

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
    isCreating,
    createContext,

    // Getters
    hasChanges,
    canSave,
    duplicateCheckState,

    // Actions
    open,
    openForCourse,
    openForCreate,
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
