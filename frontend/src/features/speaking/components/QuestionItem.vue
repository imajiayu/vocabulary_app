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
import { useSpeakingContext } from '../composables/useSpeakingContext'

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
   Question Row - Dark Studio Style (Level 3)
   最深层级 - 极简深色行，微妙边框
   ═══════════════════════════════════════════════════════════════════════════ */

.question-row {
  position: relative;
  background: rgba(22, 26, 38, 0.6);
  border: 1px solid rgba(250, 247, 242, 0.05);
  border-radius: 6px;
  cursor: pointer;
  overflow: hidden;
  transition: all 0.2s ease;
}

.question-row:hover {
  background: rgba(26, 30, 44, 0.75);
  border-color: rgba(250, 247, 242, 0.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.question-row.is-active {
  background: linear-gradient(
    135deg,
    rgba(184, 134, 11, 0.12) 0%,
    rgba(139, 105, 20, 0.08) 100%
  );
  border-color: rgba(184, 134, 11, 0.35);
  box-shadow:
    0 2px 12px rgba(184, 134, 11, 0.15),
    inset 0 0 0 1px rgba(184, 134, 11, 0.1);
}

.question-row.is-active:hover {
  border-color: rgba(184, 134, 11, 0.45);
}

/* ── Question Content ── */
.question-content {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 10px;
}

.question-indicator {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;

  font-family: var(--font-serif);
  font-size: 10px;
  font-weight: 600;
  color: var(--primitive-paper-600);

  background: rgba(250, 247, 242, 0.08);
  border-radius: 4px;

  transition: all 0.2s ease;
}

.question-row.is-active .question-indicator {
  background: linear-gradient(
    135deg,
    var(--primitive-gold-500),
    var(--primitive-copper-500)
  );
  color: white;
  box-shadow: 0 2px 6px rgba(184, 134, 11, 0.3);
}

.question-text {
  flex: 1;
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
  color: var(--primitive-paper-400);
  word-break: break-word;
  white-space: pre-line;
}

.question-row:hover .question-text {
  color: var(--primitive-paper-300);
}

.question-row.is-active .question-text {
  color: var(--primitive-paper-200);
  font-weight: 500;
}

/* ── Question Actions ── */
.question-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease;
}

.question-row:hover .question-actions,
.question-row.is-active .question-actions {
  opacity: 1;
  pointer-events: auto;
}

.mini-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;

  background: rgba(250, 247, 242, 0.05);
  border: 1px solid rgba(250, 247, 242, 0.08);
  border-radius: 4px;

  cursor: pointer;
  transition: all 0.15s ease;
}

.mini-btn:hover {
  transform: translateY(-1px);
}

.mini-btn--edit {
  color: var(--primitive-gold-400);
}

.mini-btn--edit:hover {
  background: rgba(184, 134, 11, 0.15);
  border-color: rgba(184, 134, 11, 0.25);
  color: var(--primitive-gold-300);
}

.mini-btn--delete {
  color: var(--primitive-brick-400);
}

.mini-btn--delete:hover {
  background: rgba(155, 59, 59, 0.15);
  border-color: rgba(155, 59, 59, 0.25);
  color: var(--primitive-brick-300);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Edit Form - 深色主题
   ═══════════════════════════════════════════════════════════════════════════ */

.edit-form {
  padding: 10px;
  background: rgba(18, 22, 32, 0.8);
  border-top: 1px solid rgba(250, 247, 242, 0.05);
}

.edit-textarea {
  width: 100%;
  padding: 10px 12px;

  font-family: var(--font-ui);
  font-size: 12px;
  line-height: 1.5;
  color: var(--primitive-paper-200);

  background: rgba(15, 18, 26, 0.9);
  border: 1px solid rgba(250, 247, 242, 0.1);
  border-radius: 6px;

  resize: vertical;
  min-height: 60px;
  box-sizing: border-box;
  transition: all 0.15s ease;
}

.edit-textarea:focus {
  outline: none;
  border-color: var(--primitive-gold-500);
  box-shadow: 0 0 0 2px rgba(184, 134, 11, 0.15);
  background: rgba(18, 22, 32, 0.95);
}

.edit-textarea::placeholder {
  color: var(--primitive-paper-600);
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

  font-size: 11px;
  font-weight: 500;

  border: none;
  border-radius: 5px;
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
  box-shadow: 0 2px 8px rgba(93, 122, 93, 0.3);
}

.toolbar-btn--confirm:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(93, 122, 93, 0.35);
}

.toolbar-btn--cancel {
  background: rgba(250, 247, 242, 0.08);
  color: var(--primitive-paper-400);
  border: 1px solid rgba(250, 247, 242, 0.1);
}

.toolbar-btn--cancel:hover {
  background: rgba(250, 247, 242, 0.12);
  color: var(--primitive-paper-300);
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

@media (max-width: 768px) {
  .question-content {
    padding: 10px;
    gap: 8px;
  }

  .question-indicator {
    width: 18px;
    height: 18px;
    font-size: 9px;
  }

  .question-text {
    font-size: 12px;
  }

  /* Always show actions on mobile */
  .question-actions {
    opacity: 1;
    pointer-events: auto;
  }

  .mini-btn {
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
  }

  .mini-btn svg {
    width: 14px;
    height: 14px;
  }

  /* Disable hover effects on mobile */
  .question-row:hover {
    background: rgba(22, 26, 38, 0.6);
    border-color: rgba(250, 247, 242, 0.05);
    box-shadow: none;
  }

  .question-row:active {
    background: rgba(184, 134, 11, 0.08);
  }

  .question-row.is-active:hover {
    border-color: rgba(184, 134, 11, 0.35);
  }

  .edit-form {
    padding: 10px;
  }

  .edit-textarea {
    min-height: 60px;
    padding: 10px;
    font-size: 12px;
  }

  .toolbar-btn {
    padding: 8px 14px;
    font-size: 11px;
  }
}
</style>
