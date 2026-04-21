/**
 * AI 释义回退：Wiktionary 查不到时通过 ai-proxy 调用 LLM 生成结构化释义
 */

import { callAI } from './ai'
import { parseJsonResponse } from '@/shared/utils/json'
import type { DefinitionObject, SourceLang } from '@/shared/types'

export async function fetchDefinitionFromAI(word: string, lang: SourceLang): Promise<DefinitionObject> {
  const systemPrompt = `You are a dictionary assistant. Given a ${lang} word, return its definition in JSON matching this TypeScript interface:

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

  const response = await callAI(systemPrompt, word, [], {
    temperature: 0.3,
    maxTokens: 500,
  })
  return parseJsonResponse<DefinitionObject>(response)
}
