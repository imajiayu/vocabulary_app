import { ref, computed, onMounted, onUnmounted } from 'vue'
import { logger } from '@/shared/utils/logger'

const POSITION_STORAGE_KEY = 'vocabulary-assistance-widget-position'
const DRAG_THRESHOLD = 5

export function useChatPosition(isExpanded: { value: boolean }) {
  // Drag state
  const isDragging = ref(false)
  const hasMoved = ref(false)
  const dragStartX = ref(0)
  const dragStartY = ref(0)
  const initialX = ref(0)
  const initialY = ref(0)
  const currentX = ref(0)
  const currentY = ref(0)
  const savedX = ref(0)
  const savedY = ref(0)

  // Load position from localStorage
  function loadPosition() {
    try {
      const saved = localStorage.getItem(POSITION_STORAGE_KEY)
      if (saved) {
        const { x, y } = JSON.parse(saved)
        currentX.value = x
        currentY.value = y
        savedX.value = x
        savedY.value = y
        return
      }
    } catch (error) {
      logger.error('加载位置失败:', error)
    }

    // Use default position
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const widgetWidth = 120
    const defaultRight = 16
    const isMobile = viewportWidth <= 768

    if (isMobile) {
      currentX.value = 12
      currentY.value = 56 + 40 + 8
    } else {
      const defaultBottom = 72
      currentX.value = viewportWidth - widgetWidth - defaultRight
      currentY.value = viewportHeight - 50 - defaultBottom
    }

    savedX.value = currentX.value
    savedY.value = currentY.value
  }

  // Save position to localStorage
  function savePosition() {
    try {
      localStorage.setItem(
        POSITION_STORAGE_KEY,
        JSON.stringify({ x: currentX.value, y: currentY.value })
      )
    } catch (error) {
      logger.error('保存位置失败:', error)
    }
  }

  // Computed position style
  const widgetPosition = computed(() => {
    if (currentX.value !== 0 || currentY.value !== 0) {
      return {
        position: 'fixed' as const,
        right: 'auto',
        bottom: 'auto',
        left: `${currentX.value}px`,
        top: `${currentY.value}px`
      }
    }
    return {}
  })

  // Adjust position to stay within viewport
  function adjustPositionWithinBounds() {
    const widgetWidth = isExpanded.value ? 380 : 120
    const widgetHeight = isExpanded.value ? 600 : 50
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    if (currentX.value + widgetWidth > viewportWidth) {
      currentX.value = viewportWidth - widgetWidth
    }
    if (currentY.value + widgetHeight > viewportHeight) {
      currentY.value = viewportHeight - widgetHeight
    }

    currentX.value = Math.max(0, currentX.value)
    currentY.value = Math.max(0, currentY.value)
  }

  // Start drag
  function startDrag(e: MouseEvent) {
    if ((e.target as HTMLElement).closest('.close-button')) return
    if ((e.target as HTMLElement).closest('.chat-input-area')) return

    isDragging.value = true
    hasMoved.value = false
    dragStartX.value = e.clientX
    dragStartY.value = e.clientY

    if (currentX.value === 0 && currentY.value === 0) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      initialX.value = rect.left
      initialY.value = rect.top
      currentX.value = initialX.value
      currentY.value = initialY.value
    } else {
      initialX.value = currentX.value
      initialY.value = currentY.value
    }

    document.addEventListener('mousemove', handleDrag)
    document.addEventListener('mouseup', stopDrag)
    e.preventDefault()
  }

  // Handle drag movement
  function handleDrag(e: MouseEvent) {
    if (!isDragging.value) return

    const deltaX = e.clientX - dragStartX.value
    const deltaY = e.clientY - dragStartY.value

    if (!hasMoved.value && (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD)) {
      hasMoved.value = true
    }

    if (hasMoved.value) {
      let newX = initialX.value + deltaX
      let newY = initialY.value + deltaY

      const widgetWidth = isExpanded.value ? 380 : 120
      const widgetHeight = isExpanded.value ? 600 : 50
      const viewportWidth = window.innerWidth
      const viewportHeight = window.innerHeight

      newX = Math.max(0, Math.min(newX, viewportWidth - widgetWidth))
      newY = Math.max(0, Math.min(newY, viewportHeight - widgetHeight))

      currentX.value = newX
      currentY.value = newY
    }
  }

  // Stop drag
  function stopDrag() {
    isDragging.value = false
    document.removeEventListener('mousemove', handleDrag)
    document.removeEventListener('mouseup', stopDrag)

    if (hasMoved.value) {
      savedX.value = currentX.value
      savedY.value = currentY.value
      savePosition()
    }
  }

  // Save current position for later restore
  function saveCurrentPosition() {
    savedX.value = currentX.value
    savedY.value = currentY.value
  }

  // Restore to saved position
  function restorePosition() {
    currentX.value = savedX.value
    currentY.value = savedY.value
  }

  // Handle window resize
  function handleWindowResize() {
    if (currentX.value !== 0 || currentY.value !== 0) {
      adjustPositionWithinBounds()
      if (!isExpanded.value) {
        savedX.value = currentX.value
        savedY.value = currentY.value
        savePosition()
      }
    }
  }

  // Check if drag should block toggle
  function shouldBlockToggle(): boolean {
    if (hasMoved.value) {
      hasMoved.value = false
      return true
    }
    return false
  }

  // Lifecycle
  onMounted(() => {
    loadPosition()
    window.addEventListener('resize', handleWindowResize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', handleWindowResize)
  })

  return {
    // State
    isDragging,
    hasMoved,
    currentX,
    currentY,

    // Computed
    widgetPosition,

    // Actions
    startDrag,
    adjustPositionWithinBounds,
    saveCurrentPosition,
    restorePosition,
    shouldBlockToggle
  }
}
