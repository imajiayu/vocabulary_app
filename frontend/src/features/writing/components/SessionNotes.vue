<template>
  <div class="session-notes">
    <header class="notes-header">
      <h3 class="notes-title">学习笔记</h3>
      <button
        v-if="!isEditing"
        class="edit-btn"
        @click="startEdit"
      >
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M18.5 2.50001C18.8978 2.10219 19.4374 1.87869 20 1.87869C20.5626 1.87869 21.1022 2.10219 21.5 2.50001C21.8978 2.89784 22.1213 3.4374 22.1213 4.00001C22.1213 4.56262 21.8978 5.10219 21.5 5.50001L12 15L8 16L9 12L18.5 2.50001Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </header>

    <div class="notes-content">
      <textarea
        v-if="isEditing"
        ref="textareaRef"
        v-model="localNotes"
        class="notes-textarea"
        placeholder="记录本次练习的心得体会..."
        rows="4"
      ></textarea>
      <p v-else-if="notes" class="notes-text">{{ notes }}</p>
      <p v-else class="notes-empty">点击编辑添加笔记</p>
    </div>

    <div v-if="isEditing" class="notes-actions">
      <button class="btn btn--secondary" @click="cancelEdit">取消</button>
      <button class="btn btn--primary" @click="saveNotes">保存</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'

const props = defineProps<{
  notes: string | null
}>()

const emit = defineEmits<{
  (e: 'save', notes: string): void
}>()

const isEditing = ref(false)
const localNotes = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

function startEdit() {
  localNotes.value = props.notes || ''
  isEditing.value = true
  nextTick(() => {
    textareaRef.value?.focus()
  })
}

function cancelEdit() {
  isEditing.value = false
  localNotes.value = ''
}

function saveNotes() {
  emit('save', localNotes.value)
  isEditing.value = false
}
</script>

<style scoped>
.session-notes {
  background: rgba(250, 247, 242, 0.02);
  border: 1px solid rgba(250, 247, 242, 0.05);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

/* ── Header ── */
.notes-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(250, 247, 242, 0.05);
}

.notes-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--primitive-paper-200);
}

.edit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--primitive-paper-400);
  cursor: pointer;
  transition: all 0.2s ease;
}

.edit-btn svg {
  width: 16px;
  height: 16px;
}

.edit-btn:hover {
  background: rgba(250, 247, 242, 0.1);
  color: var(--primitive-paper-200);
}

/* ── Content ── */
.notes-content {
  padding: 16px;
}

.notes-textarea {
  width: 100%;
  padding: 12px;
  background: rgba(250, 247, 242, 0.03);
  border: 1px solid rgba(250, 247, 242, 0.1);
  border-radius: var(--radius-sm);
  color: var(--primitive-paper-200);
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
  min-height: 100px;
}

.notes-textarea:focus {
  outline: none;
  border-color: var(--primitive-azure-500);
}

.notes-textarea::placeholder {
  color: var(--primitive-ink-400);
}

.notes-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--primitive-paper-300);
  white-space: pre-wrap;
}

.notes-empty {
  margin: 0;
  font-size: 14px;
  color: var(--primitive-ink-400);
  font-style: italic;
}

/* ── Actions ── */
.notes-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.1);
  border-top: 1px solid rgba(250, 247, 242, 0.03);
}

.btn {
  padding: 8px 16px;
  font-size: 13px;
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

.btn--primary:hover {
  background: var(--primitive-azure-600);
}
</style>
