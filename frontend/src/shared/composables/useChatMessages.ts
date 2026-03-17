import { ref, nextTick, watch, type Ref } from 'vue'
import type { SourceLang, Word } from '@/shared/types'
import { api } from '@/shared/api'
import { formatMarkdown } from '@/shared/utils/markdown'
import { logger } from '@/shared/utils/logger'
import { useSettings } from './useSettings'

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function useChatMessages(
  currentWord: Ref<Word | null | undefined>,
  isExpanded: Ref<boolean>
) {
  const { settings, loadSettings } = useSettings()
  const userInput = ref('')
  const messages = ref<Message[]>([])
  const isLoading = ref(false)
  const messagesContainer = ref<HTMLElement | null>(null)

  const formatMessage = formatMarkdown

  function scrollToBottom() {
    if (messagesContainer.value) {
      requestAnimationFrame(() => {
        if (messagesContainer.value) {
          messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
        }
      })
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

    isLoading.value = true
    try {
      const definitions = currentWord.value?.definition?.definitions || []
      const definitionText = definitions.join('; ')

      await loadSettings()
      const customSources = settings.value?.sources?.customSources || {}
      const source = currentWord.value?.source || ''
      const lang: SourceLang = customSources[source] ?? 'en'

      const result = await api.vocabularyAssistance.sendMessage({
        message: message,
        word: currentWord.value?.word || '',
        definition: definitionText || '',
        lang,
      })

      messages.value.push({
        role: 'assistant',
        content: result.response
      })
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

  // Auto-scroll when messages change or loading state changes
  watch(
    [() => messages.value.length, isLoading],
    () => scrollToBottom(),
    { flush: 'post' }
  )

  // Scroll to bottom when panel reopens with existing messages
  watch(isExpanded, (expanded) => {
    if (expanded && messages.value.length > 0) {
      nextTick(() => setTimeout(() => scrollToBottom(), 50))
    }
  })

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
