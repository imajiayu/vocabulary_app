/**
 * AI 释义回退：Wiktionary 查不到时经 Flask /api/ai/chat 生成结构化释义
 *
 * Prompt 维护在 shared/prompts/definition.ts
 */

import { callAI } from './ai'
import { parseJsonResponse } from '@/shared/utils/json'
import { buildDefinitionPrompt, buildDefinitionUserMessage } from '@/shared/prompts/definition'
import type { DefinitionObject, SourceLang } from '@/shared/types'

export async function fetchDefinitionFromAI(word: string, lang: SourceLang): Promise<DefinitionObject> {
  const response = await callAI(
    buildDefinitionPrompt(lang),
    buildDefinitionUserMessage(word, lang),
    [],
    {
      temperature: 0.3,
      maxTokens: 500,
      jsonMode: true,
      caller: 'definition_fallback',
    },
  )
  return parseJsonResponse<DefinitionObject>(response)
}
