import { ref, computed } from 'vue'

/**
 * 计时器 Composable
 * 提供开始、暂停、读取并清空的功能
 */
export function useTimer() {
  // 开始时间戳
  const startTime = ref<number | null>(null)

  // 暂停时的累计时间（毫秒）
  const accumulatedTime = ref(0)

  // 是否正在运行
  const isRunning = ref(false)

  // 暂停时间戳
  const pauseTime = ref<number | null>(null)

  /**
   * 开始计时
   * 如果已经在运行，则不做任何操作
   */
  const start = () => {
    if (isRunning.value) {
      return
    }

    startTime.value = Date.now()
    isRunning.value = true
    pauseTime.value = null
  }

  /**
   * 暂停计时
   * 保存当前累计时间
   */
  const pause = () => {
    if (!isRunning.value || startTime.value === null) {
      return
    }

    pauseTime.value = Date.now()
    accumulatedTime.value += pauseTime.value - startTime.value
    isRunning.value = false
  }

  /**
   * 恢复计时
   * 从暂停状态继续计时
   */
  const resume = () => {
    if (isRunning.value) {
      return
    }

    startTime.value = Date.now()
    isRunning.value = true
    pauseTime.value = null
  }

  /**
   * 获取当前经过的时间（秒）
   * 不清空计时器状态
   */
  const getElapsedTime = (): number => {
    let totalTime = accumulatedTime.value

    if (isRunning.value && startTime.value !== null) {
      totalTime += Date.now() - startTime.value
    }

    // 转换为秒
    return totalTime / 1000
  }

  /**
   * 读取并清空计时器
   * 返回经过的时间（秒），并重置所有状态
   *
   * @param maxTime 最大时间限制（秒），默认 10 秒
   * @returns 经过的时间（秒），限制在 maxTime 以内
   */
  const readAndReset = (maxTime: number = 10.0): number => {
    const elapsedTime = Math.min(maxTime, getElapsedTime())

    // 重置所有状态
    reset()

    return elapsedTime
  }

  /**
   * 重置计时器
   * 清空所有状态
   */
  const reset = () => {
    startTime.value = null
    accumulatedTime.value = 0
    isRunning.value = false
    pauseTime.value = null
  }

  // 计算属性：当前经过的时间（秒）
  const elapsedSeconds = computed(() => getElapsedTime())

  return {
    // 状态
    isRunning: computed(() => isRunning.value),
    elapsedSeconds,

    // 方法
    start,
    pause,
    resume,
    getElapsedTime,
    readAndReset,
    reset
  }
}
