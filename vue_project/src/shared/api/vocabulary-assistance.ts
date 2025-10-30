/**
 * 词汇学习助手相关的API接口
 */

import { post } from './client'

// 词汇助手消息参数接口
export interface VocabularyAssistanceMessagePayload {
  message: string
  word?: string
  definition?: string
}

// 词汇助手响应接口
export interface VocabularyAssistanceResponse {
  response: string
}

/**
 * 词汇学习助手API类
 */
export class VocabularyAssistanceApi {
  /**
   * 发送消息到词汇助手
   * @param payload 消息数据
   * @returns AI响应
   */
  static async sendMessage(payload: VocabularyAssistanceMessagePayload): Promise<VocabularyAssistanceResponse> {
    return post<VocabularyAssistanceResponse>('/api/vocabulary-assistance/message', payload)
  }
}
