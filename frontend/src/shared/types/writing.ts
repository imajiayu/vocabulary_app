// types/writing.ts - IELTS 写作练习模块类型定义

// ============================================================================
// 数据库实体类型
// ============================================================================

/**
 * 文件夹 - 用于组织题目
 */
export interface WritingFolder {
  id: number
  user_id: string
  name: string
  sort_order: number
  created_at: string
}

/**
 * 写作题目
 */
export interface WritingPrompt {
  id: number
  user_id: string
  folder_id: number | null
  task_type: 1 | 2  // Task 1 或 Task 2
  prompt_text: string
  image_url: string | null  // Task 1 图表图片 URL
  notes: string | null  // 题目级别的笔记
  sort_order: number
  created_at: string
}

/**
 * 练习会话（V3：合并了原 writing_versions 的字段）
 */
export interface WritingSession {
  id: number
  user_id: string
  prompt_id: number | null
  prompt?: WritingPrompt  // 关联查询时填充
  time_limit: number      // 秒
  time_spent: number | null  // 实际用时（秒）
  status: WritingSessionStatus
  outline: string | null
  draft_content: string | null
  final_content: string | null
  feedback: ParagraphFeedback[] | null
  scores: WritingScores | null
  word_count: number | null
  created_at: string
  completed_at: string | null
}

export type WritingSessionStatus = 'outline' | 'writing' | 'feedback' | 'revision' | 'completed'

// ============================================================================
// AI 反馈类型
// ============================================================================

/**
 * 逐段反馈 — 每段对应 draft_content 按 \n\n 分割后的段落
 */
export interface ParagraphFeedback {
  improved: string  // 改进后的段落文本
  notes: string     // 改进说明
}

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
  outline?: string | null
  draft_content?: string | null
  final_content?: string | null
  feedback?: ParagraphFeedback[] | null
  scores?: WritingScores | null
  word_count?: number | null
}

// ============================================================================
// UI 状态类型
// ============================================================================

/**
 * 页面状态机
 * V3: outline → writing → feedback → revision → completed
 */
export type WritingPageState =
  | 'idle'           // 未选择题目，显示欢迎界面
  | 'prompt_selected' // 已选题目，显示"开始练习"按钮
  | 'outline'        // 大纲编辑阶段
  | 'writing'        // 写作中，显示编辑器+计时器
  | 'feedback'       // 逐段反馈阶段
  | 'revision'       // 修改中
  | 'completed'      // 已完成，显示评分

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
 * 评分维度中文名
 */
/**
 * 会话状态中文名
 */
export const SESSION_STATUS_LABELS: Record<WritingSessionStatus, string> = {
  outline: '大纲',
  writing: '写作中',
  feedback: '反馈',
  revision: '修改中',
  completed: '已完成'
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
