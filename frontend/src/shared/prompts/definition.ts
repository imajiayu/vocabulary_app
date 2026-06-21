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

/** 例句领域 → 给 LLM 的额外约束（仅影响例句语境，不影响释义） */
const EXAMPLE_DOMAIN_RULE: Record<string, string> = {}

export function buildDefinitionPrompt(lang: SourceLang, exampleDomain?: string): string {
  const label = LANG_LABEL[lang]
  const domainRule = exampleDomain ? EXAMPLE_DOMAIN_RULE[exampleDomain] : undefined
  return `You are a dictionary assistant. The user will send a word or multi-word phrase in ${label}. Return its definition in JSON matching this TypeScript interface:

{
  "phonetic": { "ipa": "string" },
  "definitions": ["string", ...],
  "examples": [{ "en": "string", "zh": "string" }, ...]
}

Rules:
- The input is guaranteed to be ${label}. Do not guess the language.
- "definitions": 1-3 concise definitions written in Simplified Chinese (简体中文), each prefixed with an English part-of-speech tag (e.g. "n. 陪审团", "v. 发动战争", "phr. 用于表示……")
- "examples.en": example sentence in ${label} that MUST contain the EXACT input word/phrase verbatim (do not split, paraphrase, or partially use it)${domainRule ? `; ${domainRule}` : ''}
- "examples.zh": Chinese translation of that example sentence
- "phonetic.ipa": IPA transcription in ${label} phonology${lang === 'uk' ? ' (Ukrainian IPA — NOT Russian IPA)' : ''}; for multi-word phrases, transcribe the full phrase
- Provide 1-2 examples
- Return ONLY valid JSON, no markdown or extra text`
}

/**
 * 构造 user message：显式把语种标签也带上，双保险避免模型判错。
 */
export function buildDefinitionUserMessage(word: string, lang: SourceLang): string {
  return `Word: ${word}\nLanguage: ${LANG_LABEL[lang]}`
}
