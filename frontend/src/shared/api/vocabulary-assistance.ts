/**
 * 词汇学习助手相关的API接口
 * 通过 Edge Function ai-proxy 调用上游 LLM
 */

import type { SourceLang } from '@/shared/types'
import { callAI } from '@/shared/services/ai'
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

// IELTS 英语词汇助手系统提示词
const EN_PROMPT = `你是 IELTS 词汇学习助手，帮助用户理解和记忆词汇。

【当前词汇】
词汇：{word}
释义：{definition}

【响应规则】
1. 用中文解释，英文部分保持地道准确
2. 简洁直接，每个要点不超过两句话
3. 围绕当前词汇展开，但也可回答其他词汇问题

【按问题类型响应】
- 问"怎么用/用法/搭配"→ 给3个典型搭配 + 1个例句
- 问"怎么记/记忆"→ 给1个最有效的记忆法（词根拆解/联想/谐音）
- 问"区别/辨析"→ 核心差异 + 各一个对比例句
- 问"造句/例句"→ 2-3个不同场景的地道例句
- 问"同义词/反义词"→ 列出词汇并简述差异
- 其他问题 → 直接简洁回答

【格式要求】
- 不要加开场白和结束语
- 例句用「」包裹，重点词用加粗
- 多个要点用数字列表`

// 乌克兰语词汇助手系统提示词
const UK_PROMPT = `你是乌克兰语词汇学习助手，帮助中文母语用户理解和记忆乌克兰语词汇。

【当前词汇】
词汇：{word}
释义：{definition}

【响应规则】
1. 用中文解释，乌克兰语部分保持准确并标注重音
2. 简洁直接，每个要点不超过两句话
3. 围绕当前词汇展开，但也可回答其他词汇问题

【按问题类型响应】
- 问"怎么用/用法/搭配"→ 给3个典型搭配 + 1个例句（乌中双语）
- 问"怎么记/记忆"→ 给1个最有效的记忆法（词源联想/音近联想/形态分析）
- 问"区别/辨析"→ 核心差异 + 各一个对比例句
- 问"造句/例句"→ 2-3个不同场景的例句（乌中双语）
- 问"同义词/反义词"→ 列出词汇并简述差异
- 问"变格/变位/语法"→ 给出关键变化形式和用法说明
- 其他问题 → 直接简洁回答

【格式要求】
- 不要加开场白和结束语
- 例句用「」包裹，重点词用加粗
- 多个要点用数字列表`

const PROMPTS: Record<SourceLang, string> = {
  en: EN_PROMPT,
  uk: UK_PROMPT,
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

    const promptTemplate = PROMPTS[payload.lang ?? 'en']
    const systemPrompt = promptTemplate
      .replace('{word}', payload.word || '暂无')
      .replace('{definition}', payload.definition || '暂无')

    const response = await callAI(systemPrompt, payload.message)

    // Fire-and-forget 写入缓存
    if (promptType && payload.word) {
      AiCacheApi.saveToCache(payload.word, promptType, response)
    }

    return { response }
  }
}
