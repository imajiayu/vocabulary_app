/**
 * 音频口音全局状态管理
 * 用于在应用中共享音频口音设置
 */
import { ref, watch } from 'vue'
import { api } from '@/shared/api'

type AudioAccent = 'us' | 'uk'

// 全局状态
const audioAccent = ref<AudioAccent>('us')
const isLoaded = ref(false)

export function useAudioAccent() {
  /**
   * 从服务器加载音频设置
   */
  const loadAudioAccent = async () => {
    try {
      const settings = await api.settings.getSettings()
      audioAccent.value = settings.audio.accent
      isLoaded.value = true
    } catch (error) {
      console.error('加载音频设置失败:', error)
      // 使用默认值
      audioAccent.value = 'us'
      isLoaded.value = true
    }
  }

  /**
   * 更新音频口音
   */
  const updateAudioAccent = async (accent: AudioAccent) => {
    try {
      await api.settings.updateSettings({
        audio: { accent }
      })
      audioAccent.value = accent
    } catch (error) {
      console.error('更新音频设置失败:', error)
      throw error
    }
  }

  /**
   * 获取当前音频口音
   */
  const getAudioAccent = () => audioAccent.value

  return {
    audioAccent,
    isLoaded,
    loadAudioAccent,
    updateAudioAccent,
    getAudioAccent
  }
}
