import { ref } from 'vue'
import { api } from '@/shared/api'

// For WordIndex - can read and write to backend session
export function useShuffleSelection() {
  const shuffle = ref<boolean>(false)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const setShuffle = async (newShuffle: boolean) => {
    try {
      loading.value = true
      error.value = null

      await api.config.setShuffle(newShuffle)
      shuffle.value = newShuffle

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
    try {
      const data = await api.config.getShuffle()
      shuffle.value = data.shuffle
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
    try {
      const data = await api.config.getShuffle()
      shuffle.value = data.shuffle
    } catch (error) {
      console.error('Failed to get current shuffle:', error)
    }
  }

  return {
    shuffle,
    initializeFromData
  }
}