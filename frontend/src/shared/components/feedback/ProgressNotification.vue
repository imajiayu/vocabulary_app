<template>
  <Transition name="notification">
    <div v-if="show" class="progress-notification">
      <!-- 装饰性背景 -->
      <div class="notification-decoration">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <circle cx="80" cy="20" r="40" fill="url(#notifGradient)" opacity="0.15"/>
          <defs>
            <radialGradient id="notifGradient">
              <stop offset="0%" stop-color="var(--primitive-olive-400)"/>
              <stop offset="100%" stop-color="transparent"/>
            </radialGradient>
          </defs>
        </svg>
      </div>

      <!-- 左侧：进度环 -->
      <div class="notification-progress">
        <svg viewBox="0 0 60 60" class="progress-ring">
          <circle
            class="ring-track"
            cx="30" cy="30" r="24"
            stroke-width="5"
            fill="none"
          />
          <circle
            class="ring-fill"
            cx="30" cy="30" r="24"
            stroke-width="5"
            fill="none"
            :stroke-dasharray="150.8"
            :stroke-dashoffset="150.8 * (1 - progressPercent)"
          />
        </svg>
        <div class="progress-percent">{{ Math.round(progressPercent * 100) }}%</div>
      </div>

      <!-- 中间：信息区 -->
      <div class="notification-body">
        <div class="notification-header">
          <span class="notification-badge" :class="modeClass">
            <AppIcon :name="getModeIcon(progressInfo.mode)" class="badge-icon" />
            {{ getModeDisplayName(progressInfo.mode) }}
          </span>
          <span class="notification-source">{{ progressInfo.source }}</span>
        </div>

        <div class="notification-title">继续上次的学习？</div>

        <div class="notification-stats">
          <div class="stat-item">
            <span class="stat-value">{{ completedCount }}</span>
            <span class="stat-label">已完成</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-value stat-value--remaining">{{ remainingCount }}</span>
            <span class="stat-label">剩余</span>
          </div>
          <div class="stat-divider"></div>
          <div class="stat-item">
            <span class="stat-value stat-value--muted">{{ progressInfo.shuffle ? '随机' : '顺序' }}</span>
            <span class="stat-label">模式</span>
          </div>
        </div>
      </div>

      <!-- 右侧：操作区 -->
      <div class="notification-actions">
        <button class="action-btn action-btn--primary" @click="$emit('resume')">
          <AppIcon name="play" class="btn-icon" />
          <span class="btn-text">继续</span>
        </button>
        <button class="action-btn action-btn--ghost" @click="$emit('dismiss')">
          <span class="btn-text">放弃</span>
        </button>
      </div>

      <!-- 移动端关闭按钮 -->
      <button class="mobile-close" @click="$emit('dismiss')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from '@/shared/components/controls/Icons.vue'

interface ProgressInfo {
  mode: string
  source: string
  shuffle: boolean
  current_index: number
  total_words: number
  remaining_words: number
  initial_lapse_word_count: number
}

interface Props {
  show: boolean
  progressInfo: ProgressInfo
}

const props = defineProps<Props>()

defineEmits<{
  resume: []
  dismiss: []
}>()

const getModeDisplayName = (mode: string) => {
  const modeMap: Record<string, string> = {
    'mode_review': '复习',
    'mode_lapse': '错题',
    'mode_spelling': '拼写'
  }
  return modeMap[mode] || mode
}

const getModeIcon = (mode: string) => {
  const iconMap: Record<string, 'refresh' | 'alert' | 'keyboard' | 'book'> = {
    'mode_review': 'refresh',
    'mode_lapse': 'alert',
    'mode_spelling': 'keyboard'
  }
  return iconMap[mode] || 'book'
}

const modeClass = computed(() => {
  const classMap: Record<string, string> = {
    'mode_review': 'badge--review',
    'mode_lapse': 'badge--lapse',
    'mode_spelling': 'badge--spelling'
  }
  return classMap[props.progressInfo.mode] || ''
})

// 根据模式计算已完成单词数
const completedCount = computed(() => {
  if (props.progressInfo.mode === 'mode_lapse') {
    return props.progressInfo.initial_lapse_word_count - props.progressInfo.total_words
  }
  return props.progressInfo.current_index
})

// 根据模式计算总单词数
const totalCount = computed(() => {
  if (props.progressInfo.mode === 'mode_lapse') {
    return props.progressInfo.initial_lapse_word_count
  }
  return props.progressInfo.total_words
})

// 根据模式计算剩余单词数
const remainingCount = computed(() => {
  if (props.progressInfo.mode === 'mode_lapse') {
    return props.progressInfo.total_words
  }
  return props.progressInfo.remaining_words
})

// 计算进度百分比
const progressPercent = computed(() => {
  if (totalCount.value === 0) return 0
  return completedCount.value / totalCount.value
})
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   进度恢复通知 - 重新设计
   ═══════════════════════════════════════════════════════════════════════════ */

.progress-notification {
  position: relative;
  display: flex;
  align-items: center;
  gap: 1.25rem;
  padding: 1.25rem 1.5rem;
  background: var(--primitive-paper-100);
  border: 1px solid var(--primitive-olive-200);
  border-left: 4px solid var(--primitive-olive-400);
  border-radius: var(--radius-lg);
  box-shadow: 0 4px 20px rgba(93, 122, 93, 0.12);
  overflow: hidden;
  margin-bottom: 1.5rem;
}

/* 装饰性背景 */
.notification-decoration {
  position: absolute;
  right: 0;
  top: 0;
  width: 120px;
  height: 100%;
  pointer-events: none;
  opacity: 0.8;
}

.notification-decoration svg {
  width: 100%;
  height: 100%;
}

/* ── 进度环 ── */
.notification-progress {
  position: relative;
  width: 60px;
  height: 60px;
  flex-shrink: 0;
}

.progress-ring {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.ring-track {
  stroke: var(--primitive-paper-400);
}

.ring-fill {
  stroke: var(--primitive-olive-500);
  stroke-linecap: round;
  transition: stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.progress-percent {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--primitive-olive-600);
}

/* ── 信息区 ── */
.notification-body {
  flex: 1;
  min-width: 0;
  position: relative;
  z-index: 1;
}

.notification-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.375rem;
}

.notification-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.1875rem 0.5rem;
  font-size: 0.6875rem;
  font-weight: 600;
  border-radius: var(--radius-full);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.badge-icon {
  width: 0.875rem;
  height: 0.875rem;
  fill: currentColor;
}

.badge--review {
  background: var(--primitive-copper-100);
  color: var(--primitive-copper-600);
}

.badge--lapse {
  background: var(--primitive-brick-100);
  color: var(--primitive-brick-600);
}

.badge--spelling {
  background: var(--primitive-olive-100);
  color: var(--primitive-olive-600);
}

.notification-source {
  font-size: 0.75rem;
  color: var(--primitive-ink-400);
  font-weight: 500;
}

.notification-title {
  font-family: var(--font-serif);
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--primitive-ink-800);
  margin-bottom: 0.625rem;
}

.notification-stats {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.125rem;
}

.stat-value {
  font-family: var(--font-mono);
  font-size: 1rem;
  font-weight: 700;
  color: var(--primitive-olive-600);
  line-height: 1;
}

.stat-value--remaining {
  color: var(--primitive-copper-500);
}

.stat-value--muted {
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--primitive-ink-500);
}

.stat-label {
  font-size: 0.625rem;
  color: var(--primitive-ink-400);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-divider {
  width: 1px;
  height: 24px;
  background: var(--primitive-paper-400);
}

/* ── 操作区 ── */
.notification-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: var(--radius-md);
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.action-btn--primary {
  background: var(--gradient-primary);
  color: var(--primitive-paper-50);
  box-shadow: 0 2px 8px rgba(153, 107, 61, 0.25);
}

.action-btn--primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(153, 107, 61, 0.35);
}

.action-btn--primary:active {
  transform: translateY(0);
}

.action-btn--ghost {
  background: transparent;
  color: var(--primitive-ink-500);
}

.action-btn--ghost:hover {
  background: var(--primitive-paper-300);
  color: var(--primitive-ink-700);
}

.btn-icon {
  width: 0.75rem;
  height: 0.75rem;
  fill: currentColor;
}

.btn-text {
  line-height: 1;
}

/* 移动端关闭按钮 - 默认隐藏 */
.mobile-close {
  display: none;
}

/* ═══════════════════════════════════════════════════════════════════════════
   动画
   ═══════════════════════════════════════════════════════════════════════════ */

.notification-enter-active {
  transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.notification-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.notification-enter-from {
  opacity: 0;
  transform: translateY(-20px) scale(0.95);
}

.notification-leave-to {
  opacity: 0;
  transform: translateY(-10px) scale(0.98);
}

/* ═══════════════════════════════════════════════════════════════════════════
   移动端适配
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .progress-notification {
    flex-wrap: nowrap;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    margin: 0 0 0.5rem;
    border-radius: var(--radius-md);
  }

  .notification-progress {
    width: 44px;
    height: 44px;
  }

  .progress-percent {
    font-size: 0.625rem;
  }

  .notification-body {
    flex: 1;
    min-width: 0;
  }

  .notification-header {
    margin-bottom: 0.25rem;
  }

  .notification-title {
    font-size: 0.875rem;
    margin-bottom: 0.375rem;
  }

  .notification-stats {
    gap: 0.5rem;
  }

  .stat-value {
    font-size: 0.8125rem;
  }

  .stat-label {
    font-size: 0.5625rem;
  }

  .stat-divider {
    height: 18px;
  }

  .notification-actions {
    flex-direction: column;
    gap: 0.375rem;
  }

  .action-btn {
    padding: 0.4375rem 0.75rem;
    font-size: 0.75rem;
  }

  .mobile-close {
    display: flex;
    position: absolute;
    top: 0.375rem;
    right: 0.375rem;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    color: var(--primitive-ink-400);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .mobile-close:active {
    background: var(--primitive-paper-300);
    transform: scale(0.95);
  }

  .notification-decoration {
    display: none;
  }
}

/* 横屏适配 */
@media (max-height: 500px) and (orientation: landscape) {
  .progress-notification {
    padding: 0.75rem 1rem;
    margin-bottom: 0.75rem;
    gap: 0.75rem;
  }

  .notification-progress {
    width: 40px;
    height: 40px;
  }

  .notification-title {
    font-size: 0.9375rem;
    margin-bottom: 0.375rem;
  }

  .notification-stats {
    gap: 0.5rem;
  }

  .stat-value {
    font-size: 0.8125rem;
  }

  .notification-actions {
    flex-direction: column;
    width: auto;
    gap: 0.375rem;
  }

  .action-btn {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
  }
}
</style>
