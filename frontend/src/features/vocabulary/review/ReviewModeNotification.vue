<template>
  <Transition name="slide-down">
    <div
      v-if="show"
      ref="notificationRef"
      class="notification-container"
      :style="{ left: `${position.x}px`, top: `${position.y}px` }"
      @mousedown="startDrag"
    >
      <div class="notification-content">
        <div class="drag-handle">⋮⋮</div>
        <button class="close-button" @click.stop="handleClose" @touchend.stop="handleClose" title="关闭">×</button>
        <div class="word-display">{{ word }}</div>
        <div class="param-info">
          <span class="param-label">难度系数</span>
          <span class="param-change" :class="changeClass">
            {{ formattedChange }}
          </span>
        </div>
        <div class="info-row">
          <span class="info-label">新值</span>
          <span class="info-value">{{ newParamValue.toFixed(2) }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">下次复习</span>
          <span class="info-value">{{ formattedDate }}</span>
        </div>
        <!-- 间隔天数 -->
        <div v-if="breakdown && breakdown.interval !== undefined" class="info-row">
          <span class="info-label">间隔天数</span>
          <span class="info-value">{{ breakdown.interval }} 天</span>
        </div>
        <!-- 连续记住次数 -->
        <div v-if="breakdown && breakdown.repetition !== undefined" class="info-row">
          <span class="info-label">连续记住</span>
          <span class="info-value">{{ breakdown.repetition }}</span>
        </div>

        <!-- 复习详情 -->
        <div v-if="breakdown" class="breakdown-section">
          <div class="breakdown-divider"></div>

          <!-- 未记住时显示简化信息 -->
          <div v-if="!breakdown.remembered" class="breakdown-group">
            <div class="memory-status-label">记忆状态</div>
            <div class="memory-status-value failed">未记住</div>
          </div>

          <!-- 记住时显示评分信息 -->
          <div v-else class="breakdown-group">
            <div class="score-section">
              <div class="score-label">回忆评分</div>
              <div class="score-display">{{ breakdown.score }}</div>
              <div class="time-label">耗时 {{ (breakdown.elapsed_time ?? 0).toFixed(1) }}s</div>
            </div>

            <!-- 竖向刻度尺 -->
            <div class="vertical-scale">
              <div class="scale-bar">
                <div class="scale-segment excellent"></div>
                <div class="scale-segment good"></div>
                <div class="scale-segment fair"></div>
              </div>
              <div class="scale-marker" :style="{ top: `${getVerticalPosition(breakdown.elapsed_time ?? 0)}%` }"></div>
              <div class="scale-labels">
                <span class="scale-label top">0s</span>
                <span class="scale-label mid1">2s</span>
                <span class="scale-label mid2">5s</span>
                <span class="scale-label bottom">8s+</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { reviewLogger as log } from '@/shared/utils/logger'

interface BreakdownInfo {
  elapsed_time?: number
  score?: number
  repetition?: number
  interval?: number
  remembered: boolean
}

interface Props {
  word: string
  paramChange: number
  newParamValue: number
  nextReviewDate: string
  show?: boolean
  breakdown?: BreakdownInfo
}

const props = withDefaults(defineProps<Props>(), {
  show: true
})

const emit = defineEmits<{
  close: []
}>()

// 关闭处理函数
const handleClose = () => {
  emit('close')
}

// 位置存储key
const POSITION_STORAGE_KEY = 'review-mode-notification-position'

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
    log.error('Failed to load notification position:', e)
  }
  return false
}

// 保存位置到localStorage
const savePosition = () => {
  try {
    localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(position.value))
  } catch (e) {
    log.error('Failed to save notification position:', e)
  }
}

// 初始化默认位置
const initializePosition = () => {
  if (!loadPosition()) {
    // 默认位置：右上角
    position.value = {
      x: window.innerWidth - 220,
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

const formattedChange = computed(() => {
  const sign = props.paramChange > 0 ? '+' : ''
  return `${sign}${props.paramChange.toFixed(2)}`
})

const changeClass = computed(() => {
  if (props.paramChange === 0) {
    const isAtMax = props.newParamValue >= 3.0
    return isAtMax ? 'neutral-max' : 'neutral'
  }
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

/**
 * 计算回忆耗时在竖向刻度尺上的位置百分比
 * 0-2s: 优秀 (0%-33%)
 * 2-5s: 良好 (33%-66%)
 * 5-8s+: 及格 (66%-100%)
 */
const getVerticalPosition = (elapsedTime: number): number => {
  const maxDisplayTime = 8
  const fastThreshold = 2
  const slowThreshold = 5

  const clampedTime = Math.min(elapsedTime, maxDisplayTime)

  if (clampedTime <= fastThreshold) {
    // 0-2s: 映射到 0%-33%
    return (clampedTime / fastThreshold) * 33.3
  } else if (clampedTime <= slowThreshold) {
    // 2-5s: 映射到 33%-66%
    const ratio = (clampedTime - fastThreshold) / (slowThreshold - fastThreshold)
    return 33.3 + ratio * 33.3
  } else {
    // 5-8s: 映射到 66%-100%
    const ratio = (clampedTime - slowThreshold) / (maxDisplayTime - slowThreshold)
    return 66.6 + ratio * 33.4
  }
}
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
  padding: 16px 20px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 180px;
  max-width: 220px;
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

.close-button {
  position: absolute;
  top: 4px;
  right: 8px;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: white;
  font-size: 20px;
  line-height: 1;
  padding: 0;
  transition: background 0.2s;
}

.close-button:hover {
  background: rgba(255, 255, 255, 0.3);
}

.close-button:active {
  background: rgba(255, 255, 255, 0.4);
}

.word-display {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
}

.param-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  margin-bottom: 4px;
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

.param-change.neutral {
  color: #faad14;
}

.param-change.neutral-max {
  color: #95de64;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  font-size: 13px;
  opacity: 0.9;
  gap: 12px;
}

.info-label {
  flex-shrink: 0;
  text-align: left;
}

.info-value {
  flex-shrink: 0;
  text-align: right;
  font-weight: 500;
}

/* 详细评分信息样式 */
.breakdown-section {
  width: 100%;
  margin-top: 8px;
}

.breakdown-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.2);
  margin: 8px 0;
}

.breakdown-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.memory-status-label {
  font-size: 11px;
  opacity: 0.8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.memory-status-value {
  font-size: 14px;
  font-weight: 600;
}

.memory-status-value.failed {
  color: #ff4d4f;
}

/* 评分展示 */
.score-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.score-label {
  font-size: 11px;
  opacity: 0.8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.score-display {
  font-size: 32px;
  font-weight: 700;
  line-height: 1;
}

.time-label {
  font-size: 11px;
  opacity: 0.75;
}

/* 竖向刻度尺 */
.vertical-scale {
  position: relative;
  width: 100%;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.scale-bar {
  width: 40px;
  height: 100%;
  border-radius: 20px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
}

.scale-segment {
  flex: 1;
  transition: opacity 0.3s;
}

.scale-segment.excellent {
  background: rgba(82, 196, 26, 0.4);
}

.scale-segment.good {
  background: rgba(250, 173, 20, 0.35);
}

.scale-segment.fair {
  background: rgba(255, 77, 79, 0.3);
}

.scale-marker {
  position: absolute;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 50px;
  height: 4px;
  background: #ffffff;
  border-radius: 2px;
  box-shadow: 0 0 6px rgba(0, 0, 0, 0.4);
  z-index: 2;
  transition: top 0.3s ease;
}

.scale-labels {
  position: absolute;
  right: 10px;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 2px 0;
}

.scale-label {
  font-size: 10px;
  opacity: 0.8;
  font-weight: 600;
  line-height: 1;
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
    /* 紧贴WordSidebar下方 */
    left: auto !important;
    right: 0 !important;
    top: calc(48px + 30vh) !important; /* topbar高度 + WordSidebar高度 */
    bottom: auto !important;
    transform: none;
    max-width: 35vw; /* 进一步缩小宽度 */
    max-height: calc(100vh - 48px - 30vh - 90px); /* 调整高度：总高度 - topbar - WordSidebar - 底部按钮栏空间 */
    /* 禁用拖拽 */
    cursor: default !important;
  }

  .notification-content {
    padding: 8px 10px; /* 进一步减小padding */
    min-width: 120px; /* 进一步减小最小宽度 */
    max-width: 35vw;
    border-radius: 10px 0 0 10px; /* 只有左侧圆角 */
    overflow-y: auto;
    max-height: calc(100vh - 48px - 30vh - 90px); /* 与容器一致 */
    gap: 3px; /* 进一步减小间距 */
  }

  /* 隐藏拖拽手柄 */
  .drag-handle {
    display: none;
  }

  /* 关闭按钮 - 右上角 */
  .close-button {
    width: 18px;
    height: 18px;
    font-size: 16px;
    top: 2px;
    right: 4px;
    left: auto;
  }

  /* 字体大小调整 */
  .word-display {
    font-size: 14px; /* 减小字体 */
    margin-bottom: 0;
  }

  .param-info {
    font-size: 11px; /* 减小字体 */
    gap: 6px;
    margin-bottom: 2px;
  }

  .param-change {
    font-size: 16px; /* 减小字体 */
  }

  .info-row {
    font-size: 11px; /* 减小字体 */
    gap: 8px; /* 减小间距 */
  }

  /* 评分信息 */
  .breakdown-section {
    margin-top: 6px;
  }

  .breakdown-divider {
    margin: 6px 0;
  }

  .breakdown-group {
    gap: 8px;
  }

  .score-section {
    gap: 2px;
  }

  .score-label {
    font-size: 10px;
  }

  .score-display {
    font-size: 24px; /* 减小评分字体 */
  }

  .time-label {
    font-size: 10px;
  }

  .memory-status-label {
    font-size: 10px;
  }

  .memory-status-value {
    font-size: 12px;
  }

  /* 刻度尺 */
  .vertical-scale {
    height: 80px; /* 减小高度 */
  }

  .scale-bar {
    width: 28px; /* 减小宽度 */
  }

  .scale-marker {
    width: 36px; /* 减小标记宽度 */
    height: 3px;
  }

  .scale-labels {
    right: 6px;
  }

  .scale-label {
    font-size: 9px;
  }
}
</style>
