/**
 * 词汇学习助手相关的API接口
 * 通过 Flask /api/ai/chat 调用上游 LLM
 *
 * Prompt 维护在 shared/prompts/vocabulary-assistance.ts
 */

import type { SourceLang } from '@/shared/types'
import { callAI } from '@/shared/services/ai'
import { VOCABULARY_ASSISTANCE_PROMPTS } from '@/shared/prompts/vocabulary-assistance'
import { AiCacheApi } from './ai-cache'

// 词汇助手消息参数接口
export interface VocabularyAssistanceMessagePayload {
  message: string
  word?: string
  definition?: string
  lang?: SourceLang
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
    // 缓存查询：检测 prompt type + 查缓存
    const promptType = AiCacheApi.detectPromptType(payload.message)
    if (promptType && payload.word) {
      const cached = await AiCacheApi.getCached(payload.word, promptType)
      if (cached) return { response: cached }
    }

    const promptTemplate = VOCABULARY_ASSISTANCE_PROMPTS[payload.lang ?? 'en']
    const systemPrompt = promptTemplate
      .replace('{word}', payload.word || '暂无')
      .replace('{definition}', payload.definition || '暂无')

    const response = await callAI(systemPrompt, payload.message, [], { caller: 'vocab_assist' })

    // Fire-and-forget 写入缓存
    if (promptType && payload.word) {
      AiCacheApi.saveToCache(payload.word, promptType, response)
    }

    return { response }
  }
}
