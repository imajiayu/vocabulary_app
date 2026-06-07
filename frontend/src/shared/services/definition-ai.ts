/**
 * AI 释义回退：Wiktionary 查不到时经 Flask /api/ai/chat 生成结构化释义
 *
 * Prompt 维护在 shared/prompts/definition.ts
 */

import { callAI } from './ai'
import { parseJsonResponse } from '@/shared/utils/json'
import { buildDefinitionPrompt, buildDefinitionUserMessage } from '@/shared/prompts/definition'
import type { DefinitionObject, SourceLang } from '@/shared/types'

export async function fetchDefinitionFromAI(
  word: string,
  lang: SourceLang,
  exampleDomain?: string,
): Promise<DefinitionObject> {
  const response = await callAI(
    buildDefinitionPrompt(lang, exampleDomain),
    buildDefinitionUserMessage(word, lang),
    [],
    {
      temperature: 0.3,
      // 兜底模型多为思考模型，reasoning tokens 会先吃掉预算（实测 ~350-400），
      // 预算太小会 finish_reason=length 导致 content=null。留足正文 + 推理空间
      maxTokens: 2000,
      jsonMode: true,
      caller: 'definition_fallback',
    },
  )
  return parseJsonResponse<DefinitionObject>(response)
}
