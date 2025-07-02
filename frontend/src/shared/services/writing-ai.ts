/**
 * 写作 AI 反馈服务
 * 直接调用 DeepSeek API，不经过后端
 */

import { callDeepSeek } from './deepseek'
import type { ParagraphFeedback, WritingScores } from '@/shared/types/writing'
import { logger } from '@/shared/utils/logger'

// ============================================================================
// Prompt 模板
// ============================================================================

/**
 * 逐段改进 — 输入第一版全文，返回每段的改进版 + 说明
 */
const PARAGRAPH_IMPROVEMENT_PROMPT = `你是一位资深 IELTS 写作考官。请逐段分析以下 Task {taskType} 作文，并为每段提供改进版本。

## 题目
{prompt}

## 作文（按段落分割）
{essay}

## 输出要求
返回 JSON 数组（不要包含 markdown 代码块标记），每个元素对应原文的一个段落：
[
  {
    "improved": "改进后的段落完整文本",
    "notes": "改进说明（用词更精准、增加了过渡句、论证更有力等）"
  }
]

注意：
1. 数组长度必须与原文段落数完全一致
2. improved 是改进后的完整段落文本，不是差异描述
3. notes 简要说明做了哪些改进，为什么这样改
4. 如果某段已经很好，improved 保持原文不变，notes 写"该段表达良好，无需修改"
5. 改进要保持作者的原始意图和论点方向
6. 聚焦于词汇提升、语法修正、衔接优化、论证加强`

/**
 * 优化大纲
 */
const OPTIMIZE_OUTLINE_PROMPT = `你是一位资深 IELTS 写作辅导老师。请根据用户的指令优化以下写作大纲。

## 题目
{prompt}

## 当前大纲
{outline}

## 用户指令
{instruction}

## 输出要求
直接输出优化后的完整大纲文本（纯文本，不要 JSON，不要 markdown 代码块）。

注意：
1. 保持大纲的结构清晰
2. 根据用户指令进行针对性优化
3. 如果用户没有具体指令，从整体结构、论点分布、逻辑层次等方面优化
4. 大纲应体现 IELTS 写作的段落结构要求`

/**
 * 重新优化指定段落
 */
const REOPTIMIZE_PARAGRAPH_PROMPT = `你是一位资深 IELTS 写作考官。请根据用户的指令重新优化以下段落。

## 题目
{prompt}

## 原始段落（用户写的）
{originalParagraph}

## 当前改进版
{currentImproved}

## 用户指令
{instruction}

## 输出要求
返回 JSON 格式（不要包含 markdown 代码块标记）：
{
  "improved": "重新优化后的段落完整文本",
  "notes": "本次优化的说明"
}

注意：
1. 根据用户指令进行针对性修改
2. improved 是完整的段落文本
3. notes 简要说明做了哪些改动`

/**
 * 最终评分
 */
const FINAL_SCORING_PROMPT = `请给出 IELTS Task {taskType} 作文的最终评分和详细反馈。

## 题目
{prompt}

## 最终稿
{finalEssay}

## IELTS 评分标准要点

### Band 6
- Task Response: 回应了题目但部分内容可能不够相关
- Coherence: 有连接词但可能使用不当
- Lexical: 词汇够用但可能有错误
- Grammar: 句型混合但有错误

### Band 7
- Task Response: 充分回应题目，观点清晰
- Coherence: 逻辑清晰，衔接自然
- Lexical: 词汇丰富，偶有小错
- Grammar: 句型多样，错误少

### Band 8
- Task Response: 完整回应，论证充分
- Coherence: 文章流畅，段落清晰
- Lexical: 词汇地道精准
- Grammar: 几乎无错

## 输出要求
返回 JSON 格式（不要包含 markdown 代码块标记）：
{
  "scores": {
    "taskAchievement": 6.5,
    "coherenceCohesion": 6.0,
    "lexicalResource": 6.5,
    "grammaticalRange": 6.0,
    "overall": 6.5
  },
  "feedback": {
    "taskAchievement": "该维度的详细评价...",
    "coherenceCohesion": "该维度的详细评价...",
    "lexicalResource": "该维度的详细评价...",
    "grammaticalRange": "该维度的详细评价..."
  },
  "summary": "总结性建议（未来如何提高）"
}

注意：
1. 分数以 0.5 为单位，范围 1-9
2. overall 是四项平均，四舍五入到 0.5
3. 评分要严格对照标准，宁严勿松
4. feedback 中的评价要具体，引用文章中的例子`

/**
 * 编辑选中文本 — 只返回修改后的文本
 */
const EDIT_TEXT_PROMPT = `你是一位资深 IELTS 写作考官。用户选中了作文中的一段文本，并给出了修改指令。
请只返回修改后的文本，不要添加任何解释、引号或 markdown 格式。

## 作文上下文
{essayContext}

## 选中的文本
{selectedText}

## 修改指令
{instruction}

## 输出要求
直接输出修改后的文本，不要包含任何其他内容。保持与原文相同的语言（英文）。`

/**
 * 大纲问答 — 关于大纲内容的 Q&A
 */
const OUTLINE_QA_PROMPT = `你是一位资深 IELTS 写作辅导老师。用户正在编写写作大纲，有问题想请教。

## 题目
{prompt}

## 当前大纲
{outline}

## 用户选中的文本（如有）
{selectedText}

## 用户问题
{question}

请提供有针对性的建议。回答要简洁实用，聚焦于大纲结构、论点质量、逻辑衔接等方面。
注意：只回答问题，不要修改大纲内容。`

/**
 * 编辑大纲选中文本 — 返回修改后的文本 + 说明
 */
const EDIT_OUTLINE_TEXT_PROMPT = `你是一位资深 IELTS 写作辅导老师。用户选中了大纲中的一段文本，并给出了修改指令。

## 题目
{prompt}

## 当前大纲
{outline}

## 选中的文本
{selectedText}

## 修改指令
{instruction}

## 输出要求
返回 JSON 格式（不要包含 markdown 代码块标记）：
{
  "reply": "简要说明做了哪些修改以及为什么",
  "modified": "修改后的文本，用于替换选中内容"
}

注意：
1. modified 只包含替换选中部分的文本，不是整个大纲
2. reply 简要说明修改理由
3. 保持与原文相同的格式风格（如 markdown 列表、标题等）`

/**
 * 终稿后问答
 */
const POST_FINAL_QA_PROMPT = `用户已完成 IELTS 写作练习，现在有问题想请教。

## 作文上下文
{essayContext}

## 用户选中的文本（如有）
{selectedText}

## 用户问题
{question}

请提供有针对性的建议。如果用户询问写作套路或模板，请结合具体例子说明。
回答要简洁实用，避免过长的解释。`

// ============================================================================
// API 函数
// ============================================================================

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

  const response = await callDeepSeek(systemPrompt, '请逐段分析并返回 JSON 格式的改进建议。')

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

  const response = await callDeepSeek(systemPrompt, instruction)
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

  const response = await callDeepSeek(systemPrompt, instruction)

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

  const response = await callDeepSeek(systemPrompt, '请评分并返回 JSON 格式的结果。')

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

  const response = await callDeepSeek(systemPrompt, question)
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

  const response = await callDeepSeek(systemPrompt, instruction)
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

  const response = await callDeepSeek(systemPrompt, question)
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

  const response = await callDeepSeek(systemPrompt, instruction)

  try {
    return parseJsonResponse<{ reply: string; modified: string }>(response)
  } catch (error) {
    logger.error('解析 AI 大纲编辑失败:', response)
    throw new Error('AI 大纲编辑格式错误，请重试')
  }
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 解析 JSON 响应（处理可能的 markdown 代码块）
 */
export function parseJsonResponse<T>(response: string): T {
  // 移除可能的 markdown 代码块标记
  let cleaned = response.trim()

  // 处理 ```json ... ``` 格式
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7)
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3)
  }

  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3)
  }

  cleaned = cleaned.trim()

  return JSON.parse(cleaned)
}
