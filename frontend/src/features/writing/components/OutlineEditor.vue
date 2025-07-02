<template>
  <div class="outline-editor">
    <!-- Left: Outline textarea -->
    <div class="outline-column">
      <!-- 题目展示 -->
      <PromptBar
        v-if="prompt"
        :prompt="prompt"
        compact
        @show-image="emit('showImage')"
      />
      <div class="outline-header">
        <h3 class="outline-title">写作大纲</h3>
        <span class="outline-hint">规划你的段落结构和论点</span>
        <button
          v-if="outlineText.trim()"
          class="mode-toggle"
          @click="toggleMode"
        >
          <svg v-if="isPreview" viewBox="0 0 24 24" fill="none">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          {{ isPreview ? '编辑' : '预览' }}
        </button>
      </div>
      <div class="outline-body">
        <div
          v-if="isPreview"
          class="outline-preview markdown-content"
          v-html="renderedOutline"
          @dblclick="toggleMode"
          @mouseup="handlePreviewSelection"
        ></div>
        <textarea
          v-else
          ref="textareaRef"
          v-model="outlineText"
          class="outline-textarea"
          placeholder="在这里列出你的大纲...&#10;&#10;例如：&#10;Introduction: 引出话题，表明立场&#10;Body 1: 第一个论点 + 例子&#10;Body 2: 第二个论点 + 例子&#10;Conclusion: 总结观点"
          @mouseup="handleTextareaSelection"
          @keyup="handleTextareaSelection"
        ></textarea>
      </div>
      <div class="outline-actions">
        <button
          class="save-btn"
          :disabled="!canSave"
          @click="handleSave"
        >
          确认大纲，开始写作
        </button>
      </div>
    </div>

    <!-- Right: AI Chat Panel -->
    <div class="chat-column">
      <AiChatPanel
        ref="chatRef"
        title="AI 大纲助手"
        placeholder="让 AI 帮你优化大纲..."
        empty-hint="选中文本后可问答或修改；也可直接输入问题"
        :ask-handler="handleAsk"
        :edit-handler="handleEdit"
        :support-edit="hasEditHandler"
        @replace="handleReplace"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import type { WritingPrompt } from '@/shared/types/writing'
import { formatMarkdown } from '@/shared/utils/markdown'
import PromptBar from './PromptBar.vue'
import AiChatPanel from './AiChatPanel.vue'

const props = defineProps<{
  initialOutline?: string
  askHandler?: (message: string, selectedText?: string) => Promise<string>
  editHandler?: (selectedText: string, instruction: string) => Promise<{ reply: string; modified: string }>
  prompt?: WritingPrompt
}>()

const emit = defineEmits<{
  (e: 'save', outline: string): void
  (e: 'showImage'): void
}>()

const outlineText = ref(props.initialOutline || '')
const isPreview = ref(!!props.initialOutline)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const chatRef = ref<InstanceType<typeof AiChatPanel> | null>(null)

// Selection tracking
const selectedText = ref('')
const selectionRange = ref<{ start: number; end: number } | null>(null)

const hasEditHandler = computed(() => !!props.editHandler)

const canSave = computed(() => {
  return outlineText.value.trim().length > 0
})

const renderedOutline = computed(() => {
  return formatMarkdown(outlineText.value)
})

function toggleMode() {
  isPreview.value = !isPreview.value
  if (!isPreview.value) {
    nextTick(() => textareaRef.value?.focus())
  }
}

function handleSave() {
  if (!canSave.value) return
  emit('save', outlineText.value)
}

// ── Selection handlers ──

function handleTextareaSelection() {
  const textarea = textareaRef.value
  if (!textarea) return

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const text = outlineText.value.substring(start, end).trim()

  if (text) {
    selectedText.value = text
    selectionRange.value = { start, end }
    chatRef.value?.setSelectedText(text)
  } else {
    clearSelection()
  }
}

function handlePreviewSelection() {
  const selection = window.getSelection()
  const text = selection?.toString().trim() || ''

  if (text) {
    selectedText.value = text
    // Find the text in the raw outline for replacement
    const idx = outlineText.value.indexOf(text)
    if (idx !== -1) {
      selectionRange.value = { start: idx, end: idx + text.length }
    } else {
      selectionRange.value = null
    }
    chatRef.value?.setSelectedText(text)
  } else {
    clearSelection()
  }
}

function clearSelection() {
  selectedText.value = ''
  selectionRange.value = null
}

// ── Chat handlers ──

async function handleAsk(question: string, chatSelectedText?: string) {
  if (!props.askHandler) throw new Error('No askHandler provided')
  return await props.askHandler(question, chatSelectedText)
}

async function handleEdit(editSelectedText: string, instruction: string) {
  if (!props.editHandler) throw new Error('No editHandler provided')
  return await props.editHandler(editSelectedText, instruction)
}

function handleReplace(newText: string) {
  const range = selectionRange.value
  if (range) {
    outlineText.value =
      outlineText.value.substring(0, range.start) +
      newText +
      outlineText.value.substring(range.end)
    isPreview.value = true
  } else if (selectedText.value) {
    // Fallback: find by string match
    const idx = outlineText.value.indexOf(selectedText.value)
    if (idx !== -1) {
      outlineText.value =
        outlineText.value.substring(0, idx) +
        newText +
        outlineText.value.substring(idx + selectedText.value.length)
      isPreview.value = true
    }
  }
  clearSelection()
}

onMounted(() => {
  textareaRef.value?.focus()
})

defineExpose({
  getOutline: () => outlineText.value,
  setOutline: (text: string) => { outlineText.value = text }
})
</script>

<style src="@/shared/styles/markdown-content.css"></style>
<style scoped>
.outline-editor {
  flex: 1;
  display: flex;
  min-height: 0;
  overflow: hidden;
}

/* ── Outline Column ── */
.outline-column {
  flex: 6;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.outline-header {
  padding: 14px 20px;
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-shrink: 0;
}

.outline-title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 15px;
  font-weight: 600;
  color: rgba(250, 247, 242, 0.85);
}

.outline-hint {
  flex: 1;
  font-family: var(--font-ui);
  font-size: 12px;
  color: rgba(250, 247, 242, 0.3);
}

.mode-toggle {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 12px;
  font-family: var(--font-ui);
  font-size: 11px;
  font-weight: 500;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: var(--radius-full);
  color: rgba(250, 247, 242, 0.45);
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.mode-toggle svg {
  width: 12px;
  height: 12px;
}

.mode-toggle:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(250, 247, 242, 0.7);
  border-color: rgba(255, 255, 255, 0.12);
}

.outline-body {
  flex: 1;
  padding: 0 16px;
  min-height: 0;
}

.outline-textarea {
  width: 100%;
  height: 100%;
  padding: 20px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-default);
  color: rgba(250, 247, 242, 0.85);
  font-family: var(--font-serif);
  font-size: 15px;
  line-height: 1.9;
  resize: none;
  box-sizing: border-box;
  transition: border-color 0.3s ease;
}

.outline-textarea:focus {
  outline: none;
  border-color: rgba(59, 130, 246, 0.3);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.06);
}

.outline-textarea::placeholder {
  color: rgba(250, 247, 242, 0.22);
  font-style: italic;
}

/* ── Preview ── */
.outline-preview {
  width: 100%;
  height: 100%;
  padding: 20px;
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-default);
  color: rgba(250, 247, 242, 0.8);
  font-family: var(--font-serif);
  font-size: 14px;
  line-height: 1.85;
  overflow-y: auto;
  box-sizing: border-box;
  cursor: default;
}

/* markdown styles: inherits from markdown-content.css */

.outline-actions {
  padding: 14px 20px;
  display: flex;
  justify-content: flex-end;
  flex-shrink: 0;
}

.save-btn {
  padding: 10px 24px;
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 600;
  background: linear-gradient(135deg, var(--primitive-azure-500), var(--primitive-azure-600));
  border: none;
  border-radius: var(--radius-sm);
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 10px rgba(59, 130, 246, 0.2);
  letter-spacing: 0.02em;
}

.save-btn:hover:not(:disabled) {
  filter: brightness(1.1);
  box-shadow: 0 4px 16px rgba(59, 130, 246, 0.3);
}

.save-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  box-shadow: none;
}

/* ── Chat Column ── */
.chat-column {
  flex: 4;
  min-width: 0;
  border-left: 1px solid rgba(255, 255, 255, 0.06);
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* ── Mobile ── */
@media (max-width: 768px) {
  .outline-editor {
    flex-direction: column;
    flex: none;
  }

  .outline-column {
    flex: none;
    min-height: 300px;
  }

  .chat-column {
    flex: none;
    width: 100%;
    border-left: none;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }
}

@media (max-width: 1024px) {
  .outline-column {
    flex: 5;
  }

  .chat-column {
    flex: 5;
  }
}
</style>
