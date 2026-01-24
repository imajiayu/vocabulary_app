/**
 * useKeyboardNavigation - 键盘导航增强
 *
 * 用于列表、菜单等需要键盘导航的场景。
 * 基于 FRONTEND_DESIGN_OPTIMIZATION.md 7.3 节实现。
 */
import { ref, type Ref } from 'vue'

export interface KeyboardNavigationOptions {
  /** 导航方向：水平、垂直或双向 */
  orientation?: 'horizontal' | 'vertical' | 'both'
  /** 是否循环导航，默认 true */
  loop?: boolean
  /** 自定义按键映射 */
  keyMap?: {
    next?: string[]
    prev?: string[]
    first?: string[]
    last?: string[]
    select?: string[]
  }
}

export interface KeyboardNavigationReturn {
  /** 当前焦点索引 */
  currentIndex: Ref<number>
  /** 处理键盘事件 */
  handleKeydown: (e: KeyboardEvent) => void
  /** 设置焦点到指定索引 */
  setIndex: (index: number) => void
  /** 重置焦点 */
  reset: () => void
}

const DEFAULT_KEY_MAP = {
  next: ['ArrowDown', 'ArrowRight'],
  prev: ['ArrowUp', 'ArrowLeft'],
  first: ['Home'],
  last: ['End'],
  select: ['Enter', ' ']
}

export function useKeyboardNavigation(
  items: Ref<HTMLElement[]> | Ref<number>,
  options: KeyboardNavigationOptions = {}
): KeyboardNavigationReturn {
  const {
    orientation = 'vertical',
    loop = true,
    keyMap = {}
  } = options

  const currentIndex = ref(0)

  const mergedKeyMap = {
    ...DEFAULT_KEY_MAP,
    ...keyMap
  }

  // 获取列表长度
  const getLength = (): number => {
    const value = items.value
    if (typeof value === 'number') {
      return value
    }
    return value.length
  }

  // 聚焦到指定元素
  const focusItem = (index: number) => {
    const value = items.value
    if (typeof value !== 'number' && value[index]) {
      value[index].focus()
    }
  }

  const setIndex = (index: number) => {
    const length = getLength()
    if (length === 0) return

    let newIndex = index

    if (loop) {
      if (newIndex < 0) newIndex = length - 1
      if (newIndex >= length) newIndex = 0
    } else {
      newIndex = Math.max(0, Math.min(newIndex, length - 1))
    }

    currentIndex.value = newIndex
    focusItem(newIndex)
  }

  const reset = () => {
    currentIndex.value = 0
  }

  const handleKeydown = (e: KeyboardEvent) => {
    const isVertical = orientation === 'vertical' || orientation === 'both'
    const isHorizontal = orientation === 'horizontal' || orientation === 'both'

    let handled = false
    let newIndex = currentIndex.value

    // 下一个
    if (mergedKeyMap.next.includes(e.key)) {
      if ((e.key === 'ArrowDown' && isVertical) ||
          (e.key === 'ArrowRight' && isHorizontal)) {
        newIndex = currentIndex.value + 1
        handled = true
      }
    }

    // 上一个
    if (mergedKeyMap.prev.includes(e.key)) {
      if ((e.key === 'ArrowUp' && isVertical) ||
          (e.key === 'ArrowLeft' && isHorizontal)) {
        newIndex = currentIndex.value - 1
        handled = true
      }
    }

    // 第一个
    if (mergedKeyMap.first.includes(e.key)) {
      newIndex = 0
      handled = true
    }

    // 最后一个
    if (mergedKeyMap.last.includes(e.key)) {
      newIndex = getLength() - 1
      handled = true
    }

    if (handled) {
      e.preventDefault()
      setIndex(newIndex)
    }
  }

  return {
    currentIndex,
    handleKeydown,
    setIndex,
    reset
  }
}
