<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import TopBarDropdown, { type DropdownItem } from './TopBarDropdown.vue'
import AppIcon from '@/shared/components/controls/Icons.vue'

interface Props {
  background?: string
  height?: string | number
  sticky?: boolean
  border?: string
  padding?: string
  showHomeButton?: boolean
  homeButtonText?: string
  homeButtonTo?: string
  showHomeLoading?: boolean
  showManagementButton?: boolean
  showStatsButton?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  background: 'transparent',
  height: 'var(--topbar-height)',
  sticky: true,
  border: 'none',
  padding: '0 var(--spacing-md)',
  showHomeButton: false,
  homeButtonText: '返回首页',
  homeButtonTo: '/',
  showHomeLoading: true,
  showManagementButton: false,
  showStatsButton: false
})

const emit = defineEmits<{
  beforeNavigate: []
  afterNavigate: []
  navigationError: [error: Error]
}>()

const router = useRouter()
const isNavigating = ref(false)
const isMobile = ref(false)

const computedHeight = computed(() => {
  return typeof props.height === 'number' ? `${props.height}px` : props.height
})

// 检测是否为移动端
const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768
}

// 下拉菜单项
const dropdownItems = computed<DropdownItem[]>(() => {
  const items: DropdownItem[] = []
  if (props.showHomeButton) {
    items.push({
      key: 'home',
      label: props.homeButtonText,
      icon: 'home',
      disabled: isNavigating.value,
      action: goHome
    })
  }
  if (props.showManagementButton) {
    items.push({
      key: 'management',
      label: '管理单词',
      icon: 'plus-circle',
      action: goManagement
    })
  }
  if (props.showStatsButton) {
    items.push({
      key: 'stats',
      label: '查看统计',
      icon: 'chart',
      action: goStats
    })
  }
  return items
})

onMounted(() => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})

// 导航方法
const goHome = async () => {
  if (isNavigating.value) return

  try {
    isNavigating.value = props.showHomeLoading
    emit('beforeNavigate')

    await router.push(props.homeButtonTo)

    emit('afterNavigate')
  } catch (error) {
    emit('navigationError', error as Error)

    // 备选方案：使用原生跳转
    window.location.href = props.homeButtonTo
  } finally {
    isNavigating.value = false
  }
}

// 导航到管理单词页面（新窗口）
const goManagement = () => {
  const resolved = router.resolve('/management')
  window.open(resolved.href, '_blank')
}

// 导航到统计页面（新窗口）
const goStats = () => {
  const resolved = router.resolve('/stats')
  window.open(resolved.href, '_blank')
}
</script>

<template>
  <header
    class="top-bar"
    :class="{ sticky: props.sticky }"
    :style="{
      '--bar-height': computedHeight,
      padding: props.padding
    }"
  >
    <!-- 装饰性墨水线 -->
    <div class="ink-line ink-line--top"></div>

    <!-- 主内容容器 -->
    <div class="bar-content">
      <!-- 移动端：中间层（绝对居中，在左右之下） -->
      <div v-if="isMobile" class="bar-section bar-section--center-absolute">
        <slot name="center" />
        <slot v-if="!$slots.center" />
      </div>

      <!-- 左侧区域 -->
      <div class="bar-section bar-section--left">
        <!-- 桌面端：优雅的导航按钮 -->
        <template v-if="!isMobile">
          <!-- 返回首页按钮 -->
          <button
            v-if="props.showHomeButton"
            @click="goHome"
            class="nav-button nav-button--primary"
            :disabled="isNavigating"
          >
            <span class="button-icon">←</span>
            <span v-if="!isNavigating" class="button-label">{{ props.homeButtonText }}</span>
            <span v-else class="button-label loading">
              <span class="loading-dot"></span>
              返回中
            </span>
          </button>

          <!-- 快捷操作按钮组 -->
          <div v-if="props.showManagementButton || props.showStatsButton" class="quick-actions">
            <button
              v-if="props.showManagementButton"
              @click="goManagement"
              class="action-chip"
              title="管理单词"
            >
              <AppIcon name="plus-circle" class="chip-icon-svg" />
              <span class="chip-text">管理</span>
            </button>

            <button
              v-if="props.showStatsButton"
              @click="goStats"
              class="action-chip"
              title="查看统计"
            >
              <AppIcon name="chart" class="chip-icon-svg" />
              <span class="chip-text">统计</span>
            </button>
          </div>
        </template>

        <!-- 移动端：下拉菜单 -->
        <template v-else>
          <TopBarDropdown
            v-if="dropdownItems.length > 0"
            :items="dropdownItems"
          />
        </template>

        <slot name="left" />
      </div>

      <!-- 中间区域 - 桌面端使用 grid 布局 -->
      <div v-if="!isMobile" class="bar-section bar-section--center">
        <slot name="center" />
        <slot v-if="!$slots.center" />
      </div>

      <!-- 右侧区域 -->
      <div class="bar-section bar-section--right">
        <slot name="right" />
      </div>
    </div>

    <!-- 底部装饰线 -->
    <div class="ink-line ink-line--bottom"></div>
  </header>
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   TopBar - 浮动编辑台风格
   ═══════════════════════════════════════════════════════════════════════════ */

.top-bar {
  --bar-height: var(--topbar-height, 48px);
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: var(--bar-height);
  background: linear-gradient(
    180deg,
    var(--primitive-paper-100) 0%,
    var(--primitive-paper-200) 100%
  );
  box-sizing: border-box;
  z-index: 10;
}

.top-bar.sticky {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  box-shadow:
    0 4px 20px rgba(139, 105, 20, 0.06),
    0 1px 3px rgba(0, 0, 0, 0.04);
}

/* ── 装饰性墨水线 ── */
.ink-line {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 2rem);
  max-width: 1200px;
  height: 1px;
  pointer-events: none;
}

.ink-line--top {
  top: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--primitive-copper-200) 20%,
    var(--primitive-copper-300) 50%,
    var(--primitive-copper-200) 80%,
    transparent 100%
  );
  opacity: 0.6;
}

.ink-line--bottom {
  bottom: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--primitive-paper-400) 15%,
    var(--primitive-paper-500) 50%,
    var(--primitive-paper-400) 85%,
    transparent 100%
  );
}

/* ── 主内容容器 ── */
.bar-content {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  width: 100%;
  height: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 1rem;
  gap: 1rem;
}

/* ── 区块布局 ── */
.bar-section {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.bar-section--left {
  justify-self: start;
}

.bar-section--center {
  justify-self: center;
  justify-content: center;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bar-section--right {
  justify-self: end;
  justify-content: flex-end;
}

/* 移动端绝对居中层（默认隐藏） */
.bar-section--center-absolute {
  display: none;
}

/* ═══════════════════════════════════════════════════════════════════════════
   导航按钮 - 主按钮
   ═══════════════════════════════════════════════════════════════════════════ */

.nav-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border: none;
  border-radius: var(--radius-full);
  font-family: var(--font-ui);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  overflow: hidden;
}

.nav-button--primary {
  background: var(--primitive-paper-50);
  color: var(--primitive-copper-600);
  box-shadow:
    0 1px 3px rgba(139, 105, 20, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  border: 1px solid var(--primitive-copper-200);
}

/* 墨水晕染效果 */
.nav-button--primary::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    circle at var(--mouse-x, 50%) var(--mouse-y, 50%),
    var(--primitive-copper-100) 0%,
    transparent 60%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
}

.nav-button--primary:hover::before {
  opacity: 1;
}

.nav-button--primary:hover {
  background: var(--primitive-paper-50);
  border-color: var(--primitive-copper-300);
  color: var(--primitive-copper-700);
  transform: translateY(-1px);
  box-shadow:
    0 4px 12px rgba(139, 105, 20, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

.nav-button--primary:active {
  transform: translateY(0);
  box-shadow:
    0 1px 2px rgba(139, 105, 20, 0.1),
    inset 0 1px 2px rgba(0, 0, 0, 0.05);
}

.nav-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.button-icon {
  font-size: 0.875rem;
  line-height: 1;
  transition: transform 0.2s ease;
}

.nav-button:hover .button-icon {
  transform: translateX(-2px);
}

.button-label {
  position: relative;
  z-index: 1;
}

.button-label.loading {
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.loading-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse-dot 1.2s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.8); }
}

/* ═══════════════════════════════════════════════════════════════════════════
   快捷操作按钮组
   ═══════════════════════════════════════════════════════════════════════════ */

.quick-actions {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding-left: 0.5rem;
  border-left: 1px solid var(--primitive-paper-400);
}

.action-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.375rem 0.625rem;
  border: none;
  background: transparent;
  color: var(--primitive-ink-500);
  font-family: var(--font-ui);
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.action-chip:hover {
  background: var(--primitive-paper-300);
  color: var(--primitive-copper-600);
}

.action-chip:active {
  background: var(--primitive-paper-400);
  transform: scale(0.96);
}

.chip-icon-svg {
  width: 0.75rem;
  height: 0.75rem;
  fill: currentColor;
  opacity: 0.7;
  transition: opacity 0.2s, transform 0.2s;
}

.action-chip:hover .chip-icon-svg {
  opacity: 1;
  transform: rotate(15deg);
}

.chip-text {
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ═══════════════════════════════════════════════════════════════════════════
   插槽内容样式
   ═══════════════════════════════════════════════════════════════════════════ */

:deep(.title) {
  font-family: var(--font-serif);
  font-weight: 600;
  font-size: 1rem;
  color: var(--primitive-ink-700);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: -0.01em;
}

:deep(.subtitle) {
  font-family: var(--font-ui);
  font-size: 0.8125rem;
  color: var(--primitive-ink-500);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

:deep(.nav-link) {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--primitive-copper-600);
  text-decoration: none;
  font-family: var(--font-ui);
  font-size: 0.875rem;
  font-weight: 500;
  transition: color 0.2s ease;
  white-space: nowrap;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

:deep(.nav-link:hover) {
  color: var(--primitive-copper-700);
}

:deep(.button) {
  padding: 0.375rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid var(--primitive-paper-400);
  background: var(--primitive-paper-50);
  color: var(--primitive-ink-600);
  font-family: var(--font-ui);
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  touch-action: manipulation;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}

:deep(.button:hover) {
  border-color: var(--primitive-copper-300);
  color: var(--primitive-copper-600);
  background: var(--primitive-paper-100);
}

:deep(.button.primary) {
  background: var(--gradient-primary);
  border-color: transparent;
  color: var(--primitive-paper-50);
  box-shadow: 0 2px 8px rgba(153, 107, 61, 0.2);
}

:deep(.button.primary:hover) {
  box-shadow: 0 4px 12px rgba(153, 107, 61, 0.3);
  transform: translateY(-1px);
}

/* ═══════════════════════════════════════════════════════════════════════════
   进度文本
   ═══════════════════════════════════════════════════════════════════════════ */

:deep(.progress-text) {
  font-family: var(--font-data);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--primitive-ink-600);
  letter-spacing: 0.02em;
  padding: 0.25rem 0.625rem;
  background: var(--primitive-paper-300);
  border-radius: var(--radius-full);
}

/* ═══════════════════════════════════════════════════════════════════════════
   移动端适配
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .top-bar {
    --bar-height: 44px;
  }

  .bar-content {
    /* 移动端：改为 flex 两端对齐 */
    display: flex;
    justify-content: space-between;
    align-items: center; /* 关键：防止子元素被 stretch 拉伸 */
    position: relative;
    padding: 0 0.5rem;
    gap: 0.5rem;
  }

  .ink-line {
    width: calc(100% - 1rem);
  }

  .quick-actions {
    display: none;
  }

  .bar-section {
    gap: 0.5rem;
  }

  .bar-section--left {
    align-self: center;
    max-height: 32px;
  }

  /* 移动端：隐藏 grid 中间层 */
  .bar-section--center {
    display: none;
  }

  /* 移动端：显示绝对居中层 */
  .bar-section--center-absolute {
    display: flex;
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    justify-content: center;
    align-items: center;
    pointer-events: none; /* 让点击穿透到下方 */
    z-index: 1;
  }

  /* 中间层内的交互元素恢复点击 */
  .bar-section--center-absolute > * {
    pointer-events: auto;
  }

  :deep(.title) {
    font-size: 0.9375rem;
  }

  :deep(.subtitle) {
    font-size: 0.75rem;
  }

  :deep(.progress-text) {
    font-size: 0.6875rem;
    padding: 0.1875rem 0.5rem;
  }

  /* 限制插槽内按钮和控件的高度 */
  :deep(.button) {
    max-height: 28px;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
  }

  /* 限制 SwitchTab 等控件的高度 */
  :deep(.switch-tab-container) {
    max-height: 28px;
    padding: 2px;
  }

  :deep(.switch-tab-container .switch-tab) {
    padding: 4px 8px;
    font-size: 11px;
    min-height: auto;
  }

  :deep(.switch-tab-container .tab-indicator) {
    top: 2px;
    height: calc(100% - 4px);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   横屏适配
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-height: 500px) and (orientation: landscape) {
  .top-bar {
    --bar-height: 40px;
  }

  .bar-content {
    padding: 0 1rem;
  }

  .nav-button--primary {
    padding: 0.25rem 0.625rem;
    font-size: 0.75rem;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   无障碍支持
   ═══════════════════════════════════════════════════════════════════════════ */

@media (prefers-reduced-motion: reduce) {
  .nav-button,
  .action-chip,
  .ink-line {
    transition: none;
  }

  .nav-button:hover {
    transform: none;
  }

  .loading-dot {
    animation: none;
  }

  .nav-button::before {
    display: none;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   高对比度模式
   ═══════════════════════════════════════════════════════════════════════════ */

@media (prefers-contrast: high) {
  .nav-button--primary {
    border: 2px solid var(--primitive-copper-600);
    background: var(--primitive-paper-50);
  }

  .ink-line--top,
  .ink-line--bottom {
    height: 2px;
    background: var(--primitive-ink-400);
    opacity: 1;
  }
}
</style>
