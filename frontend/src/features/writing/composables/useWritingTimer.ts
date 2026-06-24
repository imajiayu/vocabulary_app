/**
 * 写作计时器（正向秒表）
 *
 * 从 00:00 开始累加，持续增长；超过 timeLimit 视为超时（仅用于 UI 变红）。
 * 不做倒计时、警告或自动提交，除显示已用时间 + 超时提示外没有其他用处。
 */
import { ref, computed, onUnmounted } from 'vue'

export interface UseWritingTimerOptions {
  /** 时间限制（秒），仅用于判断是否超时（变红） */
  timeLimit: number
}

export function useWritingTimer(options: UseWritingTimerOptions) {
  const { timeLimit } = options

  // 状态
  const elapsedSeconds = ref(0)
  const isRunning = ref(false)
  const isPaused = ref(false)

  // 内部变量
  let intervalId: ReturnType<typeof setInterval> | null = null

  // ============================================================================
  // 计算属性
  // ============================================================================

  /**
   * 是否已超过时间限制（用于变红）
   */
  const isOvertime = computed(() => {
    return elapsedSeconds.value >= timeLimit
  })

  /**
   * 格式化的已用时间 mm:ss（正向）
   */
  const formattedElapsed = computed(() => {
    const mins = Math.floor(elapsedSeconds.value / 60)
    const secs = elapsedSeconds.value % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  })

  // ============================================================================
  // 操作
  // ============================================================================

  /**
   * 开始计时
   */
  function start() {
    if (isRunning.value) return

    isRunning.value = true
    isPaused.value = false

    intervalId = setInterval(() => {
      elapsedSeconds.value++
    }, 1000)
  }

  /**
   * 暂停计时
   */
  function pause() {
    if (!isRunning.value || isPaused.value) return

    isPaused.value = true
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  /**
   * 恢复计时
   */
  function resume() {
    if (!isPaused.value) return

    isPaused.value = false
    intervalId = setInterval(() => {
      elapsedSeconds.value++
    }, 1000)
  }

  /**
   * 停止计时
   */
  function stop() {
    isRunning.value = false
    isPaused.value = false
    if (intervalId) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  /**
   * 重置计时器
   */
  function reset() {
    stop()
    elapsedSeconds.value = 0
  }

  /**
   * 获取已用时间（秒）
   */
  function getElapsedSeconds(): number {
    return elapsedSeconds.value
  }

  // 组件卸载时清理
  onUnmounted(() => {
    stop()
  })

  return {
    // 状态
    elapsedSeconds,
    isRunning,
    isPaused,

    // 计算属性
    isOvertime,
    formattedElapsed,

    // 操作
    start,
    pause,
    resume,
    stop,
    reset,
    getElapsedSeconds
  }
}
