/**
 * DeepSeek AI 服务
 * 直接在前端调用 DeepSeek API
 */

const DEEPSEEK_API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY || ''
const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'
const DEEPSEEK_MODEL = 'deepseek-chat'

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface DeepSeekOptions {
  temperature?: number
  maxTokens?: number
}

/**
 * 流式调用 DeepSeek Chat API
 * 返回 AsyncGenerator，每次 yield 一段增量文本
 */
export async function* streamDeepSeek(
  messages: ChatMessage[],
  options: DeepSeekOptions & { signal?: AbortSignal } = {}
): AsyncGenerator<string> {
  if (!DEEPSEEK_API_KEY) {
    throw new Error('VITE_DEEPSEEK_API_KEY 环境变量未配置')
  }

  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      temperature: options.temperature ?? 0.7,
      stream: true,
      ...(options.maxTokens ? { max_tokens: options.maxTokens } : {})
    }),
    signal: options.signal
  })

  if (!response.ok) {
    throw new Error(`DeepSeek API 调用失败: ${response.status}`)
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
      try {
        const json = JSON.parse(data)
        const content = json.choices?.[0]?.delta?.content
        if (content) yield content
      } catch { /* ignore parse errors */ }
    }
  }
}

/**
 * 调用 DeepSeek Chat API（非流式）
 */
export async function callDeepSeek(
  systemPrompt: string,
  userMessage: string,
  history: ChatMessage[] = [],
  options: DeepSeekOptions = {}
): Promise<string> {
  if (!DEEPSEEK_API_KEY) {
    throw new Error('VITE_DEEPSEEK_API_KEY 环境变量未配置')
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: userMessage }
  ]

  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      temperature: options.temperature ?? 1.0,
      stream: false,
      ...(options.maxTokens ? { max_tokens: options.maxTokens } : {})
    })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`DeepSeek API 调用失败: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  return data.choices[0].message.content
}
