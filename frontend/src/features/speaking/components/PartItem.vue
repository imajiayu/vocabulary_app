<template>
  <div class="part-item">
    <div class="part-header">
      <div class="part-info" @click="handleToggle">
        <AppIcon name="expand" :class="{ expanded: isExpanded }" class="expand-icon" />
        <span class="part-title">Part {{ part.number }}</span>
        <span class="count">{{ part.topics.length }}</span>
      </div>
      <div class="part-actions action-btn-group">
        <button class="icon-action-btn icon-action-btn--lg icon-action-btn--add" @click.stop="showAddTopicInput = true" title="添加主题">
          <AppIcon name="plus" />
        </button>
      </div>
    </div>

    <!-- 新增 Topic 输入框 -->
    <div v-if="showAddTopicInput" class="input-container">
      <input v-model="newTopicTitle" ref="addInputRef" placeholder="输入主题标题" @keyup.enter="submitNewTopic"
        @keyup.escape="cancelAddTopic" @blur="cancelAddTopic" />
    </div>

    <!-- Topic 列表 -->
    <div
      class="topics-container"
      :class="{ expanded: isExpanded }"
      :style="{ '--estimated-height': estimatedMaxHeight }"
    >
      <TopicItem
        v-for="topic in part.topics"
        :key="`topic-${topic.id}`"
        :topic="topic"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, computed, onUnmounted } from 'vue'
import AppIcon from '@/shared/components/controls/Icons.vue'
import TopicItem from './TopicItem.vue'
import type { PartGroup } from '@/shared/types'
import { useSpeakingContext } from '../composables'

const props = defineProps<{
  part: PartGroup
}>()

// 从 context 获取状态和方法
const { expandedParts, togglePart, addTopic } = useSpeakingContext()

// 计算当前 Part 是否展开
const isExpanded = computed(() => expandedParts.value.has(props.part.number))

const handleToggle = () => {
  togglePart(props.part.number)
}

// 新增 topic 状态
const showAddTopicInput = ref(false)
const newTopicTitle = ref('')
const addInputRef = ref<HTMLInputElement | null>(null)

const submitNewTopic = async () => {
  const title = newTopicTitle.value.trim()
  if (title) {
    await addTopic(props.part.number, title)
    newTopicTitle.value = ''
  }
  showAddTopicInput.value = false
}

const cancelAddTopic = () => {
  showAddTopicInput.value = false
  newTopicTitle.value = ''
}

// 计算展开后所需的最大高度
const estimatedMaxHeight = computed(() => {
  if (!props.part.topics || props.part.topics.length === 0) return '200px'

  const topicCount = props.part.topics.length

  // 如果topic数量很多（比如50个），使用一个很大的固定值而不是none
  // 这样可以保持动画效果
  if (topicCount > 20) {
    return '10000px' // 足够大的值，能容纳50个topics
  }

  // 对于较少的topics，保留原来的计算逻辑
  let totalHeight = 0
  props.part.topics.forEach(topic => {
    totalHeight += 90 // topic header + spacing
    if (topic.questions && topic.questions.length > 0) {
      totalHeight += topic.questions.length * 55 // 每个question约55px
    }
  })

  const finalHeight = Math.max(200, totalHeight)
  return `${finalHeight}px`
})

// 监听窗口大小变化，重新计算高度
let resizeObserver: ResizeObserver | null = null
if (typeof window !== 'undefined') {
  resizeObserver = new ResizeObserver(() => {
    // 触发计算属性重新计算（通过访问estimatedMaxHeight）
    estimatedMaxHeight.value
  })

  nextTick(() => {
    if (resizeObserver) {
      resizeObserver.observe(document.body)
    }
  })
}

// 自动 focus 输入框
watch(showAddTopicInput, val => {
  if (val) nextTick(() => addInputRef.value?.focus())
})

// 清理资源
const cleanup = () => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
}

// 在组件卸载时清理
onUnmounted(cleanup)

</script>

<style scoped>
.part-item {
  margin-bottom: 16px;
}

.part-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  background: var(--gradient-purple-subtle);
  border: 1px solid var(--color-purple-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
  position: relative;
}

.part-header:hover {
  background: var(--gradient-purple-hover);
  border-color: rgba(102, 126, 234, 0.3);
  transform: translateY(-2px) scale(1.01);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.2);
}

/* 添加点击反馈动画 */
.part-header:active {
  transform: translateY(-1px) scale(0.99);
  transition: all 0.1s ease;
}

.part-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.part-title {
  font-weight: 600;
  color: var(--color-purple);
  font-size: 15px;
  letter-spacing: -0.025em;
  flex: 1;
}

.count {
  background: var(--gradient-primary);
  color: var(--color-text-inverse);
  padding: 4px 10px;
  border-radius: 14px;
  font-size: 11px;
  font-weight: 600;
  min-width: 24px;
  text-align: center;
  box-shadow: 0 2px 6px rgba(102, 126, 234, 0.3);
}

.expand-icon {
  color: var(--color-purple);
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  transform-origin: center;
  will-change: transform;
}

.expand-icon.expanded {
  transform: rotate(90deg);
  color: var(--color-purple-dark);
}

/* 按钮组 hover 显示 */
.part-header:hover .part-actions {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(0);
}

.input-container {
  padding: 8px 16px;
  animation: slideIn 0.2s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.input-container input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 2px solid var(--color-purple);
  border-radius: var(--radius-default);
  font-size: 14px;
  background: var(--color-bg-primary);
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
}

.input-container input:focus {
  outline: none;
  border-color: var(--color-purple-dark);
  box-shadow: 0 0 0 3px var(--color-purple-light);
  transform: scale(1.02);
}

.topics-container {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94),
              margin-top 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94),
              opacity 0.3s ease,
              transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  padding-left: 16px;
  margin-top: 0;
  opacity: 0;
  transform: translateY(-8px);
  will-change: max-height, margin-top, opacity, transform;
}

.topics-container.expanded {
  max-height: var(--estimated-height, 10000px);
  margin-top: 12px;
  opacity: 1;
  transform: translateY(0);
}

/* 移除特殊处理，统一使用计算的高度值 */

/* 添加微妙的动画延迟效果 */
.topics-container > * {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.topics-container.expanded > * {
  animation: slideInFromLeft 0.3s ease forwards;
}

@keyframes slideInFromLeft {
  from {
    opacity: 0;
    transform: translateX(-16px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@media (max-width: 480px) {
  .part-header {
    padding: 10px 12px;
  }

  /* 移动端禁用hover效果，使用触摸反馈 */
  .part-header:hover {
    background: var(--gradient-purple-subtle);
    border-color: var(--color-purple-border);
    transform: none;
    box-shadow: none;
  }

  .part-header:active {
    background: var(--gradient-purple-hover);
    transform: scale(0.98);
  }
}
</style>