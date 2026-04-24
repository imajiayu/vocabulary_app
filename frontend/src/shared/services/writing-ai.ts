/**
 * 写作 AI 反馈服务 — 经 Flask /api/ai/chat
 *
 * Prompt 维护在 shared/prompts/writing.ts
 *
 * 主要结构化点：
 * - 逐段反馈按【段落N】编号拼接送给 LLM，返回数组严格对齐
 * - paragraph feedback 自动补齐 changed 字段（若 LLM 没填，用字符串对比兜底）
 * - final scoring 的 overall 由前端按 IELTS 规则计算，不让 LLM 算
 */

import { callAI } from './ai'
import type { ParagraphFeedback, WritingScores } from '@/shared/types/writing'
import { logger } from '@/shared/utils/logger'
import { parseJsonResponse } from '@/shared/utils/json'
import {
  PARAGRAPH_IMPROVEMENT_PROMPT,
  OPTIMIZE_OUTLINE_PROMPT,
  REOPTIMIZE_PARAGRAPH_PROMPT,
  FINAL_SCORING_PROMPT,
  EDIT_TEXT_PROMPT,
  OUTLINE_QA_PROMPT,
  EDIT_OUTLINE_TEXT_PROMPT,
  POST_FINAL_QA_PROMPT,
} from '@/shared/prompts/writing'

const log = logger.create('writing-ai')

/** 把 essay 字符串按 \n\n 分段，并以【段落N】编号拼接，传给 LLM */
function splitParagraphs(essay: string): string[] {
  return essay.split('\n\n').map((p) => p.trim()).filter((p) => p.length > 0)
}

function formatEssayForPrompt(paragraphs: string[]): string {
  return paragraphs.map((p, i) => `【段落${i + 1}】\n${p}`).join('\n\n')
}

/** 字符串归一化：去首尾空白、合并内部空白、小写化，用于"是否改过"的兜底推断 */
function normalize(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** 若 LLM 未返回 changed 字段，用原/改字符串对比兜底 */
function inferChanged(original: string, improved: string, llmValue: unknown): boolean {
  if (typeof llmValue === 'boolean') return llmValue
  return normalize(original) !== normalize(improved)
}

/**
 * IELTS 官方的分项 → overall 舍入规则：
 * - 小数部分 < 0.25 → 向下取整
 * - 0.25 ≤ 小数部分 < 0.75 → 取到 .5
 * - 小数部分 ≥ 0.75 → 向上取整
 * https://takeielts.britishcouncil.org/take-ielts/results/understand-your-results
 */
export function ieltsRoundOverall(avg: number): number {
  if (!Number.isFinite(avg)) return 0
  const floor = Math.floor(avg)
  const decimal = avg - floor
  if (decimal < 0.25) return floor
  if (decimal < 0.75) return floor + 0.5
  return floor + 1
}

function computeOverall(scores: Omit<WritingScores, 'overall'>): number {
  const avg = (
    scores.taskAchievement +
    scores.coherenceCohesion +
    scores.lexicalResource +
    scores.grammaticalRange
  ) / 4
  return ieltsRoundOverall(avg)
}

/**
 * 获取逐段反馈
 */
export async function getParagraphFeedback(
  promptText: string,
  essay: string,
  taskType: 1 | 2
): Promise<ParagraphFeedback[]> {
  const paragraphs = splitParagraphs(essay)
  const numberedEssay = formatEssayForPrompt(paragraphs)

  const systemPrompt = PARAGRAPH_IMPROVEMENT_PROMPT
    .replace('{taskType}', String(taskType))
    .replace('{prompt}', promptText)
    .replace('{essay}', numberedEssay)

  const response = await callAI(systemPrompt, '请逐段分析并返回 JSON 格式的改进建议。', [], {
    caller: 'writing_paragraph_feedback',
    temperature: 0.5,
    jsonMode: true,
  })

  let parsed: unknown
  try {
    parsed = parseJsonResponse<unknown>(response)
  } catch {
    log.error('解析 AI 逐段反馈失败:', response)
    throw new Error('AI 反馈格式错误，请重试')
  }

  // jsonMode 下有些模型会把数组包一层 { feedback: [...] } / { result: [...] }，兜底解开
  let arr: unknown[] = []
  if (Array.isArray(parsed)) {
    arr = parsed
  } else if (parsed && typeof parsed === 'object') {
    for (const value of Object.values(parsed)) {
      if (Array.isArray(value)) { arr = value; break }
    }
  }

  if (arr.length === 0) {
    log.error('AI 返回不包含段落数组:', response)
    throw new Error('AI 反馈格式错误，请重试')
  }

  if (arr.length !== paragraphs.length) {
    log.warn(`LLM 返回段落数 ${arr.length} 与原文 ${paragraphs.length} 不一致`)
  }

  // 严格按原文段落数对齐：多出截断，缺失用"无需修改"补齐
  const result: ParagraphFeedback[] = paragraphs.map((original, i) => {
    const raw = arr[i] as Record<string, unknown> | undefined
    const improved = typeof raw?.improved === 'string' ? raw.improved : original
    const notes = typeof raw?.notes === 'string' ? raw.notes : '该段表达良好，无需修改'
    return {
      improved,
      notes,
      changed: inferChanged(original, improved, raw?.changed),
    }
  })

  return result
}

/**
 * 优化大纲
 */
export async function optimizeOutline(
  promptText: string,
  outline: string,
  instruction: string
): Promise<string> {
  const systemPrompt = OPTIMIZE_OUTLINE_PROMPT
    .replace('{prompt}', promptText)
    .replace('{outline}', outline)
    .replace('{instruction}', instruction)

  const response = await callAI(systemPrompt, instruction, [], {
    caller: 'writing_outline_optimize',
    temperature: 0.7,
  })
  return response.trim()
}

/**
 * 重新优化指定段落
 */
export async function reoptimizeParagraph(
  promptText: string,
  originalParagraph: string,
  currentImproved: string,
  instruction: string
): Promise<ParagraphFeedback> {
  const systemPrompt = REOPTIMIZE_PARAGRAPH_PROMPT
    .replace('{prompt}', promptText)
    .replace('{originalParagraph}', originalParagraph)
    .replace('{currentImproved}', currentImproved)
    .replace('{instruction}', instruction)

  const response = await callAI(systemPrompt, instruction, [], {
    caller: 'writing_paragraph_reoptimize',
    temperature: 0.5,
    jsonMode: true,
  })

  try {
    const raw = parseJsonResponse<Record<string, unknown>>(response)
    const improved = typeof raw.improved === 'string' ? raw.improved : currentImproved
    const notes = typeof raw.notes === 'string' ? raw.notes : ''
    return {
      improved,
      notes,
      // 与"当前改进版"比较而不是原段落：用户是基于 currentImproved 再改
      changed: inferChanged(currentImproved, improved, raw.changed),
    }
  } catch {
    log.error('解析 AI 段落优化失败:', response)
    throw new Error('AI 段落优化格式错误，请重试')
  }
}

/**
 * 获取最终评分（overall 由本函数按 IELTS 规则计算，不从 LLM 取）
 */
export async function getFinalScores(
  promptText: string,
  finalEssay: string,
  taskType: 1 | 2
): Promise<{ scores: WritingScores; summary: string }> {
  const systemPrompt = FINAL_SCORING_PROMPT
    .replace('{taskType}', String(taskType))
    .replace('{prompt}', promptText)
    .replace('{finalEssay}', finalEssay)

  const response = await callAI(systemPrompt, '请评分并返回 JSON 格式的结果。', [], {
    caller: 'writing_final_scoring',
    temperature: 0.3,
    jsonMode: true,
  })

  try {
    const parsed = parseJsonResponse<{
      scores: Omit<WritingScores, 'overall'> & { overall?: number }
      feedback?: unknown
      summary: string
    }>(response)

    const fourScores: Omit<WritingScores, 'overall'> = {
      taskAchievement: parsed.scores.taskAchievement,
      coherenceCohesion: parsed.scores.coherenceCohesion,
      lexicalResource: parsed.scores.lexicalResource,
      grammaticalRange: parsed.scores.grammaticalRange,
    }

    return {
      scores: {
        ...fourScores,
        overall: computeOverall(fourScores),
      },
      summary: parsed.summary,
    }
  } catch (error) {
    log.error('解析 AI 评分失败:', response)
    throw new Error('AI 评分格式错误，请重试')
  }
}

/**
 * 终稿后问答
 */
export async function askWritingQuestion(
  question: string,
  essayContext: string,
  selectedText?: string
): Promise<string> {
  const systemPrompt = POST_FINAL_QA_PROMPT
    .replace('{essayContext}', essayContext)
    .replace('{selectedText}', selectedText || '（无选中文本）')
    .replace('{question}', question)

  const response = await callAI(systemPrompt, question, [], { caller: 'writing_final_qa' })
  return response.trim()
}

/**
 * 编辑选中文本
 */
export async function editWritingText(
  selectedText: string,
  instruction: string,
  essayContext: string
): Promise<string> {
  const systemPrompt = EDIT_TEXT_PROMPT
    .replace('{essayContext}', essayContext)
    .replace('{selectedText}', selectedText)
    .replace('{instruction}', instruction)

  const response = await callAI(systemPrompt, instruction, [], {
    caller: 'writing_text_edit',
    temperature: 0.3,
  })
  return response.trim()
}

/**
 * 大纲问答
 */
export async function askOutlineQuestion(
  promptText: string,
  outline: string,
  question: string,
  selectedText?: string
): Promise<string> {
  const systemPrompt = OUTLINE_QA_PROMPT
    .replace('{prompt}', promptText)
    .replace('{outline}', outline)
    .replace('{selectedText}', selectedText || '（无选中文本）')
    .replace('{question}', question)

  const response = await callAI(systemPrompt, question, [], { caller: 'writing_outline_qa' })
  return response.trim()
}

/**
 * 编辑大纲选中文本
 */
export async function editOutlineText(
  promptText: string,
  outline: string,
  selectedText: string,
  instruction: string
): Promise<{ reply: string; modified: string }> {
  const systemPrompt = EDIT_OUTLINE_TEXT_PROMPT
    .replace('{prompt}', promptText)
    .replace('{outline}', outline)
    .replace('{selectedText}', selectedText)
    .replace('{instruction}', instruction)

  const response = await callAI(systemPrompt, instruction, [], {
    caller: 'writing_outline_edit',
    temperature: 0.3,
    jsonMode: true,
  })

  try {
    return parseJsonResponse<{ reply: string; modified: string }>(response)
  } catch (error) {
    log.error('解析 AI 大纲编辑失败:', response)
    throw new Error('AI 大纲编辑格式错误，请重试')
  }
}
