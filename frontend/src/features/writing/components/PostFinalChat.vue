<template>
  <div class="post-final-chat">
    <header class="chat-header">
      <h3 class="chat-title">向 AI 提问</h3>
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
        <div class="message-content" v-html="formatMessage(message.content)"></div>
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
        <p>有问题想问 AI？在下方输入你的问题</p>
      </div>
    </div>

    <!-- Input Area -->
    <div class="chat-input">
      <div v-if="selectedText" class="selected-text-preview">
        <span class="preview-label">选中文本：</span>
        <span class="preview-text">{{ truncatedSelectedText }}</span>
        <button class="clear-selection" @click="clearSelection">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            <path d="M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="input-row">
        <input
          ref="inputRef"
          v-model="inputText"
          type="text"
          placeholder="输入问题..."
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

const props = defineProps<{
  essayContext: string
}>()

const emit = defineEmits<{
  (e: 'ask', question: string, selectedText?: string): Promise<string>
}>()

const messages = ref<ChatMessage[]>([])
const inputText = ref('')
const selectedText = ref('')
const isLoading = ref(false)
const messagesRef = ref<HTMLDivElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)

const canSend = computed(() => {
  return inputText.value.trim().length > 0 && !isLoading.value
})

const truncatedSelectedText = computed(() => {
  if (selectedText.value.length > 50) {
    return selectedText.value.substring(0, 50) + '...'
  }
  return selectedText.value
})

function formatMessage(content: string): string {
  return content
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
}

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
  isLoading.value = true
  try {
    const answer = await emit('ask', question, selected)

    const assistantMessage: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: answer,
      timestamp: new Date().toISOString()
    }
    messages.value.push(assistantMessage)
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
}

function scrollToBottom() {
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}

// Expose method to set selected text from parent
defineExpose({
  setSelectedText: (text: string) => {
    selectedText.value = text
    inputRef.value?.focus()
  }
})
</script>

<style scoped>
.post-final-chat {
  background: rgba(250, 247, 242, 0.02);
  border: 1px solid rgba(250, 247, 242, 0.05);
  border-radius: var(--radius-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 500px;
}

/* ── Header ── */
.chat-header {
  padding: 14px 16px;
  background: rgba(0, 0, 0, 0.2);
  border-bottom: 1px solid rgba(250, 247, 242, 0.05);
}

.chat-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--primitive-paper-200);
}

/* ── Messages ── */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 200px;
}

.message {
  max-width: 85%;
  padding: 10px 14px;
  border-radius: var(--radius-md);
}

.message.user {
  align-self: flex-end;
  background: var(--primitive-azure-500);
  color: white;
}

.message.assistant {
  align-self: flex-start;
  background: rgba(250, 247, 242, 0.05);
  color: var(--primitive-paper-300);
}

.message-quote {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-bottom: 8px;
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--primitive-paper-400);
}

.message-quote svg {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  margin-top: 2px;
}

.message-content {
  font-size: 14px;
  line-height: 1.6;
}

.message-content :deep(strong) {
  font-weight: 600;
}

/* Loading dots */
.message-content.loading {
  display: flex;
  gap: 4px;
  padding: 8px 0;
}

.loading-dot {
  width: 8px;
  height: 8px;
  background: var(--primitive-paper-400);
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
  gap: 12px;
  text-align: center;
  color: var(--primitive-ink-400);
}

.empty-state svg {
  width: 40px;
  height: 40px;
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
  font-size: 14px;
}

/* ── Input ── */
.chat-input {
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.2);
  border-top: 1px solid rgba(250, 247, 242, 0.05);
}

.selected-text-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  padding: 6px 10px;
  background: rgba(59, 130, 246, 0.1);
  border-radius: var(--radius-sm);
  font-size: 12px;
}

.preview-label {
  color: var(--primitive-azure-400);
  flex-shrink: 0;
}

.preview-text {
  color: var(--primitive-paper-300);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  color: var(--primitive-paper-400);
  cursor: pointer;
  transition: all 0.2s ease;
}

.clear-selection svg {
  width: 12px;
  height: 12px;
}

.clear-selection:hover {
  background: rgba(250, 247, 242, 0.1);
}

.input-row {
  display: flex;
  gap: 8px;
}

.input-row input {
  flex: 1;
  padding: 10px 14px;
  background: rgba(250, 247, 242, 0.05);
  border: 1px solid rgba(250, 247, 242, 0.1);
  border-radius: var(--radius-sm);
  color: var(--primitive-paper-200);
  font-size: 14px;
}

.input-row input:focus {
  outline: none;
  border-color: var(--primitive-azure-500);
}

.input-row input::placeholder {
  color: var(--primitive-ink-400);
}

.send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: var(--primitive-azure-500);
  border: none;
  border-radius: var(--radius-sm);
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.send-btn svg {
  width: 18px;
  height: 18px;
}

.send-btn:hover:not(:disabled) {
  background: var(--primitive-azure-600);
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
