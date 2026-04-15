/**
 * 课程 TTS composable
 *
 * 封装现有 audioPlayer，根据课程语言自动选择 TTS 源
 */

import { playWordAudio } from '@/shared/utils/audio/audioPlayer'
import type { CourseConfig } from '../types/course'

export function useCourseTts(config: CourseConfig) {
  /**
   * 播放单词发音
   */
  function speak(word: string) {
    if (!word) return
    const cleaned = word.replace(/[.,!?;:…—–\-"«»()"。，！？：；]/g, '').trim()
    if (!cleaned) return

    if (config.lang === 'en') {
      // 英语使用有道词典
      playWordAudio(cleaned, 'us')
    } else {
      // 非英语使用 Google TTS
      playWordAudio(cleaned, 'us', config.ttsLang, config.ttsSource)
    }
  }

  return { speak }
}
