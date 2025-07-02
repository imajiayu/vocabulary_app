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

    if (part === 1) {
      // Part 1: 每个 block 是一个 topic，第一行为 title，后续行为 questions
      const blocks = text.trim().split('\n\n')
      for (const block of blocks) {
        const lines = block.split('\n').map(l => l.trim()).filter(l => l)
        if (lines.length === 0) continue
        if (lines[0].includes('Part 1') || lines[0].startsWith('##')) continue

        const title = lines[0]
        const questions = lines.slice(1)
        if (questions.length > 0) {
          topics.push({ title, questions })
        }
      }
    } else {
      // Part 2&3: "Describe..." 开头为新 topic
      //   到下一个空行之前的内容合并为第 1 个 question（Part 2 提示卡）
      //   空行之后的每一行为独立 question（Part 3 问题）
      //   直到下一个 "Describe..." 或文件结束
      const lines = text.split('\n')
      let current: ParsedTopic | null = null
      let inPromptCard = false

      for (const raw of lines) {
        const line = raw.trim()

        if (line.startsWith('Describe')) {
          // 保存上一个 topic
          if (current && current.questions.length > 0) {
            topics.push(current)
          }
          current = { title: line, questions: [] }
          inPromptCard = true
          continue
        }

        if (!current) continue

        if (line === '') {
          // 空行：结束 prompt card 区域
          if (inPromptCard && current.questions.length === 0) {
            // prompt card 还没收集到内容，跳过空行
          }
          inPromptCard = false
          continue
        }

        if (inPromptCard) {
          // 累积 prompt card 行（You should say / bullet points）
          if (current.questions.length === 0) {
            current.questions.push(current.title + '\n' + line)
          } else {
            current.questions[0] += '\n' + line
          }
        } else {
          // Part 3 独立问题，每行一个
          current.questions.push(line)
        }
      }

      // 保存最后一个 topic
      if (current && current.questions.length > 0) {
        topics.push(current)
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

      // Call import API (直接使用 Supabase)
      const result = await api.speaking.importQuestions(
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
