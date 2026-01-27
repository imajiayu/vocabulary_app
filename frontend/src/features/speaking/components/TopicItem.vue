<template>
  <div class="topic-card" :class="{ 'is-expanded': isExpanded }">
    <!-- Topic Header -->
    <div class="topic-header" @click="handleToggle">
      <div class="topic-main">
        <AppIcon
          name="expand"
          class="expand-icon"
          :class="{ 'is-rotated': isExpanded }"
        />
        <span class="topic-title">{{ topic.title }}</span>
      </div>

      <div class="topic-meta">
        <span class="question-badge">{{ topic.questions.length }}</span>

        <div class="topic-actions">
          <button
            class="action-btn action-btn--add"
            @click.stop="showAddQuestionInput = true"
            title="添加问题"
          >
            <AppIcon name="plus" />
          </button>
          <button
            class="action-btn action-btn--edit"
            @click.stop="showEditInput = true"
            title="编辑主题"
          >
            <AppIcon name="edit" />
          </button>
          <button
            class="action-btn action-btn--delete"
            @click.stop="handleDelete"
            title="删除主题"
          >
            <AppIcon name="delete" />
          </button>
        </div>
      </div>
    </div>

    <!-- Edit Topic Input -->
    <Transition name="form-slide">
      <div v-if="showEditInput" class="inline-form" @click.stop>
        <input
          v-model="editTitle"
          ref="editInputRef"
          class="form-input"
          placeholder="输入主题标题"
          @keyup.enter="submitEdit"
          @keyup.escape="cancelEdit"
          @blur="submitEdit"
        />
      </div>
    </Transition>

    <!-- Add Question Input -->
    <Transition name="form-slide">
      <div v-if="showAddQuestionInput" class="inline-form" @click.stop>
        <textarea
          v-model="newQuestionText"
          ref="addInputRef"
          class="form-input form-textarea"
          placeholder="输入问题内容..."
          rows="3"
          @keyup.enter.exact="submitNewQuestion"
          @keyup.escape="cancelAddQuestion"
          @blur="cancelAddQuestion"
        />
      </div>
    </Transition>

    <!-- Questions List -->
    <div
      ref="questionsContainer"
      class="questions-list"
      :class="{ 'is-expanded': isExpanded }"
      :style="{ '--estimated-questions-height': estimatedQuestionsHeight }"
    >
      <QuestionItem
        v-for="(question, index) in topic.questions"
        :key="`question-${question.id}`"
        :question="question"
        :style="{ '--question-index': index }"
      />

      <div v-if="topic.questions.length === 0 && isExpanded" class="questions-empty">
        <span class="empty-bullet">•</span>
        <span>暂无问题</span>
      </div>
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

// Context state and methods
const {
  expandedTopics,
  toggleTopic,
  editTopic,
  deleteTopic,
  addQuestion
} = useSpeakingContext()

// Computed expansion state
const isExpanded = computed(() => expandedTopics.value.has(props.topic.id))

const handleToggle = () => {
  toggleTopic(props.topic.id)
}

const handleDelete = () => {
  deleteTopic(props.topic.id)
}

// Edit topic state
const showEditInput = ref(false)
const editTitle = ref(props.topic.title)
const editInputRef = ref<HTMLInputElement | null>(null)

// Add question state
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
  if (!isExpanded.value) {
    toggleTopic(props.topic.id)
  }
}

const cancelAddQuestion = () => {
  showAddQuestionInput.value = false
  newQuestionText.value = ''
}

// Height estimation
const actualContentHeight = ref(0)
const questionsContainer = ref<HTMLElement | null>(null)

const estimatedQuestionsHeight = computed(() => {
  if (!props.topic.questions || props.topic.questions.length === 0) return '100px'

  const questionCount = props.topic.questions.length

  if (actualContentHeight.value > 0 && isExpanded.value) {
    const heightWithBuffer = actualContentHeight.value + 20
    return `${heightWithBuffer}px`
  }

  const baseQuestionHeight = 100
  const extraSpacing = 50
  const totalHeight = questionCount * baseQuestionHeight + extraSpacing

  const minHeight = 150
  const finalHeight = Math.max(minHeight, totalHeight)

  return `${finalHeight}px`
})

const measureContentHeight = () => {
  if (!questionsContainer.value || !isExpanded.value) return

  nextTick(() => {
    const container = questionsContainer.value
    if (container) {
      const originalMaxHeight = container.style.maxHeight
      const originalOverflow = container.style.overflow

      container.style.maxHeight = 'none'
      container.style.overflow = 'visible'

      const scrollHeight = container.scrollHeight
      actualContentHeight.value = scrollHeight

      container.style.maxHeight = originalMaxHeight
      container.style.overflow = originalOverflow
    }
  })
}

// Watchers
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

watch(() => isExpanded.value, (expanded) => {
  if (expanded) {
    setTimeout(measureContentHeight, 350)
  } else {
    actualContentHeight.value = 0
  }
})

watch(() => props.topic.questions?.length, () => {
  if (isExpanded.value) {
    setTimeout(measureContentHeight, 100)
  }
})

watch(() => props.topic.title, (newTitle) => {
  editTitle.value = newTitle
})
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   Topic Card - Index Card Style
   ═══════════════════════════════════════════════════════════════════════════ */

.topic-card {
  position: relative;
  background: var(--primitive-paper-50);
  border: 1px solid var(--primitive-paper-300);
  border-radius: 10px;
  overflow: hidden;
  transition: all 0.25s ease;

  /* Subtle card shadow */
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.topic-card:hover {
  border-color: var(--primitive-paper-400);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.topic-card.is-expanded {
  background: linear-gradient(
    180deg,
    var(--primitive-paper-50) 0%,
    var(--primitive-paper-100) 100%
  );
  border-color: var(--primitive-copper-200);
}

/* ── Topic Header ── */
.topic-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s ease;
}

.topic-header:hover {
  background: rgba(139, 105, 20, 0.04);
}

.topic-header:active {
  background: rgba(139, 105, 20, 0.08);
}

.topic-main {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.expand-icon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  margin-top: 2px;
  color: var(--primitive-ink-400);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.expand-icon.is-rotated {
  transform: rotate(90deg);
  color: var(--primitive-copper-500);
}

.topic-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--primitive-ink-700);
  line-height: 1.5;
  word-break: break-word;
}

/* ── Topic Meta ── */
.topic-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.question-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;

  font-size: 11px;
  font-weight: 600;
  color: var(--primitive-copper-600);

  background: var(--primitive-copper-100);
  border-radius: 6px;
}

/* ── Topic Actions ── */
.topic-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transform: translateX(8px);
  transition: all 0.2s ease;
}

.topic-header:hover .topic-actions {
  opacity: 1;
  transform: translateX(0);
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;

  background: white;
  border: 1px solid var(--primitive-paper-300);
  border-radius: 6px;

  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn:hover {
  transform: translateY(-1px);
}

.action-btn--add {
  color: var(--primitive-olive-500);
}

.action-btn--add:hover {
  background: var(--primitive-olive-50);
  border-color: var(--primitive-olive-200);
}

.action-btn--edit {
  color: var(--primitive-copper-500);
}

.action-btn--edit:hover {
  background: var(--primitive-copper-50);
  border-color: var(--primitive-copper-200);
}

.action-btn--delete {
  color: var(--primitive-brick-400);
}

.action-btn--delete:hover {
  background: var(--primitive-brick-50);
  border-color: var(--primitive-brick-200);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Inline Forms
   ═══════════════════════════════════════════════════════════════════════════ */

.inline-form {
  padding: 8px 14px 12px;
  background: var(--primitive-paper-100);
  border-top: 1px solid var(--primitive-paper-300);
}

.form-input {
  width: 100%;
  padding: 8px 10px;

  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--primitive-ink-800);

  background: white;
  border: 1px solid var(--primitive-paper-400);
  border-radius: 6px;

  transition: all 0.15s ease;
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: var(--primitive-copper-400);
  box-shadow: 0 0 0 2px rgba(139, 105, 20, 0.1);
}

.form-input::placeholder {
  color: var(--primitive-ink-300);
}

.form-textarea {
  resize: vertical;
  min-height: 60px;
  line-height: 1.5;
}

/* Form slide transition */
.form-slide-enter-active,
.form-slide-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.form-slide-enter-from,
.form-slide-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Questions List
   ═══════════════════════════════════════════════════════════════════════════ */

.questions-list {
  display: flex;
  flex-direction: column;
  gap: 6px;

  max-height: 0;
  overflow: hidden;
  opacity: 0;
  padding: 0 12px;
  margin: 0;

  transform: translateY(-4px);
  transition:
    max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.25s ease,
    transform 0.25s ease,
    padding 0.35s ease;

  will-change: max-height, opacity, transform;
}

.questions-list.is-expanded {
  max-height: var(--estimated-questions-height, 2000px);
  opacity: 1;
  transform: translateY(0);
  padding: 8px 12px 12px;
}

/* Staggered animation for questions */
.questions-list.is-expanded > :deep(*) {
  animation: questionSlideIn 0.25s cubic-bezier(0.22, 1, 0.36, 1) backwards;
  animation-delay: calc(var(--question-index, 0) * 0.04s);
}

@keyframes questionSlideIn {
  from {
    opacity: 0;
    transform: translateX(-8px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* ── Empty State ── */
.questions-empty {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 8px;
  font-size: 12px;
  color: var(--primitive-ink-400);
  font-style: italic;
}

.empty-bullet {
  opacity: 0.5;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Mobile Adjustments
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 480px) {
  .topic-header {
    padding: 10px 12px;
    gap: 10px;
  }

  .topic-title {
    font-size: 12px;
  }

  .question-badge {
    min-width: 20px;
    height: 20px;
    font-size: 10px;
  }

  /* Always show actions on mobile */
  .topic-actions {
    opacity: 1;
    transform: translateX(0);
  }

  .action-btn {
    width: 22px;
    height: 22px;
  }

  /* Disable hover effects on mobile */
  .topic-header:hover {
    background: transparent;
  }

  .topic-header:active {
    background: rgba(139, 105, 20, 0.08);
  }

  .topic-card:hover {
    border-color: var(--primitive-paper-300);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  }
}
</style>
