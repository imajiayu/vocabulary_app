/**
 * 写作练习相关的 API 接口
 *
 * 全部使用 Supabase 直连，不经过后端
 * - 数据读写：Supabase Database
 * - 文件存储：Supabase Storage (writing-images bucket)
 * - AI 反馈：前端直调 DeepSeek API
 */

import { supabase } from '@/shared/config/supabase'
import { getCurrentUserId } from '@/shared/composables/useUserSelection'
import type {
  WritingFolder,
  WritingPrompt,
  WritingSession,
  WritingVersion,
  WritingFeedback,
  WritingScores,
  CreateFolderPayload,
  CreatePromptPayload,
  UpdatePromptPayload,
  CreateSessionPayload,
  UpdateSessionPayload,
  CreateVersionPayload,
  UpdateVersionPayload
} from '@/shared/types/writing'
import {
  getInitialFeedback,
  getRevisionFeedback,
  getFinalScores,
  getIssueSuggestion,
  askWritingQuestion
} from '@/shared/services/writing-ai'
import type { WritingIssue } from '@/shared/types/writing'

const IMAGES_BUCKET = 'writing-images'

/**
 * 写作练习 API 类
 */
export class WritingApi {
  // ============================================================================
  // 文件夹管理
  // ============================================================================

  /**
   * 获取所有文件夹
   */
  static async getFolders(): Promise<WritingFolder[]> {
    const userId = getCurrentUserId()
    const { data, error } = await supabase
      .from('writing_folders')
      .select('*')
      .eq('user_id', userId)
      .order('sort_order')
      .order('id')

    if (error) throw new Error(`获取文件夹失败: ${error.message}`)

    return (data || []).map(row => ({
      id: row.id as number,
      user_id: row.user_id as number,
      name: row.name as string,
      sort_order: row.sort_order as number,
      created_at: row.created_at as string
    }))
  }

  /**
   * 创建文件夹
   */
  static async createFolder(payload: CreateFolderPayload): Promise<WritingFolder> {
    const userId = getCurrentUserId()
    const { data, error } = await supabase
      .from('writing_folders')
      .insert({
        user_id: userId,
        name: payload.name,
        sort_order: 0
      })
      .select()
      .single()

    if (error) throw new Error(`创建文件夹失败: ${error.message}`)

    return {
      id: data.id as number,
      user_id: data.user_id as number,
      name: data.name as string,
      sort_order: data.sort_order as number,
      created_at: data.created_at as string
    }
  }

  /**
   * 更新文件夹
   */
  static async updateFolder(id: number, name: string): Promise<WritingFolder> {
    const userId = getCurrentUserId()
    const { data, error } = await supabase
      .from('writing_folders')
      .update({ name })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw new Error(`更新文件夹失败: ${error.message}`)

    return {
      id: data.id as number,
      user_id: data.user_id as number,
      name: data.name as string,
      sort_order: data.sort_order as number,
      created_at: data.created_at as string
    }
  }

  /**
   * 删除文件夹
   * 注意：文件夹下的题目会变为未分类（folder_id = null）
   */
  static async deleteFolder(id: number): Promise<void> {
    const userId = getCurrentUserId()
    const { error } = await supabase
      .from('writing_folders')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw new Error(`删除文件夹失败: ${error.message}`)
  }

  /**
   * 重新排序文件夹
   */
  static async reorderFolders(folderIds: number[]): Promise<void> {
    const userId = getCurrentUserId()

    // 批量更新排序
    const updates = folderIds.map((id, index) => ({
      id,
      user_id: userId,
      sort_order: index
    }))

    for (const update of updates) {
      const { error } = await supabase
        .from('writing_folders')
        .update({ sort_order: update.sort_order })
        .eq('id', update.id)
        .eq('user_id', userId)

      if (error) throw new Error(`重新排序失败: ${error.message}`)
    }
  }

  // ============================================================================
  // 题目管理
  // ============================================================================

  /**
   * 获取所有题目
   */
  static async getPrompts(): Promise<WritingPrompt[]> {
    const userId = getCurrentUserId()
    const { data, error } = await supabase
      .from('writing_prompts')
      .select('*')
      .eq('user_id', userId)
      .order('folder_id', { nullsFirst: false })
      .order('sort_order')
      .order('id')

    if (error) throw new Error(`获取题目失败: ${error.message}`)

    return (data || []).map(row => ({
      id: row.id as number,
      user_id: row.user_id as number,
      folder_id: row.folder_id as number | null,
      task_type: row.task_type as 1 | 2,
      prompt_text: row.prompt_text as string,
      image_url: row.image_url as string | null,
      notes: row.notes as string | null,
      sort_order: row.sort_order as number,
      created_at: row.created_at as string
    }))
  }

  /**
   * 获取特定文件夹下的题目
   */
  static async getPromptsByFolder(folderId: number | null): Promise<WritingPrompt[]> {
    const userId = getCurrentUserId()
    let query = supabase
      .from('writing_prompts')
      .select('*')
      .eq('user_id', userId)

    if (folderId === null) {
      query = query.is('folder_id', null)
    } else {
      query = query.eq('folder_id', folderId)
    }

    const { data, error } = await query
      .order('sort_order')
      .order('id')

    if (error) throw new Error(`获取题目失败: ${error.message}`)

    return (data || []).map(row => ({
      id: row.id as number,
      user_id: row.user_id as number,
      folder_id: row.folder_id as number | null,
      task_type: row.task_type as 1 | 2,
      prompt_text: row.prompt_text as string,
      image_url: row.image_url as string | null,
      notes: row.notes as string | null,
      sort_order: row.sort_order as number,
      created_at: row.created_at as string
    }))
  }

  /**
   * 创建题目
   */
  static async createPrompt(payload: CreatePromptPayload): Promise<WritingPrompt> {
    const userId = getCurrentUserId()

    // 如果有图片，先上传
    let imageUrl: string | null = null
    if (payload.image) {
      imageUrl = await this.uploadImage(payload.image)
    }

    const { data, error } = await supabase
      .from('writing_prompts')
      .insert({
        user_id: userId,
        folder_id: payload.folder_id || null,
        task_type: payload.task_type,
        prompt_text: payload.prompt_text,
        image_url: imageUrl,
        sort_order: 0
      })
      .select()
      .single()

    if (error) {
      // 如果插入失败，清理已上传的图片
      if (imageUrl) {
        await this.deleteImage(imageUrl).catch(() => {})
      }
      throw new Error(`创建题目失败: ${error.message}`)
    }

    return {
      id: data.id as number,
      user_id: data.user_id as number,
      folder_id: data.folder_id as number | null,
      task_type: data.task_type as 1 | 2,
      prompt_text: data.prompt_text as string,
      image_url: data.image_url as string | null,
      notes: data.notes as string | null,
      sort_order: data.sort_order as number,
      created_at: data.created_at as string
    }
  }

  /**
   * 更新题目
   */
  static async updatePrompt(id: number, payload: UpdatePromptPayload): Promise<WritingPrompt> {
    const userId = getCurrentUserId()
    const { data, error } = await supabase
      .from('writing_prompts')
      .update(payload)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw new Error(`更新题目失败: ${error.message}`)

    return {
      id: data.id as number,
      user_id: data.user_id as number,
      folder_id: data.folder_id as number | null,
      task_type: data.task_type as 1 | 2,
      prompt_text: data.prompt_text as string,
      image_url: data.image_url as string | null,
      notes: data.notes as string | null,
      sort_order: data.sort_order as number,
      created_at: data.created_at as string
    }
  }

  /**
   * 更新题目笔记
   */
  static async updatePromptNotes(promptId: number, notes: string): Promise<WritingPrompt> {
    const userId = getCurrentUserId()
    const { data, error } = await supabase
      .from('writing_prompts')
      .update({ notes })
      .eq('id', promptId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw new Error(`更新笔记失败: ${error.message}`)

    return {
      id: data.id as number,
      user_id: data.user_id as number,
      folder_id: data.folder_id as number | null,
      task_type: data.task_type as 1 | 2,
      prompt_text: data.prompt_text as string,
      image_url: data.image_url as string | null,
      notes: data.notes as string | null,
      sort_order: data.sort_order as number,
      created_at: data.created_at as string
    }
  }

  /**
   * 删除题目
   * 注意：会彻底删除关联的所有数据：
   * - 关联的 sessions（会级联删除 versions）
   * - 关联的图片文件
   */
  static async deletePrompt(id: number): Promise<void> {
    const userId = getCurrentUserId()

    // 先获取题目以得到图片 URL
    const { data: prompt } = await supabase
      .from('writing_prompts')
      .select('image_url')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    // 1. 删除关联的 sessions（会级联删除 versions）
    const { error: sessionsError } = await supabase
      .from('writing_sessions')
      .delete()
      .eq('prompt_id', id)
      .eq('user_id', userId)

    if (sessionsError) {
      console.error('删除关联会话失败:', sessionsError.message)
    }

    // 2. 删除图片
    if (prompt?.image_url) {
      await this.deleteImage(prompt.image_url as string).catch(() => {})
    }

    // 3. 删除题目
    const { error } = await supabase
      .from('writing_prompts')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw new Error(`删除题目失败: ${error.message}`)
  }

  /**
   * 移动题目到文件夹
   */
  static async movePrompt(id: number, folderId: number | null): Promise<void> {
    const userId = getCurrentUserId()
    const { error } = await supabase
      .from('writing_prompts')
      .update({ folder_id: folderId })
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw new Error(`移动题目失败: ${error.message}`)
  }

  // ============================================================================
  // 图片上传/删除
  // ============================================================================

  /**
   * 上传图片到 Supabase Storage
   */
  static async uploadImage(file: File): Promise<string> {
    const timestamp = Date.now()
    const extension = file.name.split('.').pop() || 'png'
    const userId = getCurrentUserId()
    const filename = `user_${userId}/image_${timestamp}.${extension}`

    const { error } = await supabase.storage
      .from(IMAGES_BUCKET)
      .upload(filename, file, {
        contentType: file.type || 'image/png',
        upsert: false
      })

    if (error) throw new Error(`上传图片失败: ${error.message}`)

    const { data } = supabase.storage
      .from(IMAGES_BUCKET)
      .getPublicUrl(filename)

    return data.publicUrl
  }

  /**
   * 删除图片
   */
  static async deleteImage(url: string): Promise<void> {
    const filename = this.extractFilename(url)
    if (!filename) return

    const { error } = await supabase.storage
      .from(IMAGES_BUCKET)
      .remove([filename])

    if (error) {
      console.error('删除图片失败:', error.message)
    }
  }

  /**
   * 从 URL 提取文件路径
   */
  private static extractFilename(url: string): string | null {
    if (!url) return null
    try {
      const bucketMarker = `/${IMAGES_BUCKET}/`
      const index = url.indexOf(bucketMarker)
      if (index === -1) return null
      return url.slice(index + bucketMarker.length) || null
    } catch {
      return null
    }
  }

  // ============================================================================
  // 练习会话管理
  // ============================================================================

  /**
   * 获取会话列表
   */
  static async getSessions(promptId?: number): Promise<WritingSession[]> {
    const userId = getCurrentUserId()
    let query = supabase
      .from('writing_sessions')
      .select('*, writing_prompts(*)')
      .eq('user_id', userId)

    if (promptId !== undefined) {
      query = query.eq('prompt_id', promptId)
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })

    if (error) throw new Error(`获取会话失败: ${error.message}`)

    return (data || []).map(row => ({
      id: row.id as number,
      user_id: row.user_id as number,
      prompt_id: row.prompt_id as number | null,
      prompt: row.writing_prompts ? {
        id: row.writing_prompts.id as number,
        user_id: row.writing_prompts.user_id as number,
        folder_id: row.writing_prompts.folder_id as number | null,
        task_type: row.writing_prompts.task_type as 1 | 2,
        prompt_text: row.writing_prompts.prompt_text as string,
        image_url: row.writing_prompts.image_url as string | null,
        notes: row.writing_prompts.notes as string | null,
        sort_order: row.writing_prompts.sort_order as number,
        created_at: row.writing_prompts.created_at as string
      } : undefined,
      time_limit: row.time_limit as number,
      time_spent: row.time_spent as number | null,
      status: row.status as WritingSession['status'],
      created_at: row.created_at as string,
      completed_at: row.completed_at as string | null
    }))
  }

  /**
   * 获取单个会话（含版本）
   */
  static async getSession(id: number): Promise<WritingSession | null> {
    const userId = getCurrentUserId()
    const { data, error } = await supabase
      .from('writing_sessions')
      .select('*, writing_prompts(*), writing_versions(*)')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`获取会话失败: ${error.message}`)
    }

    if (!data) return null

    return {
      id: data.id as number,
      user_id: data.user_id as number,
      prompt_id: data.prompt_id as number | null,
      prompt: data.writing_prompts ? {
        id: data.writing_prompts.id as number,
        user_id: data.writing_prompts.user_id as number,
        folder_id: data.writing_prompts.folder_id as number | null,
        task_type: data.writing_prompts.task_type as 1 | 2,
        prompt_text: data.writing_prompts.prompt_text as string,
        image_url: data.writing_prompts.image_url as string | null,
        notes: data.writing_prompts.notes as string | null,
        sort_order: data.writing_prompts.sort_order as number,
        created_at: data.writing_prompts.created_at as string
      } : undefined,
      time_limit: data.time_limit as number,
      time_spent: data.time_spent as number | null,
      status: data.status as WritingSession['status'],
      created_at: data.created_at as string,
      completed_at: data.completed_at as string | null,
      versions: (data.writing_versions || []).map((v: Record<string, unknown>) => ({
        id: v.id as number,
        session_id: v.session_id as number,
        version_number: v.version_number as 1 | 2,
        content: v.content as string,
        word_count: v.word_count as number | null,
        feedback: v.feedback as WritingFeedback | null,
        scores: v.scores as WritingScores | null,
        created_at: v.created_at as string
      }))
    }
  }

  /**
   * 创建会话
   */
  static async createSession(payload: CreateSessionPayload): Promise<WritingSession> {
    const userId = getCurrentUserId()
    const { data, error } = await supabase
      .from('writing_sessions')
      .insert({
        user_id: userId,
        prompt_id: payload.prompt_id,
        time_limit: payload.time_limit,
        status: 'writing'
      })
      .select('*, writing_prompts(*)')
      .single()

    if (error) throw new Error(`创建会话失败: ${error.message}`)

    return {
      id: data.id as number,
      user_id: data.user_id as number,
      prompt_id: data.prompt_id as number | null,
      prompt: data.writing_prompts ? {
        id: data.writing_prompts.id as number,
        user_id: data.writing_prompts.user_id as number,
        folder_id: data.writing_prompts.folder_id as number | null,
        task_type: data.writing_prompts.task_type as 1 | 2,
        prompt_text: data.writing_prompts.prompt_text as string,
        image_url: data.writing_prompts.image_url as string | null,
        notes: data.writing_prompts.notes as string | null,
        sort_order: data.writing_prompts.sort_order as number,
        created_at: data.writing_prompts.created_at as string
      } : undefined,
      time_limit: data.time_limit as number,
      time_spent: data.time_spent as number | null,
      status: data.status as WritingSession['status'],
      created_at: data.created_at as string,
      completed_at: data.completed_at as string | null
    }
  }

  /**
   * 更新会话
   */
  static async updateSession(id: number, payload: UpdateSessionPayload): Promise<WritingSession> {
    const userId = getCurrentUserId()
    const { data, error } = await supabase
      .from('writing_sessions')
      .update(payload)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*, writing_prompts(*)')
      .single()

    if (error) throw new Error(`更新会话失败: ${error.message}`)

    return {
      id: data.id as number,
      user_id: data.user_id as number,
      prompt_id: data.prompt_id as number | null,
      prompt: data.writing_prompts ? {
        id: data.writing_prompts.id as number,
        user_id: data.writing_prompts.user_id as number,
        folder_id: data.writing_prompts.folder_id as number | null,
        task_type: data.writing_prompts.task_type as 1 | 2,
        prompt_text: data.writing_prompts.prompt_text as string,
        image_url: data.writing_prompts.image_url as string | null,
        notes: data.writing_prompts.notes as string | null,
        sort_order: data.writing_prompts.sort_order as number,
        created_at: data.writing_prompts.created_at as string
      } : undefined,
      time_limit: data.time_limit as number,
      time_spent: data.time_spent as number | null,
      status: data.status as WritingSession['status'],
      created_at: data.created_at as string,
      completed_at: data.completed_at as string | null
    }
  }

  /**
   * 删除会话
   */
  static async deleteSession(id: number): Promise<void> {
    const userId = getCurrentUserId()
    const { error } = await supabase
      .from('writing_sessions')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw new Error(`删除会话失败: ${error.message}`)
  }

  // ============================================================================
  // 作文版本管理
  // ============================================================================

  /**
   * 获取会话的所有版本
   */
  static async getVersions(sessionId: number): Promise<WritingVersion[]> {
    const { data, error } = await supabase
      .from('writing_versions')
      .select('*')
      .eq('session_id', sessionId)
      .order('version_number')

    if (error) throw new Error(`获取版本失败: ${error.message}`)

    return (data || []).map(row => ({
      id: row.id as number,
      session_id: row.session_id as number,
      version_number: row.version_number as 1 | 2,
      content: row.content as string,
      word_count: row.word_count as number | null,
      feedback: row.feedback as WritingFeedback | null,
      scores: row.scores as WritingScores | null,
      created_at: row.created_at as string
    }))
  }

  /**
   * 创建版本
   */
  static async createVersion(payload: CreateVersionPayload): Promise<WritingVersion> {
    const wordCount = payload.word_count ?? this.countWords(payload.content)

    const { data, error } = await supabase
      .from('writing_versions')
      .insert({
        session_id: payload.session_id,
        version_number: payload.version_number,
        content: payload.content,
        word_count: wordCount
      })
      .select()
      .single()

    if (error) throw new Error(`创建版本失败: ${error.message}`)

    return {
      id: data.id as number,
      session_id: data.session_id as number,
      version_number: data.version_number as 1 | 2,
      content: data.content as string,
      word_count: data.word_count as number | null,
      feedback: data.feedback as WritingFeedback | null,
      scores: data.scores as WritingScores | null,
      created_at: data.created_at as string
    }
  }

  /**
   * 更新版本（主要用于存储 AI 反馈和评分）
   */
  static async updateVersion(id: number, payload: UpdateVersionPayload): Promise<WritingVersion> {
    const { data, error } = await supabase
      .from('writing_versions')
      .update(payload)
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(`更新版本失败: ${error.message}`)

    return {
      id: data.id as number,
      session_id: data.session_id as number,
      version_number: data.version_number as 1 | 2,
      content: data.content as string,
      word_count: data.word_count as number | null,
      feedback: data.feedback as WritingFeedback | null,
      scores: data.scores as WritingScores | null,
      created_at: data.created_at as string
    }
  }

  /**
   * 统计单词数
   */
  private static countWords(text: string): number {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length
  }

  // ============================================================================
  // AI 反馈（委托给 writing-ai 服务）
  // ============================================================================

  /**
   * 获取初稿反馈
   */
  static async getInitialFeedback(
    promptText: string,
    essay: string,
    taskType: 1 | 2,
    imageUrl?: string
  ): Promise<WritingFeedback> {
    return getInitialFeedback(promptText, essay, taskType, imageUrl)
  }

  /**
   * 获取问题的具体建议
   */
  static async getIssueSuggestion(
    issue: WritingIssue,
    essayContext: string
  ): Promise<string> {
    return getIssueSuggestion(issue, essayContext)
  }

  /**
   * 获取修订稿反馈
   */
  static async getRevisionFeedback(
    promptText: string,
    originalEssay: string,
    revisedEssay: string,
    taskType: 1 | 2
  ): Promise<WritingFeedback> {
    return getRevisionFeedback(promptText, originalEssay, revisedEssay, taskType)
  }

  /**
   * 获取最终评分
   */
  static async getFinalScores(
    promptText: string,
    finalEssay: string,
    taskType: 1 | 2
  ): Promise<{ feedback: WritingFeedback; scores: WritingScores }> {
    return getFinalScores(promptText, finalEssay, taskType)
  }

  /**
   * 终稿后问答
   */
  static async askQuestion(
    question: string,
    essayContext: string,
    selectedText?: string
  ): Promise<string> {
    return askWritingQuestion(question, essayContext, selectedText)
  }
}
