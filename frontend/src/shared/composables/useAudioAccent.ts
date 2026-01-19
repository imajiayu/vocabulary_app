/**
 * 音频设置全局状态管理
 * 用于在应用中共享音频设置（口音、自动播放）
 *
 * 注意：此 composable 直接使用 useSettings() 的状态，不维护独立的状态
 * 这样可以确保设置更新后立即在所有组件中生效，无需重启
 */
import { computed } from 'vue'
import { useSettings } from './useSettings'
import { logger } from '@/shared/utils/logger'

type AudioAccent = 'us' | 'uk'

export function useAudioAccent() {
  const { settings, loadSettings, updateSettings } = useSettings()

  /**
   * 音频口音（计算属性，直接从全局设置中获取）
   */
  const audioAccent = computed<AudioAccent>(() => settings.value?.audio.accent ?? 'us')

  /**
   * 新单词出现时自动播放
   */
  const autoPlayOnWordChange = computed<boolean>(() => settings.value?.audio.autoPlayOnWordChange ?? true)

  /**
   * 选择答案后自动播放
   */
  const autoPlayAfterAnswer = computed<boolean>(() => settings.value?.audio.autoPlayAfterAnswer ?? true)

  /**
   * 是否已加载设置
   */
  const isLoaded = computed<boolean>(() => settings.value !== null)

  /**
   * 从服务器加载音频设置
   * 实际上是调用全局设置加载器
   */
  const loadAudioAccent = async () => {
    await loadSettings()
  }

  /**
   * 更新音频口音
   */
  const updateAudioAccent = async (accent: AudioAccent) => {
    try {
      // 使用全局设置管理器更新（自动更新缓存）
      await updateSettings({
        audio: {
          accent,
          autoPlayOnWordChange: autoPlayOnWordChange.value,
          autoPlayAfterAnswer: autoPlayAfterAnswer.value
        }
      })
    } catch (error) {
      logger.error('更新音频设置失败:', error)
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
