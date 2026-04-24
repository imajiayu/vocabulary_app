/**
 * 单词释义回退 Prompt（Wiktionary 查不到时用）
 * 由 shared/services/definition-ai.ts 消费
 */

import type { SourceLang } from '@/shared/types'

/** 语种 code → 给 LLM 看的可读名，避免用 "uk" 被当作英式英语 */
const LANG_LABEL: Record<SourceLang, string> = {
  en: 'English',
  uk: 'Ukrainian (Слов\'янська; Cyrillic script; NOT English, NOT Russian)',
}

export function buildDefinitionPrompt(lang: SourceLang): string {
  const label = LANG_LABEL[lang]
  return `You are a dictionary assistant. The user will send a single word in ${label}. Return its definition in JSON matching this TypeScript interface:

{
  "phonetic": { "ipa": "string" },
  "definitions": ["string", ...],
  "examples": [{ "en": "string", "zh": "string" }, ...]
}

Rules:
- The input word is guaranteed to be ${label}. Do not guess the language.
- "definitions": 1-3 concise English definitions, each prefixed with part of speech (e.g. "n. jury", "v. to wage war")
- "examples.en": example sentence in ${label} (the source language, NOT English translation)
- "examples.zh": Chinese translation of that example sentence
- "phonetic.ipa": IPA transcription of the word in ${label} phonology${lang === 'uk' ? ' (Ukrainian IPA — NOT Russian IPA)' : ''}
- Provide 1-2 examples
- Return ONLY valid JSON, no markdown or extra text`
}

/**
 * 构造 user message：显式把语种标签也带上，双保险避免模型判错。
 */
export function buildDefinitionUserMessage(word: string, lang: SourceLang): string {
  return `Word: ${word}\nLanguage: ${LANG_LABEL[lang]}`
}
