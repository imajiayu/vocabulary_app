/**
 * 写作练习 Context
 * 使用 Provide/Inject 在组件树中共享状态
 */
import { provide, inject, computed, type InjectionKey, type Ref, type ComputedRef } from 'vue'
import type {
  WritingFolder,
  WritingPrompt,
  WritingSession,
  WritingVersion,
  WritingPageState,
  WritingFeedback,
  WritingScores,
  CreatePromptPayload
} from '@/shared/types/writing'
import { useWritingData } from './useWritingData'

/**
 * Writing Context 接口
 */
export interface WritingContext {
  // 状态（只读）
  loading: Ref<boolean>
  folders: Ref<WritingFolder[]>
  prompts: Ref<WritingPrompt[]>
  selectedPrompt: Ref<WritingPrompt | null>
  currentSession: Ref<WritingSession | null>
  versions: Ref<WritingVersion[]>
  pageState: Ref<WritingPageState>
  expandedFolders: Ref<Set<number>>

  // 计算属性
  promptsByFolder: ComputedRef<Map<number | null, WritingPrompt[]>>
  currentVersionNumber: ComputedRef<0 | 1 | 2>
  canSubmitVersion: ComputedRef<boolean>

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
  startSession: () => Promise<WritingSession | null>
  updateSession: (payload: Partial<WritingSession>) => Promise<WritingSession | null>
  completeSession: (timeSpent: number) => Promise<WritingSession | null>

  // 版本操作
  submitVersion: (content: string) => Promise<WritingVersion | null>
  updateVersionFeedback: (versionId: number, feedback: WritingFeedback) => Promise<WritingVersion>
  updateVersionScores: (versionId: number, scores: WritingScores) => Promise<WritingVersion>

  // 状态管理
  setPageState: (state: WritingPageState) => void
  clearSession: () => void
  getVersionByNumber: (num: 1 | 2) => WritingVersion | undefined

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

  // 包装选中操作
  async function handleSelectPrompt(prompt: WritingPrompt | null) {
    // 如果点击已选中的题目，取消选中
    if (prompt && data.selectedPrompt.value?.id === prompt.id) {
      await data.selectPrompt(null)
      options.onPromptSelected?.(null)
    } else {
      await data.selectPrompt(prompt)
      options.onPromptSelected?.(prompt)
    }
  }

  const context: WritingContext = {
    // 状态
    loading: data.loading,
    folders: data.folders,
    prompts: data.prompts,
    selectedPrompt: data.selectedPrompt,
    currentSession: data.currentSession,
    versions: data.versions,
    pageState: data.pageState,
    expandedFolders: data.expandedFolders,

    // 计算属性
    promptsByFolder: data.promptsByFolder,
    currentVersionNumber: data.currentVersionNumber,
    canSubmitVersion: data.canSubmitVersion,

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
    startSession: data.startSession,
    updateSession: data.updateSession,
    completeSession: data.completeSession,

    // 版本操作
    submitVersion: data.submitVersion,
    updateVersionFeedback: data.updateVersionFeedback,
    updateVersionScores: data.updateVersionScores,

    // 状态管理
    setPageState: data.setPageState,
    clearSession: data.clearSession,
    getVersionByNumber: data.getVersionByNumber,

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
