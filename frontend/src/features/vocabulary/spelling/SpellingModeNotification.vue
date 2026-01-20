<template>
  <!-- 拼写模式通知 -->
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
      <div class="draggable-notification__content spelling-content">
        <div v-if="!isMobile" class="draggable-notification__drag-handle">⋮⋮</div>
        <button class="draggable-notification__close" @click.stop="$emit('close')" title="关闭">×</button>
        <div class="notification-word">{{ word }}</div>
        <div class="notification-param">
          <span class="notification-param__label">{{ paramLabel }}</span>
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

        <!-- 详细评分信息 (拼写模式) -->
        <div v-if="breakdown" class="notification-breakdown">
          <div class="notification-breakdown__divider"></div>

          <!-- 未记住时显示简化信息 -->
          <div v-if="!breakdown.remembered" class="notification-breakdown__group">
            <div class="stat-item">
              <span class="stat-label">记忆状态</span>
              <span class="stat-value text-danger">未记住</span>
            </div>
          </div>

          <!-- 记住时显示详细统计 -->
          <template v-else>
            <!-- 输入统计 -->
            <div class="notification-breakdown__group">
              <div class="notification-breakdown__title">输入统计</div>
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
            <div class="notification-breakdown__group">
              <div class="notification-breakdown__title">评分详情</div>
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
                      <span class="axis-line__label axis-line__label--left">-0.7</span>
                      <span class="axis-line__label axis-line__label--right">+1.0</span>
                      <!-- 当前位置标记 -->
                      <div class="axis-line__marker" :style="{ left: `${(((breakdown.strength_gain ?? 0) + 0.7) / 1.7) * 100}%` }"></div>
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
import { computed, ref, toRef } from 'vue'
import { useDraggableNotification } from '@/shared/composables/useDraggableNotification'

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
  remembered?: boolean
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

defineEmits<{
  close: []
}>()

// ── 拖拽逻辑（使用 composable） ──
const notificationRef = ref<HTMLElement | null>(null)

const { positionStyle, isMobile, startDrag } = useDraggableNotification(
  notificationRef,
  toRef(props, 'show'),
  {
    storageKey: 'spelling-mode-notification-position',
    defaultPosition: { x: window.innerWidth - 240, y: 60 },
    disableOnMobile: true, // 统一移动端行为：禁用拖拽
  }
)

// ── 计算属性 ──
const paramLabel = computed(() => {
  return props.paramType === 'ease_factor' ? '难度系数' : '拼写强度'
})

const formattedChange = computed(() => {
  const sign = props.paramChange > 0 ? '+' : ''
  return `${sign}${props.paramChange.toFixed(2)}`
})

const changeClass = computed(() => {
  if (props.paramChange === 0) {
    const isAtMax = props.paramType === 'spell_strength'
      ? props.newParamValue >= 5
      : props.newParamValue >= 3.0
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
</script>

<style scoped>
/* 拼写模式特有样式 - 内容区域调整 */
.spelling-content {
  min-width: 200px;
  max-width: 260px;
  padding: 12px 24px;
}

/* 统计网格 */
.breakdown-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px 8px;
  font-size: 11px;
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

/* 评分项 */
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

.score-number {
  font-weight: 700;
  font-size: 11px;
  min-width: 35px;
  text-align: right;
}

/* 总分数轴 */
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

/* 移动端适配 */
.draggable-notification--mobile-fixed .spelling-content {
  max-width: 40vw;
  padding: 10px 16px;
}

.draggable-notification--mobile-fixed .notification-word {
  font-size: 14px;
}

.draggable-notification--mobile-fixed .notification-param {
  font-size: 12px;
}

.draggable-notification--mobile-fixed .notification-param__change {
  font-size: 14px;
}

.draggable-notification--mobile-fixed .notification-info-row {
  font-size: 11px;
}
</style>
