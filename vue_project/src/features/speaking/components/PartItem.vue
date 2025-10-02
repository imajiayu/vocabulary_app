<template>
  <div class="part-item">
    <div class="part-header">
      <div class="part-info" @click="toggleExpanded">
        <AppIcon name="expand" :class="{ expanded: isExpanded }" class="expand-icon" />
        <span class="part-title">Part {{ part.number }}</span>
        <span class="count">{{ part.topics.length }}</span>
      </div>
      <div class="part-actions">
        <button class="action-btn" @click.stop="showAddTopicInput = true" title="添加主题">
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
      <TopicItem v-for="topic in part.topics" :key="`topic-${topic.id}`" :topic="topic"
        :is-expanded="expandedTopics.has(topic.id)" :selected-question-id="selectedQuestionId"
        @toggle-expanded="id => $emit('toggle-topic', id)"
        @add-question="(topicId, text) => $emit('add-question', topicId, text)"
        @edit-topic="(topicId, title) => $emit('edit-topic', topicId, title)"
        @delete-topic="id => $emit('delete-topic', id)"
        @edit-question="(questionId, text) => $emit('edit-question', questionId, text)"
        @question-select="q => $emit('question-select', q)" @question-delete="id => $emit('question-delete', id)" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, computed, onUnmounted } from 'vue'
import AppIcon from '@/shared/components/ui/Icons.vue'
import TopicItem from './TopicItem.vue'
import type { PartGroup } from '@/shared/types'

interface Props {
  part: PartGroup
  isExpanded: boolean
  expandedTopics: Set<number>
  selectedQuestionId?: number | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'toggle-expanded': [partNumber: number]
  'toggle-topic': [topicId: number]
  'add-topic': [partNumber: number, title: string]
  'edit-part': [partNumber: number, title: string]
  'delete-part': [partNumber: number]
  'edit-topic': [topicId: number, title: string]
  'delete-topic': [topicId: number]
  'add-question': [topicId: number, text: string]
  'edit-question': [questionId: number, text: string]
  'question-select': [question: any]
  'question-delete': [questionId: number]
}>()

const toggleExpanded = () => {
  emit('toggle-expanded', props.part.number)
}

// 新增 topic 状态
const showAddTopicInput = ref(false)
const newTopicTitle = ref('')
const addInputRef = ref<HTMLInputElement | null>(null)

const submitNewTopic = () => {
  const title = newTopicTitle.value.trim()
  if (title) {
    emit('add-topic', props.part.number, title)
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
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.08), rgba(118, 75, 162, 0.08));
  border: 1px solid rgba(102, 126, 234, 0.2);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
  position: relative;
}

.part-header:hover {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.12), rgba(118, 75, 162, 0.12));
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
  color: #667eea;
  font-size: 15px;
  letter-spacing: -0.025em;
  flex: 1;
}

.count {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  padding: 4px 10px;
  border-radius: 14px;
  font-size: 11px;
  font-weight: 600;
  min-width: 24px;
  text-align: center;
  box-shadow: 0 2px 6px rgba(102, 126, 234, 0.3);
}

.expand-icon {
  color: #667eea;
  transition: all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  transform-origin: center;
  will-change: transform;
}

.expand-icon.expanded {
  transform: rotate(90deg);
  color: #764ba2;
}

.part-actions {
  display: flex;
  gap: 6px;
  opacity: 0;
  transition: all 0.3s ease;
  transform: translateX(8px);
}

.part-header:hover .part-actions {
  opacity: 1;
  transform: translateX(0);
}

.action-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px);
  color: #667eea;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
}

.action-btn:hover {
  transform: translateY(-1px) scale(1.05);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  background: white;
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
  border: 2px solid #667eea;
  border-radius: 8px;
  font-size: 14px;
  background: white;
  transition: all 0.2s ease;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
}

.input-container input:focus {
  outline: none;
  border-color: #764ba2;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
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

@media (max-width: 768px) {
  .part-header {
    padding: 10px 12px;
  }

  .action-btn {
    width: 24px;
    height: 24px;
  }

  /* 移动端始终显示操作按钮 */
  .part-actions {
    opacity: 1;
    transform: translateX(0);
  }

  /* 移动端禁用hover效果，使用触摸反馈 */
  .part-header:hover {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.08), rgba(118, 75, 162, 0.08));
    border-color: rgba(102, 126, 234, 0.2);
    transform: none;
    box-shadow: none;
  }

  .part-header:active {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.12), rgba(118, 75, 162, 0.12));
    transform: scale(0.98);
  }
}
</style>