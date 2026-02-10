/**
 * 快捷键全局状态管理
 * 直接使用 useSettings() 的状态，不维护独立的状态
 * 这样可以确保设置更新后立即在所有组件中生效，无需重启
 */
import { computed } from 'vue'
import type { HotkeySettings } from '@/shared/types'
import { useSettings } from './useSettings'

const DEFAULT_HOTKEYS: HotkeySettings = {
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
    resetInput: ''
  }
}

export function useHotkeys() {
  const { settings, loadSettings } = useSettings()

  /**
   * 快捷键设置（计算属性，直接从全局设置中获取）
   */
  const hotkeys = computed<HotkeySettings>(() => settings.value?.hotkeys ?? DEFAULT_HOTKEYS)

  /**
   * 是否已加载设置
   */
  const isLoaded = computed<boolean>(() => settings.value !== null)

  /**
   * 从后端加载快捷键设置
   * 实际上是调用全局设置加载器
   */
  const loadHotkeys = async () => {
    await loadSettings()
  }

  return {
    hotkeys,
    isLoaded,
    loadHotkeys
  }
}
