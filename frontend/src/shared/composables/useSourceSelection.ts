import { ref, reactive, readonly, computed } from 'vue'
import { api } from '@/shared/api'
import type { WordStats } from '@/shared/api/stats'
import { logger } from '@/shared/utils/logger'

export type Source = string  // 改为动态字符串
export type SourceStats = WordStats  // 使用 WordStats 作为 SourceStats 的别名

// Counts 类型
export type SourceCounts = {
  review: number
  lapse: number
  spelling: number
  today_spell: number
}

// For WordIndex - can read and write to backend session
export function useSourceSelection() {
  const currentSource = ref<Source>('')
  const availableSources = ref<string[]>([])  // 可用的 sources 列表
  const sourceStatsMap = reactive<Record<string, SourceStats>>({})  // 动态存储各 source 统计（total）
  const allCountsMap = reactive<Record<string, SourceCounts>>({})  // 所有 source 的 counts
  const loading = ref(false)
  const error = ref<string | null>(null)

  // 加载可用的 sources
  const loadAvailableSources = async () => {
    try {
      const settings = await api.settings.getSettings()
      availableSources.value = settings.sources?.customSources || ['IELTS', 'GRE']

      // 如果当前 source 为空，设置为第一个可用的
      if (!currentSource.value && availableSources.value.length > 0) {
        currentSource.value = availableSources.value[0]
      }
    } catch (e) {
      logger.error('Failed to load available sources:', e)
      availableSources.value = ['IELTS', 'GRE']  // 降级到默认值
    }
  }

  // 切换 source（仅更新本地状态和后端 session，不重新获取数据）
  const switchSource = async (source: Source) => {
    try {
      loading.value = true
      error.value = null

      // 更新后端 session
      await api.config.setSource(source)
      currentSource.value = source
      // Update cache
      sessionStorage.setItem('currentSource', source)

      // 返回本地缓存的 counts（不再调用 getIndexSummary）
      return allCountsMap[source] || { review: 0, lapse: 0, spelling: 0, today_spell: 0 }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      error.value = message
      throw e
    } finally {
      loading.value = false
    }
  }

  // 获取当前 source 的 counts
  const getCurrentCounts = () => {
    return allCountsMap[currentSource.value] || { review: 0, lapse: 0, spelling: 0, today_spell: 0 }
  }

  const initializeFromData = (data: {
    current_source?: string
    source_stats?: Record<string, SourceStats>
    all_counts?: Record<string, SourceCounts>
  }) => {
    // 设置当前源
    if (data.current_source) {
      currentSource.value = data.current_source
      // Cache the value
      sessionStorage.setItem('currentSource', data.current_source)
    }

    // 动态加载源统计数据（total）
    if (data.source_stats) {
      // 清空之前的统计
      Object.keys(sourceStatsMap).forEach(key => delete sourceStatsMap[key])

      // 填充新的统计数据
      Object.entries(data.source_stats).forEach(([sourceName, stats]) => {
        if (sourceName !== 'all') {  // 跳过 'all'
          sourceStatsMap[sourceName] = stats
        }
      })
    }

    // 加载所有 source 的 counts（新增）
    if (data.all_counts) {
      Object.keys(allCountsMap).forEach(key => delete allCountsMap[key])
      Object.entries(data.all_counts).forEach(([sourceName, counts]) => {
        allCountsMap[sourceName] = counts
      })
    }
  }

  return {
    currentSource,
    availableSources,
    sourceStatsMap,  // 各 source 的 total
    allCountsMap,    // 各 source 的 counts（新增）
    loading,
    error,
    switchSource,
    getCurrentCounts,
    initializeFromData,
    loadAvailableSources
  }
}

// For other components - read-only access to WordIndex selection from backend
export function useSourceSelectionReadOnly() {
  const currentSource = ref<Source>('')
  const availableSources = ref<string[]>([])

  const initializeFromData = async () => {
    try {
      // First load available sources
      const settings = await api.settings.getSettings()
      availableSources.value = settings.sources?.customSources || ['IELTS', 'GRE']

      // Check if we already have a cached value in sessionStorage to avoid redundant API calls
      const cachedSource = sessionStorage.getItem('currentSource')
      if (cachedSource && availableSources.value.includes(cachedSource)) {
        currentSource.value = cachedSource
        return
      }

      const data = await api.config.getCurrentSource()
      if (data.current_source) {
        currentSource.value = data.current_source
        // Cache the value to avoid future redundant calls
        sessionStorage.setItem('currentSource', data.current_source)
      }
    } catch (error) {
      logger.error('Failed to get current source:', error)
    }
  }

  return {
    currentSource: readonly(currentSource),
    availableSources: readonly(availableSources),
    initializeFromData
  }
}
