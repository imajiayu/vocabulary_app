import { ref, reactive, readonly, computed } from 'vue'
import { api } from '@/shared/api'
import type { WordStats } from '@/shared/api/stats'
import { logger } from '@/shared/utils/logger'

export type Source = string  // 改为动态字符串
export type SourceStats = WordStats  // 使用 WordStats 作为 SourceStats 的别名

// For WordIndex - can read and write to backend session
export function useSourceSelection() {
  const currentSource = ref<Source>('')
  const availableSources = ref<string[]>([])  // 可用的 sources 列表
  const sourceStatsMap = reactive<Record<string, SourceStats>>({})  // 动态存储各 source 统计
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

  const switchSource = async (source: Source) => {
    try {
      loading.value = true
      error.value = null

      // Use the new API to set source
      await api.config.setSource(source)
      currentSource.value = source
      // Update cache
      sessionStorage.setItem('currentSource', source)

      // 获取更新的数据
      const data = await api.stats.getIndexSummary()

      // 动态更新统计数据
      if (data.source_stats) {
        // 清空之前的统计
        Object.keys(sourceStatsMap).forEach(key => delete sourceStatsMap[key])

        // 填充新的统计数据
        Object.entries(data.source_stats).forEach(([sourceName, stats]) => {
          if (sourceName !== 'all') {  // 跳过 'all'
            sourceStatsMap[sourceName] = stats as SourceStats
          }
        })
      }

      return data
    } catch (e: any) {
      error.value = e?.message || String(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  const initializeFromData = (data: any) => {
    // 设置当前源
    if (data.current_source) {
      currentSource.value = data.current_source
      // Cache the value
      sessionStorage.setItem('currentSource', data.current_source)
    }

    // 动态加载源统计数据
    if (data.source_stats) {
      // 清空之前的统计
      Object.keys(sourceStatsMap).forEach(key => delete sourceStatsMap[key])

      // 填充新的统计数据
      Object.entries(data.source_stats).forEach(([sourceName, stats]) => {
        if (sourceName !== 'all') {  // 跳过 'all'
          sourceStatsMap[sourceName] = stats as SourceStats
        }
      })
    }
  }

  return {
    currentSource,
    availableSources,
    sourceStatsMap,  // 替代之前的 ieltsStats 和 greStats
    loading,
    error,
    switchSource,
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
