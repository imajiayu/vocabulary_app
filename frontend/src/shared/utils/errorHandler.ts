/**
 * 全局错误处理工具
 */

import { ApiError } from '@/shared/api/client'
import { logger } from '@/shared/utils/logger'

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
    logger.error('API Error:', error)
  }

  if (showMessage) {
    // 这里可以集成通知系统，比如ElMessage或者自定义的toast
  }

  return errorMessage
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