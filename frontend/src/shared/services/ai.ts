/**
 * AI 服务（通过 Supabase Edge Function `ai-proxy` 转发到上游 LLM）
 *
 * - callAI: 非流式，走 supabase.functions.invoke（自动带 Bearer + apikey + JSON 解析）
 * - streamAI: 流式，手写 fetch（invoke 不支持流式），同时需要手动带 apikey header
 *
 * 协议：OpenAI 兼容 chat/completions。model 由 Edge Function 注入，前端不传。
 */

import { supabase } from '@/shared/config/supabase'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIOptions {
  temperature?: number
  maxTokens?: number
  /** 强制返回 JSON 对象（非流式专用） */
  jsonMode?: boolean
}

const AI_PROXY_FN = 'ai-proxy'

/**
 * 流式调用 AI chat API
 * 返回 AsyncGenerator，每次 yield 一段增量文本
 */
export async function* streamAI(
  messages: ChatMessage[],
  options: AIOptions & { signal?: AbortSignal } = {}
): AsyncGenerator<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('未登录，无法调用 AI')

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) throw new Error('Supabase 环境变量未配置')

  const url = `${supabaseUrl}/functions/v1/${AI_PROXY_FN}`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Supabase 网关要求：apikey 不能少，否则预检/网关会先拦
      'apikey': anonKey,
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      messages,
      temperature: options.temperature ?? 0.7,
      stream: true,
      ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
    }),
    signal: options.signal,
  })

  if (!response.ok) {
    throw new Error(`ai-proxy 调用失败: ${response.status}`)
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
      // Edge Function 上游失败时会塞单帧 {error} 进来
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

  const { data, error } = await supabase.functions.invoke(AI_PROXY_FN, {
    body: {
      messages,
      temperature: options.temperature ?? 1.0,
      stream: false,
      ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
      ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    },
  })

  if (error) throw new Error(`ai-proxy 调用失败: ${error.message}`)
  if (!data?.success) throw new Error(data?.error || 'AI 调用失败')

  const content = data.data?.choices?.[0]?.message?.content
  if (typeof content !== 'string') throw new Error('AI 响应缺少 content 字段')
  return content
}
