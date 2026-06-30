<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="handleCancel">
      <div class="modal-content">
        <header class="modal-header">
          <h3 class="modal-title">
            <span class="task-badge" :class="prompt.task_type === 1 ? 'task-badge--t1' : 'task-badge--t2'">
              {{ prompt.task_type === 1 ? 'T1' : 'T2' }}
            </span>
            编辑题目
          </h3>
          <button class="close-btn" @click="handleCancel">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <path d="M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </header>

        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">题目内容</label>
            <textarea
              ref="textareaRef"
              v-model="text"
              class="form-textarea"
              rows="6"
              placeholder="输入题目内容..."
              @keydown.meta.enter="handleSubmit"
              @keydown.ctrl.enter="handleSubmit"
            ></textarea>
          </div>
        </div>

        <footer class="modal-footer">
          <button class="btn btn--secondary" @click="handleCancel">取消</button>
          <button
            class="btn btn--primary"
            :disabled="!canSubmit || submitting"
            @click="handleSubmit"
          >
            {{ submitting ? '保存中...' : '保存' }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import type { WritingPrompt } from '@/shared/types/writing'

const props = withDefaults(defineProps<{
  prompt: WritingPrompt
  submitting?: boolean
}>(), {
  submitting: false
})

const emit = defineEmits<{
  (e: 'save', text: string): void
  (e: 'cancel'): void
}>()

const text = ref(props.prompt.prompt_text)
const textareaRef = ref<HTMLTextAreaElement | null>(null)

const canSubmit = computed(() => {
  const trimmed = text.value.trim()
  return trimmed.length > 0 && trimmed !== props.prompt.prompt_text.trim()
})

function handleSubmit() {
  if (!canSubmit.value || props.submitting) return
  emit('save', text.value.trim())
}

function handleCancel() {
  emit('cancel')
}

onMounted(() => {
  nextTick(() => {
    textareaRef.value?.focus()
  })
})
</script>

<style scoped>
/* ── Overlay ── */
.modal-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  z-index: 200;
  padding: 20px;
}

.modal-content {
  width: 100%;
  max-width: 520px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(
    180deg,
    rgba(30, 35, 50, 0.98) 0%,
    rgba(24, 28, 40, 0.98) 100%
  );
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}

/* ── Header ── */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(59, 130, 246, 0.15);
}

.modal-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--primitive-paper-200);
}

.task-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 4px;
}

.task-badge--t1 {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.task-badge--t2 {
  background: rgba(168, 85, 247, 0.15);
  color: #a855f7;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--primitive-paper-400);
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-btn svg {
  width: 18px;
  height: 18px;
}

.close-btn:hover {
  background: rgba(250, 247, 242, 0.1);
  color: var(--primitive-paper-200);
}

/* ── Body ── */
.modal-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--primitive-paper-400);
}

.form-textarea {
  padding: 12px;
  background: rgba(250, 247, 242, 0.05);
  border: 1px solid rgba(250, 247, 242, 0.1);
  border-radius: var(--radius-sm);
  color: var(--primitive-paper-200);
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
  min-height: 120px;
  transition: all 0.2s ease;
}

.form-textarea:focus {
  outline: none;
  border-color: var(--primitive-azure-500);
}

.form-textarea::placeholder {
  color: var(--primitive-ink-400);
}

/* ── Footer ── */
.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  background: rgba(0, 0, 0, 0.2);
  border-top: 1px solid rgba(59, 130, 246, 0.1);
}

.btn {
  padding: 10px 20px;
  font-size: 14px;
  font-weight: 500;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn--secondary {
  background: rgba(250, 247, 242, 0.1);
  color: var(--primitive-paper-300);
}

.btn--secondary:hover {
  background: rgba(250, 247, 242, 0.15);
}

.btn--primary {
  background: var(--primitive-azure-500);
  color: white;
}

.btn--primary:hover:not(:disabled) {
  background: var(--primitive-azure-600);
}

.btn--primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ── Mobile ── */
@media (max-width: 768px) {
  .modal-overlay {
    padding: 0;
    align-items: flex-end;
  }

  .modal-content {
    max-width: 100%;
    max-height: 90vh;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  }
}
</style>
