<template>
  <div
    class="question-item"
    :class="{ active: isActive }"
    :data-question-id="question.id"
    @click="handleSelect"
  >
    <div v-show="!showEditInput" class="question-content">
      <div class="question-text">{{ question.question_text }}</div>
      <div class="question-actions action-btn-group">
        <button
          class="icon-action-btn icon-action-btn--sm icon-action-btn--edit"
          @click.stop="showEditInput = true"
          title="编辑问题"
        >
          <AppIcon name="edit" />
        </button>
        <button
          class="icon-action-btn icon-action-btn--sm icon-action-btn--delete"
          @click.stop="handleDelete"
          title="删除问题"
        >
          <AppIcon name="delete" />
        </button>
      </div>
    </div>

    <!-- 编辑问题输入框 -->
    <div v-if="showEditInput" class="edit-input-container" @click.stop>
      <textarea
        v-model="editText"
        ref="editInputRef"
        placeholder="输入问题内容"
        rows="3"
        @keyup.enter.exact="submitEdit"
        @keyup.escape="cancelEdit"
        @blur="submitEdit"
      />
      <div class="edit-actions">
        <button class="confirm-btn" @click="submitEdit">
          <AppIcon name="check" />
        </button>
        <button class="cancel-btn" @click="cancelEdit">
          <AppIcon name="close" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, computed } from 'vue'
import AppIcon from '@/shared/components/controls/Icons.vue'
import type { Question } from '@/shared/types'
import { useSpeakingContext } from '../composables'

const props = defineProps<{
  question: Question
}>()

// 从 context 获取状态和方法
const {
  selectedQuestionId,
  selectQuestion,
  editQuestion,
  deleteQuestion
} = useSpeakingContext()

// 计算当前问题是否被选中
const isActive = computed(() => selectedQuestionId.value === props.question.id)

// 编辑状态
const showEditInput = ref(false)
const editText = ref(props.question.question_text)
const editInputRef = ref<HTMLTextAreaElement | null>(null)

const submitEdit = async () => {
  const text = editText.value.trim()
  if (text && text !== props.question.question_text) {
    await editQuestion(props.question.id, text)
  }
  showEditInput.value = false
}

const cancelEdit = () => {
  showEditInput.value = false
  editText.value = props.question.question_text
}

const handleDelete = () => {
  deleteQuestion(props.question.id)
}

const handleSelect = () => {
  selectQuestion(props.question)
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

// 监听问题变化更新编辑文本
watch(() => props.question.question_text, (newText) => {
  editText.value = newText
})
</script>

<style scoped>
.question-item {
  margin-bottom: 6px;
  border-radius: var(--radius-default);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  border: 2px solid transparent;
  background: var(--color-bg-glass-light);
  backdrop-filter: blur(8px);
}

.question-item:hover {
  background: var(--color-bg-glass-hover);
  box-shadow: 0 2px 8px var(--color-purple-light);
  border-color: var(--color-purple-light);
}

.question-item.active {
  background: var(--gradient-purple-subtle);
  border-color: var(--color-purple);
  box-shadow: 0 4px 16px var(--color-purple-border);
}

.question-item.active:hover {
  background: var(--gradient-purple-hover);
}

.question-content {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 12px 14px;
  gap: 8px;
}

.question-text {
  flex: 1;
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.5;
  word-break: break-word;
  padding-right: 8px;
  white-space: pre-line;
}

.question-item.active .question-text {
  color: var(--color-text-primary);
  font-weight: 500;
}

/* 按钮组位置覆盖 */
.question-actions {
  flex-shrink: 0;
}

/* hover 和 active 状态显示按钮组 */
.question-item:hover .question-actions,
.question-item.active .question-actions {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(0);
}

.edit-input-container {
  padding: 8px 14px 12px;
  border-top: 1px solid var(--color-purple-light);
  background: rgba(255, 255, 255, 0.95);
  animation: slideIn 0.2s ease-out;

  overflow: hidden;
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

.edit-input-container textarea {
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
  min-height: 60px;
  line-height: 1.4;
}

.edit-input-container textarea:focus {
  outline: none;
  border-color: var(--color-purple-dark);
  box-shadow: 0 0 0 3px var(--color-purple-light);
}

.edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 8px;
}

.confirm-btn,
.cancel-btn {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  font-size: 12px;
}

.confirm-btn {
  background: linear-gradient(135deg, var(--color-success), var(--color-success-hover));
  color: var(--color-text-inverse);
  box-shadow: 0 2px 6px var(--color-success-light);
}

.confirm-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 10px var(--color-success-light);
}

.cancel-btn {
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
}

.cancel-btn:hover {
  background: var(--color-border-medium);
  color: var(--color-text-primary);
  transform: translateY(-1px);
}

@media (max-width: 480px) {
  .question-content {
    padding: 10px 12px;
  }

  .question-text {
    font-size: 12px;
  }

  /* 移动端禁用hover效果，使用触摸反馈 */
  .question-item:hover {
    background: var(--color-bg-glass-light);
    box-shadow: none;
    border-color: transparent;
  }

  .question-item:active {
    background: var(--color-bg-glass);
    transform: scale(0.98);
  }

  .question-item.active:hover {
    background: var(--gradient-purple-subtle);
  }
}
</style>