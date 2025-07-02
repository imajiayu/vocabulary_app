/**
 * 写作练习数据管理
 * V3: 合并 versions 到 session，新增大纲阶段
 */
import { ref, shallowRef, computed } from 'vue'
import type {
  WritingFolder,
  WritingPrompt,
  WritingSession,
  ParagraphFeedback,
  WritingScores,
  WritingPageState,
  CreatePromptPayload,
  UpdateSessionPayload
} from '@/shared/types/writing'
import { TASK_TIME_LIMITS } from '@/shared/types/writing'
import { WritingApi } from '@/shared/api/writing'
import {
  getParagraphFeedback,
  getFinalScores,
  askOutlineQuestion,
  editOutlineText
} from '@/shared/services/writing-ai'
import { logger } from '@/shared/utils/logger'

const writingLogger = logger.create('Writing')

export function useWritingData() {
  // ============================================================================
  // 状态
  // ============================================================================

  const loading = ref(false)
  const folders = shallowRef<WritingFolder[]>([])
  const prompts = shallowRef<WritingPrompt[]>([])
  const selectedPrompt = ref<WritingPrompt | null>(null)

  // 会话相关状态
  const currentSession = ref<WritingSession | null>(null)
  const promptSessions = ref<WritingSession[]>([])
  const pageState = ref<WritingPageState>('idle')
  const sessionChecking = ref(false)

  // 每个题目的会话列表（sidebar 初始化时加载）
  const allSessions = ref<Map<number, WritingSession[]>>(new Map())

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

  // ============================================================================
  // 数据加载
  // ============================================================================

  /**
   * 加载文件夹和题目
   */
  async function loadData() {
    loading.value = true
    try {
      const [foldersData, promptsData, sessionsData] = await Promise.all([
        WritingApi.getFolders(),
        WritingApi.getPrompts(),
        WritingApi.getSessions()  // 加载所有会话
      ])
      folders.value = foldersData
      prompts.value = promptsData

      // 按 prompt_id 分组
      const sessionMap = new Map<number, WritingSession[]>()
      for (const session of sessionsData) {
        if (session.prompt_id == null) continue
        const list = sessionMap.get(session.prompt_id) || []
        list.push(session)
        sessionMap.set(session.prompt_id, list)
      }
      allSessions.value = sessionMap
    } catch (e) {
      writingLogger.error('加载数据失败:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  /**
   * 加载会话详情
   */
  async function loadSession(sessionId: number) {
    loading.value = true
    try {
      const session = await WritingApi.getSession(sessionId)
      if (session) {
        currentSession.value = session
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

  async function updatePromptNotes(promptId: number, notes: string) {
    loading.value = true
    try {
      const updated = await WritingApi.updatePromptNotes(promptId, notes)
      prompts.value = prompts.value.map(p => p.id === promptId ? updated : p)
      if (selectedPrompt.value?.id === promptId) {
        selectedPrompt.value = updated
      }
      return updated
    } catch (e) {
      writingLogger.error('更新笔记失败:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function selectPrompt(prompt: WritingPrompt | null) {
    if (!prompt) {
      selectedPrompt.value = null
      currentSession.value = null
      promptSessions.value = []
      pageState.value = 'idle'
      return
    }

    // 立即更新选中状态，右侧显示 prompt_selected
    selectedPrompt.value = prompt
    currentSession.value = null
    promptSessions.value = []
    pageState.value = 'prompt_selected'

    // 加载该题目下的所有会话
    sessionChecking.value = true
    try {
      const sessions = await WritingApi.getSessions(prompt.id)
      promptSessions.value = sessions

      // 如果有未完成的会话，自动加载它
      const inProgressSession = sessions.find(s => s.status !== 'completed')
      if (inProgressSession) {
        const session = await WritingApi.getSession(inProgressSession.id)
        if (session) {
          currentSession.value = session
          updatePageState()
        }
      }
    } catch (e) {
      writingLogger.error('加载会话失败:', e)
    } finally {
      sessionChecking.value = false
    }
  }

  // ============================================================================
  // 会话操作
  // ============================================================================

  /**
   * 选中一个具体的会话
   */
  async function selectSession(sessionId: number) {
    sessionChecking.value = true
    try {
      const session = await WritingApi.getSession(sessionId)
      if (session) {
        currentSession.value = session
        // 确保 selectedPrompt 和 promptSessions 也同步
        if (session.prompt_id != null) {
          const prompt = prompts.value.find(p => p.id === session.prompt_id)
          if (prompt) {
            selectedPrompt.value = prompt
          }
          promptSessions.value = allSessions.value.get(session.prompt_id) || []
        }
        updatePageState()
      }
    } catch (e) {
      writingLogger.error('加载会话失败:', e)
      throw e
    } finally {
      sessionChecking.value = false
    }
  }

  /**
   * 删除会话
   */
  async function deleteSession(sessionId: number) {
    try {
      // 先找到 prompt_id 以便同步 allSessions
      const session = promptSessions.value.find(s => s.id === sessionId)
      await WritingApi.deleteSession(sessionId)
      promptSessions.value = promptSessions.value.filter(s => s.id !== sessionId)
      // 同步 allSessions
      if (session?.prompt_id != null) {
        const pid = session.prompt_id
        const existing = allSessions.value.get(pid) || []
        const updated = existing.filter(s => s.id !== sessionId)
        const newMap = new Map(allSessions.value)
        if (updated.length > 0) {
          newMap.set(pid, updated)
        } else {
          newMap.delete(pid)
        }
        allSessions.value = newMap
      }
      // 如果删除的是当前会话，清除它
      if (currentSession.value?.id === sessionId) {
        currentSession.value = null
        pageState.value = selectedPrompt.value ? 'prompt_selected' : 'idle'
      }
    } catch (e) {
      writingLogger.error('删除会话失败:', e)
      throw e
    }
  }

  /**
   * 创建会话并进入大纲阶段
   */
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
      promptSessions.value = [session, ...promptSessions.value]
      // 同步 allSessions
      const pid = selectedPrompt.value.id
      const existing = allSessions.value.get(pid) || []
      allSessions.value = new Map(allSessions.value).set(pid, [session, ...existing])
      pageState.value = 'outline'
      return session
    } catch (e) {
      writingLogger.error('创建会话失败:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function updateSession(payload: UpdateSessionPayload) {
    if (!currentSession.value) return null

    try {
      const session = await WritingApi.updateSession(currentSession.value.id, payload)
      currentSession.value = session
      // 同步 promptSessions 中对应的记录
      promptSessions.value = promptSessions.value.map(s =>
        s.id === session.id ? session : s
      )
      // 同步 allSessions
      if (session.prompt_id != null) {
        const pid = session.prompt_id
        const existing = allSessions.value.get(pid) || []
        const newMap = new Map(allSessions.value)
        newMap.set(pid, existing.map(s => s.id === session.id ? session : s))
        allSessions.value = newMap
      }
      return session
    } catch (e) {
      writingLogger.error('更新会话失败:', e)
      throw e
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
  // 内容操作（替代原版本操作）
  // ============================================================================

  /**
   * 保存大纲并进入写作阶段
   */
  async function saveOutline(text: string) {
    if (!currentSession.value) return null

    const session = await updateSession({
      outline: text,
      status: 'writing'
    })
    pageState.value = 'writing'
    return session
  }

  /**
   * 提交初稿并触发 AI 逐段反馈
   */
  async function submitDraft(content: string) {
    if (!currentSession.value || !selectedPrompt.value) return null

    const wordCount = WritingApi.countWords(content)

    // 先保存初稿内容
    await updateSession({
      draft_content: content,
      word_count: wordCount,
      status: 'feedback'
    })
    pageState.value = 'feedback'

    // 调用 AI 获取逐段反馈
    const feedback = await getParagraphFeedback(
      selectedPrompt.value.prompt_text,
      content,
      selectedPrompt.value.task_type
    )

    // 保存反馈
    await updateSession({ feedback })

    return feedback
  }

  /**
   * 提交终稿并触发 AI 评分
   */
  async function submitFinal(content: string, timeSpent?: number) {
    if (!currentSession.value || !selectedPrompt.value) return null

    const wordCount = WritingApi.countWords(content)

    // 保存终稿
    await updateSession({
      final_content: content,
      word_count: wordCount
    })

    // 获取最终评分
    const result = await getFinalScores(
      selectedPrompt.value.prompt_text,
      content,
      selectedPrompt.value.task_type
    )

    // 保存评分、时间并完成会话（单次写入）
    await updateSession({
      scores: result.scores,
      status: 'completed',
      time_spent: timeSpent ?? null,
      completed_at: new Date().toISOString()
    })
    pageState.value = 'completed'

    return result
  }

  /**
   * 大纲问答（不修改大纲）
   */
  async function handleOutlineAsk(question: string, selectedText?: string): Promise<string> {
    if (!currentSession.value || !selectedPrompt.value) {
      throw new Error('No active session')
    }

    const outline = currentSession.value.outline || ''

    return askOutlineQuestion(
      selectedPrompt.value.prompt_text,
      outline,
      question,
      selectedText
    )
  }

  /**
   * 编辑大纲选中文本
   */
  async function handleOutlineEdit(
    selectedText: string,
    instruction: string
  ): Promise<{ reply: string; modified: string }> {
    if (!currentSession.value || !selectedPrompt.value) {
      throw new Error('No active session')
    }

    const outline = currentSession.value.outline || ''

    return editOutlineText(
      selectedPrompt.value.prompt_text,
      outline,
      selectedText,
      instruction
    )
  }

  // ============================================================================
  // 页面状态管理
  // ============================================================================

  /**
   * 根据 session 状态映射到页面状态
   */
  function updatePageState() {
    if (!currentSession.value) {
      pageState.value = selectedPrompt.value ? 'prompt_selected' : 'idle'
      return
    }

    const status = currentSession.value.status
    switch (status) {
      case 'outline':
        pageState.value = 'outline'
        break
      case 'writing':
        pageState.value = 'writing'
        break
      case 'feedback':
        pageState.value = 'feedback'
        break
      case 'revision':
        pageState.value = 'revision'
        break
      case 'completed':
        pageState.value = 'completed'
        break
      default:
        pageState.value = 'prompt_selected'
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
    pageState.value = selectedPrompt.value ? 'prompt_selected' : 'idle'
  }

  /**
   * 取消选中会话（不清除 selectedPrompt）
   */
  function deselectSession() {
    currentSession.value = null
    pageState.value = 'idle'
  }

  // ============================================================================
  // 返回
  // ============================================================================

  return {
    // 状态
    loading,
    sessionChecking,
    folders,
    prompts,
    selectedPrompt,
    currentSession,
    promptSessions,
    allSessions,
    pageState,
    expandedFolders,

    // 计算属性
    promptsByFolder,

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
    updatePromptNotes,
    deletePrompt,
    movePrompt,
    selectPrompt,

    // 会话操作
    selectSession,
    deselectSession,
    deleteSession,
    startSession,
    updateSession,
    completeSession,

    // 内容操作
    saveOutline,
    submitDraft,
    submitFinal,
    handleOutlineAsk,
    handleOutlineEdit,

    // 状态管理
    updatePageState,
    setPageState,
    clearSession
  }
}
