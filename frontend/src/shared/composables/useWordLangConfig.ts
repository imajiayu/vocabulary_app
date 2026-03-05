import { computed, toValue, type MaybeRefOrGetter } from 'vue'
import { useSettings } from './useSettings'
import { getSourceLangConfig, type SourceLanguageConfig } from '@/shared/config/sourceLanguage'

/**
 * 根据单词来源获取语言配置（键盘布局、输入规则、TTS 语言等）
 */
export function useWordLangConfig(source: MaybeRefOrGetter<string>) {
  const { settings } = useSettings()
  return computed<SourceLanguageConfig>(() => {
    const customSources = settings.value?.sources?.customSources || {}
    return getSourceLangConfig(toValue(source), customSources)
  })
}
