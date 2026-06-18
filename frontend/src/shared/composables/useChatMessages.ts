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

  // Per-word chat history for the current review session (in-memory only).
  // 错题模式下同一单词会反复回到队首，切词时不能直接清空，否则再次复习到该词
  // 时之前的对话就丢了。这里按 word.id 暂存/恢复，使同一会话内每个单词的聊天保留。
  const sessionHistory = new Map<number, Message[]>()

  watch(currentWord, (newWord, oldWord) => {
    if (newWord?.id === oldWord?.id) return

    // 暂存离开的单词的对话
    if (oldWord) {
      sessionHistory.set(oldWord.id, messages.value)
    }

    // 恢复进入的单词的对话（没有则从空开始）
    messages.value = newWord ? sessionHistory.get(newWord.id) ?? [] : []
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
