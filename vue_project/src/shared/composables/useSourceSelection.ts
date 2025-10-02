import { ref, reactive, readonly } from 'vue'
import { api } from '@/shared/api'

export type Source = 'IELTS' | 'GRE'
export type SourceStats = { total: number; remembered: number; unremembered: number }

// For WordIndex - can read and write to backend session
export function useSourceSelection() {
  const currentSource = ref<Source>('IELTS')
  const ieltsStats = reactive<SourceStats>({ total: 0, remembered: 0, unremembered: 0 })
  const greStats = reactive<SourceStats>({ total: 0, remembered: 0, unremembered: 0 })
  const loading = ref(false)
  const error = ref<string | null>(null)

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

      // 更新统计数据
      if (data.source_stats) {
        Object.assign(ieltsStats, data.source_stats.IELTS || { total: 0, remembered: 0, unremembered: 0 })
        Object.assign(greStats, data.source_stats.GRE || { total: 0, remembered: 0, unremembered: 0 })
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

    // 加载源统计数据
    if (data.source_stats) {
      Object.assign(ieltsStats, data.source_stats.IELTS || { total: 0, remembered: 0, unremembered: 0 })
      Object.assign(greStats, data.source_stats.GRE || { total: 0, remembered: 0, unremembered: 0 })
    }
  }

  return {
    currentSource,
    ieltsStats,
    greStats,
    loading,
    error,
    switchSource,
    initializeFromData
  }
}

// For other components - read-only access to WordIndex selection from backend
export function useSourceSelectionReadOnly() {
  const currentSource = ref<Source>('IELTS')

  const initializeFromData = async () => {
    try {
      // Check if we already have a cached value in sessionStorage to avoid redundant API calls
      const cachedSource = sessionStorage.getItem('currentSource')
      if (cachedSource && (cachedSource === 'IELTS' || cachedSource === 'GRE')) {
        currentSource.value = cachedSource as Source
        return
      }

      const data = await api.config.getCurrentSource()
      if (data.current_source) {
        currentSource.value = data.current_source
        // Cache the value to avoid future redundant calls
        sessionStorage.setItem('currentSource', data.current_source)
      }
    } catch (error) {
      console.error('Failed to get current source:', error)
    }
  }

  return {
    currentSource: readonly(currentSource),
    initializeFromData
  }
}