/**
 * 音频设置全局状态管理
 *
 * accent 按 source 独立配置（存在 sourceSettings[source].accent）
 * autoPlay 是全局配置（存在 audio.autoPlayOnWordChange/autoPlayAfterAnswer）
 *
 * source 参数可通过 MaybeRefOrGetter 传入，或从 sessionStorage 读取 currentSource
 */
import { computed, toValue } from 'vue'
import type { MaybeRefOrGetter } from 'vue'
import { useSettings } from './useSettings'
import { logger } from '@/shared/utils/logger'

type AudioAccent = 'us' | 'uk'

export function useAudioAccent(source?: MaybeRefOrGetter<string>) {
  const { settings, loadSettings, updateSourceSettings } = useSettings()

  const resolveSource = (): string => {
    if (source) return toValue(source)
    return sessionStorage.getItem('currentSource') || ''
  }

  /**
   * 音频口音（按 source 独立，从 sourceSettings 读取）
   */
  const audioAccent = computed<AudioAccent>(() => {
    const s = resolveSource()
    return settings.value?.sourceSettings[s]?.accent ?? 'us'
  })

  /**
   * 新单词出现时自动播放（全局设置）
   */
  const autoPlayOnWordChange = computed<boolean>(() => settings.value?.audio.autoPlayOnWordChange ?? true)

  /**
   * 选择答案后自动播放（全局设置）
   */
  const autoPlayAfterAnswer = computed<boolean>(() => settings.value?.audio.autoPlayAfterAnswer ?? true)

  /**
   * 是否已加载设置
   */
  const isLoaded = computed<boolean>(() => settings.value !== null)

  /**
   * 从服务器加载音频设置
   */
  const loadAudioAccent = async () => {
    await loadSettings()
  }

  /**
   * 更新音频口音（按 source 更新）
   */
  const updateAudioAccent = async (accent: AudioAccent) => {
    const s = resolveSource()
    if (!s) return
    try {
      await updateSourceSettings(s, { accent })
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
