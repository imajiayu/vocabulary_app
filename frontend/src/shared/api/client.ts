/**
 * API客户端基础配置
 */

import { API_BASE_URL } from '@/shared/config/env'

export interface ApiResponse<T = unknown> {
  success: boolean
  data: T | null
  message: string
}

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
 * 基础HTTP客户端
 */
class HttpClient {
  private baseURL: string

  constructor(baseURL = API_BASE_URL) {
    this.baseURL = baseURL
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let jsonResponse: any = null

    // 尝试解析JSON响应
    if (contentType && contentType.includes('application/json')) {
      try {
        jsonResponse = await response.json()
      } catch {
        // JSON解析失败，作为文本处理
      }
    }

    // 处理错误响应
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`
      let apiMessage = ''

      if (jsonResponse && typeof jsonResponse === 'object') {
        // 新的统一响应格式: {success: false, data: null, message: "..."}
        if ('message' in jsonResponse && typeof jsonResponse.message === 'string') {
          apiMessage = jsonResponse.message
          errorMessage = apiMessage
        }
        // 旧的错误格式: {error: "..."}
        else if ('error' in jsonResponse && typeof jsonResponse.error === 'string') {
          apiMessage = jsonResponse.error
          errorMessage = apiMessage
        }
      } else {
        // 如果不是JSON，尝试获取文本错误
        try {
          errorMessage = await response.text() || errorMessage
        } catch {
          // 忽略文本获取错误
        }
      }

      throw new ApiError(errorMessage, response.status, response, apiMessage)
    }

    // 处理成功响应
    if (jsonResponse && typeof jsonResponse === 'object') {
      // 新的统一响应格式: {success: true, data: ..., message: "..."}
      if ('success' in jsonResponse && 'data' in jsonResponse) {
        if (jsonResponse.success === true) {
          return jsonResponse.data as T
        } else {
          // success为false但状态码200的情况
          const message = typeof jsonResponse.message === 'string' ? jsonResponse.message : 'Request failed'
          throw new ApiError(
            message,
            response.status,
            response,
            message
          )
        }
      }
      // 旧格式或其他JSON响应
      return jsonResponse as T
    }

    // 非JSON响应
    return response.text() as unknown as T
  }

  async get<T = unknown>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseURL}${url}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })

    return this.handleResponse<T>(response)
  }

  async post<T = unknown>(
    url: string,
    data?: unknown,
    options: RequestInit = {}
  ): Promise<T> {
    const isFormData = data instanceof FormData

    const response = await fetch(`${this.baseURL}${url}`, {
      method: 'POST',
      headers: isFormData ? {} : {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: isFormData ? data : JSON.stringify(data),
      ...options,
    })

    return this.handleResponse<T>(response)
  }

  async put<T = unknown>(
    url: string,
    data?: unknown,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseURL}${url}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(data),
      ...options,
    })

    return this.handleResponse<T>(response)
  }

  async patch<T = unknown>(
    url: string,
    data?: unknown,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseURL}${url}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(data),
      ...options,
    })

    return this.handleResponse<T>(response)
  }

  async delete<T = unknown>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${this.baseURL}${url}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })

    return this.handleResponse<T>(response)
  }
}

// 创建全局HTTP客户端实例
export const httpClient = new HttpClient()

// 导出便捷的请求方法（保持this上下文）
export const get = <T = unknown>(url: string, options?: RequestInit) => httpClient.get<T>(url, options)
export const post = <T = unknown>(url: string, data?: unknown, options?: RequestInit) => httpClient.post<T>(url, data, options)
export const put = <T = unknown>(url: string, data?: unknown, options?: RequestInit) => httpClient.put<T>(url, data, options)
export const patch = <T = unknown>(url: string, data?: unknown, options?: RequestInit) => httpClient.patch<T>(url, data, options)
export const del = <T = unknown>(url: string, options?: RequestInit) => httpClient.delete<T>(url, options)