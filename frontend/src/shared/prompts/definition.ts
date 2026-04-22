/**
 * 单词释义回退 Prompt（Wiktionary 查不到时用）
 * 由 shared/services/definition-ai.ts 消费
 */

import type { SourceLang } from '@/shared/types'

export function buildDefinitionPrompt(lang: SourceLang): string {
  return `You are a dictionary assistant. Given a ${lang} word, return its definition in JSON matching this TypeScript interface:

{
  "phonetic": { "ipa": "string" },
  "definitions": ["string", ...],
  "examples": [{ "en": "string", "zh": "string" }, ...]
}

Rules:
- "definitions": 1-3 concise English definitions, each prefixed with part of speech (e.g. "n. jury", "v. to wage war")
- "examples.en": example sentence in ${lang} (the original language)
- "examples.zh": Chinese translation of that example sentence
- "phonetic.ipa": IPA transcription of the word
- Provide 1-2 examples
- Return ONLY valid JSON, no markdown or extra text`
}
