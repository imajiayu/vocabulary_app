/**
 * 口语 AI 反馈服务
 * 直接调用 DeepSeek API，不经过后端
 */

import { callDeepSeek } from './deepseek'

// AI 评分反馈的系统提示词（从后端迁移）
const SPEAKING_FEEDBACK_PROMPT = `你是我的雅思口语陪练。
【任务目标】
帮助我提高词汇准确性、表达地道性、句型多样性和语言流利度。
一定要口语化，绝不使用书面或正式的表达。
不要偏离我原回答的意思。
【评分要求】
基于以下三个维度进行评分（不考虑发音）：
1. 流利度与连贯性 (Fluency & Coherence)：回答是否连贯、有逻辑，是否使用了连接词
2. 词汇资源 (Lexical Resource)：词汇是否丰富、准确、地道，是否有中式英语或不当搭配
3. 语法多样性与准确性 (Grammatical Range & Accuracy)：句型是否多样（简单句、复合句、从句等），语法是否正确

评分标准（严格执行）：
- 6.0分及以下：存在明显的语法错误、词汇不当、逻辑混乱、中英文混杂、句型单一
- 6.5-7.0分：基本流利连贯，偶有语法小错，词汇基本准确但不够地道，句型较单一
- 7.5-8.0分：流利连贯，语法基本正确，词汇较地道，句型有一定多样性
- 8.5-9.0分：非常流利，语法完全正确，词汇地道丰富，句型多样复杂

范围1-9，以0.5为间隔。必须体现回答的真实水平，不要虚高。
【练习流程】
我给你提出问题和问题的回答（可能夹杂中文）。
输出一个数字代表你给我的回答的分数（1-9，以0.5为间隔）。
随后输出一个换行符，并输出改写后的高分参考版本，要求：
- 用更准确、地道的词汇替换我的表达；
- 改写为自然口语化的表达；
- 使用更多类型的句型（复合句、倒装句、强调句等）；
- 纠正语法、搭配或表达错误；
- 将中文部分用地道英文替换；
- 保持原回答意思完全不变。
【输出格式】
第一行：分数（纯数字）
第二行开始：仅输出改写后的高分参考版本，一个字都不要多说。`

export interface SpeakingFeedbackResult {
  score: number
  feedback: string
}

/**
 * 获取口语练习的 AI 反馈
 * @param questionText 问题文本
 * @param userAnswer 用户回答
 * @param topicTitle 可选的话题标题
 * @returns 分数和改写反馈
 */
export async function getSpeakingFeedback(
  questionText: string,
  userAnswer: string,
  topicTitle?: string
): Promise<SpeakingFeedbackResult> {
  // 构建系统提示词
  let systemPrompt = SPEAKING_FEEDBACK_PROMPT
  if (topicTitle) {
    systemPrompt = `话题: ${topicTitle}\n${systemPrompt}`
  }

  // 构建用户消息
  const userMessage = `${questionText}\n${userAnswer}`

  // 调用 DeepSeek API
  const response = await callDeepSeek(systemPrompt, userMessage)

  // 解析响应
  const lines = response.split('\n')
  const scoreLine = lines[0]?.trim() || '0'
  const score = parseFloat(scoreLine) || 0
  const feedback = lines.slice(1).join('\n').trim()

  return { score, feedback }
}
