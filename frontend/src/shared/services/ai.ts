/**
 * AI 服务 — 经 Flask 后端 `/api/ai/chat` 转发到上游 LLM (OpenAI 兼容)
 *
 * - callAI: 非流式
 * - streamAI: 流式（Server-Sent Events）
 *
 * 前端按 `caller` 从 user_config.config.aiModels[caller] 解析 model 后随请求提交。
 * 后端对 model 字段做兜底（未传时用 AI_DEFAULT_MODEL）。API key 全部收敛在 backend/.env。
 */

import { API_BASE_URL } from '@/shared/config/env'
import { supabase } from '@/shared/config/supabase'
import type { AiCaller } from '@/shared/constants/ai-callers'
import { resolveModelForCaller } from './aiModelPrefs'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIOptions {
  temperature?: number
  maxTokens?: number
  /** 强制返回 JSON 对象（非流式专用） */
  jsonMode?: boolean
  /** 调用方标识，用于按 caller 解析用户配置的 model */
  caller?: AiCaller
}

const CHAT_URL = `${API_BASE_URL}/api/ai/chat`

async function getAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('未登录，无法调用 AI')
  return session.access_token
}

async function buildBody(
  messages: ChatMessage[],
  options: AIOptions,
  stream: boolean
): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {
    messages,
    temperature: options.temperature ?? (stream ? 0.7 : 1.0),
    stream,
  }
  if (options.maxTokens) body.max_tokens = options.maxTokens
  if (options.jsonMode && !stream) body.response_format = { type: 'json_object' }
  if (options.caller) {
    body.model = await resolveModelForCaller(options.caller)
  }
  return body
}

/**
 * 流式调用 AI chat API
 * 返回 AsyncGenerator，每次 yield 一段增量文本
 */
export async function* streamAI(
  messages: ChatMessage[],
  options: AIOptions & { signal?: AbortSignal } = {}
): AsyncGenerator<string> {
  const token = await getAccessToken()
  const body = await buildBody(messages, options, true)

  const response = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal: options.signal,
  })

  if (!response.ok) {
    throw new Error(`AI 调用失败: ${response.status}`)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop()!

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data: ')) continue
      const data = trimmed.slice(6)
      if (data === '[DONE]') return
      let json: Record<string, unknown>
      try {
        json = JSON.parse(data)
      } catch {
        continue
      }
      // 后端上游失败时会塞单帧 {error} 进来
      if (typeof json.error === 'string') throw new Error(json.error)
      const choices = json.choices as Array<{ delta?: { content?: string } }> | undefined
      const content = choices?.[0]?.delta?.content
      if (content) yield content
    }
  }
}

/**
 * 非流式 AI chat 调用
 */
export async function callAI(
  systemPrompt: string,
  userMessage: string,
  history: ChatMessage[] = [],
  options: AIOptions = {}
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessage },
  ]

  const token = await getAccessToken()
  const body = await buildBody(messages, options, false)

  const response = await fetch(CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  let json: { success?: boolean; data?: { choices?: Array<{ message?: { content?: string } }> }; error?: string }
  try {
    json = await response.json()
  } catch {
    throw new Error(`AI 调用失败: HTTP ${response.status}`)
  }

  if (!response.ok || !json.success) {
    throw new Error(json.error || `AI 调用失败: HTTP ${response.status}`)
  }

  const content = json.data?.choices?.[0]?.message?.content
  if (typeof content !== 'string') throw new Error('AI 响应缺少 content 字段')
  return content
}
