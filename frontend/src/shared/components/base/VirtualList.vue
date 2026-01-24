<!--
  VirtualList - 虚拟列表组件

  用于高效渲染大量数据，只渲染可视区域内的元素。
  基于 FRONTEND_DESIGN_OPTIMIZATION.md 6.3 节实现。
-->
<template>
  <div
    ref="containerRef"
    class="virtual-list"
    :style="containerStyle"
    @scroll="onScroll"
  >
    <div class="virtual-list__spacer" :style="{ height: `${totalHeight}px` }">
      <div
        class="virtual-list__content"
        :style="{ transform: `translateY(${offsetY}px)` }"
      >
        <div
          v-for="(item, index) in visibleItems"
          :key="getItemKey(item, startIndex + index)"
          class="virtual-list__item"
          :style="itemStyle"
        >
          <slot :item="item" :index="startIndex + index" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T">
import { ref, computed, onMounted, onUnmounted, watch, type CSSProperties } from 'vue'

interface Props {
  /** 列表数据 */
  items: T[]
  /** 每个元素的高度（像素） */
  itemHeight: number
  /** 可视区域外的缓冲元素数量，默认 5 */
  buffer?: number
  /** 容器高度，默认 100% */
  height?: string | number
  /** 获取元素唯一标识的函数 */
  keyField?: keyof T | ((item: T, index: number) => string | number)
}

const props = withDefaults(defineProps<Props>(), {
  buffer: 5,
  height: '100%'
})

const emit = defineEmits<{
  'scroll': [scrollTop: number]
  'reach-top': []
  'reach-bottom': []
}>()

const containerRef = ref<HTMLElement>()
const scrollTop = ref(0)
const containerHeight = ref(0)

// 容器样式
const containerStyle = computed<CSSProperties>(() => ({
  height: typeof props.height === 'number' ? `${props.height}px` : props.height,
  overflow: 'auto'
}))

// 单个元素样式
const itemStyle = computed<CSSProperties>(() => ({
  height: `${props.itemHeight}px`,
  boxSizing: 'border-box'
}))

// 总高度
const totalHeight = computed(() => props.items.length * props.itemHeight)

// 起始索引
const startIndex = computed(() => {
  return Math.max(0, Math.floor(scrollTop.value / props.itemHeight) - props.buffer)
})

// 结束索引
const endIndex = computed(() => {
  const visibleCount = Math.ceil(containerHeight.value / props.itemHeight)
  return Math.min(props.items.length, startIndex.value + visibleCount + props.buffer * 2)
})

// 可见元素
const visibleItems = computed(() => {
  return props.items.slice(startIndex.value, endIndex.value)
})

// Y轴偏移
const offsetY = computed(() => startIndex.value * props.itemHeight)

// 获取元素唯一标识
const getItemKey = (item: T, index: number): string | number => {
  if (typeof props.keyField === 'function') {
    return props.keyField(item, index)
  }
  if (props.keyField && typeof item === 'object' && item !== null) {
    return String((item as Record<string, unknown>)[props.keyField as string])
  }
  return index
}

// 滚动处理
const onScroll = () => {
  if (!containerRef.value) return

  const newScrollTop = containerRef.value.scrollTop
  scrollTop.value = newScrollTop
  emit('scroll', newScrollTop)

  // 检测是否到达顶部或底部
  if (newScrollTop <= 0) {
    emit('reach-top')
  }
  if (newScrollTop + containerHeight.value >= totalHeight.value - 10) {
    emit('reach-bottom')
  }
}

// 公开方法：滚动到指定索引
const scrollToIndex = (index: number, behavior: ScrollBehavior = 'smooth') => {
  if (!containerRef.value) return

  const targetScrollTop = Math.max(0, Math.min(index * props.itemHeight, totalHeight.value - containerHeight.value))
  containerRef.value.scrollTo({
    top: targetScrollTop,
    behavior
  })
}

// 公开方法：滚动到顶部
const scrollToTop = (behavior: ScrollBehavior = 'smooth') => {
  scrollToIndex(0, behavior)
}

// 公开方法：滚动到底部
const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
  scrollToIndex(props.items.length - 1, behavior)
}

// 监听数据变化，如果滚动到底部后数据增加，保持在底部
watch(() => props.items.length, (newLen, oldLen) => {
  if (newLen > oldLen && scrollTop.value + containerHeight.value >= (oldLen * props.itemHeight) - 10) {
    scrollToBottom('auto')
  }
})

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (containerRef.value) {
    containerHeight.value = containerRef.value.clientHeight

    resizeObserver = new ResizeObserver(entries => {
      containerHeight.value = entries[0].contentRect.height
    })
    resizeObserver.observe(containerRef.value)
  }
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
})

// 暴露方法给父组件
defineExpose({
  scrollToIndex,
  scrollToTop,
  scrollToBottom,
  getScrollTop: () => scrollTop.value
})
</script>

<style scoped>
.virtual-list {
  position: relative;
  will-change: scroll-position;
}

.virtual-list__spacer {
  position: relative;
}

.virtual-list__content {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
}

.virtual-list__item {
  display: flex;
  align-items: stretch;
}
</style>
