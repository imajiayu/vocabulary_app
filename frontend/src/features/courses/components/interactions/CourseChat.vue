<template>
  <Teleport to="body">
    <!-- FAB 按钮 -->
    <button
      class="chat-fab"
      :class="{ open: isOpen }"
      :data-course="config.theme"
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
    <div v-show="isOpen" class="chat-window" ref="chatWindowRef" :data-course="config.theme" :style="windowStyle">
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

    <!-- 选中文本浮动按钮组 -->
    <div
      v-show="selBtnVisible"
      class="sel-popover"
      :data-course="config.theme"
      :style="{ left: selBtnPos.x + 'px', top: selBtnPos.y + 'px' }"
      @mousedown.prevent.stop
    >
      <button class="sel-btn" @click.prevent.stop="askAboutSelection">问 AI</button>
      <button class="sel-btn" @click.prevent.stop="addSelection" :disabled="!courseSource">添加</button>
      <button class="sel-btn sel-btn-icon" @click.prevent.stop="pronounceSelection" title="发音">
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 6v4h2.5L8.5 12.5V3.5L5.5 6H3Z" fill="currentColor"/>
          <path d="M10.5 5.5c.8.7 1.3 1.6 1.3 2.5s-.5 1.8-1.3 2.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" fill="none"/>
        </svg>
      </button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, inject, onMounted, onBeforeUnmount, nextTick, computed } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type { CourseConfig } from '../../types/course'
import type { ChatMessage } from '@/shared/services/ai'
import { streamAI } from '@/shared/services/ai'
import { formatMarkdown } from '@/shared/utils/markdown'
import { useCourseTts } from '../../composables/useCourseTts'
import { lookupCourseDefinition } from '../../composables/useCourseDefinitionLookup'
import { useWordEditorStore } from '@/features/vocabulary/stores/wordEditor'

const config = inject<CourseConfig>('courseConfig')!
const lessonTitleRef = inject<ComputedRef<string>>('lessonTitle')
const lessonSummaryRef = inject<ComputedRef<string>>('lessonSummary')
const courseSource = inject<Ref<string>>('courseSource', ref(''))
const wordEditorStore = useWordEditorStore()
const { speak } = useCourseTts(config)

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

const TEXTAREA_MAX_HEIGHT = 80

function autoHeight() {
  const ta = textareaRef.value
  if (!ta) return
  ta.style.height = 'auto'
  const next = Math.min(ta.scrollHeight, TEXTAREA_MAX_HEIGHT)
  ta.style.height = next + 'px'
  ta.style.overflowY = ta.scrollHeight > TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden'
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
  if (title) prompt += `\n\n【当前课时】${title}`
  const summary = lessonSummaryRef?.value
  if (summary) {
    prompt += `\n\n【课时内容摘要】\n${summary}`
  }
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
    for await (const chunk of streamAI(apiMessages, {
      temperature: 0.7,
      caller: 'course_chat',
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
  const target = e.target as HTMLElement | null
  if (target?.closest('.sel-popover')) return

  setTimeout(() => {
    const sel = window.getSelection()
    const text = sel?.toString().trim() || ''
    if (text.length > 2 && text.length < 500) {
      selectedText = text
      selBtnVisible.value = true
      // 锚点：选区正上方 36px，避免超出视口右/上边
      const POPOVER_W = 180
      selBtnPos.value = {
        x: Math.max(8, Math.min(e.pageX - POPOVER_W / 2, window.innerWidth - POPOVER_W - 8)),
        y: Math.max(8, e.pageY - 44)
      }
    } else {
      selBtnVisible.value = false
      selectedText = ''
    }
  }, 10)
}

function onDocMousedown(e: MouseEvent) {
  const target = e.target as HTMLElement | null

  // 选中弹层外部点击 → 隐藏
  if (!target?.closest('.sel-popover')) {
    selBtnVisible.value = false
  }

  // 聊天窗口外部点击 → 关闭窗口（排除 FAB / popover / 自身）
  if (
    isOpen.value &&
    target &&
    !chatWindowRef.value?.contains(target) &&
    !target.closest('.chat-fab') &&
    !target.closest('.sel-popover')
  ) {
    isOpen.value = false
  }
}

function askAboutSelection() {
  const text = selectedText
  selBtnVisible.value = false
  if (!isOpen.value) toggleChat()
  inputText.value = `关于以下内容：\n"${text}"\n\n请解释一下。`
  nextTick(() => {
    textareaRef.value?.focus()
    autoHeight()
  })
  selectedText = ''
  window.getSelection()?.removeAllRanges()
}

async function addSelection() {
  if (!courseSource.value) return
  const text = selectedText
  selBtnVisible.value = false
  selectedText = ''

  // 优先：从选区 DOM 节点向上找带 data-def 的祖先（点中整个 .term/.uk-word 时命中）
  let def: string | undefined
  const sel = window.getSelection()
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0)
    let node: Node | null = range.commonAncestorContainer
    if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement
    const el = (node as HTMLElement | null)?.closest?.('[data-def]')
    if (el) def = el.getAttribute('data-def') || undefined
  }
  window.getSelection()?.removeAllRanges()

  // 兜底：跨课程释义索引（覆盖漏标 data-def 的情况）
  if (!def) {
    def = await lookupCourseDefinition(text, config.lang)
  }

  await wordEditorStore.openForCourse(text, def, {
    source: courseSource.value,
    lang: config.lang,
  })
}

function pronounceSelection() {
  const text = selectedText
  if (!text) return
  speak(text)
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
  background: var(--color-surface-card, var(--primitive-paper-100));
  border: 1px solid var(--color-border-medium, var(--primitive-paper-400));
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
}

.chat-msg.user .chat-bubble {
  white-space: pre-wrap;
}

.chat-bubble :deep(p),
.chat-bubble :deep(ul),
.chat-bubble :deep(ol),
.chat-bubble :deep(pre),
.chat-bubble :deep(blockquote) {
  margin: 0;
}

.chat-bubble :deep(p + p),
.chat-bubble :deep(p + ul),
.chat-bubble :deep(p + ol),
.chat-bubble :deep(ul + p),
.chat-bubble :deep(ol + p) {
  margin-top: 6px;
}

.chat-bubble :deep(ul),
.chat-bubble :deep(ol) {
  padding-left: 1.2em;
}

.chat-bubble :deep(h1),
.chat-bubble :deep(h2),
.chat-bubble :deep(h3),
.chat-bubble :deep(h4) {
  margin: 4px 0;
  font-size: 1em;
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
  border-top: 1px solid var(--color-border-medium, var(--primitive-paper-400));
  flex-shrink: 0;
  background: var(--color-surface-page, var(--primitive-paper-200));
}

.chat-input-area textarea {
  flex: 1;
  border: 1px solid var(--color-border-medium, var(--primitive-paper-400));
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  max-height: 80px;
  min-height: 36px;
  overflow-y: hidden;
  outline: none;
  font-family: inherit;
  background: var(--color-surface-card, var(--primitive-paper-100));
  color: var(--color-text-primary, #2d2d2d);
  transition: border-color 0.15s;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border-strong, var(--primitive-paper-500)) transparent;
}

.chat-input-area textarea::-webkit-scrollbar {
  width: 6px;
}

.chat-input-area textarea::-webkit-scrollbar-thumb {
  background: var(--color-border-strong, var(--primitive-paper-500));
  border-radius: 3px;
}

.chat-input-area textarea::-webkit-scrollbar-track {
  background: transparent;
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

.sel-popover {
  position: absolute;
  z-index: 10002;
  display: inline-flex;
  align-items: stretch;
  background: var(--color-surface-card, var(--primitive-paper-100));
  border: 1px solid var(--color-border-medium, var(--primitive-paper-400));
  border-radius: 8px;
  box-shadow: 0 6px 18px -4px rgba(15, 23, 42, 0.24);
  overflow: hidden;
  font-family: var(--font-sans);
}

.sel-btn {
  background: transparent;
  color: var(--color-text-primary);
  border: none;
  padding: 6px 12px;
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.12s ease, color 0.12s ease;
  border-right: 1px solid var(--color-border-light, var(--primitive-paper-300));
}

.sel-btn:last-child { border-right: none; }

.sel-btn:hover:not(:disabled) {
  background: var(--course-accent);
  color: var(--course-accent-on, #fff);
}

.sel-btn:disabled {
  color: var(--color-text-tertiary);
  cursor: not-allowed;
  opacity: 0.6;
}

.sel-btn-icon {
  padding: 6px 10px;
  display: inline-flex;
  align-items: center;
}

.sel-btn-icon svg {
  width: 14px;
  height: 14px;
}

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
