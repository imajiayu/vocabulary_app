import { inject } from 'vue'
import type { CourseConfig } from '../types/course'
import { autoWrapWords } from '../utils/autoWrapWords'

/**
 * 返回一个 wrap(html) 函数，把 HTML 中未标注的目标语种单词自动包成
 * 可点击 span（使用当前课程的 wordClass / lang）。
 * 供组件在 v-html 入口处统一调用。
 */
export function useCourseHtml() {
  const config = inject<CourseConfig | null>('courseConfig', null)
  const lang = (config?.lang === 'en' ? 'en' : 'uk') as 'uk' | 'en'

  // 自动包装用轻样式 .tts-word（仅 hover 背景 + cursor），
  // .uk-word / .term 的强调样式只保留给 JSON 里手工标注的词组。
  const wrap = (html: string | undefined | null): string =>
    autoWrapWords(html, 'tts-word', lang)

  return { wrap }
}
