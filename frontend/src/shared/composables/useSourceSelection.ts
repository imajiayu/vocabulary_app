import { ref, reactive, readonly } from 'vue'
import { api } from '@/shared/api'
import type { SourceStats, SourceCounts } from '@/shared/api/stats'
import { supabase } from '@/shared/config/supabase'
import { getCurrentUserId } from '@/shared/composables/useAuth'
import { logger } from '@/shared/utils/logger'

export type Source = string  // 改为动态字符串
export type { SourceStats, SourceCounts }

// View 返回的原始数据类型
interface ViewRow {
  source: string
  total: number
  remembered: number
  unremembered: number
  due_count: number
  lapse_count: number
  spelling_count: number
  today_spell_count: number
}

// For WordIndex - can read and write source selection
export function useSourceSelection() {
  const currentSource = ref<Source>('')
  const availableSources = ref<string[]>([])  // 可用的 sources 列表
  const sourceStatsMap = reactive<Record<string, SourceStats>>({})  // 动态存储各 source 统计（total）
  const allCountsMap = reactive<Record<string, SourceCounts>>({})  // 缓存各 source 的 counts
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 缓存 lowEfExtraCount，避免重复请求
  let cachedLowEfExtraCount: number | null = null

  // 直接从 Supabase view 获取所有 source 的统计
  const fetchAllSourcesStats = async (): Promise<Record<string, {
    counts: SourceCounts
    source_stats: SourceStats
  }>> => {
    const userId = getCurrentUserId()
    const { data, error: supabaseError } = await supabase
      .from('word_source_stats')
      .select('*')
      .eq('user_id', userId)

    if (supabaseError) {
      throw new Error(`Supabase query failed: ${supabaseError.message}`)
    }

    const rows = (data || []) as ViewRow[]
    const lowEfExtra = cachedLowEfExtraCount ?? 30
    const result: Record<string, { counts: SourceCounts; source_stats: SourceStats }> = {}

    for (const row of rows) {
      result[row.source] = {
        counts: {
          review: (row.due_count || 0) + lowEfExtra,
          lapse: row.lapse_count || 0,
          spelling: row.spelling_count || 0,
          today_spell: row.today_spell_count || 0
        },
        source_stats: {
          total: row.total || 0,
          remembered: row.remembered || 0,
          unremembered: row.unremembered || 0
        }
      }
    }

    return result
  }

  // 加载可用的 sources，同时从 Supabase 获取所有 source 的统计
  const loadAvailableSources = async () => {
    try {
      const settings = await api.settings.getSettings()
      availableSources.value = settings.sources?.customSources || ['IELTS', 'GRE']
      // 同时缓存 lowEfExtraCount
      cachedLowEfExtraCount = settings.learning?.lowEfExtraCount ?? 30

      // 优先从 sessionStorage 恢复，否则使用第一个可用的
      if (!currentSource.value) {
        const cached = sessionStorage.getItem('currentSource')
        if (cached && availableSources.value.includes(cached)) {
          currentSource.value = cached
        } else if (availableSources.value.length > 0) {
          currentSource.value = availableSources.value[0]
        }
      }

      // 从 Supabase 获取所有 source 的统计数据
      try {
        const allStats = await fetchAllSourcesStats()
        updateAllCaches(allStats)
      } catch (e) {
        logger.error('Failed to fetch source stats from Supabase:', e)
      }
    } catch (e) {
      logger.error('Failed to load available sources:', e)
      availableSources.value = ['IELTS', 'GRE']  // 降级到默认值
    }
  }

  // 更新所有缓存（sourceStatsMap 和 allCountsMap）
  const updateAllCaches = (allStats: Record<string, { counts: SourceCounts; source_stats: SourceStats }>) => {
    for (const [sourceName, stats] of Object.entries(allStats)) {
      sourceStatsMap[sourceName] = stats.source_stats
      allCountsMap[sourceName] = stats.counts
    }
  }

  // 切换 source - 立即返回缓存数据，异步刷新最新数据
  const switchSource = async (source: Source) => {
    // 立即更新 currentSource
    currentSource.value = source
    sessionStorage.setItem('currentSource', source)

    // 异步刷新最新统计数据（不阻塞 UI）
    fetchAllSourcesStats().then(allStats => {
      updateAllCaches(allStats)
    }).catch(e => {
      logger.error('Failed to refresh source stats:', e)
    })

    // 立即返回缓存的 counts（如果有），否则返回默认值
    return allCountsMap[source] || { review: 0, lapse: 0, spelling: 0, today_spell: 0 }
  }

  const initializeFromData = (data: {
    current_source?: string
    source_stats?: Record<string, SourceStats>
  }) => {
    // 设置当前源
    if (data.current_source) {
      currentSource.value = data.current_source
      sessionStorage.setItem('currentSource', data.current_source)
    }

    // 动态加载源统计数据（total）
    if (data.source_stats) {
      Object.keys(sourceStatsMap).forEach(key => delete sourceStatsMap[key])
      Object.entries(data.source_stats).forEach(([sourceName, stats]) => {
        if (sourceName !== 'all') {
          sourceStatsMap[sourceName] = stats
        }
      })
    }
  }

  return {
    currentSource,
    availableSources,
    sourceStatsMap,
    allCountsMap,
    loading,
    error,
    switchSource,
    initializeFromData,
    loadAvailableSources,
    fetchAllSourcesStats,
    updateAllCaches
  }
}

// For other components - read-only access to WordIndex selection
export function useSourceSelectionReadOnly() {
  const currentSource = ref<Source>('')
  const availableSources = ref<string[]>(['IELTS', 'GRE'])  // 设置默认值

  const initializeFromData = async () => {
    try {
      const settings = await api.settings.getSettings()
      availableSources.value = settings.sources?.customSources || ['IELTS', 'GRE']

      // 从 sessionStorage 恢复，否则使用第一个可用的 source
      const cachedSource = sessionStorage.getItem('currentSource')
      if (cachedSource && availableSources.value.includes(cachedSource)) {
        currentSource.value = cachedSource
      } else if (availableSources.value.length > 0) {
        currentSource.value = availableSources.value[0]
      }
    } catch (error) {
      logger.error('Failed to get current source:', error)
      if (availableSources.value.length === 0) {
        availableSources.value = ['IELTS', 'GRE']
      }
      if (!currentSource.value && availableSources.value.length > 0) {
        currentSource.value = availableSources.value[0]
      }
    }
  }

  return {
    currentSource: readonly(currentSource),
    availableSources: readonly(availableSources),
    initializeFromData
  }
}
