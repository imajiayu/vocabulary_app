// types/writing.ts - IELTS 写作练习模块类型定义

// ============================================================================
// 数据库实体类型
// ============================================================================

/**
 * 文件夹 - 用于组织题目
 */
export interface WritingFolder {
  id: number
  user_id: number
  name: string
  sort_order: number
  created_at: string
}

/**
 * 写作题目
 */
export interface WritingPrompt {
  id: number
  user_id: number
  folder_id: number | null
  task_type: 1 | 2  // Task 1 或 Task 2
  prompt_text: string
  image_url: string | null  // Task 1 图表图片 URL
  notes: string | null  // 题目级别的笔记
  sort_order: number
  created_at: string
}

/**
 * 练习会话
 */
export interface WritingSession {
  id: number
  user_id: number
  prompt_id: number | null
  prompt?: WritingPrompt  // 关联查询时填充
  time_limit: number      // 秒
  time_spent: number | null  // 实际用时（秒）
  status: WritingSessionStatus
  created_at: string
  completed_at: string | null
  versions?: WritingVersion[]  // 关联查询时填充
}

export type WritingSessionStatus = 'writing' | 'revision' | 'completed'

/**
 * 作文版本
 */
export interface WritingVersion {
  id: number
  session_id: number
  version_number: 1 | 2  // V2改动：只有初稿和终稿
  content: string
  word_count: number | null
  feedback: WritingFeedback | null
  scores: WritingScores | null
  created_at: string
}

// ============================================================================
// AI 反馈类型
// ============================================================================

/**
 * AI 反馈结构
 */
export interface WritingFeedback {
  issues: WritingIssue[]
  summary: string
  improvement?: string  // 第2版起，与上版对比的改进说明
}

/**
 * 单个问题
 */
export interface WritingIssue {
  id: string
  type: WritingIssueType
  severity: 'minor' | 'major'
  location: { start: number; end: number }
  description: string
  suggestion?: string  // 用户请求后填充
}

export type WritingIssueType = 'grammar' | 'vocabulary' | 'coherence' | 'task'

/**
 * IELTS 评分
 */
export interface WritingScores {
  taskAchievement: number    // Task 1: Task Achievement / Task 2: Task Response
  coherenceCohesion: number  // 连贯与衔接
  lexicalResource: number    // 词汇资源
  grammaticalRange: number   // 语法范围与准确性
  overall: number            // 总分（四项平均，四舍五入到 0.5）
}

/**
 * 评分详细反馈
 */
export interface WritingScoreFeedback {
  taskAchievement: string
  coherenceCohesion: string
  lexicalResource: string
  grammaticalRange: string
}

// ============================================================================
// API Payload 类型
// ============================================================================

export interface CreateFolderPayload {
  name: string
}

export interface UpdateFolderPayload {
  name?: string
  sort_order?: number
}

export interface CreatePromptPayload {
  folder_id?: number | null
  task_type: 1 | 2
  prompt_text: string
  image?: File  // 可选的图片文件
}

export interface UpdatePromptPayload {
  folder_id?: number | null
  prompt_text?: string
  image_url?: string | null
}

export interface CreateSessionPayload {
  prompt_id: number
  time_limit: number
}

export interface UpdateSessionPayload {
  time_spent?: number | null
  status?: WritingSessionStatus
  completed_at?: string | null
}

export interface CreateVersionPayload {
  session_id: number
  version_number: 1 | 2
  content: string
  word_count?: number
}

export interface UpdateVersionPayload {
  feedback?: WritingFeedback
  scores?: WritingScores
}

// ============================================================================
// UI 状态类型
// ============================================================================

/**
 * 页面状态机
 * V2改动：移除 feedback_2，V2 提交后直接进入 completed
 */
export type WritingPageState =
  | 'idle'           // 未选择题目，显示欢迎界面
  | 'prompt_selected' // 已选题目，显示"开始练习"按钮
  | 'writing'        // 写作中，显示编辑器+计时器
  | 'feedback_1'     // 第一轮反馈，显示反馈面板
  | 'revision'       // 修改中（isRevising=true 时的状态）
  | 'completed'      // V2 提交后直接进入，显示评分+Diff+笔记+问答

/**
 * 高亮区域（用于编辑器）
 */
export interface HighlightRegion {
  start: number
  end: number
  type: WritingIssueType
  issueId: string
}

/**
 * 终稿问答消息
 */
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  selectedText?: string  // 用户选中的文本
  timestamp: string
}

// ============================================================================
// 常量
// ============================================================================

/**
 * 任务类型时间限制（秒）
 */
export const TASK_TIME_LIMITS = {
  1: 20 * 60,  // Task 1: 20 分钟
  2: 40 * 60   // Task 2: 40 分钟
} as const

/**
 * 问题类型中文名
 */
export const ISSUE_TYPE_LABELS: Record<WritingIssueType, string> = {
  grammar: '语法',
  vocabulary: '词汇',
  coherence: '连贯',
  task: '任务完成'
} as const

/**
 * 评分维度中文名
 */
export const SCORE_DIMENSION_LABELS = {
  taskAchievement: '任务完成度',
  coherenceCohesion: '连贯与衔接',
  lexicalResource: '词汇资源',
  grammaticalRange: '语法范围与准确性'
} as const
