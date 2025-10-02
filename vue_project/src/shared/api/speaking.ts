/**
 * 口语练习相关的API接口
 */

import { get, post, put, patch, del } from './client'
import type { TopicGroup, Question, SpeakingRecord, PartGroup } from '@/shared/types'

// 话题创建参数接口
export interface CreateTopicPayload {
  title: string
  part: number
}

// 话题更新参数接口
export interface UpdateTopicPayload {
  title?: string
  part?: number
}

// 问题创建参数接口
export interface CreateQuestionPayload {
  question_text: string
  topic_id: number
}

// 问题更新参数接口
export interface UpdateQuestionPayload {
  question_text?: string
  topic_id?: number
}

// 语音转文字响应接口
export interface SpeechToTextResponse {
  text: string
  success: boolean
  error?: string
}

// AI反馈响应接口
export interface AiFeedbackResponse {
  feedback: string
  score: number
  success: boolean
  error?: string
}

// 创建记录参数接口
export interface CreateRecordPayload {
  question_id: number
  user_answer: string
  audio_file: File
  ai_feedback?: string
  score?: number
}

// 获取记录响应接口
export interface GetRecordsResponse {
  records: SpeakingRecord[]
  total: number
}

/**
 * 口语练习API类
 */
export class SpeakingApi {
  /**
   * 获取话题列表
   */
  static async getTopics(): Promise<TopicGroup[]> {
    return get<TopicGroup[]>('/api/speaking/topics')
  }

  /**
   * 创建新话题
   */
  static async createTopic(topicData: CreateTopicPayload): Promise<TopicGroup> {
    return post<TopicGroup>('/api/speaking/topics', topicData)
  }

  /**
   * 更新话题
   */
  static async updateTopic(topicId: number, topicData: UpdateTopicPayload): Promise<TopicGroup> {
    return patch<TopicGroup>(`/api/speaking/topics/${topicId}`, topicData)
  }

  /**
   * 删除话题
   */
  static async deleteTopic(topicId: number): Promise<void> {
    return del<void>(`/api/speaking/topics/${topicId}`)
  }

  /**
   * 获取问题列表
   */
  static async getQuestions(topicId?: number): Promise<Question[]> {
    const url = topicId
      ? `/api/speaking/questions?topic_id=${topicId}`
      : '/api/speaking/questions'
    return get<Question[]>(url)
  }

  /**
   * 创建新问题
   */
  static async createQuestion(questionData: CreateQuestionPayload): Promise<Question> {
    return post<Question>('/api/speaking/questions', questionData)
  }

  /**
   * 更新问题
   */
  static async updateQuestion(questionId: number, questionData: UpdateQuestionPayload): Promise<Question> {
    return patch<Question>(`/api/speaking/questions/${questionId}`, questionData)
  }

  /**
   * 删除问题
   */
  static async deleteQuestion(questionId: number): Promise<void> {
    return del<void>(`/api/speaking/questions/${questionId}`)
  }

  /**
   * 获取问题的练习记录
   */
  static async getRecords(questionId: number): Promise<GetRecordsResponse> {
    return get<GetRecordsResponse>(`/api/speaking/records/${questionId}`)
  }

  /**
   * 创建练习记录
   */
  static async createRecord(recordData: CreateRecordPayload): Promise<SpeakingRecord> {
    const formData = new FormData()
    formData.append('question_id', String(recordData.question_id))
    formData.append('user_answer', recordData.user_answer)
    formData.append('audio_file', recordData.audio_file)

    if (recordData.ai_feedback) {
      formData.append('ai_feedback', recordData.ai_feedback)
    }

    if (recordData.score !== undefined) {
      formData.append('score', String(recordData.score))
    }

    return post<SpeakingRecord>('/api/speaking/records', formData)
  }

  /**
   * 删除练习记录
   */
  static async deleteRecord(recordId: number): Promise<void> {
    return del<void>(`/api/speaking/records/${recordId}`)
  }

  /**
   * 语音转文字
   */
  static async speechToText(audioFile: File): Promise<SpeechToTextResponse> {
    const formData = new FormData()
    formData.append('audio', audioFile)

    return post<SpeechToTextResponse>('/api/speaking/speech-to-text', formData)
  }

  /**
   * 获取AI反馈
   */
  static async getAiFeedback(questionText: string, userAnswer: string, topicTitle?: string): Promise<AiFeedbackResponse> {
    return post<AiFeedbackResponse>('/api/speaking/ai-feedback', {
      question_text: questionText,
      user_answer: userAnswer,
      topic_title: topicTitle
    })
  }

  /**
   * 批量导入问题
   */
  static async importQuestions(topicId: number, questions: string[]): Promise<Question[]> {
    return post<Question[]>(`/api/speaking/topics/${topicId}/import-questions`, {
      questions
    })
  }

  /**
   * 获取练习统计数据
   */
  static async getPracticeStats(): Promise<{
    total_records: number
    total_questions: number
    avg_score: number
    recent_activity: any[]
  }> {
    return get('/api/speaking/stats')
  }
}

// 导出便捷方法
export const speakingApi = SpeakingApi