<template>
  <div class="ai-chat-widget" :class="{ expanded: isExpanded }" :style="widgetPosition">
    <!-- 收起状态：浮动按钮 -->
    <div v-if="!isExpanded" class="chat-button" @click="toggleExpand" @mousedown="startDrag">
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
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import type { Word } from '@/shared/types'
import { api } from '@/shared/api'
import { ChatHistoryStorage, type ChatMessage } from '@/shared/utils/chatHistoryStorage'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { useTimerPause } from '@/shared/composables/useTimerPause'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

// Props
interface Props {
  currentWord?: Word | null
}

const props = withDefaults(defineProps<Props>(), {
  currentWord: null
})

// State
const isExpanded = ref(false)
const userInput = ref('')
const messages = ref<Message[]>([])
const isLoading = ref(false)
const messagesContainer = ref<HTMLElement | null>(null)

// 使用全局计时器暂停管理
const { requestPause, releasePause } = useTimerPause()

// localStorage key
const POSITION_STORAGE_KEY = 'vocabulary-assistance-widget-position'

// 拖动相关状态
const isDragging = ref(false)
const hasMoved = ref(false) // 是否真的移动了
const dragStartX = ref(0)
const dragStartY = ref(0)
const initialX = ref(0)
const initialY = ref(0)
const currentX = ref(0)
const currentY = ref(0)
const savedX = ref(0) // 保存的收起状态位置
const savedY = ref(0)
const DRAG_THRESHOLD = 5 // 拖动阈值（像素），超过这个距离才算拖动

// 加载保存的位置或使用默认位置
const loadPosition = () => {
  try {
    const saved = localStorage.getItem(POSITION_STORAGE_KEY)
    if (saved) {
      const { x, y } = JSON.parse(saved)
      currentX.value = x
      currentY.value = y
      savedX.value = x
      savedY.value = y
      return
    }
  } catch (error) {
    console.error('加载位置失败:', error)
  }

  // 使用默认位置
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const widgetWidth = 120 // 收起状态宽度
  const defaultRight = 16 // 1rem = 16px

  // 移动端：放在底部按钮栏上方
  // 桌面端：放在重置计时器按钮上方
  const isMobile = viewportWidth <= 768
  let defaultBottom

  if (isMobile) {
    // 移动端：底部按钮栏高度约 140px (2 * 3.5rem + 0.75rem + 2rem)
    // 再加上一些安全间距
    defaultBottom = 150 // 约 9.4rem
  } else {
    // 桌面端：重置计时器按钮上方
    defaultBottom = 72 // 4.5rem = 72px (1rem + 2.5rem 按钮 + 1rem 间距)
  }

  currentX.value = viewportWidth - widgetWidth - defaultRight
  currentY.value = viewportHeight - 50 - defaultBottom // 50 是收起状态的高度
  savedX.value = currentX.value
  savedY.value = currentY.value
}

// 保存位置到 localStorage
const savePosition = () => {
  try {
    localStorage.setItem(
      POSITION_STORAGE_KEY,
      JSON.stringify({ x: currentX.value, y: currentY.value })
    )
  } catch (error) {
    console.error('保存位置失败:', error)
  }
}

// 组件位置
const widgetPosition = computed(() => {
  if (currentX.value !== 0 || currentY.value !== 0) {
    return {
      position: 'fixed' as const,
      right: 'auto',
      bottom: 'auto',
      left: `${currentX.value}px`,
      top: `${currentY.value}px`,
    }
  }
  return {}
})

// 加载历史记录
const loadChatHistory = () => {
  if (!props.currentWord) {
    messages.value = []
    return
  }

  const history = ChatHistoryStorage.getMessages(props.currentWord.word)
  messages.value = history.map(msg => ({
    role: msg.role,
    content: msg.content
  }))
}

// 保存聊天记录
const saveChatHistory = () => {
  if (!props.currentWord || messages.value.length === 0) return

  const chatMessages: ChatMessage[] = messages.value.map(msg => ({
    role: msg.role,
    content: msg.content
  }))

  ChatHistoryStorage.saveMessages(props.currentWord.word, chatMessages)
}

// 方法
const toggleExpand = (e?: MouseEvent) => {
  // 如果正在拖动，或者刚刚拖动过，不触发展开/收起
  if (hasMoved.value) {
    hasMoved.value = false
    return
  }

  const wasExpanded = isExpanded.value
  isExpanded.value = !isExpanded.value

  // 控制计时器暂停/恢复
  if (isExpanded.value) {
    requestPause()
  } else {
    releasePause()
  }

  nextTick(() => {
    if (isExpanded.value) {
      // 展开时：先保存当前收起状态的位置
      savedX.value = currentX.value
      savedY.value = currentY.value
      // 然后调整位置以适应展开后的尺寸
      adjustPositionWithinBounds()
      // 加载聊天历史
      loadChatHistory()
    } else {
      // 收起时：恢复到保存的收起状态位置
      currentX.value = savedX.value
      currentY.value = savedY.value
      // 保存聊天记录
      saveChatHistory()
    }
  })
}

// 调整位置确保在屏幕内
const adjustPositionWithinBounds = () => {
  const widgetWidth = isExpanded.value ? 380 : 120
  const widgetHeight = isExpanded.value ? 600 : 50
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  // 如果当前位置会导致组件超出边界，调整位置
  if (currentX.value + widgetWidth > viewportWidth) {
    currentX.value = viewportWidth - widgetWidth
  }
  if (currentY.value + widgetHeight > viewportHeight) {
    currentY.value = viewportHeight - widgetHeight
  }

  // 确保不会超出左边和上边
  currentX.value = Math.max(0, currentX.value)
  currentY.value = Math.max(0, currentY.value)
}

// 处理示例问题点击
const handleSuggestionClick = (question: string) => {
  userInput.value = question
  sendMessage()
}

const sendMessage = async () => {
  if (!userInput.value.trim() || isLoading.value) return

  const message = userInput.value.trim()
  userInput.value = ''

  // 添加用户消息
  messages.value.push({
    role: 'user',
    content: message
  })

  // 滚动到底部
  await nextTick()
  scrollToBottom()

  // 调用AI API
  isLoading.value = true
  try {
    // 提取释义信息
    const definitions = props.currentWord?.definition?.definitions || []
    const definitionText = definitions.join('; ')

    const result = await api.vocabularyAssistance.sendMessage({
      message: message,
      word: props.currentWord?.word || '',
      definition: definitionText || ''
    })

    messages.value.push({
      role: 'assistant',
      content: result.response
    })
    await nextTick()
    scrollToBottom()

    // 保存聊天记录
    saveChatHistory()
  } catch (error) {
    console.error('AI聊天失败:', error)
    messages.value.push({
      role: 'assistant',
      content: '抱歉，连接失败，请检查网络连接。'
    })
  } finally {
    isLoading.value = false
  }
}

// 配置 marked
marked.setOptions({
  breaks: true, // 支持 GFM 换行
  gfm: true // 启用 GitHub Flavored Markdown
})

const formatMessage = (content: string) => {
  // 使用 marked 解析 Markdown
  const html = marked.parse(content) as string

  // 使用 DOMPurify 清理 HTML，防止 XSS 攻击
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 'u', 'code', 'pre',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'ul', 'ol', 'li',
      'blockquote', 'hr',
      'a', 'img'
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target']
  })
}

const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// 拖动功能
const startDrag = (e: MouseEvent) => {
  // 点击关闭按钮时不拖动
  if ((e.target as HTMLElement).closest('.close-button')) {
    return
  }

  // 点击输入框或发送按钮时不拖动
  if ((e.target as HTMLElement).closest('.chat-input-area')) {
    return
  }

  isDragging.value = true
  hasMoved.value = false
  dragStartX.value = e.clientX
  dragStartY.value = e.clientY

  // 如果还没有初始位置，使用当前位置
  if (currentX.value === 0 && currentY.value === 0) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    initialX.value = rect.left
    initialY.value = rect.top
    currentX.value = initialX.value
    currentY.value = initialY.value
  } else {
    initialX.value = currentX.value
    initialY.value = currentY.value
  }

  document.addEventListener('mousemove', handleDrag)
  document.addEventListener('mouseup', stopDrag)

  // 阻止默认行为，避免文本选择
  e.preventDefault()
}

const handleDrag = (e: MouseEvent) => {
  if (!isDragging.value) return

  const deltaX = e.clientX - dragStartX.value
  const deltaY = e.clientY - dragStartY.value

  // 检查是否超过拖动阈值
  if (!hasMoved.value && (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD)) {
    hasMoved.value = true
  }

  if (hasMoved.value) {
    let newX = initialX.value + deltaX
    let newY = initialY.value + deltaY

    // 获取组件尺寸（根据展开状态）
    const widgetWidth = isExpanded.value ? 380 : 120  // 展开时380px，收起时约120px
    const widgetHeight = isExpanded.value ? 600 : 50  // 展开时600px，收起时约50px

    // 获取视口尺寸
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    // 边界检测
    newX = Math.max(0, Math.min(newX, viewportWidth - widgetWidth))
    newY = Math.max(0, Math.min(newY, viewportHeight - widgetHeight))

    currentX.value = newX
    currentY.value = newY
  }
}

const stopDrag = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)

  // 如果真的移动了，保存位置到 localStorage 和 savedX/savedY
  if (hasMoved.value) {
    savedX.value = currentX.value
    savedY.value = currentY.value
    savePosition()
  }
}

// 监听当前词汇变化，保存旧词记录并加载新词记录
watch(() => props.currentWord, (newWord, oldWord) => {
  if (newWord && oldWord && newWord.id !== oldWord.id) {
    // 保存旧单词的聊天记录
    if (oldWord && messages.value.length > 0) {
      const oldChatMessages: ChatMessage[] = messages.value.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
      ChatHistoryStorage.saveMessages(oldWord.word, oldChatMessages)
    }

    // 加载新单词的聊天记录（如果展开状态）
    if (isExpanded.value) {
      loadChatHistory()
    } else {
      // 如果是收起状态，清空当前消息（展开时会重新加载）
      messages.value = []
    }
  }
})

// 监听窗口大小变化，调整位置
const handleWindowResize = () => {
  if (currentX.value !== 0 || currentY.value !== 0) {
    adjustPositionWithinBounds()
    // 窗口大小改变后，更新保存的位置（如果是收起状态）
    if (!isExpanded.value) {
      savedX.value = currentX.value
      savedY.value = currentY.value
      savePosition()
    }
  }
}

// 生命周期：添加和移除窗口resize监听
onMounted(() => {
  loadPosition()
  window.addEventListener('resize', handleWindowResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleWindowResize)
})
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
  /* 移动端展开时全屏显示 */
  .ai-chat-widget.expanded {
    position: fixed !important;
    left: 0 !important;
    top: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    width: 100% !important;
    height: 100% !important;
    z-index: 10000 !important;
  }

  .chat-window {
    width: 100vw;
    height: 100vh;
    max-width: 100vw;
    border-radius: 0;
  }

  .chat-button {
    padding: 10px 16px;
  }

  .chat-label {
    font-size: 13px;
  }

  /* 移动端聊天消息区域调整 */
  .chat-messages {
    padding: 16px;
  }

  /* 移动端输入区域调整 */
  .chat-input-area {
    padding: 12px 16px;
    padding-bottom: max(12px, env(safe-area-inset-bottom));
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
