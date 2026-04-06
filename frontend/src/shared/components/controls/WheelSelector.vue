<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, computed } from 'vue'

const props = defineProps<{
  max: number
  modelValue: number
  itemHeight?: number
  min?: number
  step?: number
  /** 显示的最大值（超过 max 的部分会显示为禁用状态） */
  displayMax?: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

// ── 派生常量（全部用 computed，响应式 + 有缓存） ──────────────

const ITEM_HEIGHT = computed(() => props.itemHeight ?? 28)
const MIN = computed(() => props.min ?? 1)
const STEP = computed(() => props.step ?? 1)
// 容器高度从真实 DOM 读取，避免父组件覆盖 .wheel 高度时（如 SettingsPage 改成 60px）
// 与硬编码值不一致导致选中条与 item 中心对不齐
const containerHeight = ref(80)
const SPACER_HEIGHT = computed(() => (containerHeight.value - ITEM_HEIGHT.value) / 2)

const displayMaxValue = computed(() => props.displayMax ?? props.max)

const clampToStep = (value: number): number => {
  const clamped = Math.max(MIN.value, Math.min(value, props.max))
  const steps = Math.round((clamped - MIN.value) / STEP.value)
  return MIN.value + steps * STEP.value
}

const validValues = computed(() => {
  const result: number[] = []
  for (let v = MIN.value; v <= displayMaxValue.value; v += STEP.value) {
    result.push(v)
  }
  return result
})

const isDisabled = (value: number) => value > props.max

const wheelRef = ref<HTMLDivElement | null>(null)
const topSpacerRef = ref<HTMLDivElement | null>(null)
const bottomSpacerRef = ref<HTMLDivElement | null>(null)

// ── 虚拟滚动（超过阈值时只渲染可视区域 ± buffer） ──────────────

const VIRTUAL_THRESHOLD = 50
const BUFFER_COUNT = 5

const useVirtual = computed(() => validValues.value.length > VIRTUAL_THRESHOLD)
const totalContentHeight = computed(() =>
  validValues.value.length * ITEM_HEIGHT.value + SPACER_HEIGHT.value * 2
)

let virtualStart = 0
let virtualEnd = 0
const visibleItems = ref<number[]>([])

const computeVisibleRange = (scrollTop: number): [number, number] => {
  const total = validValues.value.length
  if (!useVirtual.value || total === 0) return [0, total]

  const startIdx = Math.floor((scrollTop - SPACER_HEIGHT.value) / ITEM_HEIGHT.value)
  const endIdx = Math.ceil((scrollTop + containerHeight.value - SPACER_HEIGHT.value) / ITEM_HEIGHT.value)

  return [
    Math.max(0, startIdx - BUFFER_COUNT),
    Math.min(total, endIdx + BUFFER_COUNT),
  ]
}

/** 用 spacer div 撑高度（不用 container padding，避免 border-box 下 scrollHeight 异常） */
const updateSpacerHeights = (start: number, end: number) => {
  const total = validValues.value.length
  if (topSpacerRef.value) {
    topSpacerRef.value.style.height = (SPACER_HEIGHT.value + start * ITEM_HEIGHT.value) + 'px'
  }
  if (bottomSpacerRef.value) {
    bottomSpacerRef.value.style.height = (SPACER_HEIGHT.value + (total - end) * ITEM_HEIGHT.value) + 'px'
  }
}

const updateVirtualWindow = (scrollTop: number): boolean => {
  if (!useVirtual.value) return false

  const [newStart, newEnd] = computeVisibleRange(scrollTop)
  if (newStart === virtualStart && newEnd === virtualEnd) return false

  virtualStart = newStart
  virtualEnd = newEnd
  visibleItems.value = validValues.value.slice(newStart, newEnd)
  updateSpacerHeights(newStart, newEnd)

  cachedItems = null
  return true
}

// ── 滚动状态 ──────────────────────────────────────────────

let currentScrollTop = 0
let targetScrollTop = 0
let velocity = 0
let animationId: number | null = null
let lastWheelTime = 0
let accumulatedDelta = 0

const FRICTION = 0.92
const WHEEL_SENSITIVITY = 0.4
const SNAP_THRESHOLD = 0.5
const SNAP_SPEED = 0.15

// ── 同步初始化虚拟窗口（确保首帧有内容） ──────────────────────

if (useVirtual.value && validValues.value.length > 0) {
  const aligned = clampToStep(props.modelValue)
  const itemIndex = Math.round((aligned - MIN.value) / STEP.value)
  const elementCenter = SPACER_HEIGHT.value + itemIndex * ITEM_HEIGHT.value + ITEM_HEIGHT.value / 2
  const initialScroll = Math.max(0, elementCenter - containerHeight.value / 2)

  const [start, end] = computeVisibleRange(initialScroll)
  virtualStart = start
  virtualEnd = end
  visibleItems.value = validValues.value.slice(start, end)
  // spacer DOM 还不存在，onMounted 时会通过 updateSpacerHeights 同步

  currentScrollTop = initialScroll
  targetScrollTop = initialScroll
}

/** 同步设 scrollTop + 更新视觉；虚拟窗口变化时延迟到 nextTick 等 Vue 渲染新 DOM */
const syncScrollAndVisuals = () => {
  if (!wheelRef.value) return
  const windowChanged = updateVirtualWindow(currentScrollTop)
  if (windowChanged) {
    // 虚拟窗口变化 → visibleItems 已更新（Vue 待渲染），需等 DOM 就绪再设 scrollTop
    nextTick(() => {
      if (!wheelRef.value) return
      wheelRef.value.scrollTop = currentScrollTop
      updateItemVisuals()
    })
  } else {
    wheelRef.value.scrollTop = currentScrollTop
    updateItemVisuals()
  }
}

// ── 3D 视觉更新（直接操控 DOM，不走 Vue 响应式） ──────────────

let cachedItems: NodeListOf<HTMLElement> | null = null

watch(validValues, () => {
  cachedItems = null
  // 虚拟模式下强制重算窗口
  virtualStart = -1
  virtualEnd = -1
  if (useVirtual.value) {
    updateVirtualWindow(currentScrollTop)
  }
})

const updateItemVisuals = () => {
  const container = wheelRef.value
  if (!container) return

  const centerY = currentScrollTop + containerHeight.value / 2

  // 虚拟模式下不缓存（DOM 频繁变化），非虚拟模式保持缓存
  const items = useVirtual.value
    ? container.querySelectorAll<HTMLElement>('.wheel-item')
    : (cachedItems ?? (cachedItems = container.querySelectorAll<HTMLElement>('.wheel-item')))

  const baseIndex = useVirtual.value ? virtualStart : 0

  for (let i = 0; i < items.length; i++) {
    const globalIndex = baseIndex + i
    const itemCenterY = SPACER_HEIGHT.value + globalIndex * ITEM_HEIGHT.value + ITEM_HEIGHT.value / 2
    const normalizedDist = (itemCenterY - centerY) / ITEM_HEIGHT.value
    const absNorm = Math.abs(normalizedDist)

    if (absNorm > 5) {
      items[i].style.transform = ''
      items[i].style.opacity = '0'
      continue
    }

    const rotateX = Math.max(-55, Math.min(55, normalizedDist * -16))
    // 中心项放大（scale 代替 font-size 变化，只触发 composite 不触发 layout）
    const isCenter = absNorm < 0.5
    const baseScale = Math.max(0.75, 1 - absNorm * 0.07)
    const scale = isCenter ? baseScale * 1.07 : baseScale
    const opacity = isCenter ? 1.0 : Math.max(0.08, 1 - absNorm * 0.4)

    items[i].style.transform = `perspective(300px) rotateX(${rotateX.toFixed(1)}deg) scale(${scale.toFixed(3)})`
    items[i].style.opacity = opacity.toFixed(2)
  }
}

// ── 滚动位置计算 ──────────────────────────────────────────

const getValueFromScroll = (scrollTop: number): number => {
  const centerPosition = scrollTop + containerHeight.value / 2
  const itemIndex = Math.round((centerPosition - SPACER_HEIGHT.value) / ITEM_HEIGHT.value - 0.5)
  const rawValue = MIN.value + Math.max(0, itemIndex) * STEP.value
  return Math.max(MIN.value, Math.min(rawValue, props.max))
}

const getScrollFromValue = (value: number): number => {
  const aligned = clampToStep(value)
  const itemIndex = Math.round((aligned - MIN.value) / STEP.value)
  const elementCenter = SPACER_HEIGHT.value + itemIndex * ITEM_HEIGHT.value + ITEM_HEIGHT.value / 2
  return Math.max(0, elementCenter - containerHeight.value / 2)
}

const getMaxScroll = (): number => {
  return Math.max(0, totalContentHeight.value - containerHeight.value)
}

// ── rAF 渲染调度（touchmove 只更新数值，DOM 操作合并到单次 rAF） ──

let renderFrameId: number | null = null

const scheduleRender = () => {
  if (renderFrameId === null) {
    renderFrameId = requestAnimationFrame(renderFrame)
  }
}

const renderFrame = () => {
  renderFrameId = null
  if (!wheelRef.value) return

  syncScrollAndVisuals()

  const currentValue = getValueFromScroll(currentScrollTop)
  if (currentValue !== props.modelValue) {
    emit('update:modelValue', currentValue)
  }
}

// ── 吸附 ──────────────────────────────────────────────────

const snapToNearest = () => {
  const value = getValueFromScroll(currentScrollTop)
  targetScrollTop = getScrollFromValue(value)

  if (value !== props.modelValue) {
    emit('update:modelValue', value)
  }
}

// ── 动画循环（惯性 + 吸附，已在 rAF 内运行） ─────────────────

const animate = () => {
  if (!wheelRef.value) return

  const maxScroll = getMaxScroll()

  if (Math.abs(velocity) > 0.1) {
    currentScrollTop += velocity
    velocity *= FRICTION

    if (currentScrollTop < 0) {
      currentScrollTop = 0
      velocity = 0
    } else if (currentScrollTop > maxScroll) {
      currentScrollTop = maxScroll
      velocity = 0
    }

    syncScrollAndVisuals()

    const currentValue = getValueFromScroll(currentScrollTop)
    if (currentValue !== props.modelValue) {
      emit('update:modelValue', currentValue)
    }
  }

  if (Math.abs(velocity) < SNAP_THRESHOLD) {
    snapToNearest()

    const diff = targetScrollTop - currentScrollTop
    if (Math.abs(diff) > 0.5) {
      currentScrollTop += diff * SNAP_SPEED
      syncScrollAndVisuals()
      animationId = requestAnimationFrame(animate)
    } else {
      currentScrollTop = targetScrollTop
      syncScrollAndVisuals()
      animationId = null
    }
    return
  }

  animationId = requestAnimationFrame(animate)
}

// ── 滚轮/触控板事件 ──────────────────────────────────────

const onWheel = (e: WheelEvent) => {
  e.preventDefault()

  const now = Date.now()
  const timeDelta = now - lastWheelTime
  lastWheelTime = now

  if (timeDelta > 100) {
    accumulatedDelta = 0
  }

  let delta = e.deltaY

  if (e.deltaMode === 1) {
    delta *= ITEM_HEIGHT.value
  } else if (e.deltaMode === 2) {
    delta *= ITEM_HEIGHT.value * 3
  }

  accumulatedDelta += delta * WHEEL_SENSITIVITY

  if (Math.abs(accumulatedDelta) >= ITEM_HEIGHT.value * 0.3) {
    velocity += accumulatedDelta * 0.08
    accumulatedDelta = 0
  } else {
    velocity += delta * WHEEL_SENSITIVITY * 0.05
  }

  velocity = Math.max(-15, Math.min(15, velocity))

  if (!animationId) {
    animationId = requestAnimationFrame(animate)
  }
}

// ── 触摸事件（touchmove 只更新数值，DOM 操作交给 scheduleRender）──

let touchLastY = 0
let touchLastTime = 0

const onTouchStart = (e: TouchEvent) => {
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
  if (renderFrameId !== null) {
    cancelAnimationFrame(renderFrameId)
    renderFrameId = null
  }
  velocity = 0

  touchLastY = e.touches[0].clientY
  touchLastTime = Date.now()
}

const onTouchMove = (e: TouchEvent) => {
  e.preventDefault()

  const touchY = e.touches[0].clientY
  const now = Date.now()
  const timeDelta = now - touchLastTime

  const delta = touchLastY - touchY
  currentScrollTop += delta

  const maxScroll = getMaxScroll()
  currentScrollTop = Math.max(0, Math.min(currentScrollTop, maxScroll))

  if (timeDelta > 0) {
    velocity = delta / timeDelta * 16
  }

  touchLastY = touchY
  touchLastTime = now

  // 不同步操作 DOM，合并到下一帧
  scheduleRender()
}

const onTouchEnd = () => {
  // 取消待执行的渲染帧，做一次 final render
  if (renderFrameId !== null) {
    cancelAnimationFrame(renderFrameId)
    renderFrameId = null
  }

  if (wheelRef.value) {
    syncScrollAndVisuals()

    const currentValue = getValueFromScroll(currentScrollTop)
    if (currentValue !== props.modelValue) {
      emit('update:modelValue', currentValue)
    }
  }

  if (Math.abs(velocity) > 0.5) {
    animationId = requestAnimationFrame(animate)
  } else {
    snapToNearest()
    const diff = targetScrollTop - currentScrollTop
    if (Math.abs(diff) > 0.5) {
      animationId = requestAnimationFrame(animate)
    }
  }
}

// ── 位置设置与初始化 ──────────────────────────────────────

const setScrollPosition = (value: number) => {
  if (!wheelRef.value) return

  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
  velocity = 0

  currentScrollTop = getScrollFromValue(value)
  targetScrollTop = currentScrollTop

  if (useVirtual.value) {
    updateVirtualWindow(currentScrollTop)
    // 虚拟模式需等 Vue 渲染新 DOM 后再设 scrollTop
    nextTick(() => {
      if (!wheelRef.value) return
      wheelRef.value.scrollTop = currentScrollTop
      updateItemVisuals()
    })
  } else {
    wheelRef.value.scrollTop = currentScrollTop
    updateItemVisuals()
  }
}

const initPosition = () => {
  if (props.max >= MIN.value) {
    nextTick(() => {
      setScrollPosition(props.modelValue)
    })
  }
}

// ── Watchers ──────────────────────────────────────────────

watch(
  () => props.modelValue,
  (newValue) => {
    const aligned = clampToStep(newValue)

    if (aligned !== newValue) {
      emit('update:modelValue', aligned)
      return
    }

    if (!animationId) {
      setScrollPosition(aligned)
    }
  }
)

watch(
  () => props.max,
  () => {
    if (props.max >= MIN.value) {
      nextTick(() => {
        initPosition()
      })
    }
  }
)

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  const el = wheelRef.value
  if (el) {
    // 从真实 DOM 读取容器高度（父组件可能用 :deep 覆盖 .wheel 高度）
    const measured = el.clientHeight
    if (measured > 0) {
      containerHeight.value = measured
    }

    // 监听尺寸变化（响应式断点 / 父容器布局变化）
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        if (!wheelRef.value) return
        const next = wheelRef.value.clientHeight
        if (next > 0 && next !== containerHeight.value) {
          containerHeight.value = next
          // 高度变化后重新对齐选中项
          nextTick(() => setScrollPosition(props.modelValue))
        }
      })
      resizeObserver.observe(el)
    }
  }

  // 虚拟模式：同步设置 spacer 高度（setup 阶段已填充 visibleItems）
  if (useVirtual.value) {
    updateSpacerHeights(virtualStart, virtualEnd)
  }

  if (props.max >= MIN.value) {
    initPosition()
  }

  if (el) {
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
  }
})

onUnmounted(() => {
  if (animationId) cancelAnimationFrame(animationId)
  if (renderFrameId !== null) cancelAnimationFrame(renderFrameId)
  resizeObserver?.disconnect()
  resizeObserver = null

  const el = wheelRef.value
  if (el) {
    el.removeEventListener('wheel', onWheel)
    el.removeEventListener('touchstart', onTouchStart)
    el.removeEventListener('touchmove', onTouchMove)
    el.removeEventListener('touchend', onTouchEnd)
  }
})
</script>

<template>
  <div class="wheel" @click.stop>
    <div class="wheel-list scrollbar-hidden" ref="wheelRef">
      <!-- 非虚拟模式：spacer + 全量渲染 -->
      <template v-if="!useVirtual">
        <div class="wheel-spacer" :style="{ height: SPACER_HEIGHT + 'px' }"></div>
        <div
          class="wheel-item"
          v-for="value in validValues"
          :key="value"
          :class="{ disabled: isDisabled(value) }"
          :style="{ height: ITEM_HEIGHT + 'px', lineHeight: ITEM_HEIGHT + 'px' }"
        >
          {{ value }}
        </div>
        <div class="wheel-spacer" :style="{ height: SPACER_HEIGHT + 'px' }"></div>
      </template>
      <!-- 虚拟模式：spacer div 撑高度，只渲染可视窗口 -->
      <template v-else>
        <div ref="topSpacerRef" class="wheel-spacer"></div>
        <div
          class="wheel-item"
          v-for="value in visibleItems"
          :key="value"
          :class="{ disabled: isDisabled(value) }"
          :style="{ height: ITEM_HEIGHT + 'px', lineHeight: ITEM_HEIGHT + 'px' }"
        >
          {{ value }}
        </div>
        <div ref="bottomSpacerRef" class="wheel-spacer"></div>
      </template>
    </div>
    <div class="wheel-mask"></div>
    <div class="wheel-selection" :style="{ height: ITEM_HEIGHT + 'px' }"></div>
  </div>
</template>

<style scoped>
.wheel {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 60px;
  height: 80px;
  overflow: hidden;
  border-radius: var(--radius-default);
  background: var(--color-surface-elevated);
  box-shadow: var(--shadow-sm), inset 0 1px 3px rgba(0, 0, 0, 0.04);
  border: 1px solid var(--color-border-light);
}

.wheel-list {
  height: 100%;
  overflow-y: scroll;
  touch-action: none;
}

.wheel-spacer {
  flex-shrink: 0;
}

.wheel-item {
  text-align: center;
  color: var(--color-text-primary);
  font-family: var(--font-data);
  font-variant-numeric: tabular-nums;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
  user-select: none;
  transform-origin: center center;
  backface-visibility: hidden;
  will-change: transform, opacity;
}

.wheel-item.disabled {
  color: var(--primitive-brick-300);
}

.wheel-mask {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  pointer-events: none;
  background: linear-gradient(180deg,
      color-mix(in srgb, var(--color-surface-elevated) 98%, transparent) 0%,
      transparent 22%,
      transparent 78%,
      color-mix(in srgb, var(--color-surface-elevated) 98%, transparent) 100%);
}

.wheel-selection {
  position: absolute;
  left: 5px;
  right: 5px;
  top: 50%;
  transform: translateY(-50%);
  background: var(--color-brand-primary-light);
  border-radius: var(--radius-xs);
  border-top: 1px solid var(--color-brand-primary-border);
  border-bottom: 1px solid var(--color-brand-primary-border);
  pointer-events: none;
}
</style>
