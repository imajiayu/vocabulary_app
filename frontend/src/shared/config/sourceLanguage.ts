import type { SourceLang } from '@/shared/types'

export interface SourceLanguageConfig {
  lang: SourceLang
  inputPattern: RegExp
  sanitizePattern: RegExp
  wordPattern: RegExp
  keyboardLayout: string[][]
  keyboardSpecialChars: string[]
  supportsRelations: boolean
  supportsAccentSwitch: boolean
  ttsLang?: string
}

const EN_CONFIG: SourceLanguageConfig = {
  lang: 'en',
  inputPattern: /^[a-zA-Z \-]$/,
  sanitizePattern: /[^a-zA-Z \-]/g,
  wordPattern: /[a-zA-Z]+/g,
  keyboardLayout: [
    ['Q','W','E','R','T','Y','U','I','O','P'],
    ['A','S','D','F','G','H','J','K','L'],
    ['Z','X','C','V','B','N','M'],
  ],
  keyboardSpecialChars: ['-'],
  supportsRelations: true,
  supportsAccentSwitch: true,
}

const UK_CONFIG: SourceLanguageConfig = {
  lang: 'uk',
  inputPattern: /^[а-яА-ЯіІїЇєЄґҐʼ' \-]$/,
  sanitizePattern: /[^а-яА-ЯіІїЇєЄґҐʼ' \-]/g,
  wordPattern: /[а-яіїєґʼ']+/gi,
  keyboardLayout: [
    ['Й','Ц','У','К','Е','Н','Г','Ш','Щ','З','Х','Ї'],
    ['Ф','І','В','А','П','Р','О','Л','Д','Ж','Є'],
    ['Я','Ч','С','М','И','Т','Ь','Б','Ю','Ґ'],
  ],
  keyboardSpecialChars: ['ʼ', '-'],
  supportsRelations: false,
  supportsAccentSwitch: false,
  ttsLang: 'uk-UA',
}

const LANG_CONFIGS: Record<SourceLang, SourceLanguageConfig> = {
  en: EN_CONFIG,
  uk: UK_CONFIG,
}

export function getLangConfig(lang: SourceLang): SourceLanguageConfig {
  return LANG_CONFIGS[lang] ?? EN_CONFIG
}

export function getSourceLangConfig(
  source: string,
  customSources: Record<string, SourceLang>
): SourceLanguageConfig {
  const lang = customSources[source] ?? 'en'
  return getLangConfig(lang)
}
