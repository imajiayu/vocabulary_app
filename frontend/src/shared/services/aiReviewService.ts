/**
 * AI 复习 orchestration：
 * 查当天 review_history → 筛选 50 个单词 → 调 AI 出题 → 解析 JSON → upsert session
 */

import { AiReviewApi, type AiReviewQuestion, type AiReviewSession, type DailyReviewWordRow } from '@/shared/api/aiReview'
import { callAI } from './ai'
import { AI_REVIEW_SYSTEM_PROMPT, buildAiReviewUserMessage } from '@/shared/prompts'
import { logger } from '@/shared/utils/logger'

const log = logger.create('aiReviewService')

export const AI_REVIEW_WORD_LIMIT = 50
export const AI_REVIEW_QUESTION_COUNT = 10

/**
 * 按规则筛词：
 * - 优先 has_failure = true，按 ease_factor 升序
 * - 其次 has_failure = false，按 ease_factor 升序
 * - 截断到 AI_REVIEW_WORD_LIMIT
 */
export function selectWordsForAiReview(rows: DailyReviewWordRow[]): DailyReviewWordRow[] {
  const sorted = [...rows].sort((a, b) => {
    if (a.has_failure !== b.has_failure) return a.has_failure ? -1 : 1
    return a.ease_factor - b.ease_factor
  })
  return sorted.slice(0, AI_REVIEW_WORD_LIMIT)
}

/**
 * 截断兜底：上游把 JSON 截断（常见于 max_tokens 卡边界）时，
 * 尝试回退到 `questions` 数组中最后一个完整闭合的对象，再把数组和外层手动闭合。
 * 只做一次最朴素的大括号配平，不处理字符串内的转义大括号（LLM 输出里极罕见）。
 */
function repairTruncatedAiReviewJson(raw: string): string | null {
  const qKey = '"questions"'
  const qIdx = raw.indexOf(qKey)
  if (qIdx < 0) return null
  const arrStart = raw.indexOf('[', qIdx)
  if (arrStart < 0) return null

  let depth = 0
  let inString = false
  let escape = false
  let lastObjEnd = -1

  for (let i = arrStart + 1; i < raw.length; i++) {
    const ch = raw[i]
    if (inString) {
      if (escape) escape = false
      else if (ch === '\\') escape = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') { inString = true; continue }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) lastObjEnd = i
    }
  }
  if (lastObjEnd < 0) return null
  return raw.slice(0, lastObjEnd + 1) + ']}'
}

/**
 * 解析 AI 响应。响应须是 JSON 对象，顶层含 `questions` 数组。
 * 做最小限度校验：类型 + 必要字段存在。
 */
export function parseAiReviewResponse(raw: string): AiReviewQuestion[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    const repaired = repairTruncatedAiReviewJson(raw)
    if (repaired) {
      try {
        parsed = JSON.parse(repaired)
        log.warn('AI 响应被截断，已兜底截取最后完整题目')
      } catch {
        log.error('AI 响应不是合法 JSON（截断兜底也失败）:', raw.slice(0, 200))
        throw new Error('AI 返回的不是合法 JSON')
      }
    } else {
      log.error('AI 响应不是合法 JSON:', raw.slice(0, 200))
      throw new Error('AI 返回的不是合法 JSON')
    }
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('AI 返回结构异常')
  }
  const questions = (parsed as { questions?: unknown }).questions
  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error('AI 响应缺少 questions 数组')
  }

  const result: AiReviewQuestion[] = []
  for (const q of questions) {
    if (!q || typeof q !== 'object') continue
    const obj = q as Record<string, unknown>
    const type = obj.type
    const prompt = obj.prompt
    const answer = obj.answer
    const targetWords = obj.target_words
    if (type !== 'zh_to_en' && type !== 'en_to_zh') continue
    if (typeof prompt !== 'string' || typeof answer !== 'string') continue
    if (!Array.isArray(targetWords)) continue
    result.push({
      type,
      prompt,
      answer,
      target_words: targetWords.filter((w): w is string => typeof w === 'string'),
    })
  }

  if (result.length === 0) throw new Error('AI 响应不含有效题目')
  return result
}

/**
 * 端到端：生成并保存指定 UTC 日期 + source 的 AI 复习 session。
 * 会覆盖同 (date, source) 已存在的 session。
 */
export async function generateAiReviewSession(
  date: string,
  source: string,
): Promise<AiReviewSession> {
  const dailyRows = await AiReviewApi.getDailyReviewWords(date, source)
  if (dailyRows.length === 0) {
    throw new Error('当天没有复习记录，无法生成 AI 复习')
  }

  const selected = selectWordsForAiReview(dailyRows)
  const wordIds = selected.map((w) => w.word_id)

  const userMessage = buildAiReviewUserMessage(
    selected.map((w) => ({ word: w.word, definition: w.definition })),
  )

  const raw = await callAI(AI_REVIEW_SYSTEM_PROMPT, userMessage, [], {
    caller: 'ai_review',
    jsonMode: true,
    temperature: 0.4,
    maxTokens: 8000,
  })

  const questions = parseAiReviewResponse(raw)
  return AiReviewApi.upsertSession(date, source, wordIds, questions)
}
