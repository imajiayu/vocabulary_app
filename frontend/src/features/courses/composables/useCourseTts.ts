/**
 * 课程 TTS composable
 *
 * 路由规则：
 * - 乌语（任意文本）：浏览器缓存 → 服务器缓存 → AI
 * - 英语单词（trim 后无内部空格）：浏览器缓存 → 有道
 * - 英语短语/句子（trim 后含内部空格）：浏览器缓存 → 有道 → AI（+ 服务器缓存）
 */

import { playWordAudio } from '@/shared/utils/audio/audioPlayer'
import type { CourseConfig } from '../types/course'

export function useCourseTts(config: CourseConfig) {
  function speak(text: string) {
    if (!text) return
    const cleaned = text.replace(/[.,!?;:…—–\-"«»()"。，！？：；]/g, '').trim()
    if (!cleaned) return

    const isPhrase = /\s/.test(cleaned)

    if (config.lang === 'en') {
      if (isPhrase) {
        playWordAudio(cleaned, 'us', undefined, undefined, {
          lang: config.ttsLang,
          source: config.ttsSource,
        })
      } else {
        playWordAudio(cleaned, 'us')
      }
    } else {
      playWordAudio(cleaned, 'us', config.ttsLang, config.ttsSource)
    }
  }

  return { speak }
}
