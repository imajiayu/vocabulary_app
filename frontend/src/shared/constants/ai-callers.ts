/**
 * AI 调用方 + 可选模型目录
 *
 * 上游网关采用 OpenAI 兼容协议：同一 base URL + 同一 API key，
 * 通过 `model` 字符串路由到不同供应商（Anthropic / Google / OpenAI / ElevenLabs）。
 *
 * 所有模型元数据（价格/上下文）写死在前端展示。
 * 用户在 Settings → AI 模型 按 caller（文本）或全局（STT/TTS）选择 model；
 * 选择结果保存到 user_config.config.aiModels / aiSttModel / aiTtsModel。
 */

// ─── Caller 分组 ─────────────────────────────────────────────

export type AiCallerGroup = 'vocabulary' | 'course' | 'speaking' | 'writing'

export interface AiCallerMeta {
  label: string
  group: AiCallerGroup
  defaultModel: string
  description?: string
}

const _AI_CALLERS_LITERAL = {
  speaking_feedback: {
    label: '口语反馈',
    group: 'speaking',
    defaultModel: 'gemini-3-flash-preview',
    description: 'IELTS Part 1/2/3 AI 反馈与评分',
  },
  writing_paragraph_feedback: {
    label: '写作·逐段反馈',
    group: 'writing',
    defaultModel: 'gemini-3-flash-preview',
    description: '作文按段给出修改建议（JSON 输出）',
  },
  writing_outline_optimize: {
    label: '写作·大纲优化',
    group: 'writing',
    defaultModel: 'gemini-3-flash-preview',
  },
  writing_paragraph_reoptimize: {
    label: '写作·段落重优化',
    group: 'writing',
    defaultModel: 'gemini-3-flash-preview',
  },
  writing_final_scoring: {
    label: '写作·最终评分',
    group: 'writing',
    defaultModel: 'gemini-3-flash-preview',
    description: '四维评分 + 总评（JSON 输出）',
  },
  writing_final_qa: {
    label: '写作·终稿问答',
    group: 'writing',
    defaultModel: 'gemini-3-flash-preview',
  },
  writing_text_edit: {
    label: '写作·文本编辑',
    group: 'writing',
    defaultModel: 'gemini-3-flash-preview',
  },
  writing_outline_qa: {
    label: '写作·大纲问答',
    group: 'writing',
    defaultModel: 'gemini-3-flash-preview',
  },
  writing_outline_edit: {
    label: '写作·大纲文本编辑',
    group: 'writing',
    defaultModel: 'gemini-3-flash-preview',
  },
  definition_fallback: {
    label: '释义 AI 回退',
    group: 'vocabulary',
    defaultModel: 'gemini-3-flash-preview',
    description: 'Wiktionary 查不到时生成结构化释义',
  },
  vocab_assist: {
    label: '词汇助手',
    group: 'vocabulary',
    defaultModel: 'gemini-3-flash-preview',
    description: '词汇页面的 AI 对话按钮',
  },
  ai_review: {
    label: 'AI 复习',
    group: 'vocabulary',
    defaultModel: 'gemini-3-flash-preview',
    description: '按日期汇总当天单词生成中英互译练习',
  },
  translation_grading: {
    label: '翻译批改',
    group: 'course',
    defaultModel: 'gemini-3-flash-preview',
    description: '课程翻译练习批改（JSON 输出）',
  },
  course_chat: {
    label: '课程聊天',
    group: 'course',
    defaultModel: 'gemini-3-flash-preview',
    description: '课程内嵌 AI 助手（流式对话）',
  },
} as const satisfies Record<string, AiCallerMeta>

export type AiCaller = keyof typeof _AI_CALLERS_LITERAL

export const AI_CALLERS: Record<AiCaller, AiCallerMeta> = _AI_CALLERS_LITERAL

export const AI_CALLER_GROUPS: { key: AiCallerGroup; label: string }[] = [
  { key: 'vocabulary', label: '词汇' },
  { key: 'course', label: '课程' },
  { key: 'speaking', label: '口语' },
  { key: 'writing', label: '写作' },
]

export function listCallers(): AiCaller[] {
  return Object.keys(AI_CALLERS) as AiCaller[]
}

export function callersByGroup(group: AiCallerGroup): AiCaller[] {
  return listCallers().filter(c => AI_CALLERS[c].group === group)
}

// ─── 文本 (Chat) 模型目录 ─────────────────────────────────────

export interface TextModelMeta {
  id: string
  context: string
  inputPrice: string
  outputPrice: string
}

export const AI_TEXT_MODELS: TextModelMeta[] = [
  { id: 'claude-haiku-4-5',        context: '200K', inputPrice: '$1/M',    outputPrice: '$5/M' },
  { id: 'claude-sonnet-4-6',       context: '1M',   inputPrice: '$3/M',    outputPrice: '$15/M' },
  { id: 'claude-opus-4-6',         context: '1M',   inputPrice: '$5/M',    outputPrice: '$25/M' },
  { id: 'claude-opus-4-7',         context: '1M',   inputPrice: '$5/M',    outputPrice: '$25/M' },
  { id: 'gemini-3-flash-preview',  context: '1M',   inputPrice: '$0.50/M', outputPrice: '$3/M' },
  { id: 'gemini-3.1-pro-preview',  context: '1M',   inputPrice: '$2/M',    outputPrice: '$12/M' },
  { id: 'gpt-5.4-mini',            context: '272K', inputPrice: '$0.75/M', outputPrice: '$4.5/M' },
  { id: 'gpt-5.4',                 context: '1.1M', inputPrice: '$2.5/M',  outputPrice: '$15/M' },
]

// ─── TTS 模型目录 ───────────────────────────────────────────

export interface TtsModelMeta {
  id: string
  price: string
}

export const AI_TTS_MODELS: TtsModelMeta[] = [
  { id: 'elevenlabs/eleven_multilingual_v2', price: '$0.18/1K chars' },
  { id: 'elevenlabs/eleven_v3',              price: '$0.18/1K chars' },
]

export const AI_TTS_DEFAULT = 'elevenlabs/eleven_multilingual_v2'

// ─── STT 模型目录 ───────────────────────────────────────────

export interface SttModelMeta {
  id: string
  /** 描述性定价字符串 */
  price: string
}

export const AI_STT_MODELS: SttModelMeta[] = [
  { id: 'gpt-4o-mini-transcribe', price: '$1.25/M 输入 · $5/M 输出' },
  { id: 'gpt-4o-transcribe',      price: '$2.5/M 输入 · $10/M 输出' },
]

export const AI_STT_DEFAULT = 'gpt-4o-mini-transcribe'
