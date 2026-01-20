/**
 * useDraggableNotification - 可拖拽通知组件的共享逻辑
 *
 * 用于 ReviewModeNotification 和 SpellingModeNotification 等可拖拽浮层组件。
 * 提供拖拽、位置持久化、边界约束和移动端适配功能。
 */

import { ref, computed, onMounted, onUnmounted, watch, type Ref } from 'vue'
import { logger } from '@/shared/utils/logger'

const log = logger.create('DraggableNotification')

interface Position {
  x: number
  y: number
}

interface UseDraggableNotificationOptions {
  /** localStorage 存储键，用于持久化位置 */
  storageKey: string
  /** 默认位置（如未指定，则默认右上角） */
  defaultPosition?: Position
  /** 是否在移动端禁用拖拽 */
  disableOnMobile?: boolean
  /** 移动端断点（默认 768px） */
  mobileBreakpoint?: number
}

export function useDraggableNotification(
  elementRef: Ref<HTMLElement | null>,
  show: Ref<boolean>,
  options: UseDraggableNotificationOptions
) {
  const {
    storageKey,
    defaultPosition,
    disableOnMobile = false,
    mobileBreakpoint = 768
  } = options

  // ── 状态 ──
  const position = ref<Position>({ x: 0, y: 0 })
  const isDragging = ref(false)
  const dragStart = ref<Position>({ x: 0, y: 0 })
  const dragOffset = ref<Position>({ x: 0, y: 0 })

  // ── 计算属性 ──
  const isMobile = computed(() => window.innerWidth <= mobileBreakpoint)

  const positionStyle = computed(() => ({
    left: `${position.value.x}px`,
    top: `${position.value.y}px`
  }))

  // ── localStorage 操作 ──
  function loadPosition(): boolean {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const savedPosition = JSON.parse(saved) as Position
        position.value = savedPosition
        return true
      }
    } catch (e) {
      log.error('Failed to load notification position:', e)
    }
    return false
  }

  function savePosition(): void {
    try {
      localStorage.setItem(storageKey, JSON.stringify(position.value))
    } catch (e) {
      log.error('Failed to save notification position:', e)
    }
  }

  // ── 位置计算 ──
  function getDefaultPosition(): Position {
    if (defaultPosition) {
      return { ...defaultPosition }
    }
    // 默认位置：右上角，距边缘一定距离
    return {
      x: window.innerWidth - 240,
      y: 60
    }
  }

  function constrainPosition(): void {
    if (!elementRef.value) return

    const rect = elementRef.value.getBoundingClientRect()
    const maxX = window.innerWidth - rect.width
    const maxY = window.innerHeight - rect.height

    position.value.x = Math.max(0, Math.min(position.value.x, maxX))
    position.value.y = Math.max(0, Math.min(position.value.y, maxY))
  }

  function initializePosition(): void {
    if (!loadPosition()) {
      position.value = getDefaultPosition()
    }
    constrainPosition()
  }

  // ── 拖拽处理 ──
  function startDrag(e: MouseEvent | TouchEvent): void {
    // 移动端禁用拖拽时直接返回
    if (disableOnMobile && isMobile.value) return

    isDragging.value = true

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    dragStart.value = { x: clientX, y: clientY }
    dragOffset.value = { x: position.value.x, y: position.value.y }

    document.addEventListener('mousemove', onDrag)
    document.addEventListener('mouseup', stopDrag)
    document.addEventListener('touchmove', onDrag, { passive: false })
    document.addEventListener('touchend', stopDrag)

    e.preventDefault()
  }

  function onDrag(e: MouseEvent | TouchEvent): void {
    if (!isDragging.value || !elementRef.value) return

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    const deltaX = clientX - dragStart.value.x
    const deltaY = clientY - dragStart.value.y

    position.value.x = dragOffset.value.x + deltaX
    position.value.y = dragOffset.value.y + deltaY

    constrainPosition()

    // 阻止触摸事件的默认行为（如滚动）
    if ('touches' in e) {
      e.preventDefault()
    }
  }

  function stopDrag(): void {
    if (isDragging.value) {
      isDragging.value = false
      savePosition()

      document.removeEventListener('mousemove', onDrag)
      document.removeEventListener('mouseup', stopDrag)
      document.removeEventListener('touchmove', onDrag)
      document.removeEventListener('touchend', stopDrag)
    }
  }

  // ── 事件监听 ──
  function handleResize(): void {
    constrainPosition()
    savePosition()
  }

  // ── 生命周期 ──
  watch(show, (newShow) => {
    if (newShow) {
      // 延迟到下一帧，确保 DOM 已渲染
      requestAnimationFrame(() => {
        if (!elementRef.value) return
        constrainPosition()
      })
    }
  })

  onMounted(() => {
    initializePosition()
    window.addEventListener('resize', handleResize)
  })

  onUnmounted(() => {
    stopDrag()
    window.removeEventListener('resize', handleResize)
  })

  return {
    // 状态
    position,
    isDragging,
    isMobile,

    // 计算属性
    positionStyle,

    // 方法
    startDrag,
    constrainPosition,
    savePosition,
  }
}
