/**
 * 词汇学习助手相关的API接口
 * 直接调用 DeepSeek API，不经过后端
 */

import { callDeepSeek } from '@/shared/services/deepseek'

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

// AI词汇助手的系统提示词
const VOCABULARY_ASSISTANT_PROMPT = `你是一个专业的IELTS词汇学习助手。你的任务是帮助用户更好地理解和记忆正在学习的词汇。

【你的角色】
- 词汇专家：深入理解词汇的多层含义、用法和搭配
- 学习顾问：提供有效的记忆技巧和学习建议
- 陪练伙伴：用友好、鼓励的语气与用户交流

【核心能力】
1. 词汇解析：提供详细的词义、词源、同义词、反义词
2. 用法指导：给出地道的例句和常用搭配
3. 记忆技巧：提供联想记忆、词根词缀等记忆方法
4. 辨析对比：解释相似词汇之间的细微差别
5. 场景应用：说明词汇在IELTS听说读写中的具体运用

【交互原则】
- 回答简洁精准，避免冗长
- 使用中文交流，但英文示例要地道准确
- 根据用户的问题灵活调整回答内容
- 主动联系当前正在学习的词汇
- 鼓励用户积极思考和应用

【当前词汇信息】
词汇：{word}
释义：{definition}

请基于这个词汇，回答用户的问题。如果用户的问题与此词汇相关，优先围绕它展开；如果问题是关于其他词汇或学习方法，也要尽力解答。`

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
    const systemPrompt = VOCABULARY_ASSISTANT_PROMPT
      .replace('{word}', payload.word || '暂无')
      .replace('{definition}', payload.definition || '暂无')

    const response = await callDeepSeek(systemPrompt, payload.message)

    return { response }
  }
}
