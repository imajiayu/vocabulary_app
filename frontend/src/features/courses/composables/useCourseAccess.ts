/**
 * 课程访问准入检查
 *
 * 课程页面（index + lesson）依赖用户在主站设置中至少存在一个对应语言的 source。
 * 没有对应 source 时，无法添加课程词汇 / 同步进度，因此直接拦截入口。
 */

import { useSettings } from '@/shared/composables/useSettings'
import type { CourseConfig } from '../types/course'
import type { SourceLang } from '@/shared/types'

export interface CourseAccessResult {
  allowed: boolean
  /** 用户已配置、且 lang 与课程匹配的 source 列表（用于调试 / 提示） */
  matchingSources: string[]
  reason?: string
}

/**
 * 课程入口准入检查（异步，可能触发 settings 加载）
 *
 * @param config 课程配置
 * @returns 是否允许进入 + 匹配的 source 列表
 */
export async function checkCourseAccess(config: CourseConfig): Promise<CourseAccessResult> {
  const { loadSettings } = useSettings()
  try {
    const settings = await loadSettings()
    const customSources = (settings.sources?.customSources ?? {}) as Record<string, SourceLang>
    const matching = Object.entries(customSources)
      .filter(([, lang]) => lang === config.lang)
      .map(([name]) => name)

    if (matching.length === 0) {
      return {
        allowed: false,
        matchingSources: [],
        reason: `请先在「设置」中创建至少一个 ${langLabel(config.lang)} 词本`,
      }
    }
    return { allowed: true, matchingSources: matching }
  } catch (error) {
    // 加载失败时放行（兜底交给页面内的 source 选择 UI 处理）
    return {
      allowed: true,
      matchingSources: [],
      reason: error instanceof Error ? error.message : String(error),
    }
  }
}

function langLabel(lang: SourceLang): string {
  switch (lang) {
    case 'uk': return '乌克兰语'
    case 'en': return '英语'
    default: return lang
  }
}
