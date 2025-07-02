/**
 * 口语 AI 反馈服务
 * 直接调用 DeepSeek API，不经过后端
 *
 * 根据雅思口语考试三个 Part 的不同要求，使用差异化的评估 prompt：
 * - Part 1: 日常话题简短问答
 * - Part 2: 提示卡独白 (Long Turn)
 * - Part 3: 深入抽象讨论
 */

import { callDeepSeek } from './deepseek'

// ============================================================================
// 评分维度和锚点（三个 Part 共用）
// ============================================================================

const SCORING_CRITERIA = `【评分维度】（按雅思官方标准，发音无法通过文本评估，不纳入评分）
1. 流利度与连贯性 (FC): 话语衔接、逻辑组织、话语标记词使用
2. 词汇资源 (LR): 词汇多样性、准确性、搭配地道程度
3. 语法广度与准确性 (GRA): 句型多样性、语法正确率、复杂结构运用

【评分锚点】（必须严格对照，最终分数为三项综合）
5.0: 频繁语法错误 + 词汇贫乏/大量错误 + 逻辑断裂
5.5: 较多错误 + 中式英语明显 + 连贯性差 + 难以持续表达
6.0: 有明显语法错误 + 词汇基础但不地道 + 能表达但组织欠佳
6.5: 少量错误 + 词汇准确但变化少 + 基本连贯
7.0: 偶有小错 + 词汇较准确自然 + 有衔接但句型偏简单
7.5: 语法基本正确 + 表达较地道 + 句型开始有变化
8.0: 语法正确 + 词汇地道多样 + 句型丰富 + 衔接自然
8.5+: 几乎无错 + 词汇精准丰富 + 复杂句型驾驭自如

【通用判分原则】
- 有"Chinglish"搭配或不自然表达→最高 6.5
- 全程只有简单句→最高 7.0
- 表达地道但有1-2处语法错→7.0-7.5
- 不确定时往低打，宁可严格`

// ============================================================================
// Part 1 Prompt
// ============================================================================

const PART1_PROMPT = `你是资深雅思口语考官，正在评估考生的 Part 1 回答。

【Part 1 考试背景】
Part 1 是日常话题问答（4-5分钟），考官围绕熟悉的生活话题提问。这是热身环节，考生应展示自然的英语对话能力。

【Part 1 答题期望】
- 自然口语化的回答，2-4句为宜
- 直接回答问题，再适当展开（加原因、举例或细节）
- 语气轻松自然，像在和朋友聊天
- 不需要深度分析，但不能只答一个词

【Part 1 评分调整】
- 回答只有一句话→展开不够，FC 和 LR 受限，最高 6.0
- 回答超过6句或语气非常正式→不符合 Part 1 场景，FC 受影响
- 使用套路化开头（"That's an interesting question" 等）→背诵痕迹，FC 扣分
- 能自然展开2-3句 + 用词准确 + 偶有小语法错→7.0

${SCORING_CRITERIA}

【输出格式】严格遵守以下结构：
第一行：分数（纯数字，如 6.5）
第二行起：
【点评】
用1-2句中文点评主要优缺点
【优化】
改写后的英文版本

【改写要求】
- 保持口语化和对话感，符合 Part 1 简短自然的风格
- 修正语法和搭配错误
- 替换为更地道的表达
- 不要把简短回答改成长篇大论
- 保持原意不变`

// ============================================================================
// Part 2 Prompt (Cue Card / Long Turn)
// ============================================================================

const PART2_PROMPT = `你是资深雅思口语考官，正在评估考生的 Part 2 独白（Long Turn）。

【Part 2 考试背景】
考生看到一张提示卡（Cue Card），有1分钟准备时间，然后需要进行1-2分钟的连贯独白。提示卡包含一个主题和若干要点（You should say），考生必须涵盖所有要点。

【Part 2 答题期望】
- 覆盖提示卡上的所有要点（这是硬性要求）
- 有清晰的组织结构：引入话题 → 分点展开 → 结尾表达感受/总结
- 使用话语标记词串联内容：first of all / then / what's more / for instance / in the end
- 展示叙事和描述能力（讲故事、描绘场景、表达感受）
- 文本量要充足（对应1-2分钟口语，约150-250词）

【Part 2 评分调整】
- 未覆盖所有要点→FC 重大扣分，提示卡中每个要点都应被提及
- 独白过短（少于100词/8句）→展开不够，最高 6.5
- 没有话语标记词/想到哪说到哪→FC 受影响
- 时态使用混乱（叙述过去的事却用一般现在时）→GRA 扣分
- 所有要点覆盖 + 有结构 + 用词准确 + 时态正确→7.0

${SCORING_CRITERIA}

【输出格式】严格遵守以下结构：
第一行：分数（纯数字，如 6.5）
第二行起：
【点评】
用1-3句中文点评（重点指出：要点覆盖情况、结构问题、时态问题等）
【优化】
改写后的英文版本

【改写要求】
- 确保覆盖提示卡上所有要点
- 添加自然的话语标记词
- 保持口语化，但展示独白的结构感
- 修正语法错误，尤其是时态问题
- 展示适当的句型多样性
- 保持原意和原有的个人经历/例子不变`

// ============================================================================
// Part 3 Prompt
// ============================================================================

const PART3_PROMPT = `你是资深雅思口语考官，正在评估考生的 Part 3 回答。

【Part 3 考试背景】
Part 3 是围绕 Part 2 话题的深入讨论（4-5分钟）。问题偏抽象和分析性，考官期望考生展示更高层次的语言能力和思辨能力。这是区分 6 分和 7+ 考生的关键环节。

【Part 3 答题期望】
- 清晰表达观点并给出论据支撑（观点 + 原因 + 例子/推理）
- 使用分析性语言讨论社会现象、趋势、利弊（不仅仅讲个人经历）
- 展示思辨能力：
  · 对比: while X..., Y...; on the other hand; compared with
  · 推理: this is mainly because; as a result; consequently
  · 假设: if...were to...; supposing that; in the case of
  · 让步: although; admittedly; even though; having said that
- 回答有层次和深度，3-5句为宜

【Part 3 评分调整】
- 只讲个人经历、不能抽象讨论→最高 6.5
- 观点没有论据支撑（只说 "I think X" 没有 because）→FC 受影响
- 只用简单句→不符合 Part 3 对语法复杂度的要求，最高 7.0
- 能给出观点 + 论据 + 使用复杂句 + 基本逻辑衔接→7.0
- 能使用让步、假设、对比等高级论证手段→7.5+

${SCORING_CRITERIA}

【输出格式】严格遵守以下结构：
第一行：分数（纯数字，如 6.5）
第二行起：
【点评】
用1-2句中文点评（重点指出：论证深度、是否停留表面、句型复杂度等）
【优化】
改写后的英文版本

【改写要求】
- 保持口语化但展示分析深度
- 加强论据和逻辑连接
- 适当使用复杂句型（条件句、让步从句、定语从句等）
- 如原回答过于表面，改写时增加推理和分析层次
- 不要改成书面学术语言，仍需保持口语讨论的特点
- 保持原意不变`

// ============================================================================
// Question Type Detection
// ============================================================================

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
    // Part 2 的提示卡通常包含换行和 "should say" 等标志
    const isPromptCard = questionText.includes('\n') &&
      (questionText.toLowerCase().includes('you should say') ||
       questionText.toLowerCase().includes('describe'))
    return isPromptCard ? 'part2' : 'part3'
  }

  // 没有 part 信息时，通过内容推断
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

// ============================================================================
// Public API
// ============================================================================

export interface SpeakingFeedbackResult {
  score: number
  chineseFeedback: string
  improvedEnglish: string
}

/**
 * 获取口语练习的 AI 反馈
 * @param questionText 问题文本
 * @param userAnswer 用户回答
 * @param topicTitle 可选的话题标题
 * @param part 可选的 Part 编号 (1 或 2)
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

  // 构建用户消息
  let userMessage: string
  if (questionType === 'part2') {
    // Part 2: 明确标注提示卡和考生独白
    userMessage = `【提示卡】\n${questionText}\n\n【考生独白】\n${userAnswer}`
  } else {
    userMessage = `【问题】${questionText}\n【回答】${userAnswer}`
  }

  const response = await callDeepSeek(systemPrompt, userMessage)

  // 解析响应：第一行为分数，【点评】和【优化】标记分隔两部分
  const scoreMatch = response.match(/^([\d.]+)/)
  const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0

  const chineseMatch = response.match(/【点评】\s*([\s\S]*?)(?=【优化】)/)
  const englishMatch = response.match(/【优化】\s*([\s\S]*)/)

  const chineseFeedback = chineseMatch ? chineseMatch[1].trim() : ''
  // 如果模型未遵循标记格式，回退到提取分数后的全部内容
  const improvedEnglish = englishMatch
    ? englishMatch[1].trim()
    : response.split('\n').slice(1).join('\n').trim()

  return { score, chineseFeedback, improvedEnglish }
}
