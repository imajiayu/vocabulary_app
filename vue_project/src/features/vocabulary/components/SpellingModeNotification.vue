<template>
  <!-- 拼写模式通知 -->
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
        <button class="close-button" @click.stop="$emit('close')" title="关闭">×</button>
        <div class="word-display">{{ word }}</div>
        <div class="param-info">
          <span class="param-label">{{ paramLabel }}</span>
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

        <!-- 详细评分信息 (拼写模式) -->
        <div v-if="breakdown" class="breakdown-section">
          <div class="breakdown-divider"></div>

          <!-- 未记住时显示简化信息 -->
          <div v-if="!breakdown.remembered" class="breakdown-group">
            <div class="review-stats">
              <div class="stat-item">
                <span class="stat-label">记忆状态</span>
                <span class="stat-value text-danger">未记住</span>
              </div>
            </div>
          </div>

          <!-- 记住时显示详细统计 -->
          <template v-else>
            <!-- 输入统计 -->
            <div class="breakdown-group">
              <div class="breakdown-title">输入统计</div>
              <div class="breakdown-stats">
                <div class="stat-item">
                  <span class="stat-label">字母数</span>
                  <span class="stat-value">{{ breakdown.typed_count }} / {{ breakdown.word_length }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">退格数</span>
                  <span class="stat-value">{{ breakdown.backspace_count }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">平均间隔</span>
                  <span class="stat-value">{{ Math.round(breakdown.avg_key_interval ?? 0) }}ms</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">最长停顿</span>
                  <span class="stat-value">{{ Math.round(breakdown.longest_pause ?? 0) }}ms</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">总耗时</span>
                  <span class="stat-value">{{ ((breakdown.total_typing_time ?? 0) / 1000).toFixed(1) }}s</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">音频帮助</span>
                  <span class="stat-value">{{ breakdown.audio_requests }}</span>
                </div>
              </div>
            </div>

            <!-- 评分详情 -->
            <div class="breakdown-group">
              <div class="breakdown-title">评分详情</div>
            <div class="score-items">
              <div class="score-item">
                <div class="score-header">
                  <span class="score-name">准确性</span>
                  <span class="score-weight">(60%)</span>
                </div>
                <div class="score-bar-container">
                  <div class="score-bar" :style="{ width: `${(breakdown.accuracy_score ?? 0) * 100}%` }"></div>
                </div>
                <span class="score-number">{{ (breakdown.weighted_accuracy ?? 0).toFixed(1) }}</span>
              </div>
              <div class="score-item">
                <div class="score-header">
                  <span class="score-name">流畅度</span>
                  <span class="score-weight">(20%)</span>
                </div>
                <div class="score-bar-container">
                  <div class="score-bar" :style="{ width: `${(breakdown.fluency_score ?? 0) * 100}%` }"></div>
                </div>
                <span class="score-number">{{ (breakdown.weighted_fluency ?? 0).toFixed(1) }}</span>
              </div>
              <div class="score-item">
                <div class="score-header">
                  <span class="score-name">独立性</span>
                  <span class="score-weight">(20%)</span>
                </div>
                <div class="score-bar-container">
                  <div class="score-bar" :style="{ width: `${(breakdown.independence_score ?? 0) * 100}%` }"></div>
                </div>
                <span class="score-number">{{ (breakdown.weighted_independence ?? 0).toFixed(1) }}</span>
              </div>
              <!-- 总分数轴 -->
              <div class="total-score-axis">
                <div class="score-header">
                  <span class="score-name">总分</span>
                </div>
                <div class="axis-container">
                  <div class="axis-line">
                    <span class="axis-label axis-left">-0.7</span>
                    <span class="axis-label axis-right">+1.0</span>
                    <!-- 当前位置标记 -->
                    <div class="axis-marker" :style="{ left: `${(((breakdown.strength_gain ?? 0) + 0.7) / 1.7) * 100}%` }"></div>
                  </div>
                </div>
                <span class="score-number">{{ (breakdown.total_score ?? 0).toFixed(1) }}</span>
              </div>
            </div>
          </div>
          </template>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'

interface BreakdownInfo {
  // 拼写模式字段
  typed_count?: number
  backspace_count?: number
  word_length?: number
  avg_key_interval?: number
  longest_pause?: number
  total_typing_time?: number
  audio_requests?: number
  accuracy_score?: number
  fluency_score?: number
  independence_score?: number
  weighted_accuracy?: number
  weighted_fluency?: number
  weighted_independence?: number
  total_score?: number
  strength_gain?: number

  // 通用字段
  remembered: boolean
}

interface Props {
  word: string
  paramType: 'ease_factor' | 'spell_strength'
  paramChange: number
  newParamValue: number
  nextReviewDate: string
  show?: boolean
  breakdown?: BreakdownInfo
}

const props = withDefaults(defineProps<Props>(), {
  show: true
})

// 位置存储key（拼写模式专用）
const POSITION_STORAGE_KEY = 'spelling-mode-notification-position'

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
  // 当 change 为 0 时，需要判断是否已经达到最高值
  if (props.paramChange === 0) {
    const isAtMax = props.paramType === 'spell_strength'
      ? props.newParamValue >= 5
      : props.newParamValue >= 3.0
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
  margin-top: 12px;
}

.breakdown-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.2);
  margin: 8px 0;
}

.breakdown-group {
  margin-top: 10px;
}

.breakdown-title {
  font-size: 11px;
  font-weight: 600;
  opacity: 0.8;
  margin-bottom: 6px;
  text-align: left;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.breakdown-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px 8px;
  font-size: 11px;
}

.review-stats {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 11px;
}

.review-stats .stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}

.text-success {
  color: #52c41a;
}

.text-danger {
  color: #ff4d4f;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2px 0;
}

.stat-label {
  opacity: 0.75;
  font-size: 10px;
}

.stat-value {
  font-weight: 600;
  font-size: 11px;
}

.score-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.score-item {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 8px;
  font-size: 10px;
}

.score-item.total-score {
  margin-top: 4px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.score-header {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 50px;
}

.score-name {
  font-weight: 600;
  font-size: 10px;
}

.score-weight {
  font-size: 9px;
  opacity: 0.6;
}

.score-bar-container {
  height: 8px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  overflow: hidden;
  flex: 1;
}

.score-bar {
  height: 100%;
  background: linear-gradient(90deg, #52c41a, #73d13d);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.score-bar.total {
  background: linear-gradient(90deg, #1890ff, #40a9ff);
}

.score-number {
  font-weight: 700;
  font-size: 11px;
  min-width: 35px;
  text-align: right;
}

/* 总分数轴样式 */
.total-score-axis {
  display: grid;
  grid-template-columns: 34px 1fr 28px;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  margin-top: 4px;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.total-score-axis .score-header {
  min-width: auto;
}

.total-score-axis .score-name {
  font-size: 10px;
}

.total-score-axis .score-number {
  min-width: 28px;
  font-size: 11px;
}

.axis-container {
  flex: 1;
}

.axis-line {
  position: relative;
  height: 20px;
  background: linear-gradient(to right,
    rgba(255, 77, 79, 0.25) 0%,     /* 红色区域 -0.7到0 */
    rgba(255, 77, 79, 0.25) 41.2%,  /* 41.2% = 0.7/1.7 */
    rgba(255, 255, 255, 0.15) 41.2%,  /* 半透明白色区域 0到1.0 */
    rgba(255, 255, 255, 0.15) 100%
  );
  border-radius: 4px;
  display: flex;
  align-items: center;
}

.axis-label {
  position: absolute;
  font-size: 9px;
  opacity: 0.8;
  font-weight: 600;
  top: 50%;
  transform: translateY(-50%);
}

.axis-label.axis-left {
  left: 2px;
}

.axis-label.axis-right {
  right: 2px;
}

.axis-marker {
  position: absolute;
  width: 3px;
  height: 24px;
  background: #ffffff;
  border-radius: 2px;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.3);
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
  transition: left 0.3s ease;
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

  .info-row {
    font-size: 12px;
  }
}
</style>
