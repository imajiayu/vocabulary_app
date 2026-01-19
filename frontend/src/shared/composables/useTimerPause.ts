import { ref } from 'vue'

/**
 * 全局计时器暂停管理
 * 用于在打开覆盖层（modal、全屏通知等）时暂停计时器
 */

// 全局状态：暂停请求计数
const pauseCount = ref(0)

export function useTimerPause() {
  /**
   * 请求暂停计时器
   * 可以多次调用，每次调用增加暂停计数
   */
  const requestPause = () => {
    pauseCount.value++
  }

  /**
   * 释放暂停请求
   * 减少暂停计数，当计数为0时恢复计时
   */
  const releasePause = () => {
    pauseCount.value = Math.max(0, pauseCount.value - 1)
  }

  /**
   * 是否应该暂停
   * 只要有任何暂停请求存在就返回 true
   */
  const shouldPause = () => {
    return pauseCount.value > 0
  }

  return {
    requestPause,
    releasePause,
    shouldPause,
    pauseCount
  }
}
