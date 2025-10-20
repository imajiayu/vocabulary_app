/**
 * 音频设置全局状态管理
 * 用于在应用中共享音频设置（口音、自动播放）
 */
import { ref, watch } from 'vue'
import { useSettings } from './useSettings'

type AudioAccent = 'us' | 'uk'

// 全局状态
const audioAccent = ref<AudioAccent>('us')
const autoPlayOnWordChange = ref<boolean>(true)
const autoPlayAfterAnswer = ref<boolean>(true)
const isLoaded = ref(false)

export function useAudioAccent() {
  const { loadSettings, updateSettings } = useSettings()

  /**
   * 从服务器加载音频设置
   */
  const loadAudioAccent = async () => {
    // 如果已经加载过，直接返回，避免重复请求
    if (isLoaded.value) {
      return
    }

    try {
      // 使用统一的 settings 加载器，避免重复请求
      const settings = await loadSettings()
      audioAccent.value = settings.audio.accent ?? 'us'
      autoPlayOnWordChange.value = settings.audio.autoPlayOnWordChange ?? true
      autoPlayAfterAnswer.value = settings.audio.autoPlayAfterAnswer ?? true
      isLoaded.value = true
    } catch (error) {
      console.error('加载音频设置失败:', error)
      // 使用默认值
      audioAccent.value = 'us'
      autoPlayOnWordChange.value = true
      autoPlayAfterAnswer.value = true
      isLoaded.value = true
    }
  }

  /**
   * 更新音频口音
   */
  const updateAudioAccent = async (accent: AudioAccent) => {
    try {
      // 使用全局设置管理器更新（自动更新缓存）
      const updatedSettings = await updateSettings({
        audio: {
          accent,
          autoPlayOnWordChange: autoPlayOnWordChange.value,
          autoPlayAfterAnswer: autoPlayAfterAnswer.value
        }
      })
      audioAccent.value = updatedSettings.audio.accent
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
    autoPlayOnWordChange,
    autoPlayAfterAnswer,
    isLoaded,
    loadAudioAccent,
    updateAudioAccent,
    getAudioAccent
  }
}
