/**
 * 设置相关的 Supabase 直连 API
 *
 * 全部使用 Supabase 直连，不经过后端
 * - 基本读写：Supabase Database (user_config 表)
 * - 复杂逻辑：Supabase Edge Functions
 */

import { supabase } from '@/shared/config/supabase'
import { getCurrentUserId } from '@/shared/composables/useUserSelection'
import type { UserSettings } from '@/shared/types'

// 默认配置（与后端 DEFAULT_CONFIG 保持一致）
const DEFAULT_CONFIG: UserSettings = {
  learning: {
    dailyReviewLimit: 300,
    dailySpellLimit: 200,
    maxPrepDays: 30,
    lapseQueueSize: 25,
    lapseMaxValue: 4,
    lapseInitialValue: 3,
    lapseFastExitEnabled: true,
    lapseConsecutiveThreshold: 4,
    defaultShuffle: true,
    lowEfExtraCount: 0
  },
  management: {
    wordsLoadBatchSize: 200,
    definitionFetchThreads: 3
  },
  sources: {
    customSources: ['IELTS', 'GRE']
  },
  audio: {
    accent: 'us',
    autoPlayOnWordChange: true,
    autoPlayAfterAnswer: true
  },
  hotkeys: {
    reviewInitial: {
      remembered: 'ArrowLeft',
      notRemembered: 'ArrowRight',
      stopReview: 'ArrowDown'
    },
    reviewAfter: {
      wrong: 'ArrowLeft',
      next: 'ArrowRight'
    },
    spelling: {
      playAudio: 'ArrowLeft',
      forgot: 'ArrowRight',
      next: 'Enter'
    }
  }
}

/**
 * 深度合并两个对象
 */
function deepMerge<T extends object>(base: T, override: Partial<T>): T {
  const result = { ...base }
  for (const key in override) {
    const overrideValue = override[key as keyof T]
    const baseValue = result[key as keyof T]
    if (
      overrideValue !== undefined &&
      typeof overrideValue === 'object' &&
      overrideValue !== null &&
      !Array.isArray(overrideValue) &&
      typeof baseValue === 'object' &&
      baseValue !== null &&
      !Array.isArray(baseValue)
    ) {
      (result as Record<string, unknown>)[key] = deepMerge(
        baseValue as object,
        overrideValue as Partial<object>
      )
    } else if (overrideValue !== undefined) {
      (result as Record<string, unknown>)[key] = overrideValue
    }
  }
  return result
}

// Edge Function 响应接口
interface AdjustMaxPrepDaysResponse {
  success: boolean
  affected: {
    interval: number
    next_review: number
    spell_next_review: number
  }
  error?: string
}

interface DeleteSourceResponse {
  success: boolean
  message: string
  deleted_words: number
  deleted_progress: number
  remaining_sources: string[]
  error?: string
}

/**
 * 设置 Supabase 直连 API 类
 */
export class SettingsSupabaseApi {
  /**
   * 获取用户设置（直连 Supabase）
   */
  static async getSettings(): Promise<UserSettings> {
    const userId = getCurrentUserId()

    const { data, error } = await supabase
      .from('user_config')
      .select('config')
      .eq('user_id', userId)
      .single()

    if (error) {
      // 没有记录时返回默认配置
      if (error.code === 'PGRST116') {
        return { ...DEFAULT_CONFIG }
      }
      throw new Error(`获取设置失败: ${error.message}`)
    }

    // 将数据库配置与默认配置合并，确保所有字段存在
    const dbConfig = (data?.config || {}) as Partial<UserSettings>
    return deepMerge(DEFAULT_CONFIG, dbConfig)
  }

  /**
   * 更新用户设置（直连 Supabase）
   * @param settings 要更新的设置（部分更新）
   * @param oldMaxPrepDays 如果传入，且新 maxPrepDays 变小，会调用 Edge Function 调整单词
   */
  static async updateSettings(
    settings: Partial<UserSettings>,
    oldMaxPrepDays?: number
  ): Promise<UserSettings> {
    const userId = getCurrentUserId()

    // 1. 获取当前配置
    const currentSettings = await this.getSettings()

    // 2. 合并新配置
    const mergedConfig = deepMerge(currentSettings, settings)

    // 3. 检查是否需要调整单词（maxPrepDays 变小）
    const newMaxPrepDays = settings.learning?.maxPrepDays
    if (
      oldMaxPrepDays !== undefined &&
      newMaxPrepDays !== undefined &&
      newMaxPrepDays < oldMaxPrepDays
    ) {
      await this.adjustMaxPrepDays(newMaxPrepDays)
    }

    // 4. 保存到数据库（upsert 模式）
    const { data: existing } = await supabase
      .from('user_config')
      .select('user_id')
      .eq('user_id', userId)
      .single()

    if (existing) {
      // 更新现有记录
      const { error } = await supabase
        .from('user_config')
        .update({ config: mergedConfig })
        .eq('user_id', userId)

      if (error) {
        throw new Error(`更新设置失败: ${error.message}`)
      }
    } else {
      // 插入新记录
      const { error } = await supabase
        .from('user_config')
        .insert({ user_id: userId, config: mergedConfig })

      if (error) {
        throw new Error(`保存设置失败: ${error.message}`)
      }
    }

    return mergedConfig
  }

  /**
   * 调用 Edge Function 调整单词复习时间
   * 当 maxPrepDays 变小时使用
   */
  static async adjustMaxPrepDays(maxPrepDays: number): Promise<AdjustMaxPrepDaysResponse> {
    const userId = getCurrentUserId()

    const { data, error } = await supabase.functions.invoke('adjust-max-prep-days', {
      body: { maxPrepDays },
      headers: { 'x-user-id': String(userId) }
    })

    if (error) {
      throw new Error(`调整 maxPrepDays 失败: ${error.message}`)
    }

    const response = data as AdjustMaxPrepDaysResponse
    if (!response.success) {
      throw new Error(response.error || '调整失败')
    }

    return response
  }

  /**
   * 删除指定 source（调用 Edge Function）
   */
  static async deleteSource(sourceName: string): Promise<DeleteSourceResponse> {
    const userId = getCurrentUserId()

    const { data, error } = await supabase.functions.invoke('delete-source', {
      body: { sourceName },
      headers: { 'x-user-id': String(userId) }
    })

    if (error) {
      throw new Error(`删除 source 失败: ${error.message}`)
    }

    const response = data as DeleteSourceResponse
    if (!response.success) {
      throw new Error(response.error || '删除失败')
    }

    return response
  }

  /**
   * 获取所有 sources 的统计信息（直连 Supabase）
   */
  static async getSourcesStats(): Promise<Record<string, number>> {
    const userId = getCurrentUserId()

    // 直接查询 words 表，按 source 分组统计
    const { data, error } = await supabase
      .from('words')
      .select('source')
      .eq('user_id', userId)

    if (error) {
      throw new Error(`获取 source 统计失败: ${error.message}`)
    }

    // 统计每个 source 的单词数
    const stats: Record<string, number> = {}
    for (const row of data || []) {
      const source = row.source as string
      stats[source] = (stats[source] || 0) + 1
    }

    // 获取用户配置的 customSources，确保所有配置的 source 都有统计
    const settings = await this.getSettings()
    for (const source of settings.sources.customSources) {
      if (!(source in stats)) {
        stats[source] = 0
      }
    }

    return stats
  }
}
