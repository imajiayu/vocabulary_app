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

// 每个 item 的高度
const itemHeight = props.itemHeight ?? 28
// 最小值
const minValue = () => props.min ?? 1
// 步长
const stepValue = () => props.step ?? 1
// spacer 高度（与 CSS 保持一致）
const spacerHeight = 26

// 显示的最大值（如果没有指定，则等于可滚动的最大值）
const displayMaxValue = computed(() => props.displayMax ?? props.max)

// 生成所有显示值的数组（包括禁用的）
const validValues = computed(() => {
  const result: number[] = []
  for (let v = minValue(); v <= displayMaxValue.value; v += stepValue()) {
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
const FRICTION = 0.92 // 摩擦系数（越小停得越快）
const WHEEL_SENSITIVITY = 0.4 // 滚轮灵敏度（越小越精确）
const SNAP_THRESHOLD = 0.5 // 速度低于此值时开始吸附
const SNAP_SPEED = 0.15 // 吸附动画速度

// 根据滚动位置计算当前值
const getValueFromScroll = (scrollTop: number): number => {
  const containerCenter = wheelRef.value?.clientHeight ?? 80
  const centerPosition = scrollTop + containerCenter / 2
  const itemIndex = Math.round((centerPosition - spacerHeight) / itemHeight - 0.5)
  const rawValue = minValue() + Math.max(0, itemIndex) * stepValue()
  return Math.max(minValue(), Math.min(rawValue, props.max))
}

// 根据值计算滚动位置
const getScrollFromValue = (value: number): number => {
  const targetValue = Math.max(minValue(), Math.min(value, props.max))
  const containerCenter = (wheelRef.value?.clientHeight ?? 80) / 2
  const itemIndex = Math.round((targetValue - minValue()) / stepValue())
  const elementCenter = spacerHeight + itemIndex * itemHeight + itemHeight / 2
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

  // 使用 deltaY，对触控板和鼠标滚轮都有效
  // 触控板的 deltaY 通常较小且连续，鼠标滚轮的 deltaY 较大
  let delta = e.deltaY

  // 规范化 delta（处理不同设备的差异）
  if (e.deltaMode === 1) {
    // 行模式（某些鼠标）
    delta *= itemHeight
  } else if (e.deltaMode === 2) {
    // 页模式
    delta *= itemHeight * 3
  }

  // 累积 delta 以实现更平滑的手势
  accumulatedDelta += delta * WHEEL_SENSITIVITY

  // 对于小的增量，累积后再应用（提供颗粒感）
  if (Math.abs(accumulatedDelta) >= itemHeight * 0.3) {
    velocity += accumulatedDelta * 0.08
    accumulatedDelta = 0
  } else {
    // 即使小增量也要有反馈
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
let touchStartY = 0
let touchLastY = 0
let touchLastTime = 0

const onTouchStart = (e: TouchEvent) => {
  // 停止当前动画
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
  velocity = 0

  touchStartY = e.touches[0].clientY
  touchLastY = touchStartY
  touchLastTime = Date.now()
}

const onTouchMove = (e: TouchEvent) => {
  e.preventDefault()

  const touchY = e.touches[0].clientY
  const now = Date.now()
  const timeDelta = now - touchLastTime

  // 计算移动距离
  const delta = touchLastY - touchY

  // 更新滚动位置
  currentScrollTop += delta

  // 边界限制
  const maxScroll = getMaxScroll()
  currentScrollTop = Math.max(0, Math.min(currentScrollTop, maxScroll))

  if (wheelRef.value) {
    wheelRef.value.scrollTop = currentScrollTop
  }

  // 计算速度（用于惯性）
  if (timeDelta > 0) {
    velocity = delta / timeDelta * 16 // 转换为每帧的速度
  }

  // 更新值
  const currentValue = getValueFromScroll(currentScrollTop)
  if (currentValue !== props.modelValue) {
    emit('update:modelValue', currentValue)
  }

  touchLastY = touchY
  touchLastTime = now
}

const onTouchEnd = () => {
  // 启动惯性动画
  if (Math.abs(velocity) > 0.5) {
    animationId = requestAnimationFrame(animate)
  } else {
    // 直接吸附
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

  // 停止当前动画
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
  if (props.modelValue >= minValue() && props.max >= minValue()) {
    nextTick(() => {
      setScrollPosition(props.modelValue)
    })
  }
}

// 监听外部 modelValue 变化
watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue >= minValue() && newValue <= props.max) {
      // 只有当不在动画中时才设置位置
      if (!animationId) {
        setScrollPosition(newValue)
      }
    }
  }
)

// 监听 max 变化，确保在数据加载完成后初始化位置
watch(
  () => props.max,
  () => {
    if (props.max >= minValue()) {
      nextTick(() => {
        initPosition()
      })
    }
  }
)

onMounted(() => {
  if (props.max >= minValue()) {
    initPosition()
  }

  // 绑定事件
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
      <!-- 添加顶部和底部的占位空间，确保第一个和最后一个元素能滚动到中心 -->
      <div class="wheel-spacer"></div>
      <div class="wheel-item" v-for="value in validValues" :key="value" :class="{ active: value === modelValue, disabled: isDisabled(value) }">
        {{ value }}
      </div>
      <div class="wheel-spacer"></div>
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
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  border: 1px solid rgba(146, 84, 222, 0.15);
}

.wheel-list {
  height: 100%;
  overflow-y: scroll;
  /* 自定义滚动控制，不使用原生 snap */
  touch-action: none;
}

/* 顶部和底部占位空间，高度为容器高度的一半减去一个item高度的一半 */
.wheel-spacer {
  height: calc(40px - 14px);
  /* (80px / 2) - (28px / 2) = 26px */
  flex-shrink: 0;
}

.wheel-item {
  height: 28px;
  line-height: 28px;
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
      rgba(255, 255, 255, 0.9),
      rgba(255, 255, 255, 0.0) 30%,
      rgba(255, 255, 255, 0.0) 70%,
      rgba(255, 255, 255, 0.9));
}

/* 中心指示线（可选） */
.wheel-center-line {
  position: absolute;
  left: 8px;
  right: 8px;
  top: 50%;
  height: 1px;
  background: rgba(146, 84, 222, 0.3);
  pointer-events: none;
  transform: translateY(-0.5px);
}
</style>