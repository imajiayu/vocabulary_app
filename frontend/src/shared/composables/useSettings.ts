/**
 * 全局设置管理 - 统一加载和缓存用户设置
 * 使用 Supabase 直连，不经过后端 API
 */
import { ref } from 'vue'
import { SettingsSupabaseApi } from '@/shared/api/settings-supabase'
import type { UserSettings } from '@/shared/types'
import { logger } from '@/shared/utils/logger'

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
   * @param options.force - 强制重新查询，忽略缓存
   */
  const loadSettings = async (options?: { force?: boolean }): Promise<UserSettings> => {
    const force = options?.force ?? false

    // 如果已经加载过且不是强制刷新，直接返回缓存
    if (!force && isLoaded.value && settings.value) {
      return settings.value
    }

    // 强制刷新时清除之前的加载状态
    if (force) {
      loadingPromise = null
    }

    // 如果正在加载中，返回相同的 Promise
    if (loadingPromise) {
      return loadingPromise
    }

    // 创建新的加载 Promise（使用 Supabase 直连）
    loadingPromise = SettingsSupabaseApi.getSettings()
      .then((data) => {
        settings.value = data
        isLoaded.value = true
        loadingPromise = null
        return data
      })
      .catch((error) => {
        logger.error('加载设置失败:', error)
        loadingPromise = null
        throw error
      })

    return loadingPromise
  }

  /**
   * 更新设置并刷新缓存
   * 如果 maxPrepDays 变小，会自动调用 Edge Function 调整单词复习时间
   */
  const updateSettings = async (newSettings: Partial<UserSettings>): Promise<UserSettings> => {
    // 获取旧的 maxPrepDays 用于比较
    const oldMaxPrepDays = settings.value?.learning?.maxPrepDays

    // 使用 Supabase 直连更新设置
    const updatedSettings = await SettingsSupabaseApi.updateSettings(newSettings, oldMaxPrepDays)
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
