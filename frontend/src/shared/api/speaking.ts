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
import { getCurrentUserId } from '@/shared/composables/useUserSelection'
import type { TopicGroup, Question, SpeakingRecord } from '@/shared/types'

// 创建记录参数接口
export interface CreateRecordPayload {
  question_id: number
  user_answer: string
  audio_file: File
  ai_feedback?: string
  score?: number
}

// AI 反馈响应接口（保持兼容）
export interface AiFeedbackResponse {
  feedback: string
  score: number
}

/**
 * 口语练习 API 类
 */
export class SpeakingApi {
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
    topicTitle?: string
  ): Promise<AiFeedbackResponse> {
    const result = await getSpeakingFeedback(questionText, userAnswer, topicTitle)
    return {
      feedback: result.feedback,
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
    const { data, error } = await supabase
      .from('speaking_topics')
      .select('*, speaking_questions(*)')
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
        topic_title: topic.title as string
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
    const { data: topic, error } = await supabase
      .from('speaking_topics')
      .insert({ part: data.part, title: data.title })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return { ...topic, questions: [] } as TopicGroup
  }

  /**
   * 更新话题标题
   */
  static async updateTopicDirect(topicId: number, data: { title: string }): Promise<TopicGroup> {
    const { data: topic, error } = await supabase
      .from('speaking_topics')
      .update({ title: data.title })
      .eq('id', topicId)
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
    // 1. 获取该话题下所有记录的音频 URL
    const { data: questions } = await supabase
      .from('speaking_questions')
      .select('id')
      .eq('topic_id', topicId)

    if (questions && questions.length > 0) {
      const questionIds = questions.map(q => q.id)
      const userId = getCurrentUserId()
      const { data: records } = await supabase
        .from('speaking_records')
        .select('audio_file')
        .in('question_id', questionIds)
        .eq('user_id', userId)

      // 2. 删除所有音频文件
      if (records) {
        await Promise.all(
          records
            .filter(r => r.audio_file)
            .map(r => deleteAudio(r.audio_file as string).catch(() => {}))
        )
      }
    }

    // 3. 删除话题（DB 级联删除问题和记录）
    const { error } = await supabase
      .from('speaking_topics')
      .delete()
      .eq('id', topicId)

    if (error) throw new Error(error.message)
  }

  /**
   * 创建新问题
   */
  static async createQuestionDirect(data: { topic_id: number; question_text: string }): Promise<Question> {
    const { data: question, error } = await supabase
      .from('speaking_questions')
      .insert({ topic_id: data.topic_id, question_text: data.question_text })
      .select()
      .single()

    if (error) throw new Error(error.message)
    return question as Question
  }

  /**
   * 更新问题文本
   */
  static async updateQuestionDirect(questionId: number, data: { question_text: string }): Promise<Question> {
    const { data: question, error } = await supabase
      .from('speaking_questions')
      .update({ question_text: data.question_text })
      .eq('id', questionId)
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
    const { data: records } = await supabase
      .from('speaking_records')
      .select('audio_file')
      .eq('question_id', questionId)
      .eq('user_id', userId)

    // 2. 删除所有音频文件
    if (records) {
      await Promise.all(
        records
          .filter(r => r.audio_file)
          .map(r => deleteAudio(r.audio_file as string).catch(() => {}))
      )
    }

    // 3. 删除问题（DB 级联删除记录）
    const { error } = await supabase
      .from('speaking_questions')
      .delete()
      .eq('id', questionId)

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
    let topicsCount = 0
    let questionsCount = 0

    for (const { title, questions } of topicsData) {
      // 检查主题是否已存在
      const { data: existing } = await supabase
        .from('speaking_topics')
        .select('id')
        .eq('title', title)
        .eq('part', part)
        .single()

      if (existing) {
        // 主题已存在，跳过
        continue
      }

      // 创建新主题
      const { data: newTopic, error: topicError } = await supabase
        .from('speaking_topics')
        .insert({ part, title })
        .select()
        .single()

      if (topicError || !newTopic) {
        console.error('创建主题失败:', topicError)
        continue
      }

      topicsCount++

      // 批量插入问题
      if (questions.length > 0) {
        const questionsToInsert = questions.map(q => ({
          topic_id: newTopic.id,
          question_text: q
        }))

        const { error: questionsError } = await supabase
          .from('speaking_questions')
          .insert(questionsToInsert)

        if (!questionsError) {
          questionsCount += questions.length
        }
      }
    }

    return { topics_count: topicsCount, questions_count: questionsCount }
  }

  /**
   * 清除当前用户的口语记录和音频
   * 注意：话题和问题是共享内容，不会删除
   */
  static async clearAllData(): Promise<void> {
    const userId = getCurrentUserId()

    // 1. 获取当前用户所有记录的音频 URL
    const { data: records } = await supabase
      .from('speaking_records')
      .select('audio_file')
      .eq('user_id', userId)

    // 2. 删除所有音频文件
    if (records) {
      await Promise.all(
        records
          .filter(r => r.audio_file)
          .map(r => deleteAudio(r.audio_file as string).catch(() => {}))
      )
    }

    // 3. 删除当前用户的所有记录
    const { error } = await supabase
      .from('speaking_records')
      .delete()
      .eq('user_id', userId)

    if (error) throw new Error(error.message)
  }
}

// 导出便捷方法
export const speakingApi = SpeakingApi
