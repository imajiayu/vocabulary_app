<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="handleCancel">
      <div class="modal-content">
        <header class="modal-header">
          <h3 class="modal-title">新建题目</h3>
          <button class="close-btn" @click="handleCancel">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <path d="M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </header>

        <div class="modal-body">
          <!-- Task Type -->
          <div class="form-group">
            <label class="form-label">题目类型</label>
            <div class="task-type-selector">
              <button
                class="type-btn"
                :class="{ 'is-active': taskType === 1 }"
                @click="taskType = 1"
              >
                <span class="type-badge type-badge--t1">T1</span>
                <span class="type-name">Task 1</span>
                <span class="type-desc">20 分钟</span>
              </button>
              <button
                class="type-btn"
                :class="{ 'is-active': taskType === 2 }"
                @click="taskType = 2"
              >
                <span class="type-badge type-badge--t2">T2</span>
                <span class="type-name">Task 2</span>
                <span class="type-desc">40 分钟</span>
              </button>
            </div>
          </div>

          <!-- Folder -->
          <div class="form-group">
            <label class="form-label">文件夹（可选）</label>
            <select v-model="folderId" class="form-select">
              <option :value="null">未分类</option>
              <option
                v-for="folder in folders"
                :key="folder.id"
                :value="folder.id"
              >
                {{ folder.name }}
              </option>
            </select>
          </div>

          <!-- Prompt Text -->
          <div class="form-group">
            <label class="form-label">题目内容</label>
            <textarea
              ref="textareaRef"
              v-model="promptText"
              class="form-textarea"
              rows="6"
              placeholder="输入题目内容..."
            ></textarea>
          </div>

          <!-- Image Upload (Task 1 only) -->
          <div v-if="taskType === 1" class="form-group">
            <label class="form-label">图表图片（可选）</label>
            <div class="image-upload">
              <input
                ref="fileInputRef"
                type="file"
                accept="image/*"
                class="file-input"
                @change="handleImageChange"
              />
              <div v-if="!imagePreview" class="upload-placeholder" @click="triggerFileInput">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M17 8L12 3L7 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                  <path d="M12 3V15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <span>点击上传图片</span>
              </div>
              <div v-else class="image-preview">
                <img :src="imagePreview" alt="Preview" />
                <button class="remove-image" @click="removeImage">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <path d="M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <footer class="modal-footer">
          <button class="btn btn--secondary" @click="handleCancel">取消</button>
          <button
            class="btn btn--primary"
            :disabled="!canSubmit || isSubmitting"
            @click="handleSubmit"
          >
            {{ isSubmitting ? '创建中...' : '创建' }}
          </button>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import type { WritingFolder, CreatePromptPayload } from '@/shared/types/writing'

const props = defineProps<{
  folders: WritingFolder[]
}>()

const emit = defineEmits<{
  (e: 'save', payload: CreatePromptPayload): void
  (e: 'cancel'): void
}>()

// Form state
const taskType = ref<1 | 2>(2)
const folderId = ref<number | null>(null)
const promptText = ref('')
const imageFile = ref<File | null>(null)
const imagePreview = ref<string | null>(null)
const isSubmitting = ref(false)

// Refs
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)

// Computed
const canSubmit = computed(() => {
  return promptText.value.trim().length > 0
})

// Image handling
function triggerFileInput() {
  fileInputRef.value?.click()
}

function handleImageChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) {
    imageFile.value = file
    const reader = new FileReader()
    reader.onload = (e) => {
      imagePreview.value = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }
}

function removeImage() {
  imageFile.value = null
  imagePreview.value = null
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

// Actions
async function handleSubmit() {
  if (!canSubmit.value || isSubmitting.value) return

  isSubmitting.value = true

  const payload: CreatePromptPayload = {
    task_type: taskType.value,
    folder_id: folderId.value,
    prompt_text: promptText.value.trim(),
    image: imageFile.value || undefined
  }

  emit('save', payload)
}

function handleCancel() {
  emit('cancel')
}

// Focus textarea on mount
onMounted(() => {
  nextTick(() => {
    textareaRef.value?.focus()
  })
})
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   Modal Overlay
   ═══════════════════════════════════════════════════════════════════════════ */

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
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--primitive-paper-200);
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
  display: flex;
  flex-direction: column;
  gap: 20px;
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

/* ── Task Type Selector ── */
.task-type-selector {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.type-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px;
  background: rgba(250, 247, 242, 0.03);
  border: 1px solid rgba(250, 247, 242, 0.1);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
}

.type-btn:hover {
  background: rgba(250, 247, 242, 0.05);
}

.type-btn.is-active {
  background: rgba(59, 130, 246, 0.1);
  border-color: var(--primitive-azure-500);
}

.type-badge {
  font-size: 12px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 4px;
}

.type-badge--t1 {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.type-badge--t2 {
  background: rgba(168, 85, 247, 0.15);
  color: #a855f7;
}

.type-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--primitive-paper-200);
}

.type-desc {
  font-size: 12px;
  color: var(--primitive-ink-400);
}

/* ── Select ── */
.form-select {
  padding: 10px 12px;
  background: rgba(250, 247, 242, 0.05);
  border: 1px solid rgba(250, 247, 242, 0.1);
  border-radius: var(--radius-sm);
  color: var(--primitive-paper-200);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.form-select:focus {
  outline: none;
  border-color: var(--primitive-azure-500);
}

.form-select option {
  background: var(--primitive-ink-900);
  color: var(--primitive-paper-200);
}

/* ── Textarea ── */
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

/* ── Image Upload ── */
.image-upload {
  position: relative;
}

.file-input {
  display: none;
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  background: rgba(250, 247, 242, 0.03);
  border: 2px dashed rgba(250, 247, 242, 0.15);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
}

.upload-placeholder:hover {
  background: rgba(250, 247, 242, 0.05);
  border-color: rgba(59, 130, 246, 0.3);
}

.upload-placeholder svg {
  width: 32px;
  height: 32px;
  color: var(--primitive-ink-400);
}

.upload-placeholder span {
  font-size: 13px;
  color: var(--primitive-ink-400);
}

.image-preview {
  position: relative;
  border-radius: var(--radius-md);
  overflow: hidden;
}

.image-preview img {
  width: 100%;
  max-height: 200px;
  object-fit: contain;
  background: rgba(0, 0, 0, 0.2);
}

.remove-image {
  position: absolute;
  top: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.remove-image svg {
  width: 14px;
  height: 14px;
}

.remove-image:hover {
  background: rgba(239, 68, 68, 0.8);
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

/* ═══════════════════════════════════════════════════════════════════════════
   Mobile
   ═══════════════════════════════════════════════════════════════════════════ */

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

  .task-type-selector {
    gap: 8px;
  }

  .type-btn {
    padding: 12px;
  }
}
</style>
