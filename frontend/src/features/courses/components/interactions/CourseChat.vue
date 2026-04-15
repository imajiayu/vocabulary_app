<template>
  <Teleport to="body">
    <!-- FAB 按钮 -->
    <button
      class="chat-fab"
      :class="{ open: isOpen }"
      :title="isOpen ? '关闭助手' : `问 ${config.chatName}`"
      @click="toggleChat"
    >
      <svg v-if="!isOpen" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path d="M5 4h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-5l-4 3v-3H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
          stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
        <circle cx="8" cy="10" r="1" fill="currentColor"/>
        <circle cx="11" cy="10" r="1" fill="currentColor"/>
        <circle cx="14" cy="10" r="1" fill="currentColor"/>
      </svg>
      <svg v-else viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <path d="m6 6 10 10M16 6 6 16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
    </button>

    <!-- 聊天窗口 -->
    <div v-show="isOpen" class="chat-window" ref="chatWindowRef" :style="windowStyle">
      <!-- 标题栏 -->
      <div class="chat-header" :style="{ background: 'var(--course-accent)' }">
        <span class="chat-header-title">{{ config.chatName }}</span>
        <button class="chat-header-btn" title="清空对话" @click="clearChat">🗑</button>
        <button class="chat-header-btn" title="关闭" @click="toggleChat">×</button>
      </div>

      <!-- 消息列表 -->
      <div class="chat-messages" ref="messagesRef">
        <div v-if="!messages.length" class="chat-welcome">
          你好！我是{{ config.chatName }}。<br />
          有任何关于本节课的问题都可以问我。<br />
          <span class="chat-welcome-hint">提示：选中页面文字后点击"问 AI"可快速提问</span>
        </div>
        <div
          v-for="(msg, i) in messages"
          :key="i"
          class="chat-msg"
          :class="msg.role"
        >
          <div class="chat-bubble" v-if="msg.role === 'user'">{{ msg.content }}</div>
          <div class="chat-bubble" v-else v-html="formatMarkdown(msg.content)">
          </div>
        </div>
        <div v-if="streaming" class="chat-msg assistant">
          <div class="chat-bubble">
            <span v-if="streamContent" v-html="formatMarkdown(streamContent)" />
            <span v-else class="chat-loading" />
          </div>
        </div>
      </div>

      <!-- 输入区 -->
      <div class="chat-input-area">
        <textarea
          ref="textareaRef"
          rows="1"
          placeholder="输入你的问题…"
          v-model="inputText"
          @keydown.enter.exact.prevent="send"
          @input="autoHeight"
        />
        <button class="chat-send-btn" :disabled="!inputText.trim() || streaming" @click="send">
          {{ streaming ? '…' : '发送' }}
        </button>
      </div>
    </div>

    <!-- 选中文本浮动按钮 -->
    <button
      v-show="selBtnVisible"
      class="chat-sel-btn"
      :style="{ left: selBtnPos.x + 'px', top: selBtnPos.y + 'px' }"
      @click.prevent.stop="askAboutSelection"
    >问 AI</button>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, inject, onMounted, onBeforeUnmount, nextTick, computed } from 'vue'
import type { ComputedRef } from 'vue'
import type { CourseConfig } from '../../types/course'
import type { ChatMessage } from '@/shared/services/deepseek'
import { streamDeepSeek } from '@/shared/services/deepseek'
import { formatMarkdown } from '@/shared/utils/markdown'

const config = inject<CourseConfig>('courseConfig')!
const lessonTitleRef = inject<ComputedRef<string>>('lessonTitle')

const isOpen = ref(false)
const messages = ref<ChatMessage[]>([])
const inputText = ref('')
const streaming = ref(false)
const streamContent = ref('')
const messagesRef = ref<HTMLElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const chatWindowRef = ref<HTMLElement | null>(null)
let abortController: AbortController | null = null

// 窗口尺寸
const savedSize = (() => {
  try {
    const raw = localStorage.getItem('course_chat_size')
    if (raw) return JSON.parse(raw) as { w: number; h: number }
  } catch { /* ignore */ }
  return null
})()

const windowStyle = computed(() => ({
  width: (savedSize?.w || 400) + 'px',
  height: (savedSize?.h || 520) + 'px'
}))

// 选中文本
const selBtnVisible = ref(false)
const selBtnPos = ref({ x: 0, y: 0 })
let selectedText = ''

function toggleChat() {
  isOpen.value = !isOpen.value
  if (isOpen.value) nextTick(() => textareaRef.value?.focus())
}

function clearChat() {
  if (streaming.value && abortController) abortController.abort()
  messages.value = []
  streaming.value = false
  streamContent.value = ''
}

function autoHeight() {
  const ta = textareaRef.value
  if (ta) {
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 80) + 'px'
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTop = messagesRef.value.scrollHeight
    }
  })
}

function buildSystemPrompt(): string {
  let prompt = config.chatSystemPrompt
  const title = lessonTitleRef?.value
  if (title) prompt += `\n\n当前课时：${title}`
  return prompt
}

async function send() {
  const text = inputText.value.trim()
  if (!text || streaming.value) return

  inputText.value = ''
  if (textareaRef.value) textareaRef.value.style.height = 'auto'

  messages.value.push({ role: 'user', content: text })
  scrollToBottom()

  streaming.value = true
  streamContent.value = ''
  abortController = new AbortController()

  const apiMessages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt() },
    ...messages.value.slice(-20) // 最近 10 轮
  ]

  let fullContent = ''

  try {
    for await (const chunk of streamDeepSeek(apiMessages, {
      temperature: 0.7,
      signal: abortController.signal
    })) {
      fullContent += chunk
      streamContent.value = fullContent
      scrollToBottom()
    }
  } catch (e) {
    if ((e as Error).name !== 'AbortError') {
      fullContent = fullContent || '出错了，请重试。'
    }
  }

  if (fullContent) {
    messages.value.push({ role: 'assistant', content: fullContent })
  }

  streaming.value = false
  streamContent.value = ''
  abortController = null
  scrollToBottom()
}

// 文本选中交互
function onDocMouseup(e: MouseEvent) {
  if (chatWindowRef.value?.contains(e.target as Node)) return

  setTimeout(() => {
    const sel = window.getSelection()
    const text = sel?.toString().trim() || ''
    if (text.length > 2 && text.length < 500) {
      selectedText = text
      selBtnVisible.value = true
      selBtnPos.value = {
        x: Math.min(e.pageX + 10, window.innerWidth - 80),
        y: e.pageY - 36
      }
    } else {
      selBtnVisible.value = false
      selectedText = ''
    }
  }, 10)
}

function onDocMousedown(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.classList.contains('chat-sel-btn')) {
    selBtnVisible.value = false
  }
}

function askAboutSelection() {
  selBtnVisible.value = false
  if (!isOpen.value) toggleChat()
  inputText.value = `关于以下内容：\n"${selectedText}"\n\n请解释一下。`
  nextTick(() => {
    textareaRef.value?.focus()
    autoHeight()
  })
  selectedText = ''
  window.getSelection()?.removeAllRanges()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isOpen.value) toggleChat()
}

onMounted(() => {
  document.addEventListener('mouseup', onDocMouseup)
  document.addEventListener('mousedown', onDocMousedown)
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('mouseup', onDocMouseup)
  document.removeEventListener('mousedown', onDocMousedown)
  document.removeEventListener('keydown', onKeydown)
  if (abortController) abortController.abort()
})
</script>

<style scoped>
.chat-fab {
  position: fixed;
  bottom: 28px;
  right: 28px;
  z-index: 10000;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--course-accent);
  color: var(--course-accent-on, #fff);
  border: none;
  cursor: pointer;
  display: grid;
  place-items: center;
  box-shadow:
    0 10px 28px -8px var(--course-accent-shadow, rgba(15, 23, 42, 0.3)),
    0 2px 6px -2px rgba(15, 23, 42, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.18);
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s ease, background 0.18s ease;
}

.chat-fab:hover {
  transform: translateY(-2px) scale(1.04);
  background: var(--course-accent-hover);
  box-shadow:
    0 16px 36px -10px var(--course-accent-shadow, rgba(15, 23, 42, 0.35)),
    0 4px 10px -2px rgba(15, 23, 42, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.chat-fab.open {
  transform: scale(1.02) rotate(90deg);
}

.chat-fab svg { width: 20px; height: 20px; }

.chat-window {
  position: fixed;
  bottom: 92px;
  right: 28px;
  z-index: 10001;
  min-width: 340px;
  min-height: 380px;
  max-width: 95vw;
  max-height: 90vh;
  border-radius: 16px;
  background: var(--color-surface-elevated, #fff);
  border: 1px solid var(--color-border-light, rgba(0,0,0,0.08));
  box-shadow:
    0 24px 60px -16px rgba(15, 23, 42, 0.22),
    0 10px 24px -10px rgba(15, 23, 42, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: var(--font-sans);
  font-size: 14px;
  line-height: 1.6;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}

.chat-header-title { flex: 1; }

.chat-header-btn {
  background: none;
  border: none;
  color: rgba(255,255,255,0.85);
  cursor: pointer;
  font-size: 16px;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background 0.15s;
}

.chat-header-btn:hover {
  background: rgba(255,255,255,0.2);
  color: #fff;
}

.chat-messages {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 12px 14px;
  min-height: 0;
}

.chat-msg { margin-bottom: 12px; display: flex; }
.chat-msg.user { justify-content: flex-end; }
.chat-msg.assistant { justify-content: flex-start; }

.chat-bubble {
  max-width: 85%;
  padding: 8px 12px;
  border-radius: 10px;
  word-break: break-word;
  white-space: pre-wrap;
}

.chat-msg.user .chat-bubble {
  background: var(--course-accent);
  color: #fff;
  border-bottom-right-radius: 3px;
}

.chat-msg.assistant .chat-bubble {
  background: var(--course-highlight, #eff6ff);
  color: var(--color-text-primary, #2d2d2d);
  border-bottom-left-radius: 3px;
}

.chat-bubble :deep(code) {
  background: rgba(0,0,0,0.06);
  padding: 1px 4px;
  border-radius: 3px;
  font-family: var(--font-mono, monospace);
  font-size: 0.9em;
}

.chat-msg.user .chat-bubble :deep(code) {
  background: rgba(255,255,255,0.2);
}

.chat-loading::after {
  content: "";
  display: inline-block;
  width: 4px;
  height: 14px;
  background: var(--course-accent);
  margin-left: 2px;
  animation: chat-blink 0.6s infinite;
}

@keyframes chat-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.chat-input-area {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--color-border-medium, #e5e2dd);
  flex-shrink: 0;
  background: var(--color-surface-card, #fff);
}

.chat-input-area textarea {
  flex: 1;
  border: 1px solid var(--color-border-medium, #e5e2dd);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  max-height: 80px;
  min-height: 36px;
  outline: none;
  font-family: inherit;
  background: var(--color-surface-card, #fff);
  color: var(--color-text-primary, #2d2d2d);
  transition: border-color 0.15s;
}

.chat-input-area textarea:focus {
  border-color: var(--course-accent);
}

.chat-send-btn {
  background: var(--course-accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 8px 14px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  transition: opacity 0.15s;
}

.chat-send-btn:hover { opacity: 0.9; }
.chat-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.chat-welcome {
  text-align: center;
  color: var(--color-text-secondary, #666);
  padding: 20px 10px;
  font-size: 13px;
  line-height: 1.8;
}

.chat-welcome-hint {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.chat-sel-btn {
  position: absolute;
  z-index: 10002;
  background: var(--course-accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0,0,0,0.18);
}

.chat-sel-btn:hover { opacity: 0.9; }

@media (max-width: 600px) {
  .chat-window {
    width: 100% !important;
    height: 100% !important;
    bottom: 0;
    right: 0;
    max-width: none;
    max-height: none;
    border-radius: 0;
  }

  .chat-fab {
    bottom: 16px;
    right: 16px;
  }
}
</style>
