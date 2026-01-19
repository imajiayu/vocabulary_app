import { ref } from 'vue'
import type { HotkeySettings } from '@/shared/types'
import { useSettings } from './useSettings'
import { logger } from '@/shared/utils/logger'

// 全局状态 - 快捷键设置
const hotkeys = ref<HotkeySettings>({
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
})

const isLoaded = ref(false)

/**
 * 快捷键全局状态管理
 * 提供加载、更新快捷键设置的功能
 */
export function useHotkeys() {
  const { loadSettings, updateSettings } = useSettings()

  /**
   * 从后端加载快捷键设置
   */
  const loadHotkeys = async () => {
    // 如果已经加载过，直接返回，避免重复请求
    if (isLoaded.value) {
      return
    }

    try {
      // 使用统一的 settings 加载器，避免重复请求
      const settings = await loadSettings()
      hotkeys.value = settings.hotkeys
      isLoaded.value = true
    } catch (error) {
      logger.error('[useHotkeys] 加载快捷键设置失败:', error)
      // 保持默认值
    }
  }

  /**
   * 更新快捷键设置到后端
   */
  const updateHotkeys = async (newHotkeys: HotkeySettings) => {
    try {
      // 使用全局设置管理器更新（自动更新缓存）
      const updatedSettings = await updateSettings({ hotkeys: newHotkeys })
      hotkeys.value = updatedSettings.hotkeys
    } catch (error) {
      logger.error('[useHotkeys] 更新快捷键设置失败:', error)
      throw error
    }
  }

  /**
   * 获取当前快捷键设置（同步）
   * 如果还未加载，返回默认值
   */
  const getHotkeys = (): HotkeySettings => {
    return hotkeys.value
  }

  return {
    hotkeys,
    isLoaded,
    loadHotkeys,
    updateHotkeys,
    getHotkeys
  }
}
