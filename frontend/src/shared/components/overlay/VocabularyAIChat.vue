<template>
  <div class="ai-chat-widget" :class="{ expanded: isExpanded, 'show-button': showButton }" :style="widgetPosition">
    <!-- 遮罩层（移动端点击收回） -->
    <div v-if="showButton && isMobile" class="mobile-overlay" @click="handleOverlayClick"></div>

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
      <div class="chat-messages" ref="messagesContainer">
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
const isMobile = computed(() => window.innerWidth <= 768)

// 移动端遮罩层点击处理
const handleOverlayClick = () => {
  showButton.value = false
}

// 处理 mousedown 事件
const handleMouseDown = (e: MouseEvent) => {
  // 移动端：阻止默认行为，只使用 click 事件
  if (isMobile.value) {
    e.preventDefault()
    return
  }
  // 桌面端：执行拖拽逻辑
  startDrag(e)
}

// 移动端按钮点击处理
const handleButtonClick = (e?: MouseEvent) => {
  if (isMobile.value) {
    // 移动端逻辑
    if (!showButton.value) {
      // 第一次点击箭头：显示"AI助手"按钮（左侧垂直居中）
      showButton.value = true
    } else {
      // 点击"AI助手"按钮：展开全屏对话框
      toggleExpand(e)
    }
  } else {
    // 桌面端逻辑
    toggleExpand(e)
  }
}

// 方法
const toggleExpand = (e?: MouseEvent) => {
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
      // 然后调整位置以适应展开后的尺寸
      adjustPositionWithinBounds()
      // 加载聊天历史
      loadChatHistory()
    } else {
      // 收起时：恢复到保存的收起状态位置
      restorePosition()
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 50px;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
  cursor: pointer;
  transition: all 0.3s ease;
  user-select: none;
}

.chat-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
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
  border-radius: 16px;
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
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
  border-radius: 4px;
  transition: background 0.2s ease;
}

.close-button:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* 当前词汇信息 */
.current-word-info {
  padding: 12px 20px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  text-align: center;
}

.word-title {
  font-size: 20px;
  font-weight: 700;
  color: #667eea;
}

/* 消息区域 */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background: #fafbfc;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.welcome-message {
  color: #6c757d;
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
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 13px;
  color: #4a5568;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.suggestion-btn:hover {
  background: #f7fafc;
  border-color: #667eea;
  color: #667eea;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(102, 126, 234, 0.15);
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
  border-radius: 12px;
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
  border-radius: 4px;
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
  color: #667eea;
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
  border-left: 3px solid #667eea;
  color: inherit;
  font-style: italic;
}

.message-text :deep(em) {
  font-style: italic;
  color: inherit;
}

.user-message .message-text {
  background: #667eea;
  color: white;
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
  background: white;
  color: #2d3748;
  border-bottom-left-radius: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

/* 加载动画 */
.loading-dots {
  display: flex;
  gap: 4px;
  padding: 10px 14px;
  background: white;
  border-radius: 12px;
  border-bottom-left-radius: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.loading-dots span {
  width: 8px;
  height: 8px;
  background: #cbd5e0;
  border-radius: 50%;
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
  border-top: 1px solid #e9ecef;
}

.chat-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #dee2e6;
  border-radius: 20px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s ease;
}

.chat-input:focus {
  border-color: #667eea;
}

.chat-input:disabled {
  background: #f8f9fa;
  cursor: not-allowed;
}

.send-button {
  padding: 10px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.send-button:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
}

.send-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .ai-chat-widget {
    z-index: 1001; /* 在 WordSidebar 上方 */
  }

  /* 移动端收起状态：左边隐藏的小箭头 */
  .chat-button {
    position: fixed !important;
    left: -60px !important; /* 默认隐藏在左边 */
    top: 50% !important;
    transform: translateY(-50%);
    width: 80px;
    height: 40px;
    padding: 0;
    border-radius: 0 20px 20px 0;
    box-shadow: 2px 0 8px rgba(102, 126, 234, 0.4);
    transition: left 0.3s ease;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 12px;
  }

  /* 箭头悬停时稍微伸出 */
  .chat-button:active {
    left: -50px !important;
  }

  .chat-icon {
    display: none; /* 隐藏 emoji 图标 */
  }

  .chat-label {
    display: none; /* 收起时不显示文字 */
  }

  /* 添加向右箭头 */
  .chat-button::before {
    content: '→';
    font-size: 20px;
    font-weight: bold;
    position: absolute;
    right: 12px;
  }

  /* 移动端遮罩层 */
  .mobile-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.3);
    z-index: 999;
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  /* 展开后显示"AI助手"按钮（左侧垂直居中） */
  .ai-chat-widget.show-button .chat-button {
    left: 0 !important;
    top: 50% !important;
    transform: translateY(-50%);
    width: auto;
    height: auto;
    padding: 10px 16px;
    border-radius: 0 20px 20px 0;
    justify-content: center;
    gap: 8px;
    z-index: 1000;
    box-shadow: 2px 0 12px rgba(102, 126, 234, 0.4);
    animation: slideInFromLeft 0.3s ease;
  }

  @keyframes slideInFromLeft {
    from {
      transform: translateY(-50%) translateX(-100%);
      opacity: 0;
    }
    to {
      transform: translateY(-50%) translateX(0);
      opacity: 1;
    }
  }

  .ai-chat-widget.show-button .chat-button::before {
    content: none;
  }

  .ai-chat-widget.show-button .chat-icon {
    display: inline;
  }

  .ai-chat-widget.show-button .chat-label {
    display: inline;
    font-size: 14px;
    font-weight: 600;
  }

  /* 移动端展开时全屏显示 */
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
    display: none; /* 全屏时隐藏按钮 */
  }

  .chat-window {
    width: 100vw;
    height: 100dvh;
    max-width: 100vw;
    border-radius: 0;
    display: flex;
    flex-direction: column;
  }

  /* 移动端标题栏不可拖动 */
  .chat-header {
    cursor: default;
    flex-shrink: 0;
  }

  /* 当前单词信息 */
  .current-word-info {
    flex-shrink: 0;
  }

  /* 移动端聊天消息区域调整 */
  .chat-messages {
    padding: 16px;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  /* 移动端输入区域调整 */
  .chat-input-area {
    padding: 12px 16px;
    padding-bottom: max(12px, env(safe-area-inset-bottom));
    flex-shrink: 0;
    background: white;
  }
}

/* 滚动条样式 */
.chat-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-track {
  background: transparent;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: #cbd5e0;
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: #a0aec0;
}
</style>
