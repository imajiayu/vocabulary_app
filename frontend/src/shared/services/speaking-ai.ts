/**
 * 口语 AI 反馈服务 — 经 Flask /api/ai/chat
 *
 * Prompt 维护在 shared/prompts/speaking.ts
 */

import { callAI } from './ai'
import { PART1_PROMPT, PART2_PROMPT, PART3_PROMPT } from '@/shared/prompts/speaking'

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

  const response = await callAI(systemPrompt, userMessage, [], { caller: 'speaking_feedback' })

  const scoreMatch = response.match(/^([\d.]+)/)
  const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0

  const chineseMatch = response.match(/【点评】\s*([\s\S]*?)(?=【优化】)/)
  const englishMatch = response.match(/【优化】\s*([\s\S]*)/)

  const chineseFeedback = chineseMatch ? chineseMatch[1].trim() : ''
  const improvedEnglish = englishMatch
    ? englishMatch[1].trim()
    : response.split('\n').slice(1).join('\n').trim()

  return { score, chineseFeedback, improvedEnglish }
}
