/**
 * 全局设置管理 - 统一加载和缓存用户设置
 * 使用 Supabase 直连，不经过后端 API
 */
import { ref } from 'vue'
import { SettingsSupabaseApi, createDefaultSourceSettings } from '@/shared/api/settings-supabase'
import type { UserSettings, LearningSettings, SourceSpecificSettings } from '@/shared/types'
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
   * 如果某个 source 的 maxPrepDays 变小，会自动调用 Edge Function 调整
   */
  const updateSettings = async (
    newSettings: Partial<UserSettings>,
    oldSourceSettings?: Record<string, SourceSpecificSettings>
  ): Promise<UserSettings> => {
    const dbResult = await SettingsSupabaseApi.updateSettings(newSettings, oldSourceSettings)

    // 只将本次操作涉及的字段 patch 到内存对象上，保留未涉及字段的本地未保存修改
    // （避免自动保存 accent/audio/sources 时，从 DB 重读的旧值覆盖掉用户正在编辑的 learning/hotkeys）
    if (settings.value) {
      for (const key of Object.keys(newSettings) as (keyof UserSettings)[]) {
        if (key === 'sourceSettings' && newSettings.sourceSettings) {
          // sourceSettings 按 source key 粒度 patch，不整体替换
          for (const [source, partial] of Object.entries(newSettings.sourceSettings)) {
            if (!settings.value.sourceSettings[source]) {
              settings.value.sourceSettings[source] = dbResult.sourceSettings[source]
            } else {
              Object.assign(settings.value.sourceSettings[source], partial)
            }
          }
        } else {
          (settings.value as Record<string, unknown>)[key] = dbResult[key]
        }
      }
    } else {
      settings.value = dbResult
    }

    return settings.value!
  }

  /**
   * 更新指定 source 的设置
   */
  const updateSourceSettings = async (
    source: string,
    partial: Partial<SourceSpecificSettings>
  ): Promise<UserSettings> => {
    return updateSettings({
      sourceSettings: { [source]: partial as SourceSpecificSettings }
    })
  }

  /**
   * 获取指定 source 的学习设置
   */
  const getSourceLearning = (source: string): LearningSettings => {
    return settings.value?.sourceSettings[source]?.learning
      ?? createDefaultSourceSettings().learning
  }

  /**
   * 获取指定 source 的 accent
   */
  const getSourceAccent = (source: string): 'us' | 'uk' => {
    return settings.value?.sourceSettings[source]?.accent ?? 'us'
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
    updateSourceSettings,
    getSourceLearning,
    getSourceAccent,
    clearCache
  }
}
