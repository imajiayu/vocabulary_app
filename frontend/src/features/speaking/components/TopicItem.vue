<template>
  <div class="topic-item">
    <div class="topic-header">
      <div class="topic-title-row" @click="handleToggle">
        <AppIcon name="expand" :class="{ expanded: isExpanded }" class="expand-icon" />
        <span class="topic-title">{{ topic.title }}</span>
      </div>
      <div class="topic-controls" :class="{ editing: showAddQuestionInput || showEditInput }">
        <span class="count">{{ topic.questions.length }}</span>
        <div class="topic-actions action-btn-group">
          <button class="icon-action-btn icon-action-btn--md icon-action-btn--add" @click.stop="showAddQuestionInput = true" title="添加问题">
            <AppIcon name="plus" />
          </button>
          <button class="icon-action-btn icon-action-btn--md icon-action-btn--edit" @click.stop="showEditInput = true" title="编辑主题">
            <AppIcon name="edit" />
          </button>
          <button class="icon-action-btn icon-action-btn--md icon-action-btn--delete" @click.stop="handleDelete" title="删除主题">
            <AppIcon name="delete" />
          </button>
        </div>
      </div>
    </div>

    <!-- 编辑主题输入框 -->
    <div v-if="showEditInput" class="input-container">
      <input v-model="editTitle" ref="editInputRef" placeholder="输入主题标题" @keyup.enter="submitEdit"
        @keyup.escape="cancelEdit" @blur="submitEdit" />
    </div>

    <!-- 新增问题输入框 -->
    <div v-if="showAddQuestionInput" class="input-container">
      <textarea v-model="newQuestionText" ref="addInputRef" placeholder="输入问题内容" rows="3"
        @keyup.enter="submitNewQuestion" @keyup.escape="cancelAddQuestion" @blur="cancelAddQuestion" />
    </div>

    <!-- 问题列表 -->
    <div
      ref="questionsContainer"
      class="questions-container"
      :class="{ expanded: isExpanded }"
      :style="{ '--estimated-questions-height': estimatedQuestionsHeight }"
    >
      <QuestionItem
        v-for="question in topic.questions"
        :key="`question-${question.id}`"
        :question="question"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, computed } from 'vue'
import AppIcon from '@/shared/components/controls/Icons.vue'
import QuestionItem from './QuestionItem.vue'
import type { TopicGroup } from '@/shared/types'
import { useSpeakingContext } from '../composables'

const props = defineProps<{
  topic: TopicGroup
}>()

// 从 context 获取状态和方法
const {
  expandedTopics,
  toggleTopic,
  editTopic,
  deleteTopic,
  addQuestion
} = useSpeakingContext()

// 计算当前 Topic 是否展开
const isExpanded = computed(() => expandedTopics.value.has(props.topic.id))

const handleToggle = () => {
  toggleTopic(props.topic.id)
}

const handleDelete = () => {
  deleteTopic(props.topic.id)
}

// 编辑主题状态
const showEditInput = ref(false)
const editTitle = ref(props.topic.title)
const editInputRef = ref<HTMLInputElement | null>(null)

// 新增问题状态
const showAddQuestionInput = ref(false)
const newQuestionText = ref('')
const addInputRef = ref<HTMLTextAreaElement | null>(null)

const submitEdit = async () => {
  const title = editTitle.value.trim()
  if (title && title !== props.topic.title) {
    await editTopic(props.topic.id, title)
  }
  showEditInput.value = false
}

const cancelEdit = () => {
  showEditInput.value = false
  editTitle.value = props.topic.title
}

const submitNewQuestion = async () => {
  const text = newQuestionText.value.trim()
  if (text) {
    await addQuestion(props.topic.id, text)
    newQuestionText.value = ''
  }
  showAddQuestionInput.value = false
  // 确保 topic 展开以显示新添加的问题
  if (!isExpanded.value) {
    toggleTopic(props.topic.id)
  }
}

const cancelAddQuestion = () => {
  showAddQuestionInput.value = false
  newQuestionText.value = ''
}


// 实际内容高度的响应式引用
const actualContentHeight = ref(0)
const questionsContainer = ref<HTMLElement | null>(null)

// 计算问题容器所需的高度
const estimatedQuestionsHeight = computed(() => {
  if (!props.topic.questions || props.topic.questions.length === 0) return '100px'

  const questionCount = props.topic.questions.length

  // 如果已经测量到实际高度且展开，使用实际高度加缓冲
  if (actualContentHeight.value > 0 && isExpanded.value) {
    const heightWithBuffer = actualContentHeight.value + 20
    return `${heightWithBuffer}px`
  }

  // 否则使用估算高度，现在更加保守
  const baseQuestionHeight = 100  // 进一步增加基础高度以适应长文本
  const extraSpacing = 50         // 增加更多缓冲空间
  const totalHeight = questionCount * baseQuestionHeight + extraSpacing

  const minHeight = 150
  const finalHeight = Math.max(minHeight, totalHeight)

  return `${finalHeight}px`
})

// 测量实际内容高度
const measureContentHeight = () => {
  if (!questionsContainer.value || !isExpanded.value) return

  nextTick(() => {
    const container = questionsContainer.value
    if (container) {
      // 临时移除高度限制以测量真实高度
      const originalMaxHeight = container.style.maxHeight
      const originalOverflow = container.style.overflow

      container.style.maxHeight = 'none'
      container.style.overflow = 'visible'

      const scrollHeight = container.scrollHeight
      actualContentHeight.value = scrollHeight

      // 恢复原有样式
      container.style.maxHeight = originalMaxHeight
      container.style.overflow = originalOverflow
    }
  })
}

// 自动 focus 输入框
watch(showEditInput, val => {
  if (val) {
    nextTick(() => {
      editInputRef.value?.focus()
      editInputRef.value?.select()
    })
  }
})

watch(showAddQuestionInput, val => {
  if (val) nextTick(() => addInputRef.value?.focus())
})

// 监听展开状态变化，展开时测量高度
watch(() => isExpanded.value, (isExpanded) => {
  if (isExpanded) {
    // 延迟测量，等待动画和DOM更新完成
    setTimeout(measureContentHeight, 350)
  } else {
    // 折叠时重置实际高度
    actualContentHeight.value = 0
  }
})

// 监听问题数量变化，重新测量高度
watch(() => props.topic.questions?.length, () => {
  if (isExpanded.value) {
    setTimeout(measureContentHeight, 100)
  }
})

// 监听 topic 变化更新编辑标题
watch(() => props.topic.title, (newTitle) => {
  editTitle.value = newTitle
})
</script>

<style scoped>
.topic-item {
  margin-bottom: 12px;
}

.topic-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 14px;
  background: var(--color-bg-glass-light);
  backdrop-filter: blur(10px);
  border: 1px solid var(--color-purple-light);
  border-radius: var(--radius-default);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
}

.topic-header:hover {
  background: var(--color-bg-glass-strong);
  border-color: var(--color-purple-border);
  box-shadow: 0 6px 16px var(--color-purple-light);
}

/* 添加点击反馈动画 */
.topic-header:active {
  transform: translateY(0) scale(0.99);
  transition: all 0.1s ease;
}

.topic-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  user-select: none;
}

.topic-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.topic-title {
  font-weight: 500;
  color: var(--color-purple-dark);
  font-size: 14px;
  flex: 1;
  line-height: 1.4;
}

.count {
  background: var(--color-purple-light);
  color: var(--color-purple);
  padding: 3px 8px;
  border-radius: var(--radius-md);
  font-size: 11px;
  font-weight: 600;
  min-width: 20px;
  text-align: center;
  border: 1px solid var(--color-purple-border);
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

/* 非编辑状态，hover 显示按钮组 */
.topic-header:hover .topic-controls .topic-actions {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(0);
}

/* 编辑状态禁用 hover */
.topic-controls.editing .topic-actions {
  opacity: 0 !important;
  pointer-events: none !important;
  transform: translateX(8px) !important;
}

.input-container {
  padding: 6px 14px;
  animation: slideIn 0.2s ease-out;

  /* 添加这些 */
  overflow: hidden;
  margin: 0 -1px;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.input-container input,
.input-container textarea {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 2px solid var(--color-purple);
  border-radius: var(--radius-sm);
  font-size: 13px;
  background: var(--color-bg-primary);
  transition: all 0.2s ease;
  box-shadow: 0 2px 6px var(--color-purple-light);
  font-family: inherit;
  resize: vertical;
  min-height: 36px;
}

.input-container input:focus,
.input-container textarea:focus {
  outline: none;
  border-color: var(--color-purple-dark);
  box-shadow: 0 0 0 3px var(--color-purple-light);
  transform: scale(1.01);
}

.questions-container {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94),
              margin-top 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94),
              opacity 0.25s ease,
              transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  padding-left: 12px;
  margin-top: 0;
  opacity: 0;
  transform: translateY(-6px);
  will-change: max-height, margin-top, opacity, transform;
}

.questions-container.expanded {
  max-height: var(--estimated-questions-height, 2000px);
  margin-top: 8px;
  opacity: 1;
  transform: translateY(0);
}

/* 问题项的错列动画效果 */
.questions-container.expanded > * {
  animation: slideInStaggered 0.25s ease forwards;
}

.questions-container.expanded > *:nth-child(1) { animation-delay: 0ms; }
.questions-container.expanded > *:nth-child(2) { animation-delay: 40ms; }
.questions-container.expanded > *:nth-child(3) { animation-delay: 80ms; }
.questions-container.expanded > *:nth-child(4) { animation-delay: 120ms; }
.questions-container.expanded > *:nth-child(5) { animation-delay: 160ms; }
.questions-container.expanded > *:nth-child(n+6) { animation-delay: 200ms; }

@keyframes slideInStaggered {
  from {
    opacity: 0;
    transform: translateX(-12px) translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateX(0) translateY(0);
  }
}

@media (max-width: 480px) {
  .topic-header {
    padding: 8px 10px;
  }

  .topic-title {
    font-size: 13px;
  }

  /* 移动端禁用hover效果，使用触摸反馈 */
  .topic-header:hover {
    background: var(--color-bg-glass-light);
    border-color: var(--color-purple-light);
    box-shadow: none;
  }

  .topic-header:active {
    background: var(--color-bg-glass-hover);
    transform: scale(0.98);
  }
}
</style>