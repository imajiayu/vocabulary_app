<template>
  <div
    ref="containerRef"
    class="switch-tab-container"
    :class="[containerClass, { 'has-indicator': showIndicator }]"
    :style="{ '--tab-count': tabs.length }"
  >
    <!-- 滑动指示器 -->
    <div
      v-if="showIndicator"
      class="tab-indicator"
      :class="{ 'tab-indicator-animated': hasUserInteracted }"
      :style="{
        left: indicatorLeft,
        width: indicatorWidth,
        background: indicatorBackground,
        boxShadow: indicatorBoxShadow
      }"
    ></div>

    <button
      v-for="tab in tabs"
      :key="tab.value"
      :class="['switch-tab', { active: modelValue === tab.value }]"
      :data-value="tab.value"
      @click="handleTabClick(tab.value)"
    >
      <span v-if="tab.icon" class="tab-icon">{{ tab.icon }}</span>
      <span class="tab-label">{{ tab.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, nextTick, watch } from 'vue'

interface Tab {
  value: string
  label: string
  icon?: string
}

interface Props {
  modelValue: string
  tabs: Tab[]
  containerClass?: string
  persistKey?: string // localStorage key for persistence
  showIndicator?: boolean // 是否显示滑动指示器
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  containerClass: '',
  persistKey: undefined,
  showIndicator: false
})

const emit = defineEmits<Emits>()

// DOM refs for measuring actual tab widths
const containerRef = ref<HTMLElement>()
const tabWidths = ref<number[]>([])
const hasUserInteracted = ref(false)
const resizeObserver = ref<ResizeObserver | null>(null)

// 从 DOM 读取实际 gap 和 padding，避免 JS/CSS 值不同步
const getContainerMetrics = () => {
  if (!containerRef.value) return { gap: 4, padding: 4 }
  const style = getComputedStyle(containerRef.value)
  return {
    gap: parseFloat(style.gap) || 0,
    padding: parseFloat(style.paddingLeft) || 4
  }
}

// 计算指示器的 left 偏移（基于实际tab宽度和gap）
const indicatorLeft = computed(() => {
  const tabIndex = props.tabs.findIndex(tab => tab.value === props.modelValue)
  if (tabIndex < 0 || tabWidths.value.length === 0) return '4px'

  const { gap, padding } = getContainerMetrics()
  const offsetWidth = tabWidths.value.slice(0, tabIndex).reduce((sum, width) => sum + width, 0)
  const gapOffset = tabIndex * gap

  return `${padding + offsetWidth + gapOffset}px`
})

// 计算指示器的宽度（基于实际tab宽度）
const indicatorWidth = computed(() => {
  const tabIndex = props.tabs.findIndex(tab => tab.value === props.modelValue)
  if (tabIndex < 0 || tabWidths.value.length === 0) {
    // 回退到 calc 计算方式
    const tabCount = props.tabs.length
    const { gap, padding } = getContainerMetrics()
    const totalGaps = (tabCount - 1) * gap
    return `calc((100% - ${padding * 2}px - ${totalGaps}px) / ${tabCount})`
  }

  return `${tabWidths.value[tabIndex]}px`
})

// 为filter-theme计算指示器的动态背景颜色和阴影
const indicatorBackground = computed(() => {
  const containerClass = props.containerClass || ''

  if (containerClass.includes('filter-theme')) {
    switch (props.modelValue) {
      case 'all':
        return 'var(--gradient-primary)' // 铜褐渐变 - 全部
      case 'unremembered':
        return 'var(--color-edit)' // 铜褐 - 学习中
      case 'remembered':
        return 'var(--color-success)' // 橄榄绿 - 已掌握
      default:
        return 'var(--gradient-primary)'
    }
  }

  return undefined
})

// 为filter-theme计算指示器的动态阴影
const indicatorBoxShadow = computed(() => {
  const containerClass = props.containerClass || ''

  if (containerClass.includes('filter-theme')) {
    switch (props.modelValue) {
      case 'all':
        return '0 1px 6px rgba(153, 107, 61, 0.2)'
      case 'unremembered':
        return '0 1px 6px rgba(153, 107, 61, 0.25)'
      case 'remembered':
        return '0 1px 6px rgba(93, 122, 93, 0.25)'
      default:
        return '0 1px 6px rgba(153, 107, 61, 0.2)'
    }
  }

  return undefined
})

const handleTabClick = (value: string) => {
  if (props.modelValue !== value) {
    hasUserInteracted.value = true

    emit('update:modelValue', value)
    emit('change', value)

    if (props.persistKey) {
      localStorage.setItem(props.persistKey, value)
    }
  }
}

// 测量实际tab宽度的函数
const measureTabWidths = async () => {
  await nextTick()

  if (!containerRef.value) return

  const tabElements = containerRef.value.querySelectorAll('.switch-tab')
  const widths: number[] = []

  tabElements.forEach((tab) => {
    const rect = (tab as HTMLElement).getBoundingClientRect()
    widths.push(rect.width)
  })

  tabWidths.value = widths
}

// 监听tabs变化和组件挂载时测量宽度
watch(() => props.tabs, measureTabWidths, { deep: true })
watch(() => props.modelValue, measureTabWidths)

onMounted(() => {
  measureTabWidths()

  if (containerRef.value) {
    resizeObserver.value = new ResizeObserver(() => {
      measureTabWidths()
    })
    resizeObserver.value.observe(containerRef.value)
  }
})

onUnmounted(() => {
  if (resizeObserver.value) {
    resizeObserver.value.disconnect()
    resizeObserver.value = null
  }
})
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════
   SwitchTab 基础样式
   ═══════════════════════════════════════════════════════════════ */
.switch-tab-container {
  position: relative;
  display: flex;
  gap: 4px;
  background: rgba(0, 0, 0, 0.05);
  padding: 4px;
  border-radius: var(--radius-default);
  overflow: hidden;
}

.tab-indicator {
  position: absolute;
  top: 4px;
  height: calc(100% - 8px);
  background: var(--gradient-primary);
  border-radius: var(--radius-sm);
  z-index: 1;
  box-shadow: 0 1px 6px rgba(153, 107, 61, 0.2);
}

.tab-indicator-animated {
  transition:
    left 0.28s cubic-bezier(0.4, 0, 0.2, 1),
    width 0.28s cubic-bezier(0.4, 0, 0.2, 1),
    background 0.35s ease,
    box-shadow 0.35s ease;
}

.switch-tab {
  position: relative;
  flex: 1;
  padding: 8px 12px;
  border: none;
  background: transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
  transition: color 0.2s ease, background 0.2s ease;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  white-space: nowrap;
  z-index: 2;
  outline: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  user-select: none;
}

/* 无指示器时的 active 样式 */
.switch-tab.active {
  background: var(--gradient-primary);
  color: var(--color-text-inverse);
  box-shadow: 0 1px 6px rgba(153, 107, 61, 0.2);
}

/* 有指示器时，统一移除按钮自身的 active 背景（指示器负责视觉） */
.has-indicator .switch-tab.active {
  background: transparent;
  color: white;
  box-shadow: none;
}

.switch-tab:hover:not(.active) {
  background: rgba(0, 0, 0, 0.06);
  color: var(--color-text-primary);
}

.switch-tab:active {
  transform: scale(0.97);
  transition: transform 0.1s ease;
}

.tab-icon {
  font-size: inherit;
}

.tab-label {
  font-size: inherit;
  font-weight: inherit;
}

/* ═══════════════════════════════════════════════════════════════
   尺寸变体
   ═══════════════════════════════════════════════════════════════ */
.switch-tab-container.large {
  padding: 6px;
  border-radius: var(--radius-md);
  gap: 6px;
}

.switch-tab-container.large .switch-tab {
  padding: 12px 16px;
  font-size: 14px;
  border-radius: var(--radius-default);
}

.switch-tab-container.small {
  padding: 2px;
  border-radius: var(--radius-sm);
  gap: 2px;
}

.switch-tab-container.small .switch-tab {
  padding: 6px 10px;
  font-size: 12px;
  border-radius: var(--radius-xs);
}

/* ═══════════════════════════════════════════════════════════════
   主题变体
   ═══════════════════════════════════════════════════════════════ */

/* Primary theme */
.switch-tab-container.primary-theme .tab-indicator {
  background: var(--gradient-primary);
  box-shadow: 0 1px 6px rgba(153, 107, 61, 0.2);
}

/* Mobile theme */
.switch-tab-container.mobile-theme {
  background: rgba(0, 0, 0, 0.05);
  padding: 4px;
  border-radius: var(--radius-md);
  gap: 0;
}

.switch-tab-container.mobile-theme .switch-tab {
  padding: 12px 20px;
  font-size: 15px;
  font-weight: 500;
  min-height: 44px;
}

.switch-tab-container.mobile-theme .tab-indicator {
  background: var(--gradient-primary);
  border-radius: var(--radius-default);
  box-shadow: 0 1px 6px rgba(153, 107, 61, 0.2);
}

/* Secondary theme */
.switch-tab-container.secondary-theme {
  background: rgba(0, 0, 0, 0.03);
}

.switch-tab-container.secondary-theme .switch-tab {
  color: var(--color-text-secondary);
}

.switch-tab-container.secondary-theme.has-indicator .switch-tab.active {
  color: white;
}

.switch-tab-container.secondary-theme .tab-indicator {
  background: var(--gradient-primary);
  box-shadow: 0 1px 6px rgba(153, 107, 61, 0.2);
}

/* Filter theme — 指示器颜色由 JS 动态控制 */
.switch-tab-container.filter-theme {
  background: rgba(0, 0, 0, 0.05);
  gap: 4px;
}

.switch-tab-container.filter-theme .switch-tab {
  font-weight: 500;
  border-radius: var(--radius-sm);
}

.switch-tab-container.filter-theme .switch-tab:hover:not(.active) {
  background: rgba(0, 0, 0, 0.04);
}

/* Dark theme — 深色背景（录音控制台等） */
.switch-tab-container.dark-theme {
  background: rgba(250, 247, 242, 0.06);
  border: 1px solid rgba(250, 247, 242, 0.08);
}

.switch-tab-container.dark-theme .switch-tab {
  color: rgba(250, 247, 242, 0.45);
  font-weight: 500;
}

.switch-tab-container.dark-theme .switch-tab:hover:not(.active) {
  background: rgba(250, 247, 242, 0.06);
  color: rgba(250, 247, 242, 0.7);
}

.switch-tab-container.dark-theme.has-indicator .switch-tab.active {
  color: var(--primitive-paper-100);
}

.switch-tab-container.dark-theme .tab-indicator {
  background: rgba(250, 247, 242, 0.12);
  box-shadow: none;
}
</style>
