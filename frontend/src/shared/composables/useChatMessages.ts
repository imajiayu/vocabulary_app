import { ref, nextTick, watch, type Ref } from 'vue'
import type { Word } from '@/shared/types'
import { api } from '@/shared/api'
import { formatMarkdown } from '@/shared/utils/markdown'
import { logger } from '@/shared/utils/logger'

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function useChatMessages(
  currentWord: Ref<Word | null | undefined>,
  isExpanded: Ref<boolean>
) {
  const userInput = ref('')
  const messages = ref<Message[]>([])
  const isLoading = ref(false)
  const messagesContainer = ref<HTMLElement | null>(null)

  const formatMessage = formatMarkdown

  function scrollToBottom() {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  }

  function handleSuggestionClick(question: string) {
    userInput.value = question
    sendMessage()
  }

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

  // Clear messages when switching words
  watch(currentWord, (newWord, oldWord) => {
    if (newWord && oldWord && newWord.id !== oldWord.id) {
      messages.value = []
    }
  })

  return {
    userInput,
    messages,
    isLoading,
    messagesContainer,
    formatMessage,
    scrollToBottom,
    handleSuggestionClick,
    sendMessage
  }
}
