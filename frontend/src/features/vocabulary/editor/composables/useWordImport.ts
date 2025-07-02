import { ref, type Ref } from 'vue'
import type { Word } from '@/shared/types'
import { api } from '@/shared/api'
import { handleWordInsertError } from '@/shared/utils/errorHandler'
import { logger } from '@/shared/utils/logger'

const log = logger.create('WordImport')

interface MessageState {
  type: string
  text: string
}

export function useWordImport(
  source: Ref<string>,
  inputRef: Ref<HTMLInputElement | undefined>,
  emit: {
    (event: 'wordInserted', word: Word): void
    (event: 'batchWordInserted', words: Word[]): void
  }
) {
  const word = ref('')
  const isLoading = ref(false)
  const isBatchLoading = ref(false)
  const message = ref<MessageState>({ type: '', text: '' })
  const fileInputRef = ref<HTMLInputElement>()

  // Clear message after timeout
  function clearMessageAfterDelay(delay: number = 3000) {
    setTimeout(() => {
      message.value = { type: '', text: '' }
    }, delay)
  }

  // Focus input after delay
  function focusInput() {
    setTimeout(() => {
      inputRef.value?.focus()
    }, 50)
  }

  // Submit single word
  async function handleSubmit() {
    if (!word.value.trim()) return

    isLoading.value = true
    message.value = { type: '', text: '' }

    try {
      const newWord = await api.words.createWordDirect(word.value, source.value)

      emit('wordInserted', newWord)
      word.value = ''
      message.value = { type: 'success', text: `单词添加成功（${source.value}）` }
    } catch (error) {
      const errorMessage = handleWordInsertError(error)
      message.value = {
        type: 'error',
        text: errorMessage
      }
    } finally {
      isLoading.value = false
    }

    clearMessageAfterDelay()
    focusInput()
  }

  // Trigger file input click
  function triggerFileInput() {
    fileInputRef.value?.click()
  }

  // Handle file selection for batch import
  async function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]

    if (!file) return

    if (!file.name.endsWith('.txt')) {
      message.value = { type: 'error', text: '请选择.txt文件' }
      clearMessageAfterDelay()
      return
    }

    isBatchLoading.value = true
    message.value = { type: '', text: '' }

    try {
      const text = await file.text()
      const words = text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)

      if (words.length === 0) {
        message.value = { type: 'error', text: '文件为空或格式不正确' }
        return
      }

      const result = await api.words.batchImportWordsDirect(words, source.value)

      let displayMsg = `批量导入完成：成功 ${result.success_count}，失败 ${result.failed_count}`

      if (result.failed_details && result.failed_details.length > 0) {
        displayMsg += '\n' + result.failed_details.join('\n')
        log.log('Failed words:', result.failed_words)
      }

      message.value = {
        type: result.failed_count === 0 ? 'success' : 'error',
        text: displayMsg
      }

      if (result.inserted_words && result.inserted_words.length > 0) {
        // 批量插入使用专用事件，支持并行获取释义
        emit('batchWordInserted', result.inserted_words)
      }
    } catch (error) {
      const errorMessage = handleWordInsertError(error)
      message.value = {
        type: 'error',
        text: `批量导入失败：${errorMessage}`
      }
    } finally {
      isBatchLoading.value = false
      target.value = ''
      clearMessageAfterDelay(5000)
    }
  }

  return {
    word,
    isLoading,
    isBatchLoading,
    message,
    fileInputRef,
    handleSubmit,
    triggerFileInput,
    handleFileSelect
  }
}
