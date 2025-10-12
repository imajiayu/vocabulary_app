<template>
  <Transition name="slide-down">
    <div
      v-if="show"
      ref="notificationRef"
      class="notification-container"
      :style="{ left: `${position.x}px`, top: `${position.y}px` }"
      @mousedown="startDrag"
      @touchstart="startDrag"
    >
      <div class="notification-content">
        <div class="drag-handle">⋮⋮</div>
        <div class="word-display">{{ word }}</div>
        <div class="param-info">
          <span class="param-label">{{ paramLabel }}</span>
          <span class="param-change" :class="changeClass">
            {{ formattedChange }}
          </span>
        </div>
        <div class="param-value-info">
          新值: {{ newParamValue.toFixed(2) }}
        </div>
        <div class="next-review">
          下次复习: {{ formattedDate }}
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'

interface Props {
  word: string
  paramType: 'ease_factor' | 'spell_strength'
  paramChange: number
  newParamValue: number
  nextReviewDate: string
  show?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  show: true
})

// 位置存储key
const POSITION_STORAGE_KEY = 'review-params-notification-position'

// 通知元素引用
const notificationRef = ref<HTMLElement | null>(null)

// 位置状态
const position = ref({ x: 0, y: 0 })

// 拖拽状态
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const dragOffset = ref({ x: 0, y: 0 })

// 从localStorage加载位置
const loadPosition = () => {
  try {
    const saved = localStorage.getItem(POSITION_STORAGE_KEY)
    if (saved) {
      const savedPosition = JSON.parse(saved)
      position.value = savedPosition
      return true
    }
  } catch (e) {
    console.error('Failed to load notification position:', e)
  }
  return false
}

// 保存位置到localStorage
const savePosition = () => {
  try {
    localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(position.value))
  } catch (e) {
    console.error('Failed to save notification position:', e)
  }
}

// 初始化默认位置
const initializePosition = () => {
  if (!loadPosition()) {
    // 默认位置：右上角
    position.value = {
      x: window.innerWidth - 240,
      y: 60
    }
  }
  // 确保位置在边界内
  constrainPosition()
}

// 约束位置在边界内
const constrainPosition = () => {
  if (!notificationRef.value) return

  const rect = notificationRef.value.getBoundingClientRect()
  const maxX = window.innerWidth - rect.width
  const maxY = window.innerHeight - rect.height

  position.value.x = Math.max(0, Math.min(position.value.x, maxX))
  position.value.y = Math.max(0, Math.min(position.value.y, maxY))
}

// 开始拖拽
const startDrag = (e: MouseEvent | TouchEvent) => {
  isDragging.value = true

  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

  dragStart.value = { x: clientX, y: clientY }
  dragOffset.value = { x: position.value.x, y: position.value.y }

  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
  document.addEventListener('touchmove', onDrag)
  document.addEventListener('touchend', stopDrag)

  e.preventDefault()
}

// 拖拽中
const onDrag = (e: MouseEvent | TouchEvent) => {
  if (!isDragging.value || !notificationRef.value) return

  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

  const deltaX = clientX - dragStart.value.x
  const deltaY = clientY - dragStart.value.y

  position.value.x = dragOffset.value.x + deltaX
  position.value.y = dragOffset.value.y + deltaY

  constrainPosition()
}

// 停止拖拽
const stopDrag = () => {
  if (isDragging.value) {
    isDragging.value = false
    savePosition()

    document.removeEventListener('mousemove', onDrag)
    document.removeEventListener('mouseup', stopDrag)
    document.removeEventListener('touchmove', onDrag)
    document.removeEventListener('touchend', stopDrag)
  }
}

// 窗口大小变化时重新约束位置
const handleResize = () => {
  constrainPosition()
  savePosition()
}

// 监听show变化，初始化位置
watch(() => props.show, (newShow) => {
  if (newShow) {
    // 延迟到下一帧，确保DOM已渲染
    requestAnimationFrame(() => {
      if (!notificationRef.value) return
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

const paramLabel = computed(() => {
  return props.paramType === 'ease_factor' ? '难度系数' : '拼写强度'
})

const formattedChange = computed(() => {
  const sign = props.paramChange > 0 ? '+' : ''
  return `${sign}${props.paramChange.toFixed(2)}`
})

const changeClass = computed(() => {
  return props.paramChange > 0 ? 'positive' : 'negative'
})

const formattedDate = computed(() => {
  try {
    const date = new Date(props.nextReviewDate)
    return date.toLocaleDateString('zh-CN', {
      month: 'numeric',
      day: 'numeric'
    })
  } catch {
    return props.nextReviewDate
  }
})
</script>

<style scoped>
.notification-container {
  position: fixed;
  z-index: 9999;
  pointer-events: auto;
  cursor: move;
  user-select: none;
  touch-action: none;
}

.notification-content {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 12px 24px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 200px;
  position: relative;
}

.drag-handle {
  position: absolute;
  top: 4px;
  left: 8px;
  font-size: 14px;
  opacity: 0.6;
  cursor: grab;
  line-height: 1;
}

.notification-container:active .drag-handle {
  cursor: grabbing;
}

.word-display {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.param-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.param-label {
  opacity: 0.9;
}

.param-change {
  font-weight: 700;
  font-size: 20px;
}

.param-change.positive {
  color: #52c41a;
}

.param-change.negative {
  color: #ff4d4f;
}

.param-value-info {
  font-size: 12px;
  opacity: 0.85;
}

.next-review {
  font-size: 12px;
  opacity: 0.85;
}

/* 过渡动画 */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-down-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}

.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

/* 移动端适配 */
@media (max-width: 768px) {
  .notification-container {
    top: 52px;
  }

  .notification-content {
    padding: 10px 20px;
    min-width: auto;
    max-width: 90vw;
  }

  .word-display {
    font-size: 16px;
  }

  .param-info {
    font-size: 13px;
  }

  .param-change {
    font-size: 14px;
  }

  .next-review {
    font-size: 11px;
  }
}
</style>
