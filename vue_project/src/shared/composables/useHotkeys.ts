import { ref } from 'vue'
import { api } from '@/shared/api'
import type { HotkeySettings } from '@/shared/types'

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
  /**
   * 从后端加载快捷键设置
   */
  const loadHotkeys = async () => {
    try {
      const settings = await api.settings.getSettings()
      hotkeys.value = settings.hotkeys
      isLoaded.value = true
    } catch (error) {
      console.error('[useHotkeys] 加载快捷键设置失败:', error)
      // 保持默认值
    }
  }

  /**
   * 更新快捷键设置到后端
   */
  const updateHotkeys = async (newHotkeys: HotkeySettings) => {
    try {
      await api.settings.updateSettings({ hotkeys: newHotkeys })
      hotkeys.value = newHotkeys
    } catch (error) {
      console.error('[useHotkeys] 更新快捷键设置失败:', error)
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
