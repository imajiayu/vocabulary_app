/**
 * 音频预加载管理：预加载 watchers、缓存清理
 */
import { watch } from 'vue'
import type { Ref } from 'vue'
import type { Word } from '@/shared/types'
import type { ReviewMode, AudioType } from '../review'
import { preloadMultipleWordAudio, clearPreloadCache } from '@/shared/utils/playWordAudio'
import { useAudioAccent } from '@/shared/composables/useAudioAccent'
import { useSettings } from '@/shared/composables/useSettings'
import { getSourceLangConfig } from '@/shared/config/sourceLanguage'
import { reviewLogger as log } from '@/shared/utils/logger'

export function useAudioPreloader(
  wordQueue: Ref<Word[]>,
  currentIndex: Ref<number>,
  audioType: Ref<AudioType>,
  mode: Ref<ReviewMode>
) {
  const { audioAccent } = useAudioAccent()
  const { settings } = useSettings()

  // 根据单词 source 获取 ttsLang
  const getTtsLang = (word: Word): string | undefined => {
    const customSources = settings.value?.sources?.customSources || {}
    return getSourceLangConfig(word.source || '', customSources).ttsLang
  }

  // 同步 audioType 与全局 audioAccent
  watch(audioAccent, (newAccent) => {
    if (audioType.value !== newAccent) {
      audioType.value = newAccent
      clearPreloadCache(0)
    }
  }, { immediate: true })

  const preloadUpcomingAudio = async (
    accent: 'us' | 'uk' = 'us',
    preloadCount: number = 5,
    includeCurrent: boolean = false
  ): Promise<void> => {
    if (wordQueue.value.length === 0) return

    const startIndex = mode.value === 'mode_lapse'
      ? (includeCurrent ? 0 : 1)
      : (includeCurrent ? currentIndex.value : currentIndex.value + 1)

    if (startIndex >= wordQueue.value.length) return

    const endIndex = Math.min(startIndex + preloadCount, wordQueue.value.length)
    const upcoming = wordQueue.value.slice(startIndex, endIndex)

    if (upcoming.length > 0) {
      // 取首个单词的 ttsLang（同一批次通常同源；混源时以首个为准）
      const ttsLang = getTtsLang(upcoming[0])
      const source = upcoming[0].source
      preloadMultipleWordAudio(upcoming.map(w => w.word), accent, ttsLang, source).catch(err => {
        log.warn('预加载音频失败:', err)
      })
    }
  }

  // 监听队列/索引变化，自动预加载
  watch([wordQueue, currentIndex, audioType], ([newQueue, newIndex], [oldQueue, oldIndex]) => {
    const isQueueChanged = newQueue.length !== oldQueue?.length || newQueue !== oldQueue
    const isInitialLoad = oldQueue === undefined || oldQueue.length === 0

    if (isQueueChanged || isInitialLoad) {
      preloadUpcomingAudio(audioType.value, 5, true)
    } else if (newIndex !== oldIndex) {
      setTimeout(() => preloadUpcomingAudio(audioType.value, 5, false), 100)
    }
  }, { deep: false })

  // 定期清理缓存
  watch(currentIndex, (newIndex) => {
    if (newIndex > 0 && newIndex % 10 === 0) {
      clearPreloadCache(15)
    }
  })

  return {
    preloadUpcomingAudio,
  }
}
