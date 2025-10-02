/**
 * 全局错误处理工具
 */

import { ApiError } from '@/shared/api/client'

export interface ErrorHandlerOptions {
  showMessage?: boolean
  logToConsole?: boolean
  customMessage?: string
}

/**
 * 统一处理API错误
 * @param error 错误对象
 * @param options 处理选项
 */
export function handleApiError(
  error: unknown,
  options: ErrorHandlerOptions = {}
): string {
  const {
    showMessage = false,
    logToConsole = true,
    customMessage
  } = options

  let errorMessage = customMessage || 'Unknown error occurred'

  if (error instanceof ApiError) {
    // 优先使用API返回的message
    errorMessage = error.apiMessage || error.message
  } else if (error instanceof Error) {
    errorMessage = error.message
  } else if (typeof error === 'string') {
    errorMessage = error
  }

  if (logToConsole) {
    console.error('API Error:', error)
  }

  if (showMessage) {
    // 这里可以集成通知系统，比如ElMessage或者自定义的toast
  }

  return errorMessage
}

/**
 * 用于包装异步操作的错误处理
 * @param asyncFn 异步函数
 * @param options 错误处理选项
 */
export function withErrorHandler<T>(
  asyncFn: () => Promise<T>,
  options: ErrorHandlerOptions = {}
): Promise<T | null> {
  return asyncFn().catch(error => {
    handleApiError(error, options)
    return null
  })
}

/**
 * 显示成功消息（需要时使用）
 * @param message 成功消息
 */
export function showSuccess(message: string) {
  // 这里可以集成通知系统
  console.log('Success:', message)
}

/**
 * 专门处理插入单词失败的情况
 * @param error 错误对象
 */
export function handleWordInsertError(error: unknown): string {
  return handleApiError(error, {
    showMessage: true, // 插入单词失败时显示消息
    logToConsole: true,
    customMessage: '单词插入失败'
  })
}