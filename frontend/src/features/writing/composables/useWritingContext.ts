/**
 * 写作练习 Context
 * 使用 Provide/Inject 在组件树中共享状态
 */
import { provide, inject, type InjectionKey, type Ref, type ComputedRef } from 'vue'
import type {
  WritingFolder,
  WritingPrompt,
  WritingSession,
  ParagraphFeedback,
  WritingPageState,
  CreatePromptPayload,
  UpdateSessionPayload,
} from '@/shared/types/writing'
import { useWritingData } from './useWritingData'

/**
 * Writing Context 接口
 */
export interface WritingContext {
  // 状态（只读）
  loading: Ref<boolean>
  sessionChecking: Ref<boolean>
  folders: Ref<WritingFolder[]>
  prompts: Ref<WritingPrompt[]>
  selectedPrompt: Ref<WritingPrompt | null>
  currentSession: Ref<WritingSession | null>
  promptSessions: Ref<WritingSession[]>
  allSessions: Ref<Map<number, WritingSession[]>>
  pageState: Ref<WritingPageState>
  expandedFolders: Ref<Set<number>>

  // 计算属性
  promptsByFolder: ComputedRef<Map<number | null, WritingPrompt[]>>

  // 文件夹操作
  createFolder: (name: string) => Promise<WritingFolder>
  updateFolder: (id: number, name: string) => Promise<WritingFolder>
  deleteFolder: (id: number) => Promise<void>
  toggleFolder: (id: number) => void

  // 题目操作
  createPrompt: (payload: CreatePromptPayload) => Promise<WritingPrompt>
  updatePrompt: (id: number, payload: Partial<WritingPrompt>) => Promise<WritingPrompt>
  updatePromptNotes: (promptId: number, notes: string) => Promise<WritingPrompt>
  deletePrompt: (id: number) => Promise<void>
  movePrompt: (id: number, folderId: number | null) => Promise<void>
  selectPrompt: (prompt: WritingPrompt | null) => Promise<void>

  // 会话操作
  selectSession: (sessionId: number) => Promise<void>
  deselectSession: () => void
  deleteSession: (sessionId: number) => Promise<void>
  startSession: () => Promise<WritingSession | null>
  updateSession: (payload: UpdateSessionPayload) => Promise<WritingSession | null>
  completeSession: (timeSpent: number) => Promise<WritingSession | null>

  // 内容操作
  saveOutline: (text: string) => Promise<WritingSession | null>
  submitDraft: (content: string) => Promise<ParagraphFeedback[] | null>
  submitFinal: (content: string, timeSpent?: number) => Promise<{ scores: import('@/shared/types/writing').WritingScores; summary: string } | null>
  handleOutlineAsk: (question: string, selectedText?: string) => Promise<string>
  handleOutlineEdit: (selectedText: string, instruction: string) => Promise<{ reply: string; modified: string }>

  // 状态管理
  setPageState: (state: WritingPageState) => void
  clearSession: () => void

  // 数据加载
  loadData: () => Promise<void>

  // 回调
  onPromptSelected?: (prompt: WritingPrompt | null) => void
}

/**
 * 创建 Writing Context 的参数
 */
export interface CreateWritingContextOptions {
  onPromptSelected?: (prompt: WritingPrompt | null) => void
}

const WRITING_CONTEXT_KEY: InjectionKey<WritingContext> = Symbol('writing-context')

/**
 * 创建并提供 Writing Context
 * 在 WritingSidebar 中调用
 */
export function createWritingContext(options: CreateWritingContextOptions = {}) {
  const data = useWritingData()

  // 包装删除操作，添加确认
  async function handleDeleteFolder(id: number) {
    if (!confirm('删除文件夹？文件夹内的题目将移至"未分类"。')) return
    await data.deleteFolder(id)
  }

  async function handleDeletePrompt(id: number) {
    if (!confirm('确定要删除此题目吗？相关的练习记录也会被删除。')) return
    await data.deletePrompt(id)
    options.onPromptSelected?.(null)
  }

  async function handleDeleteSession(sessionId: number) {
    if (!confirm('确定要删除此练习记录吗？')) return
    await data.deleteSession(sessionId)
  }

  // 包装会话选中操作
  async function handleSelectSession(sessionId: number) {
    await data.selectSession(sessionId)
    // selectSession 内部设置了 data.selectedPrompt，同步通知父组件
    if (data.selectedPrompt.value) {
      options.onPromptSelected?.(data.selectedPrompt.value)
    }
  }

  function handleDeselectSession() {
    data.deselectSession()
    options.onPromptSelected?.(null)
  }

  // 包装选中操作
  async function handleSelectPrompt(prompt: WritingPrompt | null) {
    if (!prompt) {
      options.onPromptSelected?.(null)
      await data.selectPrompt(null)
      return
    }

    // 有 session 的题目：不走 selectPrompt（由 PromptItem 内部展开 session 列表）
    const hasSessions = (data.allSessions.value.get(prompt.id) || []).length > 0
    if (hasSessions) {
      return
    }

    // 无 session 的题目：保持原有 toggle 逻辑
    if (data.selectedPrompt.value?.id === prompt.id) {
      options.onPromptSelected?.(null)
      await data.selectPrompt(null)
    } else {
      options.onPromptSelected?.(prompt)
      await data.selectPrompt(prompt)
    }
  }

  const context: WritingContext = {
    // 状态
    loading: data.loading,
    sessionChecking: data.sessionChecking,
    folders: data.folders,
    prompts: data.prompts,
    selectedPrompt: data.selectedPrompt,
    currentSession: data.currentSession,
    promptSessions: data.promptSessions,
    allSessions: data.allSessions,
    pageState: data.pageState,
    expandedFolders: data.expandedFolders,

    // 计算属性
    promptsByFolder: data.promptsByFolder,

    // 文件夹操作
    createFolder: data.createFolder,
    updateFolder: data.updateFolder,
    deleteFolder: handleDeleteFolder,
    toggleFolder: data.toggleFolder,

    // 题目操作
    createPrompt: data.createPrompt,
    updatePrompt: data.updatePrompt,
    updatePromptNotes: data.updatePromptNotes,
    deletePrompt: handleDeletePrompt,
    movePrompt: data.movePrompt,
    selectPrompt: handleSelectPrompt,

    // 会话操作
    selectSession: handleSelectSession,
    deselectSession: handleDeselectSession,
    deleteSession: handleDeleteSession,
    startSession: data.startSession,
    updateSession: data.updateSession,
    completeSession: data.completeSession,

    // 内容操作
    saveOutline: data.saveOutline,
    submitDraft: data.submitDraft,
    submitFinal: data.submitFinal,
    handleOutlineAsk: data.handleOutlineAsk,
    handleOutlineEdit: data.handleOutlineEdit,

    // 状态管理
    setPageState: data.setPageState,
    clearSession: data.clearSession,

    // 数据加载
    loadData: data.loadData,

    onPromptSelected: options.onPromptSelected
  }

  provide(WRITING_CONTEXT_KEY, context)

  return {
    context,
    data
  }
}

/**
 * 在子组件中注入 Writing Context
 */
export function useWritingContext(): WritingContext {
  const context = inject(WRITING_CONTEXT_KEY)
  if (!context) {
    throw new Error('useWritingContext must be used within WritingSidebar')
  }
  return context
}
