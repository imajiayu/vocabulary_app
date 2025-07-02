/**
 * 写作计时器
 */
import { ref, computed, onUnmounted } from 'vue'

export interface UseWritingTimerOptions {
  /** 时间限制（秒） */
  timeLimit: number
  /** 时间到时的回调 */
  onTimeUp?: () => void
  /** 警告时间（秒），默认 5 分钟 */
  warningTime?: number
}

export function useWritingTimer(options: UseWritingTimerOptions) {
  const { timeLimit, onTimeUp, warningTime = 5 * 60 } = options

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
   * 剩余时间（秒）
   */
  const remainingSeconds = computed(() => {
    return Math.max(0, timeLimit - elapsedSeconds.value)
  })

  /**
   * 是否超时
   */
  const isOvertime = computed(() => {
    return elapsedSeconds.value >= timeLimit
  })

  /**
   * 是否处于警告时间
   */
  const isWarning = computed(() => {
    return !isOvertime.value && remainingSeconds.value <= warningTime
  })

  /**
   * 进度百分比（0-100）
   */
  const progressPercent = computed(() => {
    return Math.min(100, (elapsedSeconds.value / timeLimit) * 100)
  })

  /**
   * 格式化的剩余时间
   */
  const formattedTime = computed(() => {
    const seconds = isOvertime.value
      ? elapsedSeconds.value - timeLimit  // 超时后显示超时时长
      : remainingSeconds.value

    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    const prefix = isOvertime.value ? '+' : ''
    return `${prefix}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  })

  /**
   * 格式化的已用时间
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

      // 刚好到达时间限制时触发回调
      if (elapsedSeconds.value === timeLimit && onTimeUp) {
        onTimeUp()
      }
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

      if (elapsedSeconds.value === timeLimit && onTimeUp) {
        onTimeUp()
      }
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
    remainingSeconds,
    isOvertime,
    isWarning,
    progressPercent,
    formattedTime,
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
