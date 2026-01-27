<template>
  <div
    class="question-row"
    :class="{ 'is-active': isActive }"
    :data-question-id="question.id"
    @click="handleSelect"
  >
    <!-- Question Content -->
    <div v-show="!showEditInput" class="question-content">
      <span class="question-indicator">Q</span>
      <p class="question-text">{{ question.question_text }}</p>

      <div class="question-actions">
        <button
          class="mini-btn mini-btn--edit"
          @click.stop="showEditInput = true"
          title="编辑问题"
        >
          <AppIcon name="edit" />
        </button>
        <button
          class="mini-btn mini-btn--delete"
          @click.stop="handleDelete"
          title="删除问题"
        >
          <AppIcon name="delete" />
        </button>
      </div>
    </div>

    <!-- Edit Form -->
    <Transition name="edit-slide">
      <div v-if="showEditInput" class="edit-form" @click.stop>
        <textarea
          v-model="editText"
          ref="editInputRef"
          class="edit-textarea"
          placeholder="输入问题内容"
          rows="3"
          @keyup.enter.exact="submitEdit"
          @keyup.escape="cancelEdit"
          @blur="submitEdit"
        />
        <div class="edit-toolbar">
          <button class="toolbar-btn toolbar-btn--confirm" @click="submitEdit">
            <AppIcon name="check" />
            <span>确认</span>
          </button>
          <button class="toolbar-btn toolbar-btn--cancel" @click="cancelEdit">
            <AppIcon name="close" />
            <span>取消</span>
          </button>
        </div>
      </div>
    </Transition>
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

// Context state and methods
const {
  selectedQuestionId,
  selectQuestion,
  editQuestion,
  deleteQuestion
} = useSpeakingContext()

// Computed active state
const isActive = computed(() => selectedQuestionId.value === props.question.id)

// Edit state
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

// Watchers
watch(showEditInput, val => {
  if (val) {
    nextTick(() => {
      editInputRef.value?.focus()
      editInputRef.value?.select()
    })
  }
})

watch(() => props.question.question_text, (newText) => {
  editText.value = newText
})
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   Question Row - Minimal List Item Style
   ═══════════════════════════════════════════════════════════════════════════ */

.question-row {
  position: relative;
  background: white;
  border: 1px solid var(--primitive-paper-300);
  border-radius: 8px;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.2s ease;
}

.question-row:hover {
  border-color: var(--primitive-paper-400);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.question-row.is-active {
  background: linear-gradient(
    135deg,
    rgba(139, 105, 20, 0.06) 0%,
    rgba(184, 134, 11, 0.04) 100%
  );
  border-color: var(--primitive-copper-400);
  box-shadow:
    0 2px 12px rgba(139, 105, 20, 0.12),
    inset 0 0 0 1px rgba(139, 105, 20, 0.08);
}

.question-row.is-active:hover {
  border-color: var(--primitive-copper-500);
}

/* ── Question Content ── */
.question-content {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
}

.question-indicator {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;

  font-family: var(--font-serif);
  font-size: 11px;
  font-weight: 600;
  color: var(--primitive-ink-400);

  background: var(--primitive-paper-200);
  border-radius: 4px;

  transition: all 0.2s ease;
}

.question-row.is-active .question-indicator {
  background: var(--primitive-copper-500);
  color: white;
}

.question-text {
  flex: 1;
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--primitive-ink-600);
  word-break: break-word;
  white-space: pre-line;
}

.question-row.is-active .question-text {
  color: var(--primitive-ink-800);
  font-weight: 500;
}

/* ── Question Actions ── */
.question-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  opacity: 0;
  transform: translateX(6px);
  transition: all 0.15s ease;
}

.question-row:hover .question-actions,
.question-row.is-active .question-actions {
  opacity: 1;
  transform: translateX(0);
}

.mini-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;

  background: white;
  border: 1px solid var(--primitive-paper-300);
  border-radius: 5px;

  cursor: pointer;
  transition: all 0.15s ease;
}

.mini-btn:hover {
  transform: translateY(-1px);
}

.mini-btn--edit {
  color: var(--primitive-copper-500);
}

.mini-btn--edit:hover {
  background: var(--primitive-copper-50);
  border-color: var(--primitive-copper-200);
}

.mini-btn--delete {
  color: var(--primitive-brick-400);
}

.mini-btn--delete:hover {
  background: var(--primitive-brick-50);
  border-color: var(--primitive-brick-200);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Edit Form
   ═══════════════════════════════════════════════════════════════════════════ */

.edit-form {
  padding: 12px;
  background: var(--primitive-paper-50);
  border-top: 1px solid var(--primitive-paper-200);
}

.edit-textarea {
  width: 100%;
  padding: 10px 12px;

  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.5;
  color: var(--primitive-ink-800);

  background: white;
  border: 1px solid var(--primitive-paper-400);
  border-radius: 6px;

  resize: vertical;
  min-height: 70px;
  box-sizing: border-box;
  transition: all 0.15s ease;
}

.edit-textarea:focus {
  outline: none;
  border-color: var(--primitive-copper-400);
  box-shadow: 0 0 0 2px rgba(139, 105, 20, 0.1);
}

.edit-textarea::placeholder {
  color: var(--primitive-ink-300);
}

.edit-toolbar {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;

  font-size: 12px;
  font-weight: 500;

  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.toolbar-btn--confirm {
  background: linear-gradient(
    135deg,
    var(--primitive-olive-500),
    var(--primitive-olive-600)
  );
  color: white;
  box-shadow: 0 2px 6px rgba(93, 122, 93, 0.25);
}

.toolbar-btn--confirm:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(93, 122, 93, 0.3);
}

.toolbar-btn--cancel {
  background: var(--primitive-paper-200);
  color: var(--primitive-ink-600);
}

.toolbar-btn--cancel:hover {
  background: var(--primitive-paper-300);
  color: var(--primitive-ink-800);
}

/* Edit slide transition */
.edit-slide-enter-active,
.edit-slide-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.edit-slide-enter-from,
.edit-slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Mobile Adjustments
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 480px) {
  .question-content {
    padding: 8px 10px;
    gap: 8px;
  }

  .question-indicator {
    width: 18px;
    height: 18px;
    font-size: 10px;
  }

  .question-text {
    font-size: 12px;
  }

  /* Always show actions on mobile */
  .question-actions {
    opacity: 1;
    transform: translateX(0);
  }

  .mini-btn {
    width: 20px;
    height: 20px;
  }

  /* Disable hover effects on mobile */
  .question-row:hover {
    border-color: var(--primitive-paper-300);
    box-shadow: none;
  }

  .question-row:active {
    background: var(--primitive-paper-100);
  }

  .question-row.is-active:hover {
    border-color: var(--primitive-copper-400);
  }

  .edit-form {
    padding: 10px;
  }

  .edit-textarea {
    min-height: 60px;
    padding: 8px 10px;
    font-size: 12px;
  }

  .toolbar-btn {
    padding: 5px 10px;
    font-size: 11px;
  }
}
</style>
