/**
 * 课程配置类型
 */

import type { SourceLang } from '@/shared/types'

export interface CourseConfig {
  /** 课程 ID，用于路由和数据库 */
  id: string
  /** 课程显示名称 */
  name: string
  /** 课程语言代码 */
  lang: SourceLang
  /** AI TTS 语言代码（BCP-47，如 'uk-UA', 'en-US'） */
  ttsLang: string
  /** 课程 URL 前缀（如 '/uk'） */
  basePath: string
  /** CSS data-course 属性值 */
  theme: string
  /** 单词 CSS 类名 */
  wordClass: string
  /** 例句文本 CSS 类名 */
  textClass: string
  /** AI 聊天助手名称 */
  chatName: string
  /** AI 聊天系统提示词 */
  chatSystemPrompt: string
  /** 添加词汇时是否发送 definition */
  sendDefinition: boolean
  /** TTS source（用于服务器缓存路径） */
  ttsSource: string
  /** AI 释义兜底的例句领域（领域 key，映射到 definition.ts 的额外约束）；不设则用通用例句 */
  vocabExampleDomain?: string
}
