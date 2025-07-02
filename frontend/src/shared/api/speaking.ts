/**
 * 口语练习相关的 API 接口
 *
 * 全部使用 Supabase 直连，不经过后端
 * - 数据读写：Supabase Database
 * - 文件存储：Supabase Storage
 * - AI 反馈：前端直调 DeepSeek API
 */

import { supabase } from '@/shared/config/supabase'
import { uploadAudio, deleteAudio } from '@/shared/services/supabase-storage'
import { getSpeakingFeedback } from '@/shared/services/speaking-ai'
import { getCurrentUserId } from '@/shared/composables/useAuth'
import type { TopicGroup, Question, SpeakingRecord } from '@/shared/types'

// 创建记录参数接口
export interface CreateRecordPayload {
  question_id: number
  user_answer: string
  audio_file: File
  ai_feedback?: string
  score?: number
}

// AI 反馈响应接口
export interface AiFeedbackResponse {
  chineseFeedback: string
  improvedEnglish: string
  score: number
}

/**
 * 口语练习 API 类
 */
export class SpeakingApi {
  // ============================================================================
  // 内部工具
  // ============================================================================

  /**
   * 分页获取所有音频文件 URL（绕过 PostgREST 1000 行限制）
   */
  private static async fetchAllAudioFiles(
    filters: { questionIds?: number[]; questionId?: number; userId: string }
  ): Promise<string[]> {
    const PAGE_SIZE = 1000
    const audioFiles: string[] = []
    let offset = 0
    while (true) {
      let query = supabase
        .from('speaking_records')
        .select('audio_file')
        .eq('user_id', filters.userId)
        .range(offset, offset + PAGE_SIZE - 1)

      if (filters.questionIds) {
        query = query.in('question_id', filters.questionIds)
      } else if (filters.questionId !== undefined) {
        query = query.eq('question_id', filters.questionId)
      }

      const { data, error } = await query
      if (error) throw new Error(error.message)
      if (!data || data.length === 0) break
      for (const r of data) {
        if (r.audio_file) audioFiles.push(r.audio_file as string)
      }
      if (data.length < PAGE_SIZE) break
      offset += PAGE_SIZE
    }
    return audioFiles
  }

  // ============================================================================
  // 记录管理（含音频上传/删除）
  // ============================================================================

  /**
   * 创建练习记录
   * 1. 上传音频到 Supabase Storage
   * 2. 写入记录到 Supabase Database
   */
  static async createRecord(recordData: CreateRecordPayload): Promise<SpeakingRecord> {
    // 1. 上传音频文件
    const audioUrl = await uploadAudio(recordData.audio_file)
    const userId = getCurrentUserId()

    // 2. 写入数据库（带用户ID）
    const { data, error } = await supabase
      .from('speaking_records')
      .insert({
        user_id: userId,
        question_id: recordData.question_id,
        user_answer: recordData.user_answer,
        audio_file: audioUrl,
        ai_feedback: recordData.ai_feedback || '',
        score: recordData.score || 0
      })
      .select()
      .single()

    if (error) {
      // 如果写入失败，尝试清理已上传的音频
      await deleteAudio(audioUrl).catch(() => {})
      throw new Error(`创建记录失败: ${error.message}`)
    }

    return {
      id: data.id as number,
      question_id: data.question_id as number,
      user_answer: data.user_answer as string,
      audio_file: data.audio_file as string,
      ai_feedback: data.ai_feedback as string,
      score: Number(data.score) || 0,
      created_at: data.created_at as string
    }
  }

  /**
   * 删除练习记录（同时删除音频文件）
   */
  static async deleteRecordDirect(recordId: number): Promise<void> {
    const userId = getCurrentUserId()
    // 1. 先获取记录以得到音频 URL（带用户ID过滤）
    const { data: record, error: fetchError } = await supabase
      .from('speaking_records')
      .select('audio_file')
      .eq('id', recordId)
      .eq('user_id', userId)
      .single()

    if (fetchError) {
      throw new Error(`获取记录失败: ${fetchError.message}`)
    }

    // 2. 删除音频文件
    if (record?.audio_file) {
      await deleteAudio(record.audio_file as string)
    }

    // 3. 删除数据库记录
    const { error } = await supabase
      .from('speaking_records')
      .delete()
      .eq('id', recordId)
      .eq('user_id', userId)

    if (error) throw new Error(error.message)
  }

  // ============================================================================
  // AI 反馈（前端直调 DeepSeek）
  // ============================================================================

  /**
   * 获取 AI 反馈
   */
  static async getAiFeedback(
    questionText: string,
    userAnswer: string,
    topicTitle?: string,
    part?: number
  ): Promise<AiFeedbackResponse> {
    const result = await getSpeakingFeedback(questionText, userAnswer, topicTitle, part)
    return {
      chineseFeedback: result.chineseFeedback,
      improvedEnglish: result.improvedEnglish,
      score: result.score
    }
  }

  // ============================================================================
  // 话题和问题管理
  // ============================================================================

  /**
   * 获取话题列表（含嵌套问题）
   */
  static async getTopicsDirect(): Promise<TopicGroup[]> {
    const userId = getCurrentUserId()
    const { data, error } = await supabase
      .from('speaking_topics')
      .select('*, speaking_questions(*)')
      .eq('user_id', userId)
      .order('part')
      .order('id')

    if (error) throw new Error(error.message)

    return (data || []).map(topic => ({
      id: topic.id as number,
      title: topic.title as string,
      part: topic.part as number,
      questions: (topic.speaking_questions || []).map((q: Record<string, unknown>) => ({
        id: q.id as number,
        question_text: q.question_text as string,
        topic_id: topic.id as number,
        topic_title: topic.title as string,
        part: topic.part as number
      }))
    }))
  }

  /**
   * 获取问题的练习记录
   */
  static async getRecordsDirect(questionId: number): Promise<{ records: SpeakingRecord[]; total: number }> {
    const userId = getCurrentUserId()
    const { data, error, count } = await supabase
      .from('speaking_records')
      .select('*', { count: 'exact' })
      .eq('question_id', questionId)
      .eq('user_id', userId)
      .order('id')

    if (error) throw new Error(error.message)

    const records = (data || []).map(row => ({
      id: row.id as number,
      question_id: row.question_id as number,
      user_answer: row.user_answer as string,
      audio_file: row.audio_file as string,
      ai_feedback: row.ai_feedback as string,
      score: Number(row.score) || 0,
      created_at: row.created_at as string
    }))

    return {
      records,
      total: count || records.length
    }
  }

  /**
   * 创建新话题
   */
  static async createTopicDirect(data: { part: number; title: string }): Promise<TopicGroup> {
    const userId = getCurrentUserId()
    const { data: topic, error } = await supabase
      .from('speaking_topics')
      .insert({ part: data.part, title: data.title, user_id: userId })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return { ...topic, questions: [] } as TopicGroup
  }

  /**
   * 更新话题标题
   */
  static async updateTopicDirect(topicId: number, data: { title: string }): Promise<TopicGroup> {
    const userId = getCurrentUserId()
    const { data: topic, error } = await supabase
      .from('speaking_topics')
      .update({ title: data.title })
      .eq('id', topicId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return { ...topic, questions: [] } as TopicGroup
  }

  /**
   * 删除话题
   * 注意：DB 会级联删除问题和记录，但需要手动清理 Storage 中的音频
   */
  static async deleteTopicDirect(topicId: number): Promise<void> {
    const userId = getCurrentUserId()
    // 1. 获取该话题下所有记录的音频 URL
    const { data: questions } = await supabase
      .from('speaking_questions')
      .select('id')
      .eq('topic_id', topicId)
      .eq('user_id', userId)

    if (questions && questions.length > 0) {
      const questionIds = questions.map(q => q.id as number)
      const audioFiles = await this.fetchAllAudioFiles({ questionIds, userId })

      // 2. 删除所有音频文件
      if (audioFiles.length > 0) {
        await Promise.all(audioFiles.map(url => deleteAudio(url).catch(() => {})))
      }
    }

    // 3. 删除话题（DB 级联删除问题和记录）
    const { error } = await supabase
      .from('speaking_topics')
      .delete()
      .eq('id', topicId)
      .eq('user_id', userId)

    if (error) throw new Error(error.message)
  }

  /**
   * 创建新问题
   */
  static async createQuestionDirect(data: { topic_id: number; question_text: string }): Promise<Question> {
    const userId = getCurrentUserId()
    const { data: question, error } = await supabase
      .from('speaking_questions')
      .insert({ topic_id: data.topic_id, question_text: data.question_text, user_id: userId })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return question as Question
  }

  /**
   * 更新问题文本
   */
  static async updateQuestionDirect(questionId: number, data: { question_text: string }): Promise<Question> {
    const userId = getCurrentUserId()
    const { data: question, error } = await supabase
      .from('speaking_questions')
      .update({ question_text: data.question_text })
      .eq('id', questionId)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) throw new Error(error.message)
    return question as Question
  }

  /**
   * 删除问题
   * 注意：DB 会级联删除记录，但需要手动清理 Storage 中的音频
   */
  static async deleteQuestionDirect(questionId: number): Promise<void> {
    // 1. 获取该问题下所有记录的音频 URL
    const userId = getCurrentUserId()
    const audioFiles = await this.fetchAllAudioFiles({ questionId, userId })

    // 2. 删除所有音频文件
    if (audioFiles.length > 0) {
      await Promise.all(audioFiles.map(url => deleteAudio(url).catch(() => {})))
    }

    // 3. 删除问题（DB 级联删除记录）
    const { error } = await supabase
      .from('speaking_questions')
      .delete()
      .eq('id', questionId)
      .eq('user_id', userId)

    if (error) throw new Error(error.message)
  }

  // ============================================================================
  // 批量操作
  // ============================================================================

  /**
   * 批量导入题目
   * @param topicsData 解析后的题目数据
   * @param part 1 或 2
   */
  static async importQuestions(
    topicsData: Array<{ title: string; questions: string[] }>,
    part: 1 | 2
  ): Promise<{ topics_count: number; questions_count: number }> {
    // 1. upsert 所有主题，重复的自动跳过（依赖 UNIQUE(user_id, part, title) 约束）
    const userId = getCurrentUserId()
    const { data: upsertedTopics, error: topicError } = await supabase
      .from('speaking_topics')
      .upsert(
        topicsData.map(t => ({ part, title: t.title, user_id: userId })),
        { onConflict: 'user_id,part,title', ignoreDuplicates: true }
      )
      .select('id, title')

    if (topicError) {
      throw new Error(`创建主题失败: ${topicError.message}`)
    }

    // ignoreDuplicates 时 .select() 只返回新插入的行
    const insertedTopics = upsertedTopics || []
    if (insertedTopics.length === 0) {
      return { topics_count: 0, questions_count: 0 }
    }

    // 2. 建立 title → id 映射，一次性批量插入所有问题
    const titleToId = new Map(insertedTopics.map(t => [t.title as string, t.id as number]))
    const allQuestions: Array<{ topic_id: number; question_text: string; user_id: string }> = []

    for (const { title, questions } of topicsData) {
      const topicId = titleToId.get(title)
      if (!topicId) continue
      for (const q of questions) {
        allQuestions.push({ topic_id: topicId, question_text: q, user_id: userId })
      }
    }

    if (allQuestions.length > 0) {
      const { error: questionsError } = await supabase
        .from('speaking_questions')
        .insert(allQuestions)

      if (questionsError) {
        throw new Error(`创建问题失败: ${questionsError.message}`)
      }
    }

    return { topics_count: insertedTopics.length, questions_count: allQuestions.length }
  }

  /**
   * 清除所有口语数据：音频文件、记录、问题、主题
   * 删除 speaking_topics 会级联删除 questions 和 records
   */
  static async clearAllData(): Promise<void> {
    const userId = getCurrentUserId()

    // 1. 获取所有音频 URL（需在级联删除前获取）
    const audioFiles = await this.fetchAllAudioFiles({ userId })

    // 2. 删除音频文件
    if (audioFiles.length > 0) {
      await Promise.all(audioFiles.map(url => deleteAudio(url).catch(() => {})))
    }

    // 3. 删除所有主题（CASCADE 自动清除 questions → records）
    // RLS limits scope to current user; .eq filter as defense-in-depth
    const { error } = await supabase
      .from('speaking_topics')
      .delete()
      .eq('user_id', userId)

    if (error) throw new Error(error.message)
  }
}
