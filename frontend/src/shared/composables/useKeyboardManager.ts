/**
 * 全局键盘管理器
 * 整个应用只有一个键盘监听器，根据上下文和快捷键配置分发事件
 */

import { ref, onMounted, onBeforeUnmount } from 'vue'
import { logger } from '@/shared/utils/logger'

// 键盘事件处理函数类型
type KeyHandler = (event: KeyboardEvent) => void | Promise<void>

// 上下文类型
export type KeyboardContext =
  | 'review-initial'      // 复习-初始状态（选择记住/没记住）
  | 'review-after'        // 复习-显示释义后（记错了/下一个）
  | 'spelling'            // 拼写模式
  | 'none'                // 无上下文

interface KeyboardManagerState {
  currentContext: KeyboardContext
  handlers: Map<string, KeyHandler>  // key -> handler
  pressedKeys: Set<string>
  isHandling: boolean
  lastContextChangeTime: number
}

// 防泄漏 timer
let handlingTimer: ReturnType<typeof setTimeout> | null = null

// 全局单例状态
const globalState: KeyboardManagerState = {
  currentContext: 'none',
  handlers: new Map(),
  pressedKeys: new Set(),
  isHandling: false,
  lastContextChangeTime: 0
}

// 全局键盘事件处理器（只注册一次）
let globalListenerRegistered = false

const handleGlobalKeydown = async (event: KeyboardEvent) => {
  // 1. 防止重复触发
  if (globalState.pressedKeys.has(event.key)) {
    event.preventDefault()
    return
  }

  // 2. 防止并发处理
  if (globalState.isHandling) {
    event.preventDefault()
    return
  }

  // 3. 防止上下文切换后立即触发（100ms保护期）
  const timeSinceContextChange = Date.now() - globalState.lastContextChangeTime
  if (timeSinceContextChange < 100) {
    event.preventDefault()
    return
  }

  // 4. 查找当前按键的处理器
  const handler = globalState.handlers.get(event.key)
  if (!handler) {
    return // 不是注册的快捷键，允许默认行为
  }

  // 5. 标记并执行处理器
  event.preventDefault()
  globalState.pressedKeys.add(event.key)
  globalState.isHandling = true

  try {
    await handler(event)
  } catch (error) {
    logger.error('[KeyboardManager] Handler error:', error)
  } finally {
    // 延迟重置，确保状态切换完成
    if (handlingTimer) clearTimeout(handlingTimer)
    handlingTimer = setTimeout(() => {
      globalState.isHandling = false
      handlingTimer = null
    }, 100)
  }
}

const handleGlobalKeyup = (event: KeyboardEvent) => {
  globalState.pressedKeys.delete(event.key)
}

// 注册全局监听器（只执行一次）
const registerGlobalListener = () => {
  if (globalListenerRegistered) return

  document.addEventListener('keydown', handleGlobalKeydown)
  document.addEventListener('keyup', handleGlobalKeyup)
  globalListenerRegistered = true
}

/**
 * 使用全局键盘管理器的 composable
 */
export function useKeyboardManager() {
  // 当前组件注册的按键列表（用于清理）
  const registeredKeys = ref<string[]>([])

  // 设置当前键盘上下文
  const setContext = (context: KeyboardContext) => {
    if (globalState.currentContext !== context) {
      globalState.currentContext = context
      globalState.lastContextChangeTime = Date.now()
    }
  }

  // 注册快捷键处理器
  const registerKey = (key: string, handler: KeyHandler) => {
    globalState.handlers.set(key, handler)
    registeredKeys.value.push(key)
  }

  // 批量注册快捷键
  const registerKeys = (keyHandlers: Record<string, KeyHandler>) => {
    Object.entries(keyHandlers).forEach(([key, handler]) => {
      registerKey(key, handler)
    })
  }

  // 清理当前组件注册的所有快捷键
  const cleanup = () => {
    registeredKeys.value.forEach(key => {
      globalState.handlers.delete(key)
    })
    registeredKeys.value = []

    // 重置上下文
    if (globalState.currentContext !== 'none') {
      globalState.currentContext = 'none'
      globalState.lastContextChangeTime = Date.now()
    }
  }

  // 组件挂载时注册全局监听器
  onMounted(() => {
    registerGlobalListener()
  })

  // 组件卸载时清理
  onBeforeUnmount(() => {
    cleanup()
  })

  return {
    setContext,
    registerKey,
    registerKeys,
    cleanup,
    // 暴露只读状态
    currentContext: () => globalState.currentContext,
    isHandling: () => globalState.isHandling
  }
}
