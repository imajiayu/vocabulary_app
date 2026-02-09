/**
 * API客户端 — 用于 Flask 后端（关系图查询 + 关系生成）
 * 其他所有 API 均通过 Supabase 直连
 */

import { API_BASE_URL } from '@/shared/config/env'
import { supabase } from '@/shared/config/supabase'

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: Response,
    public apiMessage?: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Get JWT access token from Supabase session
 */
async function getAccessToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new ApiError('Not authenticated', 401)
  return session.access_token
}

/**
 * 发送 GET 请求到 Flask 后端
 */
export async function get<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAccessToken()
  const response = await fetch(`${API_BASE_URL}${url}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`
    let apiMessage = ''
    try {
      const json = await response.json()
      const msg = json?.error || json?.message
      if (msg) {
        apiMessage = msg
        errorMessage = apiMessage
      }
    } catch {
      // 非 JSON 响应
    }
    throw new ApiError(errorMessage, response.status, response, apiMessage)
  }

  const json = await response.json()

  // 统一响应格式: {success: true, data: ...}
  if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
    if (json.success === true) {
      return json.data as T
    }
    const errMsg = json.error || json.message || 'Request failed'
    throw new ApiError(errMsg, response.status, response, errMsg)
  }

  return json as T
}

/**
 * 发送 POST 请求到 Flask 后端
 */
export async function post<T = unknown>(
  url: string,
  body: unknown,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAccessToken()
  const response = await fetch(`${API_BASE_URL}${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
    body: JSON.stringify(body),
    ...options,
  })

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`
    let apiMessage = ''
    try {
      const json = await response.json()
      const msg = json?.error || json?.message
      if (msg) {
        apiMessage = msg
        errorMessage = apiMessage
      }
    } catch {
      // 非 JSON 响应
    }
    throw new ApiError(errorMessage, response.status, response, apiMessage)
  }

  const json = await response.json()

  // 统一响应格式: {success: true, data: ...}
  if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
    if (json.success === true) {
      return json.data as T
    }
    const errMsg = json.error || json.message || 'Request failed'
    throw new ApiError(errMsg, response.status, response, errMsg)
  }

  return json as T
}

/**
 * 创建到 Flask 后端的 EventSource 连接
 * SSE 不支持自定义 header，改用 query param 传 JWT
 */
export async function createEventSource(url: string): Promise<EventSource> {
  const token = await getAccessToken()
  const separator = url.includes('?') ? '&' : '?'
  const fullUrl = `${API_BASE_URL}${url}${separator}token=${encodeURIComponent(token)}`
  return new EventSource(fullUrl)
}
