// shared/utils/logger.ts
// 开发环境日志工具 - 生产环境自动静默

const isDev = import.meta.env.DEV

/**
 * 统一日志工具
 * - 开发环境：正常输出日志
 * - 生产环境：仅输出错误日志
 */
export const logger = {
  /** 普通日志 - 仅开发环境 */
  log: (...args: unknown[]) => isDev && console.log(...args),

  /** 警告日志 - 仅开发环境 */
  warn: (...args: unknown[]) => isDev && console.warn(...args),

  /** 错误日志 - 始终输出 */
  error: (...args: unknown[]) => console.error(...args),

  /** 调试日志 - 仅开发环境 */
  debug: (...args: unknown[]) => isDev && console.debug(...args),

  /**
   * 创建带上下文的 logger
   * @example
   * const log = logger.create('WebSocket')
   * log.log('Connected')  // [WebSocket] Connected
   */
  create: (context: string) => ({
    log: (...args: unknown[]) => isDev && console.log(`[${context}]`, ...args),
    warn: (...args: unknown[]) => isDev && console.warn(`[${context}]`, ...args),
    error: (...args: unknown[]) => console.error(`[${context}]`, ...args),
    debug: (...args: unknown[]) => isDev && console.debug(`[${context}]`, ...args),
  }),
}

// 预定义的上下文 logger
export const reviewLogger = logger.create('Review')
export const speakingLogger = logger.create('Speaking')
