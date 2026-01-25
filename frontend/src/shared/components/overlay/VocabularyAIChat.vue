<template>
  <div class="ai-chat-widget" :class="{ expanded: isExpanded, 'show-button': showButton }" :style="isMobile ? {} : widgetPosition">
    <!-- 遮罩层（移动端点击收回） -->
    <Teleport to="body">
      <div v-if="showButton && isMobile && !isExpanded" class="mobile-overlay" @click="showButton = false"></div>
    </Teleport>

    <!-- 收起状态：浮动按钮 -->
    <div v-if="!isExpanded" class="chat-button" @click="handleButtonClick" @mousedown="handleMouseDown">
      <span class="chat-icon">💬</span>
      <span class="chat-label">AI助手</span>
    </div>

    <!-- 展开状态：聊天窗口 -->
    <div v-else class="chat-window">
      <!-- 标题栏 -->
      <div class="chat-header" @mousedown="startDrag">
        <div class="header-title">
          <span class="header-icon">🤖</span>
          <span class="header-text">AI词汇助手</span>
        </div>
        <button class="close-button" @click="toggleExpand">
          <span>×</span>
        </button>
      </div>

      <!-- 当前词汇信息 -->
      <div v-if="currentWord" class="current-word-info">
        <div class="word-title">{{ currentWord.word }}</div>
      </div>

      <!-- 聊天消息区域 -->
      <div class="chat-messages scrollbar-thin" ref="messagesContainer">
        <div v-if="messages.length === 0" class="welcome-message">
          <p>👋 你好！我是你的AI词汇学习助手。</p>
          <p>你可以问我关于当前词汇的任何问题，比如：</p>
          <div class="suggestion-buttons">
            <button class="suggestion-btn" @click="handleSuggestionClick('这个词有哪些常用搭配？')">
              这个词有哪些常用搭配？
            </button>
            <button class="suggestion-btn" @click="handleSuggestionClick('如何用这个词造句？')">
              如何用这个词造句？
            </button>
            <button class="suggestion-btn" @click="handleSuggestionClick('有什么好的记忆方法？')">
              有什么好的记忆方法？
            </button>
            <button class="suggestion-btn" @click="handleSuggestionClick('它的同义词和反义词是什么？')">
              它的同义词和反义词是什么？
            </button>
          </div>
        </div>

        <div
          v-for="(msg, index) in messages"
          :key="index"
          class="message"
          :class="msg.role === 'user' ? 'user-message' : 'ai-message'"
        >
          <div class="message-text" v-html="formatMessage(msg.content)"></div>
        </div>

        <!-- 加载状态 -->
        <div v-if="isLoading" class="message ai-message">
          <div class="loading-dots">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>

      <!-- 输入区域 -->
      <div class="chat-input-area">
        <input
          v-model="userInput"
          type="text"
          placeholder="问我任何关于这个词的问题..."
          @keypress.enter="sendMessage"
          :disabled="isLoading"
          class="chat-input"
        />
        <button
          @click="sendMessage"
          :disabled="!userInput.trim() || isLoading"
          class="send-button"
        >
          <span>发送</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import type { Word } from '@/shared/types'
import { useTimerPause } from '@/shared/composables/useTimerPause'
import { useChatPosition } from '@/shared/composables/useChatPosition'
import { useChatMessages } from '@/shared/composables/useChatMessages'

// Props
interface Props {
  currentWord?: Word | null
}

const props = withDefaults(defineProps<Props>(), {
  currentWord: null
})

// State
const isExpanded = ref(false)
const showButton = ref(false) // 移动端：是否显示"AI助手"按钮（false时只显示箭头）

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
  handleSuggestionClick,
  sendMessage
} = useChatMessages(currentWordRef, isExpanded)

// 检测是否为移动端
const isMobile = computed(() => window.innerWidth <= 480)

// 处理 mousedown 事件
const handleMouseDown = (e: MouseEvent) => {
  // 移动端：不执行拖拽
  if (isMobile.value) {
    return
  }
  // 桌面端：执行拖拽逻辑
  startDrag(e)
}

// 移动端按钮点击处理
const handleButtonClick = () => {
  if (isMobile.value) {
    // 移动端逻辑
    if (!showButton.value) {
      // 第一次点击箭头：显示"AI助手"按钮
      showButton.value = true
    } else {
      // 点击"AI助手"按钮：展开全屏对话框
      toggleExpand()
    }
  } else {
    // 桌面端逻辑
    toggleExpand()
  }
}

// 方法
const toggleExpand = () => {
  // 如果正在拖动，或者刚刚拖动过，不触发展开/收起
  if (shouldBlockToggle()) {
    return
  }

  isExpanded.value = !isExpanded.value

  // 控制计时器暂停/恢复
  if (isExpanded.value) {
    requestPause()
  } else {
    releasePause()
    // 移动端收起时，也收回按钮
    if (isMobile.value) {
      showButton.value = false
    }
  }

  nextTick(() => {
    if (isExpanded.value) {
      // 展开时：先保存当前收起状态的位置
      saveCurrentPosition()
      // 然后调整位置以适应展开后的尺寸（仅桌面端）
      if (!isMobile.value) {
        adjustPositionWithinBounds()
      }
      // 加载聊天历史
      loadChatHistory()
    } else {
      // 收起时：恢复到保存的收起状态位置（仅桌面端）
      if (!isMobile.value) {
        restorePosition()
      }
      // 保存聊天记录
      saveChatHistory()
    }
  })
}
</script>

<style scoped>
.ai-chat-widget {
  position: fixed;
  z-index: 1000;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  /* 位置由 JS 计算并通过 widgetPosition 设置 */
}

/* 收起状态：浮动按钮 */
.chat-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: var(--gradient-primary);
  color: var(--color-text-inverse);
  border-radius: var(--radius-full);
  box-shadow: 0 4px 15px var(--color-purple-light);
  cursor: pointer;
  transition: all 0.3s ease;
  user-select: none;
}

.chat-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px var(--color-purple-border);
}

.chat-button:active {
  transform: translateY(0);
}

.chat-icon {
  font-size: 20px;
}

.chat-label {
  font-size: 14px;
  font-weight: 600;
}

/* 展开状态：聊天窗口 */
.chat-window {
  width: 380px;
  height: 600px;
  background: white;
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 标题栏 */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: var(--gradient-primary);
  color: var(--color-text-inverse);
  cursor: move;
  user-select: none;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-icon {
  font-size: 20px;
}

.header-text {
  font-size: 16px;
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  color: white;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
  padding: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-xs);
  transition: background 0.2s ease;
}

.close-button:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* 当前词汇信息 */
.current-word-info {
  padding: 12px 20px;
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border-medium);
  text-align: center;
}

.word-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-purple);
}

/* 消息区域 */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: var(--color-bg-secondary);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.welcome-message {
  color: var(--color-text-tertiary);
  font-size: 14px;
  line-height: 1.6;
}

.welcome-message p {
  margin-bottom: 12px;
}

.suggestion-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
}

.suggestion-btn {
  background: white;
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-default);
  padding: 10px 14px;
  font-size: 13px;
  color: var(--color-text-secondary);
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.suggestion-btn:hover {
  background: var(--color-bg-secondary);
  border-color: var(--color-purple);
  color: var(--color-purple);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px var(--color-purple-light);
}

.suggestion-btn:active {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.message {
  animation: fadeIn 0.3s ease;
  width: 100%;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-text {
  padding: 12px 16px;
  border-radius: var(--radius-md);
  font-size: 14px;
  line-height: 1.6;
  width: 100%;
  box-sizing: border-box;
}

/* Markdown 样式 */
.message-text :deep(p) {
  margin: 0.5em 0;
}

.message-text :deep(p:first-child) {
  margin-top: 0;
}

.message-text :deep(p:last-child) {
  margin-bottom: 0;
}

.message-text :deep(strong) {
  font-weight: 600;
  color: inherit;
}

.message-text :deep(code) {
  background: rgba(0, 0, 0, 0.05);
  padding: 2px 6px;
  border-radius: var(--radius-xs);
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.9em;
}

.message-text :deep(ul) {
  margin: 0.5em 0;
  padding-left: 1.5em;
  list-style-type: disc;
}

.message-text :deep(li) {
  margin: 0.3em 0;
}

.message-text :deep(li::marker) {
  color: var(--color-purple);
}

.message-text :deep(h1) {
  font-size: 1.4em;
  font-weight: 700;
  margin: 0.8em 0 0.5em 0;
  color: inherit;
}

.message-text :deep(h2) {
  font-size: 1.25em;
  font-weight: 700;
  margin: 0.7em 0 0.4em 0;
  color: inherit;
}

.message-text :deep(h3) {
  font-size: 1.1em;
  font-weight: 600;
  margin: 0.6em 0 0.3em 0;
  color: inherit;
}

.message-text :deep(h1:first-child),
.message-text :deep(h2:first-child),
.message-text :deep(h3:first-child) {
  margin-top: 0;
}

.message-text :deep(hr) {
  border: none;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  margin: 1em 0;
}

.message-text :deep(blockquote) {
  margin: 0.5em 0;
  padding-left: 1em;
  border-left: 3px solid var(--color-purple);
  color: inherit;
  font-style: italic;
}

.message-text :deep(em) {
  font-style: italic;
  color: inherit;
}

.user-message .message-text {
  background: var(--color-purple);
  color: var(--color-text-inverse);
  border-bottom-right-radius: 4px;
}

.user-message .message-text :deep(code) {
  background: rgba(255, 255, 255, 0.2);
  color: white;
}

.user-message .message-text :deep(li::marker) {
  color: rgba(255, 255, 255, 0.8);
}

.user-message .message-text :deep(hr) {
  border-top-color: rgba(255, 255, 255, 0.3);
}

.user-message .message-text :deep(blockquote) {
  border-left-color: rgba(255, 255, 255, 0.5);
}

.ai-message .message-text {
  background: var(--primitive-paper-50);
  color: var(--color-text-primary);
  border-bottom-left-radius: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

/* 加载动画 */
.loading-dots {
  display: flex;
  gap: 4px;
  padding: 10px 14px;
  background: white;
  border-radius: var(--radius-md);
  border-bottom-left-radius: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.loading-dots span {
  width: 8px;
  height: 8px;
  background: var(--primitive-ink-200);
  border-radius: var(--radius-full);
  animation: bounce 1.4s infinite ease-in-out;
}

.loading-dots span:nth-child(1) {
  animation-delay: -0.32s;
}

.loading-dots span:nth-child(2) {
  animation-delay: -0.16s;
}

@keyframes bounce {
  0%, 80%, 100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

/* 输入区域 */
.chat-input-area {
  display: flex;
  gap: 10px;
  padding: 16px 20px;
  background: white;
  border-top: 1px solid var(--color-border-medium);
}

.chat-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-xl);
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s ease;
}

.chat-input:focus {
  border-color: var(--color-purple);
}

.chat-input:disabled {
  background: var(--color-bg-secondary);
  cursor: not-allowed;
}

.send-button {
  padding: 10px 20px;
  background: var(--gradient-primary);
  color: var(--color-text-inverse);
  border: none;
  border-radius: var(--radius-xl);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.send-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px var(--color-purple-light);
}

.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 移动端适配 */
@media (max-width: 480px) {
  .ai-chat-widget {
    z-index: 1001;
  }

  /* 移动端按钮：完全重置桌面端样式 */
  .chat-button {
    /* 定位：用 calc 避免 transform */
    position: fixed !important;
    left: 0 !important;
    top: calc(50% - 22px) !important;
    /* 尺寸 */
    width: 28px;
    height: 44px;
    padding: 0 0 0 8px !important;
    /* 外观 */
    border-radius: 0 12px 12px 0 !important;
    box-shadow: 2px 0 8px var(--color-purple-light) !important;
    /* 布局 */
    display: flex !important;
    align-items: center !important;
    justify-content: flex-start !important;
    gap: 6px !important;
    overflow: hidden;
    /* 过渡：只对宽度和 padding */
    transition: width 0.25s ease, padding 0.25s ease !important;
    /* 禁用桌面端的 transform */
    transform: none !important;
  }

  /* 禁用桌面端的 hover/active 效果 */
  .chat-button:hover,
  .chat-button:active {
    transform: none !important;
    box-shadow: 2px 0 8px var(--color-purple-light) !important;
  }

  .chat-icon {
    flex-shrink: 0;
    font-size: 18px !important;
    opacity: 0;
    width: 0;
    transition: opacity 0.2s ease, width 0.2s ease;
  }

  .chat-label {
    flex-shrink: 0;
    font-size: 14px !important;
    font-weight: 600 !important;
    opacity: 0;
    width: 0;
    overflow: hidden;
    white-space: nowrap;
    transition: opacity 0.2s ease, width 0.2s ease;
  }

  /* 箭头图标 */
  .chat-button::before {
    content: '›';
    font-size: 22px;
    font-weight: bold;
    color: white;
    flex-shrink: 0;
  }

  /* 展开状态：显示"AI助手" */
  .ai-chat-widget.show-button .chat-button {
    width: 116px;
    padding: 0 14px 0 12px !important;
    border-radius: 0 22px 22px 0 !important;
  }

  .ai-chat-widget.show-button .chat-button::before {
    display: none;
  }

  .ai-chat-widget.show-button .chat-icon {
    opacity: 1;
    width: 20px;
  }

  .ai-chat-widget.show-button .chat-label {
    opacity: 1;
    width: 56px;
  }

  /* 全屏聊天窗口 */
  .ai-chat-widget.expanded {
    position: fixed !important;
    left: 0 !important;
    top: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100% !important;
    height: 100dvh !important;
    z-index: 10000 !important;
  }

  .ai-chat-widget.expanded .chat-button {
    display: none !important;
  }

  .chat-window {
    width: 100vw;
    height: 100dvh;
    max-width: 100vw;
    border-radius: 0;
    display: flex;
    flex-direction: column;
  }

  .chat-header {
    cursor: default;
    flex-shrink: 0;
  }

  .current-word-info {
    flex-shrink: 0;
  }

  .chat-messages {
    padding: 16px;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .chat-input-area {
    padding: 12px 16px;
    padding-bottom: max(12px, env(safe-area-inset-bottom));
    flex-shrink: 0;
    background: white;
  }
}

</style>

<style>
/* 移动端遮罩层（全局样式，因为使用 Teleport） */
.mobile-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: transparent;
  z-index: 1000;
}
</style>
