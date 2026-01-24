<template>
  <div
    ref="containerRef"
    class="switch-tab-container"
    :class="containerClass"
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
import { computed, ref, onMounted, nextTick, watch } from 'vue'

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

// 计算指示器的 left 偏移（基于实际tab宽度和gap）
const indicatorLeft = computed(() => {
  const tabIndex = props.tabs.findIndex(tab => tab.value === props.modelValue)
  if (tabIndex < 0 || tabWidths.value.length === 0) return '4px'

  const containerClass = props.containerClass || ''

  // 确定 gap 和 padding
  let gap = 4 // 默认 gap
  let padding = 4 // 默认 padding

  if (containerClass.includes('mobile-theme')) {
    gap = 0
    padding = 4
  } else if (containerClass.includes('filter-theme')) {
    gap = 4
    padding = 4
  } else if (containerClass.includes('large')) {
    gap = 6
    padding = 6
  } else if (containerClass.includes('small')) {
    gap = 2
    padding = 2
  }

  // 计算到当前tab的实际偏移量
  const offsetWidth = tabWidths.value.slice(0, tabIndex).reduce((sum, width) => sum + width, 0)
  const gapOffset = tabIndex * gap

  return `${padding + offsetWidth + gapOffset}px`
})

// 计算指示器的宽度（基于实际tab宽度）
const indicatorWidth = computed(() => {
  const tabIndex = props.tabs.findIndex(tab => tab.value === props.modelValue)
  if (tabIndex < 0 || tabWidths.value.length === 0) {
    // 回退到旧的计算方式
    const tabCount = props.tabs.length
    const containerClass = props.containerClass || ''
    let gap = 4, padding = 8

    if (containerClass.includes('mobile-theme')) {
      gap = 0
      padding = 8
    } else if (containerClass.includes('filter-theme')) {
      gap = 4
      padding = 8
    } else if (containerClass.includes('large')) {
      gap = 6
      padding = 12
    } else if (containerClass.includes('small')) {
      gap = 2
      padding = 4
    }

    const totalGaps = (tabCount - 1) * gap
    return `calc((100% - ${padding}px - ${totalGaps}px) / ${tabCount})`
  }

  // 使用实际测量的宽度
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

  // 其他主题使用默认渐变
  return 'var(--gradient-primary)'
})

// 为filter-theme计算指示器的动态阴影
const indicatorBoxShadow = computed(() => {
  const containerClass = props.containerClass || ''

  if (containerClass.includes('filter-theme')) {
    switch (props.modelValue) {
      case 'all':
        return '0 2px 8px rgba(153, 107, 61, 0.25)' // 铜褐阴影
      case 'unremembered':
        return '0 2px 8px rgba(153, 107, 61, 0.3)' // 铜褐阴影
      case 'remembered':
        return '0 2px 8px rgba(93, 122, 93, 0.3)' // 橄榄绿阴影
      default:
        return '0 2px 8px rgba(153, 107, 61, 0.25)'
    }
  }

  // 其他主题使用默认阴影
  return '0 2px 8px rgba(153, 107, 61, 0.25)'
})

const handleTabClick = (value: string) => {
  if (props.modelValue !== value) {
    // Mark that user has interacted, enabling transitions
    hasUserInteracted.value = true

    emit('update:modelValue', value)
    emit('change', value)

    // Persist to localStorage if persistKey is provided
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
})
</script>

<style scoped>
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
  box-shadow: 0 2px 8px var(--color-purple-light);
}

.tab-indicator-animated {
  transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1), width 0.3s cubic-bezier(0.4, 0, 0.2, 1), background 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1);
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
  transition: all 0.3s ease;
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

/* 默认活跃状态：当没有指示器时使用背景色 */
.switch-tab.active {
  background: var(--gradient-primary);
  color: var(--color-text-inverse);
  box-shadow: 0 2px 8px var(--color-purple-light);
}

/* 当容器有指示器时，默认主题也移除按钮背景 */
.switch-tab-container .switch-tab.active {
  background: transparent !important;
  color: white;
  box-shadow: none !important;
}

.switch-tab:hover:not(.active) {
  background: rgba(0, 0, 0, 0.08);
  color: var(--color-text-primary);
}

.tab-icon {
  font-size: inherit;
}

.tab-label {
  font-size: inherit;
  font-weight: inherit;
}

/* Size variants */
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

/* Custom theme variants */
/* Primary theme: 有指示器时移除按钮背景 */
.switch-tab-container.primary-theme .switch-tab.active {
  background: transparent !important;
  color: white;
  box-shadow: none !important;
}

.switch-tab-container.primary-theme .tab-indicator {
  background: var(--gradient-primary);
  box-shadow: 0 2px 8px var(--color-purple-light);
}

/* Mobile theme for navigation */
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
  /* 移动端触摸优化 */
  touch-action: manipulation;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.switch-tab-container.mobile-theme .switch-tab.active {
  background: transparent !important;
  color: white;
  box-shadow: none !important;
}

.switch-tab-container.mobile-theme .switch-tab:active {
  transform: scale(0.98);
}

.switch-tab-container.mobile-theme .tab-indicator {
  background: var(--gradient-primary);
  border-radius: var(--radius-default);
  box-shadow: 0 2px 8px var(--color-purple-light);
}

.switch-tab-container.secondary-theme {
  background: rgba(0, 0, 0, 0.03);
}

.switch-tab-container.secondary-theme .switch-tab {
  color: var(--color-text-secondary, var(--color-text-secondary));
}

.switch-tab-container.secondary-theme .switch-tab.active {
  background: transparent !important;
  color: white;
  box-shadow: none !important;
}

.switch-tab-container.secondary-theme .tab-indicator {
  background: var(--gradient-primary);
  box-shadow: 0 2px 8px var(--color-purple-light);
}

/* Filter theme with specific colors for different states */
.switch-tab-container.filter-theme {
  background: rgba(0, 0, 0, 0.05);
  gap: 4px;
}

/* Default state for filter theme buttons */
.switch-tab-container.filter-theme .switch-tab {
  background-color: transparent;
  color: var(--color-text-secondary);
  border-radius: 0.5rem;
  font-weight: 500;
  box-shadow: none;
  transition: background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
}

/* Hover state */
.switch-tab-container.filter-theme .switch-tab:hover:not(.active) {
  background-color: rgba(0, 0, 0, 0.05);
}

/* Override default active style for filter theme */
.switch-tab-container.filter-theme .switch-tab.active {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  box-shadow: none;
}

/* Filter theme: 使用指示器时移除按钮背景 */
.switch-tab-container.filter-theme .switch-tab.active {
  background: transparent !important;
  color: white;
  box-shadow: none !important;
}

</style>