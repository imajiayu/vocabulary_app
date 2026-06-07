/**
 * 释义加粗工具函数
 * 移植自 backend/services/vocabulary_service.py
 */
import type { DefinitionObject } from '@/shared/types'

/**
 * Edge Function (fetch-definition) 在词典查不到时塞入的占位释义
 * 与 supabase/functions/fetch-definition/index.ts 中的字符串保持一致
 */
export const NO_DEFINITION_PLACEHOLDER = '暂无释义'

/**
 * 判断释义是否"实质为空"——需要走 AI 兜底
 * 命中：definitions 缺失 / 空数组 / 全是空白 / 仅有占位符 "暂无释义"
 * 词典对长短语或生僻词常返回占位符并以 success:true 返回，故不能只靠 success 判断
 */
export function isDefinitionEmpty(def: DefinitionObject | null | undefined): boolean {
  if (!def?.definitions?.length) return true
  return def.definitions.every(d => {
    const text = d?.trim() ?? ''
    return text === '' || text === NO_DEFINITION_PLACEHOLDER
  })
}

/** 判断音标对象是否有任意非空字段 */
function hasPhonetic(p: DefinitionObject['phonetic']): boolean {
  if (!p) return false
  return !!(p.us?.trim() || p.uk?.trim() || p.ipa?.trim())
}

/**
 * 非破坏性合并：以 existing 为主，仅用 fetched 补齐缺失的部分
 * 用于"获取释义"——已有课程释义时不应被抓取结果（可能为占位符）覆盖，但仍补上音标/例句
 * - definitions：existing 有实质释义则保留，否则取 fetched
 * - phonetic：existing 有音标则保留，否则取 fetched
 * - examples：existing 有例句则保留，否则取 fetched
 */
export function mergeDefinitionFillingGaps(
  existing: DefinitionObject,
  fetched: DefinitionObject
): DefinitionObject {
  return {
    definitions: isDefinitionEmpty(existing) ? fetched.definitions : existing.definitions,
    phonetic: hasPhonetic(existing.phonetic) ? existing.phonetic : fetched.phonetic,
    examples: existing.examples?.length ? existing.examples : fetched.examples,
  }
}

/**
 * 在句子中将目标单词加粗（包裹 <strong> 标签）
 * 忽略大小写，匹配单词边界，跳过已加粗的部分
 */
export function boldWordInSentence(sentence: string, word: string): string {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // \p{L} matches any Unicode letter (Latin, Cyrillic, etc.)
  // Replaces \b which only recognizes [a-zA-Z0-9_] as word characters
  const pattern = new RegExp(
    `(?<!<strong>)(?<!\\p{L})(${escaped})(?!\\p{L})(?!<\\/strong>)`, 'giu'
  )
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
