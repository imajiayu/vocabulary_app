/**
 * 写作 AI 反馈服务 — 经 Flask /api/ai/chat
 *
 * Prompt 维护在 shared/prompts/writing.ts
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

/**
 * 获取逐段反馈
 */
export async function getParagraphFeedback(
  promptText: string,
  essay: string,
  taskType: 1 | 2
): Promise<ParagraphFeedback[]> {
  const systemPrompt = PARAGRAPH_IMPROVEMENT_PROMPT
    .replace('{taskType}', String(taskType))
    .replace('{prompt}', promptText)
    .replace('{essay}', essay)

  const response = await callAI(systemPrompt, '请逐段分析并返回 JSON 格式的改进建议。', [], {
    caller: 'writing_paragraph_feedback',
    jsonMode: true,
  })

  try {
    const parsed = parseJsonResponse<ParagraphFeedback[]>(response)
    return parsed
  } catch (error) {
    logger.error('解析 AI 逐段反馈失败:', response)
    throw new Error('AI 反馈格式错误，请重试')
  }
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

  const response = await callAI(systemPrompt, instruction, [], { caller: 'writing_outline_optimize' })
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
    jsonMode: true,
  })

  try {
    return parseJsonResponse<ParagraphFeedback>(response)
  } catch (error) {
    logger.error('解析 AI 段落优化失败:', response)
    throw new Error('AI 段落优化格式错误，请重试')
  }
}

/**
 * 获取最终评分
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
    jsonMode: true,
  })

  try {
    const parsed = parseJsonResponse<{
      scores: WritingScores
      feedback: {
        taskAchievement: string
        coherenceCohesion: string
        lexicalResource: string
        grammaticalRange: string
      }
      summary: string
    }>(response)

    return {
      scores: parsed.scores,
      summary: parsed.summary
    }
  } catch (error) {
    logger.error('解析 AI 评分失败:', response)
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

  const response = await callAI(systemPrompt, instruction, [], { caller: 'writing_text_edit' })
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
    jsonMode: true,
  })

  try {
    return parseJsonResponse<{ reply: string; modified: string }>(response)
  } catch (error) {
    logger.error('解析 AI 大纲编辑失败:', response)
    throw new Error('AI 大纲编辑格式错误，请重试')
  }
}
