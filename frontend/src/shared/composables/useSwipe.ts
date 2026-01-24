/**
 * useSwipe - 手势滑动支持
 *
 * 用于检测触摸设备上的滑动手势，支持四个方向。
 * 基于 FRONTEND_DESIGN_OPTIMIZATION.md 4.5 节实现。
 */
import { ref, onMounted, onUnmounted, watch, type Ref } from 'vue'

export type SwipeDirection = 'left' | 'right' | 'up' | 'down' | null

export interface SwipeOptions {
  /** 触发滑动的最小距离（像素），默认 50 */
  threshold?: number
  /** 滑动的最大时间（毫秒），超时则不触发，默认 300 */
  timeout?: number
  /** 是否阻止默认行为，默认 false */
  preventDefault?: boolean
  /** 是否在滑动时禁用，默认 false */
  disabled?: boolean
}

export interface SwipeReturn {
  /** 当前检测到的滑动方向 */
  direction: Ref<SwipeDirection>
  /** 是否正在滑动中 */
  isSwiping: Ref<boolean>
  /** 滑动的水平距离 */
  distanceX: Ref<number>
  /** 滑动的垂直距离 */
  distanceY: Ref<number>
  /** 重置滑动状态 */
  reset: () => void
}

export function useSwipe(
  elementRef: Ref<HTMLElement | null>,
  options: SwipeOptions = {}
): SwipeReturn {
  const {
    threshold = 50,
    timeout = 300,
    preventDefault = false,
    disabled = false
  } = options

  const direction = ref<SwipeDirection>(null)
  const isSwiping = ref(false)
  const distanceX = ref(0)
  const distanceY = ref(0)

  let startX = 0
  let startY = 0
  let startTime = 0
  let isDisabled = disabled

  // 支持响应式 disabled
  if (typeof options.disabled === 'object') {
    watch(() => options.disabled, (val) => {
      isDisabled = !!val
    })
  }

  const reset = () => {
    direction.value = null
    isSwiping.value = false
    distanceX.value = 0
    distanceY.value = 0
  }

  const onTouchStart = (e: TouchEvent) => {
    if (isDisabled) return

    startX = e.touches[0].clientX
    startY = e.touches[0].clientY
    startTime = Date.now()
    isSwiping.value = true
    direction.value = null
  }

  const onTouchMove = (e: TouchEvent) => {
    if (!isSwiping.value || isDisabled) return

    const currentX = e.touches[0].clientX
    const currentY = e.touches[0].clientY

    distanceX.value = currentX - startX
    distanceY.value = currentY - startY

    if (preventDefault) {
      e.preventDefault()
    }
  }

  const onTouchEnd = (e: TouchEvent) => {
    if (!isSwiping.value || isDisabled) return

    const endX = e.changedTouches[0].clientX
    const endY = e.changedTouches[0].clientY
    const elapsed = Date.now() - startTime

    // 超时则不触发
    if (elapsed > timeout) {
      reset()
      return
    }

    const deltaX = endX - startX
    const deltaY = endY - startY

    // 判断滑动方向
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // 水平滑动
      if (Math.abs(deltaX) > threshold) {
        direction.value = deltaX > 0 ? 'right' : 'left'
      }
    } else {
      // 垂直滑动
      if (Math.abs(deltaY) > threshold) {
        direction.value = deltaY > 0 ? 'down' : 'up'
      }
    }

    isSwiping.value = false
  }

  const onTouchCancel = () => {
    reset()
  }

  onMounted(() => {
    const el = elementRef.value
    if (!el) return

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: !preventDefault })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('touchcancel', onTouchCancel, { passive: true })
  })

  onUnmounted(() => {
    const el = elementRef.value
    if (!el) return

    el.removeEventListener('touchstart', onTouchStart)
    el.removeEventListener('touchmove', onTouchMove)
    el.removeEventListener('touchend', onTouchEnd)
    el.removeEventListener('touchcancel', onTouchCancel)
  })

  return {
    direction,
    isSwiping,
    distanceX,
    distanceY,
    reset
  }
}
