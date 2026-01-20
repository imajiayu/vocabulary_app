<template>
  <Transition name="slide-down">
    <div
      v-if="show"
      ref="notificationRef"
      class="draggable-notification"
      :class="{ 'draggable-notification--mobile-fixed': isMobile }"
      :style="positionStyle"
      @mousedown="startDrag"
      @touchstart="startDrag"
    >
      <div class="draggable-notification__content">
        <div v-if="!isMobile" class="draggable-notification__drag-handle">⋮⋮</div>
        <button class="draggable-notification__close" @click.stop="handleClose" @touchend.stop="handleClose" title="关闭">×</button>
        <div class="notification-word">{{ word }}</div>
        <div class="notification-param">
          <span class="notification-param__label">难度系数</span>
          <span class="notification-param__change" :class="changeClass">
            {{ formattedChange }}
          </span>
        </div>
        <div class="notification-info-row">
          <span class="notification-info-row__label">新值</span>
          <span class="notification-info-row__value">{{ newParamValue.toFixed(2) }}</span>
        </div>
        <div class="notification-info-row">
          <span class="notification-info-row__label">下次复习</span>
          <span class="notification-info-row__value">{{ formattedDate }}</span>
        </div>
        <!-- 间隔天数 -->
        <div v-if="breakdown && breakdown.interval !== undefined" class="notification-info-row">
          <span class="notification-info-row__label">间隔天数</span>
          <span class="notification-info-row__value">{{ breakdown.interval }} 天</span>
        </div>
        <!-- 连续记住次数 -->
        <div v-if="breakdown && breakdown.repetition !== undefined" class="notification-info-row">
          <span class="notification-info-row__label">连续记住</span>
          <span class="notification-info-row__value">{{ breakdown.repetition }}</span>
        </div>

        <!-- 复习详情 -->
        <div v-if="breakdown" class="notification-breakdown">
          <div class="notification-breakdown__divider"></div>

          <!-- 未记住时显示简化信息 -->
          <div v-if="!breakdown.remembered" class="notification-breakdown__group">
            <div class="notification-score__label">记忆状态</div>
            <div class="memory-status-value text-danger">未记住</div>
          </div>

          <!-- 记住时显示评分信息 -->
          <div v-else class="notification-breakdown__group">
            <div class="notification-score">
              <div class="notification-score__label">回忆评分</div>
              <div class="notification-score__value">{{ breakdown.score }}</div>
              <div class="notification-score__time">耗时 {{ (breakdown.elapsed_time ?? 0).toFixed(1) }}s</div>
            </div>

            <!-- 竖向刻度尺 -->
            <div class="vertical-scale">
              <div class="vertical-scale__bar">
                <div class="vertical-scale__segment vertical-scale__segment--excellent"></div>
                <div class="vertical-scale__segment vertical-scale__segment--good"></div>
                <div class="vertical-scale__segment vertical-scale__segment--fair"></div>
              </div>
              <div class="vertical-scale__marker" :style="{ top: `${getVerticalPosition(breakdown.elapsed_time ?? 0)}%` }"></div>
              <div class="vertical-scale__labels">
                <span class="vertical-scale__label">0s</span>
                <span class="vertical-scale__label">2s</span>
                <span class="vertical-scale__label">5s</span>
                <span class="vertical-scale__label">8s+</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, ref, toRef } from 'vue'
import { useDraggableNotification } from '@/shared/composables/useDraggableNotification'

interface BreakdownInfo {
  elapsed_time?: number
  score?: number
  repetition?: number
  interval?: number
  remembered?: boolean
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

// ── 拖拽逻辑（使用 composable） ──
const notificationRef = ref<HTMLElement | null>(null)

const { position, positionStyle, isMobile, startDrag } = useDraggableNotification(
  notificationRef,
  toRef(props, 'show'),
  {
    storageKey: 'review-mode-notification-position',
    defaultPosition: { x: window.innerWidth - 220, y: 60 },
    disableOnMobile: true,
  }
)

// ── 事件处理 ──
const handleClose = () => {
  emit('close')
}

// ── 计算属性 ──
const formattedChange = computed(() => {
  const sign = props.paramChange > 0 ? '+' : ''
  return `${sign}${props.paramChange.toFixed(2)}`
})

const changeClass = computed(() => {
  if (props.paramChange === 0) {
    const isAtMax = props.newParamValue >= 3.0
    return isAtMax ? 'notification-param__change--neutral-max' : 'notification-param__change--neutral'
  }
  return props.paramChange > 0 ? 'notification-param__change--positive' : 'notification-param__change--negative'
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
    return (clampedTime / fastThreshold) * 33.3
  } else if (clampedTime <= slowThreshold) {
    const ratio = (clampedTime - fastThreshold) / (slowThreshold - fastThreshold)
    return 33.3 + ratio * 33.3
  } else {
    const ratio = (clampedTime - slowThreshold) / (maxDisplayTime - slowThreshold)
    return 66.6 + ratio * 33.4
  }
}
</script>

<style scoped>
/* 组件特有样式 - 未记住状态 */
.memory-status-value {
  font-size: 14px;
  font-weight: 600;
}

/* 移动端特有调整 - 覆盖全局样式的细节 */
.draggable-notification--mobile-fixed {
  max-height: calc(100vh - 48px - 30vh - 90px);
}

.draggable-notification--mobile-fixed .draggable-notification__content {
  overflow-y: auto;
  max-height: calc(100vh - 48px - 30vh - 90px);
}

.draggable-notification--mobile-fixed .notification-breakdown {
  margin-top: 6px;
}

.draggable-notification--mobile-fixed .notification-breakdown__divider {
  margin: 6px 0;
}

.draggable-notification--mobile-fixed .notification-breakdown__group {
  gap: 8px;
}

.draggable-notification--mobile-fixed .notification-score {
  gap: 2px;
}

.draggable-notification--mobile-fixed .notification-score__label {
  font-size: 10px;
}

.draggable-notification--mobile-fixed .notification-score__value {
  font-size: 24px;
}

.draggable-notification--mobile-fixed .notification-score__time {
  font-size: 10px;
}

.draggable-notification--mobile-fixed .memory-status-value {
  font-size: 12px;
}
</style>
