import { ref } from 'vue'
import { useSettings } from './useSettings'
import { logger } from '@/shared/utils/logger'

export function useShuffleSelection() {
  const shuffle = ref<boolean>(false)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const { settings, updateSourceSettings } = useSettings()

  const setShuffle = async (newShuffle: boolean, source: string) => {
    try {
      loading.value = true
      error.value = null

      const currentLearning = settings.value?.sourceSettings[source]?.learning
      if (!currentLearning) {
        throw new Error('Settings not loaded')
      }

      const updatedSettings = await updateSourceSettings(source, {
        learning: { ...currentLearning, defaultShuffle: newShuffle }
      })
      shuffle.value = updatedSettings.sourceSettings[source]?.learning.defaultShuffle ?? false

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

  const initializeFromData = async (source: string) => {
    const { loadSettings } = useSettings()
    try {
      const settings = await loadSettings()
      shuffle.value = settings.sourceSettings[source]?.learning.defaultShuffle ?? false
    } catch (error) {
      logger.error('Failed to get current shuffle:', error)
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
