/**
 * 全局设置管理 - 统一加载和缓存用户设置
 * 避免多个组件重复请求 /api/settings
 */
import { ref } from 'vue'
import { api } from '@/shared/api'
import type { UserSettings } from '@/shared/types'

// 全局状态
const settings = ref<UserSettings | null>(null)
const isLoaded = ref(false)
let loadingPromise: Promise<UserSettings> | null = null

/**
 * 统一的设置加载器
 * 只会发起一次网络请求，后续调用返回缓存的 Promise
 */
export function useSettings() {
  /**
   * 加载用户设置（带缓存和去重）
   */
  const loadSettings = async (): Promise<UserSettings> => {
    // 如果已经加载过，直接返回缓存
    if (isLoaded.value && settings.value) {
      return settings.value
    }

    // 如果正在加载中，返回相同的 Promise
    if (loadingPromise) {
      return loadingPromise
    }

    // 创建新的加载 Promise
    loadingPromise = api.settings.getSettings()
      .then((data) => {
        settings.value = data
        isLoaded.value = true
        loadingPromise = null
        return data
      })
      .catch((error) => {
        console.error('加载设置失败:', error)
        loadingPromise = null
        throw error
      })

    return loadingPromise
  }

  /**
   * 更新设置并刷新缓存
   */
  const updateSettings = async (newSettings: Partial<UserSettings>): Promise<UserSettings> => {
    const updatedSettings = await api.settings.updateSettings(newSettings)
    settings.value = updatedSettings
    return updatedSettings
  }

  /**
   * 清除缓存（强制下次重新加载）
   */
  const clearCache = () => {
    settings.value = null
    isLoaded.value = false
    loadingPromise = null
  }

  return {
    settings,
    isLoaded,
    loadSettings,
    updateSettings,
    clearCache
  }
}
