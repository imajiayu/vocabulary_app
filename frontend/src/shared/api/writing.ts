/**
 * 写作练习相关的 API 接口
 *
 * 全部使用 Supabase 直连，不经过后端
 * - 数据读写：Supabase Database
 * - 文件存储：Supabase Storage (writing-images bucket)
 * - AI 反馈：前端直调 DeepSeek API
 */

import { supabase } from '@/shared/config/supabase'
import { countWords } from '@/shared/utils/text'
import { getCurrentUserId } from '@/shared/composables/useAuth'
import { logger } from '@/shared/utils/logger'
import type {
  WritingFolder,
  WritingPrompt,
  WritingSession,
  WritingScores,
  ParagraphFeedback,
  CreateFolderPayload,
  CreatePromptPayload,
  UpdatePromptPayload,
  CreateSessionPayload,
  UpdateSessionPayload
} from '@/shared/types/writing'
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
      user_id: row.user_id as string,
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
      user_id: data.user_id as string,
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
      user_id: data.user_id as string,
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

    const updates = folderIds.map((id, index) => ({
      id,
      user_id: userId,
      sort_order: index
    }))

    const { error } = await supabase
      .from('writing_folders')
      .upsert(updates, { onConflict: 'id' })

    if (error) throw new Error(`重新排序失败: ${error.message}`)
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
      user_id: row.user_id as string,
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
      user_id: row.user_id as string,
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
      user_id: data.user_id as string,
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
      user_id: data.user_id as string,
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
      user_id: data.user_id as string,
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

    // 1. 删除关联的 sessions
    const { error: sessionsError } = await supabase
      .from('writing_sessions')
      .delete()
      .eq('prompt_id', id)
      .eq('user_id', userId)

    if (sessionsError) {
      logger.error('删除关联会话失败:', sessionsError.message)
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
      logger.error('删除图片失败:', error.message)
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
   * 映射 session 行数据为 WritingSession
   */
  private static mapSession(data: Record<string, unknown>): WritingSession {
    return {
      id: data.id as number,
      user_id: data.user_id as string,
      prompt_id: data.prompt_id as number | null,
      prompt: data.writing_prompts ? {
        id: (data.writing_prompts as Record<string, unknown>).id as number,
        user_id: (data.writing_prompts as Record<string, unknown>).user_id as string,
        folder_id: (data.writing_prompts as Record<string, unknown>).folder_id as number | null,
        task_type: (data.writing_prompts as Record<string, unknown>).task_type as 1 | 2,
        prompt_text: (data.writing_prompts as Record<string, unknown>).prompt_text as string,
        image_url: (data.writing_prompts as Record<string, unknown>).image_url as string | null,
        notes: (data.writing_prompts as Record<string, unknown>).notes as string | null,
        sort_order: (data.writing_prompts as Record<string, unknown>).sort_order as number,
        created_at: (data.writing_prompts as Record<string, unknown>).created_at as string
      } : undefined,
      time_limit: data.time_limit as number,
      time_spent: data.time_spent as number | null,
      status: data.status as WritingSession['status'],
      outline: data.outline as string | null,
      draft_content: data.draft_content as string | null,
      final_content: data.final_content as string | null,
      feedback: data.feedback as ParagraphFeedback[] | null,
      scores: data.scores as WritingScores | null,
      word_count: data.word_count as number | null,
      created_at: data.created_at as string,
      completed_at: data.completed_at as string | null
    }
  }

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

    return (data || []).map(row => this.mapSession(row as Record<string, unknown>))
  }

  /**
   * 获取单个会话
   */
  static async getSession(id: number): Promise<WritingSession | null> {
    const userId = getCurrentUserId()
    const { data, error } = await supabase
      .from('writing_sessions')
      .select('*, writing_prompts(*)')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null
      throw new Error(`获取会话失败: ${error.message}`)
    }

    if (!data) return null

    return this.mapSession(data as Record<string, unknown>)
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
        status: 'outline'
      })
      .select('*, writing_prompts(*)')
      .single()

    if (error) throw new Error(`创建会话失败: ${error.message}`)

    return this.mapSession(data as Record<string, unknown>)
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

    return this.mapSession(data as Record<string, unknown>)
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

  /**
   * 统计单词数
   */
  static countWords(text: string): number {
    return countWords(text)
  }

}
