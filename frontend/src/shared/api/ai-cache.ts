/**
 * AI Prompt Cache — 共享缓存层
 * 缓存固定 AI 提示按钮的 DeepSeek 响应，所有用户共享
 */

import { supabase } from '@/shared/config/supabase'
import { logger } from '@/shared/utils/logger'

const log = logger.create('AiCacheApi')

export type PromptType = 'collocation' | 'sentence' | 'memory' | 'synonym_antonym'

// 第 1 层：精确匹配（按钮触发的固定文本）
const EXACT_MATCHES: Record<string, PromptType> = {
  '这个词有哪些常用搭配？': 'collocation',
  '如何用这个词造句？': 'sentence',
  '有什么好的记忆方法？': 'memory',
  '它的同义词和反义词是什么？': 'synonym_antonym',
}

// 第 2 层：单意图关键词匹配
const KEYWORD_MAP: Record<PromptType, string[]> = {
  collocation: ['搭配', '用法'],
  sentence: ['造句', '例句'],
  memory: ['怎么记', '记忆', '记住'],
  synonym_antonym: ['同义', '反义', '近义', '区别', '辨析'],
}

export class AiCacheApi {
  /**
   * 检测消息对应的 prompt type
   * 精确匹配 → 关键词匹配（带歧义保护）→ null
   */
  static detectPromptType(message: string): PromptType | null {
    // 第 1 层：精确匹配
    const exact = EXACT_MATCHES[message]
    if (exact) return exact

    // 第 2 层：关键词扫描，收集所有命中的 prompt type
    const matchedTypes = new Set<PromptType>()
    for (const [type, keywords] of Object.entries(KEYWORD_MAP) as [PromptType, string[]][]) {
      for (const kw of keywords) {
        if (message.includes(kw)) {
          matchedTypes.add(type)
          break // 同一类型不需要继续扫描
        }
      }
    }

    // 歧义保护：只有唯一命中才走缓存
    if (matchedTypes.size === 1) return [...matchedTypes][0]
    return null
  }

  /**
   * 标准化 word（trim + lowercase）
   */
  private static normalizeWord(word: string): string {
    return word.trim().toLowerCase()
  }

  /**
   * 查询缓存
   * 命中 → 返回 response 文本；未命中或错误 → null
   */
  static async getCached(word: string, promptType: PromptType): Promise<string | null> {
    const normalized = this.normalizeWord(word)

    const { data, error } = await supabase
      .from('ai_prompt_cache')
      .select('response')
      .eq('word', normalized)
      .eq('prompt_type', promptType)
      .maybeSingle()

    if (error) {
      log.error('缓存查询失败:', error)
      return null
    }

    return data?.response ?? null
  }

  /**
   * 写入缓存（fire-and-forget 场景，错误仅 log）
   * ignoreDuplicates 处理竞态：第一个写入赢
   */
  static async saveToCache(word: string, promptType: PromptType, response: string): Promise<void> {
    const normalized = this.normalizeWord(word)

    const { error } = await supabase
      .from('ai_prompt_cache')
      .upsert(
        { word: normalized, prompt_type: promptType, response },
        { onConflict: 'word,prompt_type', ignoreDuplicates: true }
      )

    if (error) {
      log.error('缓存写入失败:', error)
    }
  }
}
