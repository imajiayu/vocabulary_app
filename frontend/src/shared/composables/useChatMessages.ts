import { ref, nextTick, watch, type Ref } from 'vue'
import type { Word } from '@/shared/types'
import { api } from '@/shared/api'
import { ChatHistoryStorage, type ChatMessage } from '@/shared/utils/chatHistoryStorage'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import { logger } from '@/shared/utils/logger'

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

// Configure marked once
marked.setOptions({
  breaks: true,
  gfm: true
})

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 'code', 'pre',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'blockquote', 'hr',
  'a', 'img'
]

const ALLOWED_ATTR = ['href', 'src', 'alt', 'title', 'target']

export function useChatMessages(
  currentWord: Ref<Word | null | undefined>,
  isExpanded: Ref<boolean>
) {
  const userInput = ref('')
  const messages = ref<Message[]>([])
  const isLoading = ref(false)
  const messagesContainer = ref<HTMLElement | null>(null)

  // Load chat history for current word
  function loadChatHistory() {
    if (!currentWord.value) {
      messages.value = []
      return
    }

    const history = ChatHistoryStorage.getMessages(currentWord.value.word)
    messages.value = history.map(msg => ({
      role: msg.role,
      content: msg.content
    }))
  }

  // Save chat history for current word
  function saveChatHistory() {
    if (!currentWord.value || messages.value.length === 0) return

    const chatMessages: ChatMessage[] = messages.value.map(msg => ({
      role: msg.role,
      content: msg.content
    }))

    ChatHistoryStorage.saveMessages(currentWord.value.word, chatMessages)
  }

  // Format message content with markdown
  function formatMessage(content: string): string {
    const html = marked.parse(content) as string
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS,
      ALLOWED_ATTR
    })
  }

  // Scroll messages container to bottom
  function scrollToBottom() {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  }

  // Handle suggestion click
  function handleSuggestionClick(question: string) {
    userInput.value = question
    sendMessage()
  }

  // Send message to AI
  async function sendMessage() {
    if (!userInput.value.trim() || isLoading.value) return

    const message = userInput.value.trim()
    userInput.value = ''

    messages.value.push({
      role: 'user',
      content: message
    })

    await nextTick()
    scrollToBottom()

    isLoading.value = true
    try {
      const definitions = currentWord.value?.definition?.definitions || []
      const definitionText = definitions.join('; ')

      const result = await api.vocabularyAssistance.sendMessage({
        message: message,
        word: currentWord.value?.word || '',
        definition: definitionText || ''
      })

      messages.value.push({
        role: 'assistant',
        content: result.response
      })
      await nextTick()
      scrollToBottom()

      saveChatHistory()
    } catch (error) {
      logger.error('AI聊天失败:', error)
      messages.value.push({
        role: 'assistant',
        content: '抱歉，连接失败，请检查网络连接。'
      })
    } finally {
      isLoading.value = false
    }
  }

  // Watch for word changes to save/load history
  watch(currentWord, (newWord, oldWord) => {
    if (newWord && oldWord && newWord.id !== oldWord.id) {
      // Save old word's chat history
      if (oldWord && messages.value.length > 0) {
        const oldChatMessages: ChatMessage[] = messages.value.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
        ChatHistoryStorage.saveMessages(oldWord.word, oldChatMessages)
      }

      // Load new word's history if expanded
      if (isExpanded.value) {
        loadChatHistory()
      } else {
        messages.value = []
      }
    }
  })

  return {
    // State
    userInput,
    messages,
    isLoading,
    messagesContainer,

    // Actions
    loadChatHistory,
    saveChatHistory,
    formatMessage,
    scrollToBottom,
    handleSuggestionClick,
    sendMessage
  }
}
