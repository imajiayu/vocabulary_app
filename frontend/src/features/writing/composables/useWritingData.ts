/**
 * 写作练习数据管理
 */
import { ref, computed } from 'vue'
import type {
  WritingFolder,
  WritingPrompt,
  WritingSession,
  WritingVersion,
  WritingFeedback,
  WritingScores,
  WritingPageState,
  CreatePromptPayload
} from '@/shared/types/writing'
import { TASK_TIME_LIMITS } from '@/shared/types/writing'
import { WritingApi } from '@/shared/api/writing'
import { logger } from '@/shared/utils/logger'

const writingLogger = logger.create('Writing')

export function useWritingData() {
  // ============================================================================
  // 状态
  // ============================================================================

  const loading = ref(false)
  const folders = ref<WritingFolder[]>([])
  const prompts = ref<WritingPrompt[]>([])
  const selectedPrompt = ref<WritingPrompt | null>(null)

  // 会话相关状态
  const currentSession = ref<WritingSession | null>(null)
  const versions = ref<WritingVersion[]>([])
  const pageState = ref<WritingPageState>('idle')

  // UI 状态
  const expandedFolders = ref(new Set<number>())

  // ============================================================================
  // 计算属性
  // ============================================================================

  /**
   * 按文件夹分组的题目
   */
  const promptsByFolder = computed(() => {
    const grouped: Map<number | null, WritingPrompt[]> = new Map()

    // 初始化文件夹分组
    grouped.set(null, [])  // 未分类
    for (const folder of folders.value) {
      grouped.set(folder.id, [])
    }

    // 分配题目
    for (const prompt of prompts.value) {
      const list = grouped.get(prompt.folder_id) || grouped.get(null)!
      list.push(prompt)
    }

    return grouped
  })

  /**
   * 未分类的题目
   */
  const uncategorizedPrompts = computed(() => {
    return prompts.value.filter(p => p.folder_id === null)
  })

  /**
   * 当前版本号
   */
  const currentVersionNumber = computed(() => {
    return versions.value.length as 0 | 1 | 2 | 3
  })

  /**
   * 是否可以提交新版本
   */
  const canSubmitVersion = computed(() => {
    return currentVersionNumber.value < 3
  })

  // ============================================================================
  // 数据加载
  // ============================================================================

  /**
   * 加载文件夹和题目
   */
  async function loadData() {
    loading.value = true
    try {
      const [foldersData, promptsData] = await Promise.all([
        WritingApi.getFolders(),
        WritingApi.getPrompts()
      ])
      folders.value = foldersData
      prompts.value = promptsData
    } catch (e) {
      writingLogger.error('加载数据失败:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * 加载会话详情（含版本）
   */
  async function loadSession(sessionId: number) {
    loading.value = true
    try {
      const session = await WritingApi.getSession(sessionId)
      if (session) {
        currentSession.value = session
        versions.value = session.versions || []
        updatePageState()
      }
    } catch (e) {
      writingLogger.error('加载会话失败:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  // ============================================================================
  // 文件夹操作
  // ============================================================================

  async function createFolder(name: string) {
    loading.value = true
    try {
      const folder = await WritingApi.createFolder({ name })
      folders.value = [...folders.value, folder]
      expandedFolders.value.add(folder.id)
      return folder
    } catch (e) {
      writingLogger.error('创建文件夹失败:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateFolder(id: number, name: string) {
    loading.value = true
    try {
      const folder = await WritingApi.updateFolder(id, name)
      folders.value = folders.value.map(f => f.id === id ? folder : f)
      return folder
    } catch (e) {
      writingLogger.error('更新文件夹失败:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deleteFolder(id: number) {
    loading.value = true
    try {
      await WritingApi.deleteFolder(id)
      folders.value = folders.value.filter(f => f.id !== id)
      expandedFolders.value.delete(id)
      // 更新题目的 folder_id
      prompts.value = prompts.value.map(p =>
        p.folder_id === id ? { ...p, folder_id: null } : p
      )
    } catch (e) {
      writingLogger.error('删除文件夹失败:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  function toggleFolder(id: number) {
    if (expandedFolders.value.has(id)) {
      expandedFolders.value.delete(id)
    } else {
      expandedFolders.value.add(id)
    }
  }

  // ============================================================================
  // 题目操作
  // ============================================================================

  async function createPrompt(payload: CreatePromptPayload) {
    loading.value = true
    try {
      const prompt = await WritingApi.createPrompt(payload)
      prompts.value = [...prompts.value, prompt]
      if (payload.folder_id) {
        expandedFolders.value.add(payload.folder_id)
      }
      return prompt
    } catch (e) {
      writingLogger.error('创建题目失败:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updatePrompt(id: number, payload: Partial<WritingPrompt>) {
    loading.value = true
    try {
      const prompt = await WritingApi.updatePrompt(id, payload)
      prompts.value = prompts.value.map(p => p.id === id ? prompt : p)
      if (selectedPrompt.value?.id === id) {
        selectedPrompt.value = prompt
      }
      return prompt
    } catch (e) {
      writingLogger.error('更新题目失败:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function deletePrompt(id: number) {
    loading.value = true
    try {
      await WritingApi.deletePrompt(id)
      prompts.value = prompts.value.filter(p => p.id !== id)
      if (selectedPrompt.value?.id === id) {
        selectedPrompt.value = null
        pageState.value = 'idle'
      }
    } catch (e) {
      writingLogger.error('删除题目失败:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function movePrompt(id: number, folderId: number | null) {
    loading.value = true
    try {
      await WritingApi.movePrompt(id, folderId)
      prompts.value = prompts.value.map(p =>
        p.id === id ? { ...p, folder_id: folderId } : p
      )
    } catch (e) {
      writingLogger.error('移动题目失败:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function selectPrompt(prompt: WritingPrompt | null) {
    if (!prompt) {
      selectedPrompt.value = null
      currentSession.value = null
      versions.value = []
      pageState.value = 'idle'
      return
    }

    // 先清空状态，设置 loading
    currentSession.value = null
    versions.value = []
    loading.value = true

    // 检查是否有未完成的会话
    try {
      const sessions = await WritingApi.getSessions(prompt.id)
      const inProgressSession = sessions.find(s => s.status !== 'completed')

      if (inProgressSession) {
        // 加载未完成的会话（loadSession 会设置 currentSession, versions, pageState）
        await loadSession(inProgressSession.id)
      } else {
        pageState.value = 'prompt_selected'
      }
    } catch (e) {
      writingLogger.error('检查会话失败:', e)
      pageState.value = 'prompt_selected'
    } finally {
      loading.value = false
      // 最后设置 selectedPrompt，确保数据已加载
      selectedPrompt.value = prompt
    }
  }

  // ============================================================================
  // 会话操作
  // ============================================================================

  async function startSession() {
    if (!selectedPrompt.value) return null

    loading.value = true
    try {
      const timeLimit = TASK_TIME_LIMITS[selectedPrompt.value.task_type]
      const session = await WritingApi.createSession({
        prompt_id: selectedPrompt.value.id,
        time_limit: timeLimit
      })
      currentSession.value = session
      versions.value = []
      pageState.value = 'writing'
      return session
    } catch (e) {
      writingLogger.error('创建会话失败:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateSession(payload: Partial<WritingSession>) {
    if (!currentSession.value) return null

    loading.value = true
    try {
      const session = await WritingApi.updateSession(currentSession.value.id, payload)
      currentSession.value = session
      return session
    } catch (e) {
      writingLogger.error('更新会话失败:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function completeSession(timeSpent: number) {
    if (!currentSession.value) return null

    return updateSession({
      status: 'completed',
      time_spent: timeSpent,
      completed_at: new Date().toISOString()
    })
  }

  // ============================================================================
  // 版本操作
  // ============================================================================

  async function submitVersion(content: string): Promise<WritingVersion | null> {
    if (!currentSession.value || !canSubmitVersion.value) return null

    loading.value = true
    try {
      const versionNumber = (currentVersionNumber.value + 1) as 1 | 2 | 3
      const version = await WritingApi.createVersion({
        session_id: currentSession.value.id,
        version_number: versionNumber,
        content
      })
      versions.value = [...versions.value, version]
      return version
    } catch (e) {
      writingLogger.error('提交版本失败:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateVersionFeedback(versionId: number, feedback: WritingFeedback) {
    loading.value = true
    try {
      const updated = await WritingApi.updateVersion(versionId, { feedback })
      versions.value = versions.value.map(v => v.id === versionId ? updated : v)
      return updated
    } catch (e) {
      writingLogger.error('更新反馈失败:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateVersionScores(versionId: number, scores: WritingScores) {
    loading.value = true
    try {
      const updated = await WritingApi.updateVersion(versionId, { scores })
      versions.value = versions.value.map(v => v.id === versionId ? updated : v)
      return updated
    } catch (e) {
      writingLogger.error('更新评分失败:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  // ============================================================================
  // 页面状态管理
  // ============================================================================

  function updatePageState() {
    if (!currentSession.value) {
      pageState.value = selectedPrompt.value ? 'prompt_selected' : 'idle'
      return
    }

    if (currentSession.value.status === 'completed') {
      pageState.value = 'completed'
      return
    }

    const versionCount = versions.value.length

    if (versionCount === 0) {
      pageState.value = 'writing'
    } else if (versionCount === 1) {
      pageState.value = 'feedback_1'
    } else if (versionCount === 2) {
      pageState.value = 'feedback_2'
    } else {
      pageState.value = 'completed'
    }
  }

  function setPageState(state: WritingPageState) {
    pageState.value = state
  }

  // ============================================================================
  // 辅助函数
  // ============================================================================

  function clearSession() {
    currentSession.value = null
    versions.value = []
    pageState.value = selectedPrompt.value ? 'prompt_selected' : 'idle'
  }

  function getVersionByNumber(num: 1 | 2 | 3): WritingVersion | undefined {
    return versions.value.find(v => v.version_number === num)
  }

  // ============================================================================
  // 返回
  // ============================================================================

  return {
    // 状态
    loading,
    folders,
    prompts,
    selectedPrompt,
    currentSession,
    versions,
    pageState,
    expandedFolders,

    // 计算属性
    promptsByFolder,
    uncategorizedPrompts,
    currentVersionNumber,
    canSubmitVersion,

    // 数据加载
    loadData,
    loadSession,

    // 文件夹操作
    createFolder,
    updateFolder,
    deleteFolder,
    toggleFolder,

    // 题目操作
    createPrompt,
    updatePrompt,
    deletePrompt,
    movePrompt,
    selectPrompt,

    // 会话操作
    startSession,
    updateSession,
    completeSession,

    // 版本操作
    submitVersion,
    updateVersionFeedback,
    updateVersionScores,

    // 状态管理
    updatePageState,
    setPageState,
    clearSession,
    getVersionByNumber
  }
}
