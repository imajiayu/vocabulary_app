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

      <div class="topic-right">
        <!-- Default: badge -->
        <div class="topic-meta">
          <span class="question-badge">{{ topic.questions.length }}</span>
        </div>

        <!-- Hover: action buttons -->
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
    >
      <div class="questions-inner">
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
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, computed } from 'vue'
import AppIcon from '@/shared/components/controls/Icons.vue'
import QuestionItem from './QuestionItem.vue'
import type { TopicGroup } from '@/shared/types'
import { useSpeakingContext } from '../composables/useSpeakingContext'

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

const questionsContainer = ref<HTMLElement | null>(null)

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

watch(() => props.topic.title, (newTitle) => {
  editTitle.value = newTitle
})
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   Topic Card - Dark Studio Style (Level 2)
   中间层级 - 更深的半透明背景，收敛的边框
   ═══════════════════════════════════════════════════════════════════════════ */

.topic-card {
  position: relative;
  background: rgba(28, 33, 48, 0.7);
  border: 1px solid rgba(250, 247, 242, 0.08);
  border-radius: 8px;
  overflow: hidden;
  transition: all 0.25s ease;

  /* 微妙的立体感 */
  box-shadow:
    0 1px 4px rgba(0, 0, 0, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.03);
}

.topic-card:hover {
  border-color: rgba(250, 247, 242, 0.12);
  background: rgba(32, 38, 54, 0.8);
  box-shadow:
    0 2px 10px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.topic-card.is-expanded {
  background: rgba(184, 134, 11, 0.06);
  border-color: rgba(184, 134, 11, 0.2);
  box-shadow:
    0 2px 12px rgba(184, 134, 11, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

/* ── Topic Header ── */
.topic-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s ease;
}

.topic-header:hover {
  background: rgba(250, 247, 242, 0.03);
}

.topic-header:active {
  background: rgba(184, 134, 11, 0.08);
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
  width: 14px;
  height: 14px;
  margin-top: 3px;
  color: var(--primitive-paper-600);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.expand-icon.is-rotated {
  transform: rotate(90deg);
  color: var(--primitive-gold-400);
}

.topic-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--primitive-paper-300);
  line-height: 1.5;
  word-break: break-word;
}

.topic-card.is-expanded .topic-title {
  color: var(--primitive-paper-200);
}

/* ── Right side container ── */
.topic-right {
  position: relative;
  display: grid;
  align-items: center;
  flex-shrink: 0;
  height: 22px;
}

/* Stack both layers in the same grid cell */
.topic-meta,
.topic-actions {
  grid-area: 1 / 1;
  display: flex;
  align-items: center;
  height: 100%;
  transition: opacity 0.15s ease;
}

.topic-meta {
  gap: 8px;
  opacity: 1;
}

.question-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 22px;
  padding: 0 6px;

  font-size: 10px;
  font-weight: 600;
  color: var(--primitive-gold-400);

  background: rgba(184, 134, 11, 0.15);
  border-radius: 5px;
}

/* ── Topic Actions - overlaid on same cell ── */
.topic-actions {
  gap: 4px;
  opacity: 0;
  pointer-events: none;
}

/* Hover: crossfade meta → actions */
.topic-header:hover .topic-meta {
  opacity: 0;
  pointer-events: none;
}

.topic-header:hover .topic-actions {
  opacity: 1;
  pointer-events: auto;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;

  background: rgba(250, 247, 242, 0.05);
  border: 1px solid rgba(250, 247, 242, 0.1);
  border-radius: 5px;

  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn:hover {
  transform: translateY(-1px);
}

.action-btn--add {
  color: var(--primitive-olive-400);
}

.action-btn--add:hover {
  background: rgba(93, 122, 93, 0.15);
  border-color: rgba(93, 122, 93, 0.3);
  color: var(--primitive-olive-300);
}

.action-btn--edit {
  color: var(--primitive-gold-400);
}

.action-btn--edit:hover {
  background: rgba(184, 134, 11, 0.15);
  border-color: rgba(184, 134, 11, 0.3);
  color: var(--primitive-gold-300);
}

.action-btn--delete {
  color: var(--primitive-brick-400);
}

.action-btn--delete:hover {
  background: rgba(155, 59, 59, 0.15);
  border-color: rgba(155, 59, 59, 0.3);
  color: var(--primitive-brick-300);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Inline Forms - 深色主题
   ═══════════════════════════════════════════════════════════════════════════ */

.inline-form {
  padding: 8px 12px 10px;
  background: rgba(20, 24, 36, 0.6);
  border-top: 1px solid rgba(250, 247, 242, 0.06);
}

.form-input {
  width: 100%;
  padding: 8px 10px;

  font-family: var(--font-ui);
  font-size: 13px;
  color: var(--primitive-paper-200);

  background: rgba(15, 18, 28, 0.8);
  border: 1px solid rgba(250, 247, 242, 0.12);
  border-radius: 6px;

  transition: all 0.15s ease;
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
  border-color: var(--primitive-gold-500);
  box-shadow: 0 0 0 2px rgba(184, 134, 11, 0.15);
  background: rgba(18, 22, 32, 0.9);
}

.form-input::placeholder {
  color: var(--primitive-paper-600);
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
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.questions-inner {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.questions-list.is-expanded {
  grid-template-rows: 1fr;
}

.questions-list.is-expanded .questions-inner {
  padding: 6px 10px 10px;
}

/* Staggered animation for questions */
.questions-list.is-expanded .questions-inner > :deep(*) {
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
  color: var(--primitive-paper-600);
  font-style: italic;
}

.empty-bullet {
  opacity: 0.5;
  color: var(--primitive-gold-500);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Mobile Adjustments
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .topic-header {
    padding: 12px;
    gap: 10px;
  }

  .topic-title {
    font-size: 12px;
  }

  /* On mobile: show both meta and actions, no stacking */
  .topic-right {
    display: flex;
    gap: 8px;
    height: auto;
  }

  .topic-meta,
  .topic-actions {
    grid-area: auto;
    opacity: 1;
    pointer-events: auto;
  }

  .question-badge {
    min-width: 20px;
    height: 20px;
    font-size: 9px;
  }

  /* Keep meta visible on mobile hover */
  .topic-header:hover .topic-meta {
    opacity: 1;
    pointer-events: auto;
  }

  .action-btn {
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
  }

  /* Disable hover effects on mobile */
  .topic-header:hover {
    background: transparent;
  }

  .topic-header:active {
    background: rgba(184, 134, 11, 0.1);
  }

  .topic-card:hover {
    border-color: rgba(250, 247, 242, 0.08);
    background: rgba(28, 33, 48, 0.7);
    box-shadow:
      0 1px 4px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.03);
  }
}
</style>
