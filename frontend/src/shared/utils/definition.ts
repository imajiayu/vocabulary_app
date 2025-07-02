/**
 * 释义加粗工具函数
 * 移植自 backend/services/vocabulary_service.py
 */
import type { DefinitionObject } from '@/shared/types'

/**
 * 在句子中将目标单词加粗（包裹 <strong> 标签）
 * 忽略大小写，匹配单词边界，跳过已加粗的部分
 */
export function boldWordInSentence(sentence: string, word: string): string {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`(?<!<strong>)\\b(${escaped})\\b(?!<\\/strong>)`, 'gi')
  return sentence.replace(pattern, '<strong>$1</strong>')
}

/**
 * 对释义对象中的所有例句应用加粗
 * 返回新对象，不修改原对象
 */
export function applyBoldToDefinition(def: DefinitionObject, word: string): DefinitionObject {
  if (!def.examples?.length) return def

  return {
    ...def,
    examples: def.examples.map(example => ({
      ...example,
      en: boldWordInSentence(example.en, word)
    }))
  }
}

/**
 * 移除释义对象中所有例句的 <strong> 标签
 * 用于编辑模式下让用户看到纯文本，保存时再重新加粗
 */
export function stripBoldFromDefinition(def: DefinitionObject): DefinitionObject {
  if (!def.examples?.length) return def
  return {
    ...def,
    examples: def.examples.map(example => ({
      ...example,
      en: example.en.replace(/<\/?strong>/gi, '')
    }))
  }
}
