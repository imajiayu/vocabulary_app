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
const CONTAINER_HEIGHT = 80
// spacer 高度由容器和 item 高度自动派生，不再硬编码
const SPACER_HEIGHT = computed(() => (CONTAINER_HEIGHT - ITEM_HEIGHT.value) / 2)

const displayMaxValue = computed(() => props.displayMax ?? props.max)

// 将任意值钳位到最近的合法 step 值
const clampToStep = (value: number): number => {
  const clamped = Math.max(MIN.value, Math.min(value, props.max))
  const steps = Math.round((clamped - MIN.value) / STEP.value)
  return MIN.value + steps * STEP.value
}

// 生成所有显示值的数组（包括禁用的）
const validValues = computed(() => {
  const result: number[] = []
  for (let v = MIN.value; v <= displayMaxValue.value; v += STEP.value) {
    result.push(v)
  }
  return result
})

// 判断某个值是否禁用（超过可滚动的最大值）
const isDisabled = (value: number) => value > props.max

const wheelRef = ref<HTMLDivElement | null>(null)

// 滚动状态
let currentScrollTop = 0
let targetScrollTop = 0
let velocity = 0
let animationId: number | null = null
let lastWheelTime = 0
let accumulatedDelta = 0

// 配置参数
const FRICTION = 0.92
const WHEEL_SENSITIVITY = 0.4
const SNAP_THRESHOLD = 0.5
const SNAP_SPEED = 0.15

// 根据滚动位置计算当前值
const getValueFromScroll = (scrollTop: number): number => {
  const containerCenter = wheelRef.value?.clientHeight ?? CONTAINER_HEIGHT
  const centerPosition = scrollTop + containerCenter / 2
  const itemIndex = Math.round((centerPosition - SPACER_HEIGHT.value) / ITEM_HEIGHT.value - 0.5)
  const rawValue = MIN.value + Math.max(0, itemIndex) * STEP.value
  return Math.max(MIN.value, Math.min(rawValue, props.max))
}

// 根据值计算滚动位置
const getScrollFromValue = (value: number): number => {
  const aligned = clampToStep(value)
  const containerCenter = (wheelRef.value?.clientHeight ?? CONTAINER_HEIGHT) / 2
  const itemIndex = Math.round((aligned - MIN.value) / STEP.value)
  const elementCenter = SPACER_HEIGHT.value + itemIndex * ITEM_HEIGHT.value + ITEM_HEIGHT.value / 2
  return Math.max(0, elementCenter - containerCenter)
}

// 计算最大滚动位置
const getMaxScroll = (): number => {
  if (!wheelRef.value) return 0
  return wheelRef.value.scrollHeight - wheelRef.value.clientHeight
}

// 吸附到最近的项目
const snapToNearest = () => {
  const value = getValueFromScroll(currentScrollTop)
  targetScrollTop = getScrollFromValue(value)

  if (value !== props.modelValue) {
    emit('update:modelValue', value)
  }
}

// 动画循环
const animate = () => {
  if (!wheelRef.value) return

  const maxScroll = getMaxScroll()

  // 应用速度
  if (Math.abs(velocity) > 0.1) {
    currentScrollTop += velocity
    velocity *= FRICTION

    // 边界检测
    if (currentScrollTop < 0) {
      currentScrollTop = 0
      velocity = 0
    } else if (currentScrollTop > maxScroll) {
      currentScrollTop = maxScroll
      velocity = 0
    }

    wheelRef.value.scrollTop = currentScrollTop

    // 实时更新值（提供颗粒感反馈）
    const currentValue = getValueFromScroll(currentScrollTop)
    if (currentValue !== props.modelValue) {
      emit('update:modelValue', currentValue)
    }
  }

  // 速度足够低时开始吸附
  if (Math.abs(velocity) < SNAP_THRESHOLD) {
    snapToNearest()

    // 平滑吸附动画
    const diff = targetScrollTop - currentScrollTop
    if (Math.abs(diff) > 0.5) {
      currentScrollTop += diff * SNAP_SPEED
      wheelRef.value.scrollTop = currentScrollTop
      animationId = requestAnimationFrame(animate)
    } else {
      // 吸附完成
      currentScrollTop = targetScrollTop
      wheelRef.value.scrollTop = currentScrollTop
      animationId = null
    }
    return
  }

  animationId = requestAnimationFrame(animate)
}

// 处理滚轮/触控板事件
const onWheel = (e: WheelEvent) => {
  e.preventDefault()

  const now = Date.now()
  const timeDelta = now - lastWheelTime
  lastWheelTime = now

  // 检测是否是新的滚动手势（间隔超过 100ms 重置累积）
  if (timeDelta > 100) {
    accumulatedDelta = 0
  }

  let delta = e.deltaY

  // 规范化 delta（处理不同设备的差异）
  if (e.deltaMode === 1) {
    delta *= ITEM_HEIGHT.value
  } else if (e.deltaMode === 2) {
    delta *= ITEM_HEIGHT.value * 3
  }

  // 累积 delta 以实现更平滑的手势
  accumulatedDelta += delta * WHEEL_SENSITIVITY

  // 对于小的增量，累积后再应用（提供颗粒感）
  if (Math.abs(accumulatedDelta) >= ITEM_HEIGHT.value * 0.3) {
    velocity += accumulatedDelta * 0.08
    accumulatedDelta = 0
  } else {
    velocity += delta * WHEEL_SENSITIVITY * 0.05
  }

  // 限制最大速度
  velocity = Math.max(-15, Math.min(15, velocity))

  // 启动动画
  if (!animationId) {
    animationId = requestAnimationFrame(animate)
  }
}

// 处理触摸事件
let touchLastY = 0
let touchLastTime = 0

const onTouchStart = (e: TouchEvent) => {
  // 停止当前动画
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
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

  if (wheelRef.value) {
    wheelRef.value.scrollTop = currentScrollTop
  }

  if (timeDelta > 0) {
    velocity = delta / timeDelta * 16
  }

  const currentValue = getValueFromScroll(currentScrollTop)
  if (currentValue !== props.modelValue) {
    emit('update:modelValue', currentValue)
  }

  touchLastY = touchY
  touchLastTime = now
}

const onTouchEnd = () => {
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

// 设置滚轮位置（无动画）
const setScrollPosition = (value: number) => {
  if (!wheelRef.value) return

  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
  velocity = 0

  currentScrollTop = getScrollFromValue(value)
  targetScrollTop = currentScrollTop
  wheelRef.value.scrollTop = currentScrollTop
}

// 初始化滚轮位置
const initPosition = () => {
  if (props.max >= MIN.value) {
    nextTick(() => {
      setScrollPosition(props.modelValue)
    })
  }
}

// 监听外部 modelValue 变化（含 step 对齐修正）
watch(
  () => props.modelValue,
  (newValue) => {
    const aligned = clampToStep(newValue)

    // 如果外部传入的值未对齐 step，修正它
    if (aligned !== newValue) {
      emit('update:modelValue', aligned)
      return
    }

    if (!animationId) {
      setScrollPosition(aligned)
    }
  }
)

// 监听 max 变化，确保在数据加载完成后初始化位置
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

onMounted(() => {
  if (props.max >= MIN.value) {
    initPosition()
  }

  const el = wheelRef.value
  if (el) {
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
  }
})

onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }

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
      <div class="wheel-spacer" :style="{ height: SPACER_HEIGHT + 'px' }"></div>
      <div
        class="wheel-item"
        v-for="value in validValues"
        :key="value"
        :class="{ active: value === modelValue, disabled: isDisabled(value) }"
        :style="{ height: ITEM_HEIGHT + 'px', lineHeight: ITEM_HEIGHT + 'px' }"
      >
        {{ value }}
      </div>
      <div class="wheel-spacer" :style="{ height: SPACER_HEIGHT + 'px' }"></div>
    </div>
    <div class="wheel-mask"></div>
    <div class="wheel-center-line"></div>
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
  box-shadow: var(--shadow-sm);
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
  color: var(--color-text-tertiary);
  font-size: 13px;
  transition: color .2s ease, font-size .2s ease;
  flex-shrink: 0;
  user-select: none;
}

.wheel-item.active {
  color: var(--color-text-primary);
  font-weight: 600;
  font-size: 15px;
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
      color-mix(in srgb, var(--color-surface-elevated) 90%, transparent) 0%,
      transparent 30%,
      transparent 70%,
      color-mix(in srgb, var(--color-surface-elevated) 90%, transparent) 100%);
}

.wheel-center-line {
  position: absolute;
  left: 8px;
  right: 8px;
  top: 50%;
  height: 1px;
  background: var(--color-brand-primary-light);
  pointer-events: none;
  transform: translateY(-0.5px);
}
</style>
