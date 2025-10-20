import { ref } from 'vue'
import { useSettings } from './useSettings'

// For WordIndex - can read and write to backend session
export function useShuffleSelection() {
  const shuffle = ref<boolean>(false)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const { updateSettings } = useSettings()

  const setShuffle = async (newShuffle: boolean) => {
    try {
      loading.value = true
      error.value = null

      // 使用全局设置管理器更新（自动更新缓存）
      const updatedSettings = await updateSettings({
        learning: {
          defaultShuffle: newShuffle
        }
      } as any)
      shuffle.value = updatedSettings.learning.defaultShuffle

      return { shuffle: newShuffle }
    } catch (e: any) {
      error.value = e?.message || String(e)
      console.error('Failed to set shuffle:', e)
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
      console.error('Failed to get current shuffle:', error)
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

// For other components - read-only access to shuffle selection from backend
export function useShuffleSelectionReadOnly() {
  const shuffle = ref<boolean>(false)

  const initializeFromData = async () => {
    const { loadSettings } = useSettings()
    try {
      // 使用统一的 settings 加载器，避免重复请求
      const settings = await loadSettings()
      shuffle.value = settings.learning.defaultShuffle
    } catch (error) {
      console.error('Failed to get current shuffle:', error)
    }
  }

  return {
    shuffle,
    initializeFromData
  }
}