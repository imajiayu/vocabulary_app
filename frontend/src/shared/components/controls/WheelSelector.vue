<script setup lang="ts">
import { ref, watch, onMounted, nextTick, computed } from 'vue'

const props = defineProps<{
  max: number
  modelValue: number
  itemHeight?: number
  min?: number
  step?: number
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

// 生成所有有效值的数组
const validValues = computed(() => {
  const result: number[] = []
  for (let v = minValue(); v <= props.max; v += stepValue()) {
    result.push(v)
  }
  return result
})

const wheelRef = ref<HTMLDivElement | null>(null)
const isScrolling = ref(false)

let ticking = false

// 滚动时计算当前值
const onWheelScroll = () => {
  if (!wheelRef.value || ticking) return

  ticking = true
  requestAnimationFrame(() => {
    const container = wheelRef.value!
    const scrollTop = container.scrollTop
    const containerCenter = container.clientHeight / 2
    const centerPosition = scrollTop + containerCenter
    const index = Math.round(centerPosition / itemHeight)
    const itemIndex = index - 1
    const rawValue = minValue() + itemIndex * stepValue()
    const newValue = Math.max(minValue(), Math.min(rawValue, props.max))

    if (newValue !== props.modelValue) {
      emit('update:modelValue', newValue)
    }

    ticking = false
  })
}

// 设置滚轮位置
const setScrollPosition = (value: number) => {
  if (!wheelRef.value) return

  const targetValue = Math.max(minValue(), Math.min(value, props.max))
  const container = wheelRef.value
  const containerCenter = container.clientHeight / 2
  const spacerHeight = 26 // calc(40px - 14px) = 26px

  // 计算目标值对应的 item index（从 0 开始）
  const itemIndex = Math.round((targetValue - minValue()) / stepValue())
  // 计算目标元素的中心位置
  const elementCenterInItems = itemIndex * itemHeight + itemHeight / 2
  // 加上顶部占位空间，得到在整个滚动容器中的位置
  const elementCenter = spacerHeight + elementCenterInItems
  // 滚动位置 = 元素中心位置 - 容器中心位置
  const scrollTop = elementCenter - containerCenter

  isScrolling.value = true
  container.scrollTop = Math.max(0, scrollTop)

  setTimeout(() => {
    isScrolling.value = false
  }, 100)
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
      setScrollPosition(newValue)
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
})
</script>

<template>
  <div class="wheel" @click.stop>
    <div class="wheel-list scrollbar-hidden" ref="wheelRef" @scroll="onWheelScroll">
      <!-- 添加顶部和底部的占位空间，确保第一个和最后一个元素能滚动到中心 -->
      <div class="wheel-spacer"></div>
      <div class="wheel-item" v-for="value in validValues" :key="value" :class="{ active: value === modelValue }">
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
  scroll-snap-type: y mandatory;
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
  color: #94a3b8;
  scroll-snap-align: center;
  font-size: 13px;
  transition: color .2s ease, font-size .2s ease;
  flex-shrink: 0;
}

.wheel-item.active {
  color: #0f172a;
  font-weight: 600;
  font-size: 15px;
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