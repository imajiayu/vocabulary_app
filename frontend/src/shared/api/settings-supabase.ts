/**
 * 设置相关的 Supabase 直连 API
 *
 * 全部使用 Supabase 直连，不经过后端
 * - 基本读写：Supabase Database (user_config 表)
 * - 复杂逻辑：Supabase Edge Functions
 */

import { supabase } from '@/shared/config/supabase'
import { getCurrentUserId } from '@/shared/composables/useAuth'
import type { UserSettings, SourceLang, SourceSpecificSettings } from '@/shared/types'

// 每个 source 的默认设置
const _DEFAULT_SOURCE_SETTINGS: SourceSpecificSettings = {
  learning: {
    dailyReviewLimit: 50,
    dailySpellLimit: 50,
    maxPrepDays: 90,
    lapseQueueSize: 20,
    defaultShuffle: true,
    lowEfExtraCount: 0
  },
  accent: 'us'
}

/** 每次返回独立深拷贝，避免共享引用污染 */
export function createDefaultSourceSettings(): SourceSpecificSettings {
  return JSON.parse(JSON.stringify(_DEFAULT_SOURCE_SETTINGS))
}

// 默认配置
const DEFAULT_CONFIG: UserSettings = {
  sourceSettings: {
    IELTS: createDefaultSourceSettings()
  },
  audio: {
    autoPlayOnWordChange: true,
    autoPlayAfterAnswer: true
  },
  management: {
    wordsLoadBatchSize: 200,
    definitionFetchThreads: 3
  },
  sources: {
    customSources: { IELTS: 'en' },
    sourceOrder: ['IELTS']
  },
  hotkeys: {
    reviewInitial: {
      remembered: 'ArrowLeft',
      notRemembered: 'ArrowRight',
      stopReview: 'ArrowDown',
      resetTimer: ''
    },
    reviewAfter: {
      wrong: 'ArrowLeft',
      next: 'ArrowRight'
    },
    spelling: {
      playAudio: 'ArrowLeft',
      forgot: 'ArrowRight',
      next: 'Enter',
      resetInput: '',
      stopSpell: ''
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
  remaining_sources: Record<string, SourceLang>
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbConfig = (data?.config || {}) as any

    // 将数据库配置与默认配置合并，确保所有字段存在
    const merged = deepMerge(DEFAULT_CONFIG, dbConfig as Partial<UserSettings>)

    // sourceSettings 是动态键集合，整体替换而非递归合并（同 customSources）
    if (dbConfig.sourceSettings) {
      merged.sourceSettings = {}
      for (const [key, val] of Object.entries(dbConfig.sourceSettings)) {
        merged.sourceSettings[key] = deepMerge(
          createDefaultSourceSettings(),
          val as Partial<SourceSpecificSettings>
        )
      }
    }

    // customSources 是动态键集合，必须整体替换而非递归合并
    if (dbConfig.sources?.customSources) {
      merged.sources.customSources = dbConfig.sources.customSources
    }

    // sourceOrder 兼容：旧数据无此字段时从 customSources 键推导
    if (dbConfig.sources?.sourceOrder) {
      merged.sources.sourceOrder = dbConfig.sources.sourceOrder
    } else if (dbConfig.sources?.customSources) {
      merged.sources.sourceOrder = Object.keys(dbConfig.sources.customSources)
    }

    // 归一化：确保 sourceOrder 与 customSources 同步
    const sourceKeys = new Set(Object.keys(merged.sources.customSources))
    const order = merged.sources.sourceOrder ?? []
    const filtered = order.filter(s => sourceKeys.has(s))
    const missing = [...sourceKeys].filter(s => !filtered.includes(s))
    merged.sources.sourceOrder = [...filtered, ...missing]

    // 确保每个 source 都有对应的 sourceSettings 条目
    for (const key of sourceKeys) {
      if (!merged.sourceSettings[key]) {
        merged.sourceSettings[key] = createDefaultSourceSettings()
      }
    }

    // 剔除 sourceSettings 中不在 customSources 里的孤立条目
    // 防御：deleteSource 失败/旧版本/并发写入可能在 DB 残留孤立条目，
    // 而 updateSettings 的 deepMerge 会把这些孤立条目持续保留到 DB，形成自愈循环
    for (const key of Object.keys(merged.sourceSettings)) {
      if (!sourceKeys.has(key)) {
        delete merged.sourceSettings[key]
      }
    }

    return merged
  }

  /**
   * 更新用户设置（直连 Supabase）
   * @param settings 要更新的设置（部分更新）
   * @param oldSourceSettings 如果传入，会对比每个 source 的 maxPrepDays 是否变小
   */
  static async updateSettings(
    settings: Partial<UserSettings>,
    oldSourceSettings?: Record<string, SourceSpecificSettings>
  ): Promise<UserSettings> {
    const userId = getCurrentUserId()

    // 1. 获取当前配置
    const currentSettings = await this.getSettings()

    // 2. 合并新配置
    const mergedConfig = deepMerge(currentSettings, settings)

    // sourceSettings 需要特殊合并：source key 级别浅合并，每个 source 内部 deepMerge
    if (settings.sourceSettings) {
      for (const [source, partial] of Object.entries(settings.sourceSettings)) {
        const current = currentSettings.sourceSettings[source] ?? createDefaultSourceSettings()
        mergedConfig.sourceSettings[source] = deepMerge(current, partial)
      }
    }

    // 3. 检查是否需要调整单词（per-source maxPrepDays 变小）
    if (oldSourceSettings && settings.sourceSettings) {
      for (const [source, newSourceSettings] of Object.entries(settings.sourceSettings)) {
        const oldMaxPrepDays = oldSourceSettings[source]?.learning?.maxPrepDays
        const newMaxPrepDays = newSourceSettings.learning?.maxPrepDays
        if (
          oldMaxPrepDays !== undefined &&
          newMaxPrepDays !== undefined &&
          newMaxPrepDays < oldMaxPrepDays
        ) {
          await this.adjustMaxPrepDays(newMaxPrepDays, source)
        }
      }
    }

    // 4. 写入前一致性兜底：剔除 sourceSettings 中不在 customSources 里的孤立条目
    // 防御：避免 deepMerge 把 base 中的孤立条目持续写回 DB
    const validSourceKeys = new Set(Object.keys(mergedConfig.sources?.customSources ?? {}))
    for (const key of Object.keys(mergedConfig.sourceSettings)) {
      if (!validSourceKeys.has(key)) {
        delete mergedConfig.sourceSettings[key]
      }
    }

    // 5. 保存到数据库（upsert）
    const { error } = await supabase
      .from('user_config')
      .upsert({ user_id: userId, config: mergedConfig }, { onConflict: 'user_id' })

    if (error) {
      throw new Error(`保存设置失败: ${error.message}`)
    }

    return mergedConfig
  }

  /**
   * 调用 Edge Function 调整单词复习时间
   * 当 maxPrepDays 变小时使用
   */
  static async adjustMaxPrepDays(maxPrepDays: number, source: string): Promise<AdjustMaxPrepDaysResponse> {
    const { data, error } = await supabase.functions.invoke('adjust-max-prep-days', {
      body: { maxPrepDays, source },
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
    const { data, error } = await supabase.functions.invoke('delete-source', {
      body: { sourceName },
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
   * @param customSources 自定义 source 列表（可选，传入避免额外查询 settings）
   */
  static async getSourcesStats(customSources?: string[]): Promise<Record<string, number>> {
    const userId = getCurrentUserId()

    // 使用 word_source_stats 视图获取统计
    const { data, error } = await supabase
      .from('word_source_stats')
      .select('source, total')
      .eq('user_id', userId)

    if (error) {
      throw new Error(`获取 source 统计失败: ${error.message}`)
    }

    // 构建统计对象
    const stats: Record<string, number> = {}
    for (const row of data || []) {
      stats[row.source] = row.total || 0
    }

    // 确保所有配置的 source 都有统计（零计数补全）
    const sources = customSources ?? Object.keys((await this.getSettings()).sources.customSources)
    for (const source of sources) {
      if (!(source in stats)) {
        stats[source] = 0
      }
    }

    return stats
  }
}
