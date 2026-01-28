/**
 * 写作 AI 反馈服务
 * 直接调用 DeepSeek API，不经过后端
 */

import { callDeepSeek } from './deepseek'
import type { WritingFeedback, WritingIssue, WritingScores } from '@/shared/types/writing'

// ============================================================================
// Prompt 模板
// ============================================================================

/**
 * 第一轮反馈 - 标注问题（不给建议）
 */
const INITIAL_FEEDBACK_PROMPT = `你是一位资深 IELTS 写作考官。请分析以下 Task {taskType} 作文，识别问题但不直接给出修改建议。

## 评分维度
- Task Achievement/Response: 任务完成度
- Coherence and Cohesion: 连贯与衔接
- Lexical Resource: 词汇资源
- Grammatical Range and Accuracy: 语法范围与准确性

## 题目
{prompt}

## 作文
{essay}

## 输出要求
返回 JSON 格式（不要包含 markdown 代码块标记）：
{
  "issues": [
    {
      "id": "唯一ID（如 issue_1）",
      "type": "grammar|vocabulary|coherence|task",
      "severity": "minor|major",
      "text": "原文中有问题的文本片段（精确复制，用于定位高亮）",
      "description": "问题描述（不要给修改建议）"
    }
  ],
  "summary": "总体评价（2-3句，指出主要优缺点）"
}

注意：
1. text 必须是原文中的精确文本，会用于在编辑器中查找并高亮
2. 只描述问题是什么，不要说"应该改成..."
3. severity: major 表示严重影响分数的问题
4. issues 数组按照在文章中的位置排序`

/**
 * 请求具体建议
 */
const ISSUE_SUGGESTION_PROMPT = `针对以下写作问题，给出具体的修改建议和示例。

## 原文片段
{essayContext}

## 问题描述
{issueDescription}

## 问题类型
{issueType}

## 输出要求
请给出：
1. **为什么这是个问题**：简要解释（1-2句）
2. **修改建议**：具体的改进方向（1-2句）
3. **修改示例**：提供一个具体的修改版本

注意：
- 保持建议的实用性，避免泛泛而谈
- 修改示例应该是地道的英语表达
- 口语化的解释，不要过于学术化`

/**
 * 第二轮反馈 - 对比分析
 */
const REVISION_FEEDBACK_PROMPT = `请对比用户的初稿和修改稿，分析改进情况并指出剩余问题。

## 题目
{prompt}

## 初稿
{originalEssay}

## 修改稿
{revisedEssay}

## 输出要求
返回 JSON 格式（不要包含 markdown 代码块标记）：
{
  "improvement": "改进了哪些方面（具体列出改进点，用逗号分隔）",
  "issues": [
    {
      "id": "唯一ID（如 issue_1）",
      "type": "grammar|vocabulary|coherence|task",
      "severity": "minor|major",
      "text": "修改稿中有问题的文本片段（精确复制，用于定位高亮）",
      "description": "问题描述（只列出剩余问题）"
    }
  ],
  "summary": "整体评价，包括进步和仍需改进的地方"
}

注意：
1. text 必须是修改稿中的精确文本，会用于查找并高亮
2. 如果某个问题已修复，不要再列出
3. 如果修改引入了新问题，需要指出`

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
 * 获取初稿反馈
 */
export async function getInitialFeedback(
  promptText: string,
  essay: string,
  taskType: 1 | 2,
  _imageUrl?: string  // 预留，未来可用于多模态分析
): Promise<WritingFeedback> {
  const systemPrompt = INITIAL_FEEDBACK_PROMPT
    .replace('{taskType}', String(taskType))
    .replace('{prompt}', promptText)
    .replace('{essay}', essay)

  const response = await callDeepSeek(systemPrompt, '请分析这篇作文并返回 JSON 格式的反馈。')

  try {
    const parsed = parseJsonResponse<{
      issues: Array<{ id?: string; type: string; severity: string; text?: string; description: string }>
      summary: string
    }>(response)

    return {
      issues: processIssuesWithLocation(parsed.issues, essay),
      summary: parsed.summary
    }
  } catch (error) {
    console.error('解析 AI 反馈失败:', response)
    throw new Error('AI 反馈格式错误，请重试')
  }
}

/**
 * 获取问题的具体建议
 */
export async function getIssueSuggestion(
  issue: WritingIssue,
  essayContext: string
): Promise<string> {
  const issueTypeLabels: Record<string, string> = {
    grammar: '语法问题',
    vocabulary: '词汇问题',
    coherence: '连贯性问题',
    task: '任务完成度问题'
  }

  const systemPrompt = ISSUE_SUGGESTION_PROMPT
    .replace('{essayContext}', essayContext)
    .replace('{issueDescription}', issue.description)
    .replace('{issueType}', issueTypeLabels[issue.type] || issue.type)

  const response = await callDeepSeek(systemPrompt, '请给出修改建议。')
  return response.trim()
}

/**
 * 获取修订稿反馈
 */
export async function getRevisionFeedback(
  promptText: string,
  originalEssay: string,
  revisedEssay: string,
  taskType: 1 | 2
): Promise<WritingFeedback> {
  const systemPrompt = REVISION_FEEDBACK_PROMPT
    .replace('{prompt}', promptText)
    .replace('{originalEssay}', originalEssay)
    .replace('{revisedEssay}', revisedEssay)

  const response = await callDeepSeek(systemPrompt, '请对比分析并返回 JSON 格式的反馈。')

  try {
    const parsed = parseJsonResponse<{
      issues: Array<{ id?: string; type: string; severity: string; text?: string; description: string }>
      summary: string
      improvement?: string
    }>(response)

    return {
      issues: processIssuesWithLocation(parsed.issues, revisedEssay),
      summary: parsed.summary,
      improvement: parsed.improvement
    }
  } catch (error) {
    console.error('解析 AI 反馈失败:', response)
    throw new Error('AI 反馈格式错误，请重试')
  }
}

/**
 * 获取最终评分
 */
export async function getFinalScores(
  promptText: string,
  finalEssay: string,
  taskType: 1 | 2
): Promise<{ feedback: WritingFeedback; scores: WritingScores }> {
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
      feedback: {
        issues: [],
        summary: parsed.summary,
        improvement: Object.entries(parsed.feedback)
          .map(([key, value]) => `${key}: ${value}`)
          .join('\n\n')
      },
      scores: parsed.scores
    }
  } catch (error) {
    console.error('解析 AI 评分失败:', response)
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

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 根据问题文本在文章中查找位置
 * 返回 { start, end }，如果找不到则返回 null
 */
function locateIssueText(essay: string, text: string): { start: number; end: number } | null {
  if (!text) return null

  const index = essay.indexOf(text)
  if (index !== -1) {
    return { start: index, end: index + text.length }
  }

  // 尝试忽略首尾空白的匹配
  const trimmedText = text.trim()
  const trimmedIndex = essay.indexOf(trimmedText)
  if (trimmedIndex !== -1) {
    return { start: trimmedIndex, end: trimmedIndex + trimmedText.length }
  }

  return null
}

/**
 * 处理 AI 返回的 issues，将 text 转换为 location
 */
function processIssuesWithLocation(
  issues: Array<{ id?: string; type: string; severity: string; text?: string; description: string }>,
  essay: string
): WritingIssue[] {
  return issues
    .map((issue, index) => {
      const location = issue.text ? locateIssueText(essay, issue.text) : null

      // 跳过无法定位的问题
      if (!location) {
        console.warn(`无法定位问题文本: "${issue.text}"`)
        return null
      }

      return {
        id: issue.id || `issue_${index + 1}`,
        type: issue.type as WritingIssue['type'],
        severity: issue.severity as WritingIssue['severity'],
        location,
        description: issue.description
      }
    })
    .filter((issue): issue is WritingIssue => issue !== null)
}

/**
 * 解析 JSON 响应（处理可能的 markdown 代码块）
 */
function parseJsonResponse<T>(response: string): T {
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
