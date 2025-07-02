import { ref } from 'vue'
import { useSettings } from './useSettings'
import { logger } from '@/shared/utils/logger'
import type { UserSettings } from '@/shared/types'

// For WordIndex - can read and write shuffle setting
export function useShuffleSelection() {
  const shuffle = ref<boolean>(false)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const { settings, updateSettings } = useSettings()

  const setShuffle = async (newShuffle: boolean) => {
    try {
      loading.value = true
      error.value = null

      // 获取当前设置，确保有完整的 learning 对象
      const currentLearning = settings.value?.learning
      if (!currentLearning) {
        throw new Error('Settings not loaded')
      }

      // 使用全局设置管理器更新
      const updatedSettings = await updateSettings({
        learning: {
          ...currentLearning,
          defaultShuffle: newShuffle
        }
      } as Partial<UserSettings>)
      shuffle.value = updatedSettings.learning.defaultShuffle

      return { shuffle: newShuffle }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      error.value = message
      logger.error('Failed to set shuffle:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  const initializeFromData = async () => {
    const { loadSettings } = useSettings()
    try {
      // 使用统一的 settings 加载器，避免重复请求
      const settings = await loadSettings()
      shuffle.value = settings.learning.defaultShuffle
    } catch (error) {
      logger.error('Failed to get current shuffle:', error)
      // Default to false if there's an error
      shuffle.value = false
    }
  }

  return {
    shuffle,
    loading,
    error,
    setShuffle,
    initializeFromData
  }
}

// For other components - read-only access to shuffle selection
export function useShuffleSelectionReadOnly() {
  const shuffle = ref<boolean>(false)

  const initializeFromData = async () => {
    const { loadSettings } = useSettings()
    try {
      // 使用统一的 settings 加载器，避免重复请求
      const settings = await loadSettings()
      shuffle.value = settings.learning.defaultShuffle
    } catch (error) {
      logger.error('Failed to get current shuffle:', error)
    }
  }

  return {
    shuffle,
    initializeFromData
  }
}