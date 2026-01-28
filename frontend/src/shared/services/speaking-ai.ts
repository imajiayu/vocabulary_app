/**
 * 口语 AI 反馈服务
 * 直接调用 DeepSeek API，不经过后端
 */

import { callDeepSeek } from './deepseek'

// AI 评分反馈的系统提示词（从后端迁移）
const SPEAKING_FEEDBACK_PROMPT = `你是雅思口语评分员。严格按标准评分，输出分数和改写版本。

【评分锚点】（必须严格对照）
5.0: 大量语法错误 + 词汇贫乏/错误 + 逻辑断裂 + 表达支离破碎
5.5: 较多语法错误 + 词汇单一/中式英语 + 连贯性差 + 难以理解
6.0: 有明显语法错误 + 词汇基础但不地道 + 能表达但不流畅
6.5: 少量语法错误 + 词汇准确但缺乏变化 + 基本连贯
7.0: 偶有语法小错 + 词汇较准确 + 有连接词但句型单一
7.5: 语法基本正确 + 词汇较地道 + 开始有复杂句
8.0: 语法正确 + 词汇地道多样 + 句型有变化 + 自然连贯
8.5: 几乎无错 + 词汇丰富精准 + 复杂句型流畅
9.0: 完美母语水平（极少给出）

【判分原则】
- 有"Chinglish"搭配或不自然表达，最高6.5
- 只有简单句，最高7.0
- 表达地道但有1-2处语法错，给7.0-7.5
- 不确定时往低打，宁可严格

【改写要求】
- 保持原意不变
- 口语化、自然，不要书面语
- 修正语法和搭配错误
- 替换为更地道的表达
- 适当增加句型多样性

【输出格式】
第一行：分数（纯数字，如7.0）
第二行起：改写版本（直接输出，无需任何说明）`

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
