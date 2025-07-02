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
 * 调用 DeepSeek Chat API
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
