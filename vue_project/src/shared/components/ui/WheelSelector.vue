<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'

const props = defineProps<{
  max: number
  modelValue: number
  itemHeight?: number
  min?: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

// 每个 item 的高度
const itemHeight = props.itemHeight ?? 28
// 最小值
const minValue = () => props.min ?? 1

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
    const newValue = Math.max(minValue(), Math.min(index + minValue() - 1, props.max))

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

  // 计算目标元素的中心位置
  // 元素在实际列表中的位置 = (值 - 1) * 高度 + 高度/2
  const elementCenterInItems = (targetValue - minValue()) * itemHeight + itemHeight / 2
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
    <div class="wheel-list" ref="wheelRef" @scroll="onWheelScroll">
      <!-- 添加顶部和底部的占位空间，确保第一个和最后一个元素能滚动到中心 -->
      <div class="wheel-spacer"></div>
      <div class="wheel-item" v-for="n in Math.max(1, max - (min ?? 1) + 1)" :key="n + (min ?? 1) - 1" :class="{ active: n + (min ?? 1) - 1 === modelValue }">
        {{ n + (min ?? 1) - 1 }}
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
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  border: 1px solid rgba(146, 84, 222, 0.15);
}

.wheel-list {
  height: 100%;
  overflow-y: scroll;
  scroll-snap-type: y mandatory;
  scrollbar-width: none;
  /* Firefox */
  -ms-overflow-style: none;
  /* IE 10+ */
}

.wheel-list::-webkit-scrollbar {
  display: none;
  /* Chrome, Safari, Opera */
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