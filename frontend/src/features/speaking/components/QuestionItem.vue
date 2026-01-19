<template>
  <div
    class="question-item"
    :class="{ active: isActive }"
    :data-question-id="question.id"
    @click="selectQuestion"
  >
    <div v-show="!showEditInput" class="question-content">
      <div class="question-text">{{ question.question_text }}</div>
      <div class="question-actions">
        <button 
          class="action-btn edit-btn"
          @click.stop="showEditInput = true"
          title="编辑问题"
        >
          <AppIcon name="edit" />
        </button>
        <button 
          class="action-btn delete-btn"
          @click.stop="confirmDelete"
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
import { ref, nextTick, watch } from 'vue'
import AppIcon from '@/shared/components/controls/Icons.vue'
import type { Question } from '@/shared/types'

interface Props {
  question: Question
  isActive?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  select: [question: Question]
  edit: [data: { id: number, text: string }]
  delete: [data: { id: number }]
}>()

// 编辑状态
const showEditInput = ref(false)
const editText = ref(props.question.question_text)
const editInputRef = ref<HTMLTextAreaElement | null>(null)

const submitEdit = () => {
  const text = editText.value.trim()
  if (text && text !== props.question.question_text) {
    emit('edit', { id: props.question.id, text })
  }
  showEditInput.value = false
}

const cancelEdit = () => {
  showEditInput.value = false
  editText.value = props.question.question_text
}

const confirmDelete = () => {
    emit('delete', { id: props.question.id })
}

const selectQuestion = () => {
  emit('select', props.question)
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
  border-radius: 8px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  border: 2px solid transparent;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(8px);
}

.question-item:hover {
  background: rgba(255, 255, 255, 0.9);
  /* transform: translateX(4px); */
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1);
  border-color: rgba(102, 126, 234, 0.1);
}

.question-item.active {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.15), rgba(118, 75, 162, 0.1));
  border-color: #667eea;
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.2);
  /* transform: translateX(6px); */
}

.question-item.active:hover {
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.2), rgba(118, 75, 162, 0.15));
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
  color: #374151;
  line-height: 1.5;
  word-break: break-word;
  padding-right: 8px;
  white-space: pre-line;
}

.question-item.active .question-text {
  color: #1e293b;
  font-weight: 500;
}

.question-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: all 0.3s ease;
  transform: translateX(8px);
  flex-shrink: 0;
}

.question-item:hover .question-actions {
  opacity: 1;
  transform: translateX(0);
}

.question-item.active .question-actions {
  opacity: 1;
  transform: translateX(0);
}

.action-btn {
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  color: #667eea;
  box-shadow: 0 2px 4px rgba(102, 126, 234, 0.1);
}

.action-btn:hover {
  transform: translateY(-1px) scale(1.1);
  box-shadow: 0 4px 8px rgba(102, 126, 234, 0.2);
  background: white;
}

.edit-btn:hover {
  color: #f59e0b;
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.05));
}

.delete-btn:hover {
  color: #ef4444;
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.05));
}

.edit-input-container {
  padding: 8px 14px 12px;
  border-top: 1px solid rgba(102, 126, 234, 0.1);
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
  border: 2px solid #667eea;
  border-radius: 6px;
  font-size: 13px;
  background: white;
  transition: all 0.2s ease;
  box-shadow: 0 2px 6px rgba(102, 126, 234, 0.15);
  font-family: inherit;
  resize: vertical;
  min-height: 60px;
  line-height: 1.4;
}

.edit-input-container textarea:focus {
  outline: none;
  border-color: #764ba2;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15);
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
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  font-size: 12px;
}

.confirm-btn {
  background: linear-gradient(135deg, #10b981, #059669);
  color: white;
  box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3);
}

.confirm-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(16, 185, 129, 0.4);
}

.cancel-btn {
  background: rgba(156, 163, 175, 0.2);
  color: #6b7280;
}

.cancel-btn:hover {
  background: rgba(156, 163, 175, 0.3);
  color: #374151;
  transform: translateY(-1px);
}

@media (max-width: 768px) {
  .question-content {
    padding: 10px 12px;
  }

  .question-text {
    font-size: 12px;
  }

  .action-btn {
    width: 20px;
    height: 20px;
  }

  /* 移动端始终显示操作按钮 */
  .question-actions {
    opacity: 1;
    transform: translateX(0);
  }

  /* 移动端禁用hover效果，使用触摸反馈 */
  .question-item:hover {
    background: rgba(255, 255, 255, 0.6);
    box-shadow: none;
    border-color: transparent;
  }

  .question-item:active {
    background: rgba(255, 255, 255, 0.8);
    transform: scale(0.98);
  }

  .question-item.active:hover {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.15), rgba(118, 75, 162, 0.1));
  }

  .action-btn:hover {
    transform: none;
    box-shadow: 0 2px 4px rgba(102, 126, 234, 0.1);
    background: rgba(255, 255, 255, 0.9);
  }

  .action-btn:active {
    transform: scale(0.9);
  }
}
</style>