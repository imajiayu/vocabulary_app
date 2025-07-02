<template>
  <div class="ai-chat-panel">
    <header v-if="title" class="chat-header">
      <h3 class="chat-title">{{ title }}</h3>
    </header>

    <!-- Chat Messages -->
    <div class="chat-messages" ref="messagesRef">
      <div
        v-for="message in messages"
        :key="message.id"
        class="message"
        :class="message.role"
      >
        <div v-if="message.selectedText" class="message-quote">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M3 21C3 21 7 17 7 13V5H3V13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M15 21C15 21 19 17 19 13V5H15V13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>{{ message.selectedText }}</span>
        </div>
        <div class="message-content markdown-content" v-html="formatMarkdown(message.content)"></div>
      </div>

      <!-- Loading indicator -->
      <div v-if="isLoading" class="message assistant">
        <div class="message-content loading">
          <span class="loading-dot"></span>
          <span class="loading-dot"></span>
          <span class="loading-dot"></span>
        </div>
      </div>

      <!-- Empty state -->
      <div v-if="messages.length === 0 && !isLoading" class="empty-state">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <p>{{ emptyHint }}</p>
      </div>
    </div>

    <!-- Input Area -->
    <div class="chat-input">
      <div v-if="selectedText" class="selected-text-preview">
        <div class="preview-header">
          <span class="preview-label">选中文本</span>
          <div v-if="supportEdit" class="mode-toggle">
            <button
              class="mode-btn"
              :class="{ active: mode === 'ask' }"
              @click="mode = 'ask'"
            >问</button>
            <button
              class="mode-btn"
              :class="{ active: mode === 'edit' }"
              @click="mode = 'edit'"
            >改</button>
          </div>
          <button class="clear-selection" @click="clearSelection">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <path d="M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
        <div class="preview-body" :class="{ expanded: isSelectionExpanded }">
          <span class="preview-text">{{ selectedText }}</span>
        </div>
        <button
          v-if="isTextLong"
          class="expand-toggle"
          @click="isSelectionExpanded = !isSelectionExpanded"
        >{{ isSelectionExpanded ? '收起' : '展开' }}</button>
      </div>
      <div class="input-row">
        <input
          ref="inputRef"
          v-model="inputText"
          type="text"
          :placeholder="placeholder"
          :disabled="isLoading"
          @keyup.enter="sendMessage"
        />
        <button
          class="send-btn"
          :disabled="!canSend"
          @click="sendMessage"
        >
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import type { ChatMessage } from '@/shared/types/writing'
import { formatMarkdown } from '@/shared/utils/markdown'

export type ChatMode = 'ask' | 'edit'

export type EditResult = string | { reply: string; modified: string }

const props = withDefaults(defineProps<{
  title?: string
  placeholder?: string
  emptyHint?: string
  supportEdit?: boolean
  askHandler?: (question: string, selectedText?: string) => Promise<string>
  editHandler?: (selectedText: string, instruction: string) => Promise<EditResult>
}>(), {
  title: '向 AI 提问',
  placeholder: '输入问题...',
  emptyHint: '有问题想问 AI？在下方输入你的问题',
  supportEdit: false
})

const emit = defineEmits<{
  (e: 'replace', text: string): void
}>()

const messages = ref<ChatMessage[]>([])
const inputText = ref('')
const selectedText = ref('')
const mode = ref<ChatMode>('ask')
const isLoading = ref(false)
const isSelectionExpanded = ref(false)
const messagesRef = ref<HTMLDivElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)

const canSend = computed(() => {
  return inputText.value.trim().length > 0 && !isLoading.value
})

const isTextLong = computed(() => {
  return selectedText.value.length > 80
})

async function sendMessage() {
  if (!canSend.value) return

  const question = inputText.value.trim()
  const selected = selectedText.value || undefined

  // Add user message
  const userMessage: ChatMessage = {
    id: `user-${Date.now()}`,
    role: 'user',
    content: question,
    selectedText: selected,
    timestamp: new Date().toISOString()
  }
  messages.value.push(userMessage)

  // Clear input
  inputText.value = ''
  selectedText.value = ''

  // Scroll to bottom
  await nextTick()
  scrollToBottom()

  // Get AI response
  const isEditMode = mode.value === 'edit' && selected
  isLoading.value = true
  try {
    let chatContent: string
    let replaceText: string | null = null

    if (isEditMode && props.editHandler) {
      const result = await props.editHandler(selected!, question)
      if (typeof result === 'object' && result !== null && 'reply' in result) {
        chatContent = result.reply
        replaceText = result.modified
      } else {
        chatContent = `已替换选中文本。\n\n**修改后：**\n${result}`
        replaceText = result as string
      }
    } else {
      if (!props.askHandler) throw new Error('No askHandler provided')
      chatContent = await props.askHandler(question, selected)
    }

    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: chatContent,
      timestamp: new Date().toISOString()
    }
    messages.value.push(assistantMessage)

    // In edit mode, emit replace event
    if (isEditMode && replaceText !== null) {
      emit('replace', replaceText)
    }
  } catch (error) {
    const errorMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '抱歉，获取回答失败，请重试。',
      timestamp: new Date().toISOString()
    }
    messages.value.push(errorMessage)
  } finally {
    isLoading.value = false
    await nextTick()
    scrollToBottom()
  }
}

function clearSelection() {
  selectedText.value = ''
  isSelectionExpanded.value = false
}

function scrollToBottom() {
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}

// Expose methods to parent
defineExpose({
  setSelectedText: (text: string) => {
    selectedText.value = text
    isSelectionExpanded.value = false
    inputRef.value?.focus()
  },
  setMode: (m: ChatMode) => {
    mode.value = m
  },
  clearMessages: () => {
    messages.value = []
  }
})
</script>

<style src="@/shared/styles/markdown-content.css"></style>
<style scoped>
.ai-chat-panel {
  background: rgba(0, 0, 0, 0.15);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

/* ── Header ── */
.chat-header {
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.18);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.chat-title {
  margin: 0;
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 600;
  color: rgba(250, 247, 242, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

/* ── Messages ── */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.08) transparent;
}

.chat-messages::-webkit-scrollbar {
  width: 4px;
}
.chat-messages::-webkit-scrollbar-track {
  background: transparent;
}
.chat-messages::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
}

.message {
  max-width: 88%;
  padding: 10px 14px;
  border-radius: var(--radius-default);
  animation: msgIn 0.2s ease-out;
}

@keyframes msgIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

.message.user {
  align-self: flex-end;
  background: linear-gradient(135deg, var(--primitive-azure-500), var(--primitive-azure-600));
  color: white;
  border-bottom-right-radius: var(--radius-xs);
}

.message.assistant {
  align-self: flex-start;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.05);
  color: rgba(250, 247, 242, 0.75);
  border-bottom-left-radius: var(--radius-xs);
}

.message-quote {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-bottom: 8px;
  padding: 5px 10px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: var(--radius-xs);
  font-family: var(--font-ui);
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
}

.message-quote svg {
  width: 11px;
  height: 11px;
  flex-shrink: 0;
  margin-top: 1px;
  opacity: 0.6;
}

/* markdown styles: inherits from markdown-content.css */
.message-content {
  font-family: var(--font-serif);
  font-size: 13px;
  line-height: 1.7;
}

/* Chat-specific overrides */
.message-content :deep(em) {
  color: rgba(56, 189, 248, 0.7);
}

.message.user .message-content :deep(em) {
  color: rgba(255, 255, 255, 0.85);
}

.message-content :deep(blockquote) {
  border-left-color: rgba(56, 189, 248, 0.4);
}

/* Loading dots */
.message-content.loading {
  display: flex;
  gap: 5px;
  padding: 6px 0;
}

.loading-dot {
  width: 6px;
  height: 6px;
  background: rgba(250, 247, 242, 0.35);
  border-radius: 50%;
  animation: loadingBounce 1.4s infinite ease-in-out both;
}

.loading-dot:nth-child(1) { animation-delay: -0.32s; }
.loading-dot:nth-child(2) { animation-delay: -0.16s; }

@keyframes loadingBounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

/* Empty state */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
}

.empty-state svg {
  width: 32px;
  height: 32px;
  color: rgba(250, 247, 242, 0.15);
}

.empty-state p {
  margin: 0;
  font-family: var(--font-ui);
  font-size: 12px;
  color: rgba(250, 247, 242, 0.25);
  max-width: 200px;
  line-height: 1.5;
}

/* ── Input ── */
.chat-input {
  padding: 10px 14px;
  background: rgba(0, 0, 0, 0.18);
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.selected-text-preview {
  margin-bottom: 8px;
  background: rgba(59, 130, 246, 0.08);
  border: 1px solid rgba(59, 130, 246, 0.12);
  border-radius: var(--radius-xs);
  font-family: var(--font-ui);
  font-size: 11px;
}

.preview-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
}

.preview-label {
  color: rgba(56, 189, 248, 0.6);
  flex-shrink: 0;
  flex: 1;
}

.preview-body {
  padding: 0 10px 6px;
  max-height: 2.4em;
  overflow: hidden;
  transition: max-height 0.2s ease;
}

.preview-body.expanded {
  max-height: 200px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.08) transparent;
}

.preview-text {
  color: rgba(250, 247, 242, 0.6);
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
}

.expand-toggle {
  display: block;
  width: 100%;
  padding: 3px 10px;
  border: none;
  border-top: 1px solid rgba(59, 130, 246, 0.08);
  background: transparent;
  color: rgba(56, 189, 248, 0.5);
  font-family: var(--font-ui);
  font-size: 10px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.15s ease;
}

.expand-toggle:hover {
  color: rgba(56, 189, 248, 0.8);
}

.mode-toggle {
  display: flex;
  gap: 1px;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.04);
  border-radius: var(--radius-xs);
  padding: 2px;
}

.mode-btn {
  padding: 2px 8px;
  font-family: var(--font-ui);
  font-size: 10px;
  font-weight: 600;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: rgba(250, 247, 242, 0.4);
  cursor: pointer;
  transition: all 0.15s ease;
}

.mode-btn.active {
  background: var(--primitive-azure-500);
  color: white;
}

.mode-btn:hover:not(.active) {
  color: rgba(250, 247, 242, 0.6);
}

.clear-selection {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: rgba(250, 247, 242, 0.4);
  cursor: pointer;
  transition: all 0.15s ease;
}

.clear-selection svg {
  width: 10px;
  height: 10px;
}

.clear-selection:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(250, 247, 242, 0.7);
}

.input-row {
  display: flex;
  gap: 8px;
}

.input-row input {
  flex: 1;
  padding: 9px 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: var(--radius-sm);
  color: rgba(250, 247, 242, 0.88);
  font-family: var(--font-ui);
  font-size: 13px;
  transition: border-color 0.2s ease;
}

.input-row input:focus {
  outline: none;
  border-color: rgba(59, 130, 246, 0.4);
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.06);
}

.input-row input::placeholder {
  color: rgba(250, 247, 242, 0.25);
}

.send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  background: linear-gradient(135deg, var(--primitive-azure-500), var(--primitive-azure-600));
  border: none;
  border-radius: var(--radius-sm);
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.send-btn svg {
  width: 16px;
  height: 16px;
}

.send-btn:hover:not(:disabled) {
  filter: brightness(1.1);
  box-shadow: 0 2px 10px rgba(59, 130, 246, 0.25);
}

.send-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
</style>
