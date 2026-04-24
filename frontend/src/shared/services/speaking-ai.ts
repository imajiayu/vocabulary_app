/**
 * 口语 AI 反馈服务 — 经 Flask /api/ai/chat
 *
 * Prompt 维护在 shared/prompts/speaking.ts
 * 输出为严格 JSON：{ score, capScore, capReasons, review, optimized }
 */

import { callAI } from './ai'
import { parseJsonResponse } from '@/shared/utils/json'
import { logger } from '@/shared/utils/logger'
import { PART1_PROMPT, PART2_PROMPT, PART3_PROMPT } from '@/shared/prompts/speaking'

const log = logger.create('speaking-ai')

type QuestionType = 'part1' | 'part2' | 'part3'

/**
 * 根据题目信息判断问题类型
 * - part=1 → Part 1
 * - part=2 且 question_text 包含多行（提示卡）→ Part 2
 * - part=2 且 question_text 是单行问题 → Part 3
 */
function detectQuestionType(questionText: string, part?: number): QuestionType {
  if (part === 1) return 'part1'

  if (part === 2) {
    const isPromptCard = questionText.includes('\n') &&
      (questionText.toLowerCase().includes('you should say') ||
       questionText.toLowerCase().includes('describe'))
    return isPromptCard ? 'part2' : 'part3'
  }

  if (questionText.includes('\n') && questionText.toLowerCase().includes('you should say')) {
    return 'part2'
  }

  return 'part1'
}

function getPromptForType(type: QuestionType): string {
  switch (type) {
    case 'part1': return PART1_PROMPT
    case 'part2': return PART2_PROMPT
    case 'part3': return PART3_PROMPT
  }
}

export interface SpeakingFeedbackResult {
  score: number
  chineseFeedback: string
  improvedEnglish: string
  /** 命中分数上限规则后推导出的封顶分数；无触发时与 score 相同 */
  capScore: number
  /** 命中的上限规则描述，用于 UI 提示用户为什么被压分 */
  capReasons: string[]
}

interface RawSpeakingResponse {
  score?: unknown
  capScore?: unknown
  capReasons?: unknown
  review?: unknown
  optimized?: unknown
}

/** 把 LLM 返回的分数 clamp 到合法范围并归到最近的 0.5 */
function normalizeScore(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''))
  if (!Number.isFinite(n)) return 0
  const clamped = Math.max(0, Math.min(9, n))
  return Math.round(clamped * 2) / 2
}

/**
 * 获取口语练习的 AI 反馈
 */
export async function getSpeakingFeedback(
  questionText: string,
  userAnswer: string,
  topicTitle?: string,
  part?: number
): Promise<SpeakingFeedbackResult> {
  const questionType = detectQuestionType(questionText, part)
  let systemPrompt = getPromptForType(questionType)

  if (topicTitle) {
    systemPrompt = `当前话题: ${topicTitle}\n\n${systemPrompt}`
  }

  let userMessage: string
  if (questionType === 'part2') {
    userMessage = `【提示卡】\n${questionText}\n\n【考生独白】\n${userAnswer}`
  } else {
    userMessage = `【问题】${questionText}\n【回答】${userAnswer}`
  }

  const response = await callAI(systemPrompt, userMessage, [], {
    caller: 'speaking_feedback',
    temperature: 0.3,
    jsonMode: true,
  })

  let raw: RawSpeakingResponse
  try {
    raw = parseJsonResponse<RawSpeakingResponse>(response)
  } catch (err) {
    log.error('解析口语 AI 反馈 JSON 失败:', response)
    throw new Error('AI 反馈格式错误，请重试')
  }

  const baseScore = normalizeScore(raw.score)
  const capScore = normalizeScore(raw.capScore ?? raw.score)
  // 服务端保险：即使模型忘了在 score 上 apply capScore，前端再 clamp 一次
  const finalScore = capScore > 0 ? Math.min(baseScore, capScore) : baseScore

  const capReasons = Array.isArray(raw.capReasons)
    ? raw.capReasons.filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
    : []

  return {
    score: finalScore,
    capScore: capScore || finalScore,
    capReasons,
    chineseFeedback: typeof raw.review === 'string' ? raw.review.trim() : '',
    improvedEnglish: typeof raw.optimized === 'string' ? raw.optimized.trim() : '',
  }
}
