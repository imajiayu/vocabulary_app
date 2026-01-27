<template>
  <div
    class="ai-scholar"
    :class="{
      expanded: isExpanded,
      'mobile-expanded': isMobile && isExpanded,
      'show-trigger': showTrigger
    }"
    :style="!isMobile ? widgetPosition : {}"
  >
    <!-- 移动端遮罩 -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="isMobile && isExpanded"
          class="mobile-backdrop"
          @click="toggleExpand"
        />
      </Transition>
    </Teleport>

    <!-- 收起态：书签触发器 -->
    <div
      v-if="!isExpanded"
      class="bookmark-trigger"
      :class="{ 'hover-peek': isHovering }"
      @click="handleTriggerClick"
      @mouseenter="isHovering = true"
      @mouseleave="isHovering = false"
      @mousedown="handleMouseDown"
    >
      <div class="bookmark-fold" />
      <div class="bookmark-content">
        <span class="bookmark-icon">✎</span>
        <span class="bookmark-label">助手</span>
      </div>
      <div class="bookmark-shadow" />
    </div>

    <!-- 展开态：学术笔记边栏 -->
    <Transition name="scholar-slide">
      <div v-if="isExpanded" class="scholar-panel" @mousedown="startDrag">
        <!-- 顶部装饰条 -->
        <div class="panel-ornament top" />

        <!-- 标题区 -->
        <header class="panel-header">
          <div class="header-left">
            <div class="quill-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5l6.74-6.76z"/>
                <line x1="16" y1="8" x2="2" y2="22"/>
                <line x1="17.5" y1="15" x2="9" y2="15"/>
              </svg>
            </div>
            <div class="header-text">
              <h2 class="panel-title">学术助手</h2>
              <p v-if="currentWord" class="current-study">
                正在研习 <span class="study-word">{{ currentWord.word }}</span>
              </p>
            </div>
          </div>
          <button class="close-btn" @click="toggleExpand" aria-label="关闭">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </header>

        <!-- 消息区域 -->
        <div class="messages-area scrollbar-thin" ref="messagesContainer">
          <!-- 欢迎状态 -->
          <div v-if="messages.length === 0" class="welcome-state">
            <div class="welcome-illustration">
              <div class="book-stack">
                <div class="book book-1" />
                <div class="book book-2" />
                <div class="book book-3" />
              </div>
              <div class="quill-float">✎</div>
            </div>
            <h3 class="welcome-title">请教任何问题</h3>
            <p class="welcome-desc">
              我是你的词汇学习助手，可以帮你理解词义、记忆技巧、搭配用法等
            </p>

            <!-- 快捷建议 -->
            <div class="suggestions">
              <button
                v-for="(suggestion, idx) in suggestions"
                :key="idx"
                class="suggestion-card"
                :style="{ '--delay': idx * 0.08 + 's' }"
                @click="handleSuggestionClick(suggestion.text)"
              >
                <AppIcon :name="suggestion.icon" class="suggestion-icon-svg" />
                <span class="suggestion-text">{{ suggestion.label }}</span>
              </button>
            </div>
          </div>

          <!-- 对话消息 -->
          <template v-else>
            <TransitionGroup name="message-flow">
              <div
                v-for="(msg, index) in messages"
                :key="index"
                class="message-item"
                :class="msg.role"
              >
                <!-- 用户消息 -->
                <div v-if="msg.role === 'user'" class="user-bubble">
                  <div class="bubble-content">{{ msg.content }}</div>
                  <div class="bubble-tail" />
                </div>

                <!-- AI消息 -->
                <div v-else class="ai-note">
                  <div class="note-margin">
                    <div class="margin-line" />
                    <span class="note-mark">§</span>
                  </div>
                  <div class="note-content" v-html="formatMessage(msg.content)" />
                </div>
              </div>
            </TransitionGroup>
          </template>

          <!-- 加载态 -->
          <div v-if="isLoading" class="loading-state">
            <div class="ink-dots">
              <span class="dot" />
              <span class="dot" />
              <span class="dot" />
            </div>
            <span class="loading-text">正在书写...</span>
          </div>
        </div>

        <!-- 输入区 -->
        <div class="input-area">
          <div class="input-ornament" />
          <div class="input-wrapper">
            <input
              ref="inputRef"
              v-model="userInput"
              type="text"
              class="message-input"
              placeholder="请教一个问题..."
              :disabled="isLoading"
              @keypress.enter="sendMessage"
            />
            <button
              class="send-btn"
              :class="{ active: userInput.trim() && !isLoading }"
              :disabled="!userInput.trim() || isLoading"
              @click="sendMessage"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- 底部装饰条 -->
        <div class="panel-ornament bottom" />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import type { Word } from '@/shared/types'
import AppIcon from '@/shared/components/controls/Icons.vue'
import { useTimerPause } from '@/shared/composables/useTimerPause'
import { useChatPosition } from '@/shared/composables/useChatPosition'
import { useChatMessages } from '@/shared/composables/useChatMessages'

interface Props {
  currentWord?: Word | null
}

const props = withDefaults(defineProps<Props>(), {
  currentWord: null
})

// State
const isExpanded = ref(false)
const showTrigger = ref(true)
const isHovering = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

// Composables
const { requestPause, releasePause } = useTimerPause()

const {
  widgetPosition,
  startDrag,
  adjustPositionWithinBounds,
  saveCurrentPosition,
  restorePosition,
  shouldBlockToggle
} = useChatPosition(isExpanded)

const currentWordRef = computed(() => props.currentWord)
const {
  userInput,
  messages,
  isLoading,
  messagesContainer,
  loadChatHistory,
  saveChatHistory,
  formatMessage,
  handleSuggestionClick: baseSuggestionClick,
  sendMessage
} = useChatMessages(currentWordRef, isExpanded)

// 检测移动端
const isMobile = computed(() => window.innerWidth <= 480)

// 快捷建议
const suggestions: Array<{ icon: 'book-open' | 'pen' | 'lightbulb' | 'shuffle', label: string, text: string }> = [
  { icon: 'book-open', label: '常用搭配', text: '这个词有哪些常用搭配？' },
  { icon: 'pen', label: '造句示例', text: '如何用这个词造句？' },
  { icon: 'lightbulb', label: '记忆方法', text: '有什么好的记忆方法？' },
  { icon: 'shuffle', label: '近义反义', text: '它的同义词和反义词是什么？' }
]

// 处理 mousedown 事件
const handleMouseDown = (e: MouseEvent) => {
  if (isMobile.value) return
  startDrag(e)
}

// 触发器点击
const handleTriggerClick = () => {
  if (shouldBlockToggle()) return
  toggleExpand()
}

// 建议点击
const handleSuggestionClick = (text: string) => {
  baseSuggestionClick(text)
}

// 展开/收起
const toggleExpand = () => {
  if (shouldBlockToggle()) return

  isExpanded.value = !isExpanded.value

  if (isExpanded.value) {
    requestPause()
    nextTick(() => {
      saveCurrentPosition()
      if (!isMobile.value) {
        adjustPositionWithinBounds()
      }
      loadChatHistory()
      // 自动聚焦输入框
      setTimeout(() => inputRef.value?.focus(), 300)
    })
  } else {
    releasePause()
    if (!isMobile.value) {
      restorePosition()
    }
    saveChatHistory()
  }
}

onMounted(() => {
  // 初始化时确保触发器可见
  showTrigger.value = true
})
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   学术助手 - 书籍装帧风格
   ═══════════════════════════════════════════════════════════════════════════ */

.ai-scholar {
  position: fixed;
  z-index: 1000;
  font-family: var(--font-serif);
}

/* ─────────────────────────────────────────────────────────────────────────────
   书签触发器
   ───────────────────────────────────────────────────────────────────────────── */

.bookmark-trigger {
  position: relative;
  cursor: pointer;
  user-select: none;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.bookmark-fold {
  position: absolute;
  top: 0;
  right: 0;
  width: 20px;
  height: 20px;
  background: linear-gradient(135deg,
    transparent 50%,
    var(--primitive-copper-300) 50%
  );
  border-radius: 0 var(--radius-default) 0 0;
  z-index: 2;
}

.bookmark-content {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 20px 14px 16px;
  background: linear-gradient(145deg,
    var(--primitive-copper-400) 0%,
    var(--primitive-copper-500) 100%
  );
  color: var(--primitive-paper-100);
  border-radius: var(--radius-default);
  border-radius: var(--radius-default) var(--radius-default) var(--radius-default) 0;
  box-shadow:
    0 4px 12px rgba(153, 107, 61, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
  position: relative;
  overflow: hidden;
}

.bookmark-content::before {
  content: '';
  position: absolute;
  inset: 0;
  background: url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  opacity: 0.03;
  pointer-events: none;
}

.bookmark-icon {
  font-size: 18px;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.2));
}

.bookmark-label {
  font-family: var(--font-ui);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.bookmark-shadow {
  position: absolute;
  bottom: -8px;
  left: 4px;
  right: 4px;
  height: 8px;
  background: linear-gradient(to bottom,
    rgba(153, 107, 61, 0.2),
    transparent
  );
  border-radius: 0 0 var(--radius-default) var(--radius-default);
  z-index: -1;
}

.bookmark-trigger:hover {
  transform: translateY(-3px) scale(1.02);
}

.bookmark-trigger:hover .bookmark-content {
  box-shadow:
    0 8px 20px rgba(153, 107, 61, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.bookmark-trigger:active {
  transform: translateY(-1px) scale(0.98);
}

/* ─────────────────────────────────────────────────────────────────────────────
   学术面板
   ───────────────────────────────────────────────────────────────────────────── */

.scholar-panel {
  width: 400px;
  height: 620px;
  background: var(--primitive-paper-100);
  border-radius: var(--radius-lg);
  box-shadow:
    0 25px 50px -12px rgba(0, 0, 0, 0.15),
    0 0 0 1px rgba(153, 107, 61, 0.1),
    inset 0 0 80px rgba(250, 247, 242, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

/* 纸张纹理 */
.scholar-panel::before {
  content: '';
  position: absolute;
  inset: 0;
  background: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='paper'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.04' numOctaves='5' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23paper)'/%3E%3C/svg%3E");
  opacity: 0.02;
  pointer-events: none;
  z-index: 0;
}

/* 装饰条 */
.panel-ornament {
  height: 4px;
  background: linear-gradient(90deg,
    transparent 0%,
    var(--primitive-copper-300) 10%,
    var(--primitive-copper-400) 50%,
    var(--primitive-copper-300) 90%,
    transparent 100%
  );
  flex-shrink: 0;
}

.panel-ornament.top {
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
}

.panel-ornament.bottom {
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
}

/* ─────────────────────────────────────────────────────────────────────────────
   标题区
   ───────────────────────────────────────────────────────────────────────────── */

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--primitive-paper-400);
  background: linear-gradient(to bottom,
    var(--primitive-paper-100),
    var(--primitive-paper-200)
  );
  position: relative;
  z-index: 1;
  cursor: move;
  user-select: none;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.quill-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gradient-primary);
  border-radius: var(--radius-default);
  color: var(--primitive-paper-100);
  box-shadow: 0 2px 8px rgba(153, 107, 61, 0.3);
}

.quill-icon svg {
  width: 20px;
  height: 20px;
}

.header-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.panel-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--primitive-ink-800);
  margin: 0;
  letter-spacing: 0.02em;
}

.current-study {
  font-size: 12px;
  color: var(--primitive-ink-400);
  margin: 0;
  font-family: var(--font-ui);
}

.study-word {
  color: var(--primitive-copper-500);
  font-weight: 600;
  font-style: italic;
}

.close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-default);
  color: var(--primitive-ink-400);
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: var(--primitive-paper-300);
  color: var(--primitive-ink-600);
}

.close-btn svg {
  width: 18px;
  height: 18px;
}

/* ─────────────────────────────────────────────────────────────────────────────
   消息区域
   ───────────────────────────────────────────────────────────────────────────── */

.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: linear-gradient(to bottom,
    var(--primitive-paper-200),
    var(--primitive-paper-100) 30%
  );
  position: relative;
  z-index: 1;
}

/* 欢迎状态 */
.welcome-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;
  animation: welcomeFade 0.6s ease-out;
}

@keyframes welcomeFade {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.welcome-illustration {
  position: relative;
  width: 80px;
  height: 60px;
  margin-bottom: 20px;
}

.book-stack {
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
}

.book {
  position: absolute;
  bottom: 0;
  left: 50%;
  border-radius: 2px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.book-1 {
  width: 50px;
  height: 8px;
  background: var(--primitive-copper-400);
  transform: translateX(-50%) rotate(-2deg);
}

.book-2 {
  width: 45px;
  height: 10px;
  background: var(--primitive-olive-400);
  transform: translateX(-50%) translateY(-10px) rotate(1deg);
}

.book-3 {
  width: 48px;
  height: 9px;
  background: var(--primitive-gold-500);
  transform: translateX(-50%) translateY(-22px) rotate(-1deg);
}

.quill-float {
  position: absolute;
  top: 0;
  right: 0;
  font-size: 24px;
  animation: quillBob 3s ease-in-out infinite;
}

@keyframes quillBob {
  0%, 100% { transform: translateY(0) rotate(-15deg); }
  50% { transform: translateY(-5px) rotate(-10deg); }
}

.welcome-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--primitive-ink-800);
  margin: 0 0 8px 0;
  text-align: center;
}

.welcome-desc {
  font-size: 14px;
  color: var(--primitive-ink-500);
  text-align: center;
  margin: 0 0 24px 0;
  line-height: 1.6;
  max-width: 280px;
}

/* 快捷建议 */
.suggestions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  width: 100%;
}

.suggestion-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  background: var(--primitive-paper-50);
  border: 1px solid var(--primitive-paper-400);
  border-radius: var(--radius-default);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  font-family: var(--font-ui);
  text-align: left;
  animation: suggestionPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) backwards;
  animation-delay: var(--delay);
}

@keyframes suggestionPop {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(10px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.suggestion-card:hover {
  transform: translateY(-2px);
  border-color: var(--primitive-copper-300);
  box-shadow: 0 4px 12px rgba(153, 107, 61, 0.15);
  background: var(--primitive-paper-100);
}

.suggestion-card:active {
  transform: translateY(0) scale(0.98);
}

.suggestion-icon-svg {
  width: 16px;
  height: 16px;
  fill: var(--primitive-copper-500);
}

.suggestion-text {
  font-size: 13px;
  color: var(--primitive-ink-600);
  font-weight: 500;
}

/* ─────────────────────────────────────────────────────────────────────────────
   消息样式
   ───────────────────────────────────────────────────────────────────────────── */

.message-item {
  width: 100%;
  animation: messageSlide 0.35s ease-out;
}

@keyframes messageSlide {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 用户消息气泡 */
.user-bubble {
  display: flex;
  justify-content: flex-end;
  position: relative;
}

.bubble-content {
  max-width: 85%;
  padding: 12px 16px;
  background: var(--gradient-primary);
  color: var(--primitive-paper-100);
  border-radius: var(--radius-md);
  border-bottom-right-radius: var(--radius-xs);
  font-size: 14px;
  line-height: 1.6;
  box-shadow: 0 2px 8px rgba(153, 107, 61, 0.25);
  position: relative;
}

.bubble-tail {
  position: absolute;
  bottom: 0;
  right: -6px;
  width: 12px;
  height: 12px;
  background: var(--primitive-gold-500);
  clip-path: polygon(0 0, 100% 100%, 0 100%);
}

/* AI笔记样式 */
.ai-note {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: var(--primitive-paper-50);
  border-radius: var(--radius-default);
  border: 1px solid var(--primitive-paper-300);
  box-shadow:
    0 1px 3px rgba(0, 0, 0, 0.04),
    inset 0 0 20px rgba(250, 247, 242, 0.5);
}

.note-margin {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding-top: 2px;
}

.margin-line {
  width: 2px;
  flex: 1;
  min-height: 20px;
  background: linear-gradient(to bottom,
    var(--primitive-copper-300),
    var(--primitive-copper-200)
  );
  border-radius: 1px;
}

.note-mark {
  font-size: 14px;
  color: var(--primitive-copper-400);
  font-weight: 600;
}

.note-content {
  flex: 1;
  font-size: 14px;
  line-height: 1.7;
  color: var(--primitive-ink-700);
}

/* Markdown样式 */
.note-content :deep(p) {
  margin: 0.6em 0;
}

.note-content :deep(p:first-child) {
  margin-top: 0;
}

.note-content :deep(p:last-child) {
  margin-bottom: 0;
}

.note-content :deep(strong) {
  font-weight: 600;
  color: var(--primitive-ink-800);
}

.note-content :deep(em) {
  font-style: italic;
  color: var(--primitive-copper-600);
}

.note-content :deep(code) {
  background: var(--primitive-paper-300);
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  font-family: var(--font-mono);
  font-size: 0.9em;
  color: var(--primitive-copper-700);
}

.note-content :deep(ul),
.note-content :deep(ol) {
  margin: 0.6em 0;
  padding-left: 1.4em;
}

.note-content :deep(li) {
  margin: 0.3em 0;
}

.note-content :deep(li::marker) {
  color: var(--primitive-copper-400);
}

.note-content :deep(blockquote) {
  margin: 0.8em 0;
  padding-left: 12px;
  border-left: 3px solid var(--primitive-copper-300);
  color: var(--primitive-ink-600);
  font-style: italic;
}

.note-content :deep(h1),
.note-content :deep(h2),
.note-content :deep(h3) {
  margin: 1em 0 0.5em 0;
  color: var(--primitive-ink-800);
}

.note-content :deep(h1:first-child),
.note-content :deep(h2:first-child),
.note-content :deep(h3:first-child) {
  margin-top: 0;
}

/* 加载状态 */
.loading-state {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--primitive-paper-50);
  border-radius: var(--radius-default);
  border: 1px solid var(--primitive-paper-300);
}

.ink-dots {
  display: flex;
  gap: 6px;
}

.ink-dots .dot {
  width: 8px;
  height: 8px;
  background: var(--primitive-copper-400);
  border-radius: 50%;
  animation: inkSpread 1.4s ease-in-out infinite;
}

.ink-dots .dot:nth-child(1) { animation-delay: 0s; }
.ink-dots .dot:nth-child(2) { animation-delay: 0.15s; }
.ink-dots .dot:nth-child(3) { animation-delay: 0.3s; }

@keyframes inkSpread {
  0%, 80%, 100% {
    transform: scale(0.6);
    opacity: 0.4;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

.loading-text {
  font-size: 13px;
  color: var(--primitive-ink-400);
  font-family: var(--font-ui);
}

/* ─────────────────────────────────────────────────────────────────────────────
   输入区
   ───────────────────────────────────────────────────────────────────────────── */

.input-area {
  padding: 16px 20px;
  background: var(--primitive-paper-100);
  border-top: 1px solid var(--primitive-paper-400);
  position: relative;
  z-index: 1;
}

.input-ornament {
  position: absolute;
  top: 0;
  left: 20px;
  right: 20px;
  height: 1px;
  background: linear-gradient(90deg,
    transparent 0%,
    var(--primitive-copper-200) 20%,
    var(--primitive-copper-300) 50%,
    var(--primitive-copper-200) 80%,
    transparent 100%
  );
  transform: translateY(-0.5px);
}

.input-wrapper {
  display: flex;
  gap: 10px;
  align-items: center;
}

.message-input {
  flex: 1;
  padding: 12px 16px;
  background: var(--primitive-paper-50);
  border: 1px solid var(--primitive-paper-400);
  border-radius: var(--radius-full);
  font-size: 14px;
  font-family: var(--font-ui);
  color: var(--primitive-ink-800);
  outline: none;
  transition: all 0.2s ease;
}

.message-input::placeholder {
  color: var(--primitive-ink-400);
}

.message-input:focus {
  border-color: var(--primitive-copper-400);
  box-shadow: 0 0 0 3px rgba(153, 107, 61, 0.1);
}

.message-input:disabled {
  background: var(--primitive-paper-200);
  cursor: not-allowed;
}

.send-btn {
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primitive-paper-300);
  border: none;
  border-radius: 50%;
  color: var(--primitive-ink-400);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.send-btn svg {
  width: 18px;
  height: 18px;
}

.send-btn.active {
  background: var(--gradient-primary);
  color: var(--primitive-paper-100);
  box-shadow: 0 4px 12px rgba(153, 107, 61, 0.3);
}

.send-btn.active:hover {
  transform: scale(1.08);
  box-shadow: 0 6px 16px rgba(153, 107, 61, 0.4);
}

.send-btn:disabled {
  cursor: not-allowed;
}

/* ─────────────────────────────────────────────────────────────────────────────
   过渡动画
   ───────────────────────────────────────────────────────────────────────────── */

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.scholar-slide-enter-active {
  animation: scholarEnter 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.scholar-slide-leave-active {
  animation: scholarLeave 0.25s ease-in;
}

@keyframes scholarEnter {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes scholarLeave {
  from {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
  to {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }
}

.message-flow-enter-active {
  animation: messageSlide 0.35s ease-out;
}

.message-flow-leave-active {
  animation: messageSlide 0.2s ease-in reverse;
}

/* ─────────────────────────────────────────────────────────────────────────────
   移动端适配
   ───────────────────────────────────────────────────────────────────────────── */

@media (max-width: 480px) {
  .ai-scholar {
    z-index: 1001;
  }

  /* 移动端书签 - 侧边贴边 */
  .bookmark-trigger {
    position: fixed !important;
    left: 0 !important;
    top: 50% !important;
    transform: translateY(-50%) !important;
  }

  .bookmark-content {
    padding: 12px 14px 12px 10px;
    border-radius: 0 var(--radius-default) var(--radius-default) 0;
    gap: 6px;
  }

  .bookmark-fold {
    display: none;
  }

  .bookmark-shadow {
    display: none;
  }

  .bookmark-trigger:hover {
    transform: translateY(-50%) translateX(4px) !important;
  }

  /* 移动端遮罩 */
  .mobile-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(4px);
    z-index: 9998;
  }

  /* 移动端面板 - 全屏 */
  .ai-scholar.mobile-expanded {
    position: fixed !important;
    inset: 0 !important;
    width: 100% !important;
    height: 100% !important;
    z-index: 9999 !important;
  }

  .ai-scholar.mobile-expanded .bookmark-trigger {
    display: none;
  }

  .scholar-panel {
    width: 100vw;
    height: 100dvh;
    border-radius: 0;
  }

  .panel-ornament {
    border-radius: 0;
  }

  .panel-header {
    cursor: default;
    padding: 14px 16px;
  }

  .messages-area {
    padding: 16px;
  }

  .suggestions {
    grid-template-columns: 1fr;
    gap: 8px;
  }

  .suggestion-card {
    padding: 14px 16px;
  }

  .input-area {
    padding: 12px 16px;
    padding-bottom: max(12px, env(safe-area-inset-bottom));
  }

  .input-wrapper {
    gap: 8px;
  }

  .message-input {
    padding: 10px 14px;
  }

  .send-btn {
    width: 40px;
    height: 40px;
  }
}

/* 平板适配 */
@media (min-width: 481px) and (max-width: 768px) {
  .scholar-panel {
    width: 380px;
    height: 580px;
  }
}
</style>

<style>
/* 移动端遮罩全局样式 */
.mobile-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  z-index: 9998;
}
</style>
