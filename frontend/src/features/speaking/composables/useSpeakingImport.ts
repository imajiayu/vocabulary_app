import { ref } from 'vue'
import { api } from '@/shared/api'
import { speakingLogger } from '@/shared/utils/logger'

export interface ParsedTopic {
  title: string
  questions: string[]
}

export function useSpeakingImport() {
  const showImportMenu = ref(false)
  const fileInputRef = ref<HTMLInputElement | null>(null)
  const selectedPart = ref<1 | 2>(1)
  const isImporting = ref(false)

  function toggleImportMenu() {
    showImportMenu.value = !showImportMenu.value
  }

  function closeImportMenu() {
    showImportMenu.value = false
  }

  function triggerFileInput(part: 1 | 2) {
    selectedPart.value = part
    showImportMenu.value = false
    fileInputRef.value?.click()
  }

  function parseQuestionsText(text: string, part: 1 | 2): ParsedTopic[] {
    const topics: ParsedTopic[] = []
    const blocks = text.trim().split('\n\n')

    for (const block of blocks) {
      const lines = block.split('\n').map(line => line.trim()).filter(line => line)
      if (lines.length === 0) continue

      if (part === 1) {
        // Part 1 format: topic title + question list
        if (lines[0].includes('Part 1') || lines[0].startsWith('##')) continue

        const title = lines[0]
        const questions = lines.slice(1)

        if (questions.length > 0) {
          topics.push({ title, questions })
        }
      } else {
        // Part 2&3 format: "Describe..." prompt + bullet points
        if (lines[0].startsWith('Describe')) {
          const title = lines[0]
          const questionContent = lines.slice(1).join('\n')
          topics.push({ title, questions: [title + '\n' + questionContent] })
        }
      }
    }

    return topics
  }

  async function handleFileSelected(
    event: Event,
    onSuccess: () => Promise<void>
  ): Promise<{ success: boolean; message: string }> {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]

    if (!file) {
      return { success: false, message: '未选择文件' }
    }

    // Validate file type
    if (!file.name.endsWith('.txt')) {
      input.value = ''
      return { success: false, message: '请选择 .txt 格式的文件' }
    }

    isImporting.value = true
    try {
      // Read file content
      const text = await file.text()

      // Parse questions
      const topicsData = parseQuestionsText(text, selectedPart.value)

      if (topicsData.length === 0) {
        return { success: false, message: '文件中没有找到有效的题目' }
      }

      // Call import API
      const result = await api.speaking.importQuestionsFromData(
        topicsData,
        selectedPart.value
      )

      // Reload data
      await onSuccess()

      return {
        success: true,
        message: `导入成功！\n新增主题数：${result.topics_count}\n新增问题数：${result.questions_count}`
      }
    } catch (e) {
      speakingLogger.error('导入题目失败:', e)
      return {
        success: false,
        message: `导入题目失败：${e instanceof Error ? e.message : '未知错误'}`
      }
    } finally {
      isImporting.value = false
      input.value = ''
    }
  }

  return {
    showImportMenu,
    fileInputRef,
    selectedPart,
    isImporting,
    toggleImportMenu,
    closeImportMenu,
    triggerFileInput,
    handleFileSelected,
    parseQuestionsText
  }
}
