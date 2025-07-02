<template>
  <div class="prompt-notes">
    <div class="notes-content">
      <textarea
        v-if="isEditing"
        ref="textareaRef"
        v-model="localNotes"
        class="notes-textarea"
        placeholder="记录本题的学习心得..."
        rows="6"
        @keydown.ctrl.enter="saveNotes"
        @keydown.meta.enter="saveNotes"
      ></textarea>
      <p v-else-if="notes" class="notes-text">{{ notes }}</p>
      <p v-else class="notes-empty">点击添加笔记...</p>
    </div>

    <div v-if="isEditing" class="notes-actions">
      <span class="hint">Ctrl+Enter 保存</span>
      <div class="action-btns">
        <button class="btn btn--secondary" @click="cancelEdit">取消</button>
        <button class="btn btn--primary" :disabled="isSaving" @click="saveNotes">
          {{ isSaving ? '保存中...' : '保存' }}
        </button>
      </div>
    </div>
    <div v-else class="notes-actions">
      <button class="edit-btn" @click="startEdit">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M11 4H4C3.46957 4 2.96086 4.21071 2.58579 4.58579C2.21071 4.96086 2 5.46957 2 6V20C2 20.5304 2.21071 21.0391 2.58579 21.4142C2.96086 21.7893 3.46957 22 4 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M18.5 2.50001C18.8978 2.10219 19.4374 1.87869 20 1.87869C20.5626 1.87869 21.1022 2.10219 21.5 2.50001C21.8978 2.89784 22.1213 3.4374 22.1213 4.00001C22.1213 4.56262 21.8978 5.10219 21.5 5.50001L12 15L8 16L9 12L18.5 2.50001Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        编辑
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { logger } from '@/shared/utils/logger'

const props = defineProps<{
  notes: string | null
  promptId: number
}>()

const emit = defineEmits<{
  (e: 'save', promptId: number, notes: string): Promise<void>
}>()

const isEditing = ref(false)
const isSaving = ref(false)
const localNotes = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

// 当 promptId 变化时重置编辑状态
watch(() => props.promptId, () => {
  isEditing.value = false
  localNotes.value = ''
})

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

async function saveNotes() {
  if (isSaving.value) return

  isSaving.value = true
  try {
    await emit('save', props.promptId, localNotes.value)
    isEditing.value = false
  } catch (e) {
    logger.error('保存笔记失败:', e)
    alert('保存失败，请重试')
  } finally {
    isSaving.value = false
  }
}
</script>

<style scoped>
.prompt-notes {
  display: flex;
  flex-direction: column;
  padding: 16px;
  height: 100%;
}

/* ── Content ── */
.notes-content {
  flex: 1;
  min-height: 0;
}

.notes-textarea {
  width: 100%;
  height: 100%;
  min-height: 150px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-sm);
  color: rgba(250, 247, 242, 0.85);
  font-family: var(--font-serif);
  font-size: 13px;
  line-height: 1.7;
  resize: none;
  transition: border-color 0.2s ease;
}

.notes-textarea:focus {
  outline: none;
  border-color: rgba(59, 130, 246, 0.3);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.06);
}

.notes-textarea::placeholder {
  color: rgba(250, 247, 242, 0.22);
  font-style: italic;
}

.notes-text {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 13px;
  line-height: 1.75;
  color: rgba(250, 247, 242, 0.65);
  white-space: pre-wrap;
}

.notes-empty {
  margin: 0;
  font-family: var(--font-ui);
  font-size: 12px;
  color: rgba(250, 247, 242, 0.25);
  font-style: italic;
  cursor: pointer;
  transition: color 0.2s ease;
}

.notes-empty:hover {
  color: rgba(250, 247, 242, 0.45);
}

/* ── Actions ── */
.notes-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  flex-shrink: 0;
}

.hint {
  font-family: var(--font-ui);
  font-size: 10px;
  color: rgba(250, 247, 242, 0.25);
  letter-spacing: 0.02em;
}

.action-btns {
  display: flex;
  gap: 8px;
}

.edit-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  font-family: var(--font-ui);
  font-size: 11px;
  font-weight: 500;
  border: none;
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(250, 247, 242, 0.4);
  cursor: pointer;
  transition: all 0.2s ease;
  margin-left: auto;
}

.edit-btn svg {
  width: 12px;
  height: 12px;
}

.edit-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(250, 247, 242, 0.7);
}

.btn {
  padding: 7px 14px;
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 500;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn--secondary {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(250, 247, 242, 0.55);
}

.btn--secondary:hover {
  background: rgba(255, 255, 255, 0.1);
}

.btn--primary {
  background: var(--primitive-azure-500);
  color: white;
}

.btn--primary:hover:not(:disabled) {
  filter: brightness(1.1);
}

.btn--primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
