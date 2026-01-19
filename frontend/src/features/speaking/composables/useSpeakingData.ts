import { ref, computed } from 'vue'
import type { Question, TopicGroup, PartGroup } from '@/shared/types'
import { api } from '@/shared/api'
import { speakingLogger } from '@/shared/utils/logger'

export function useSpeakingData() {
  // State
  const loading = ref(false)
  const topics = ref<TopicGroup[]>([])
  const selectedQuestion = ref<Question | null>(null)
  const expandedParts = ref(new Set<number>())
  const expandedTopics = ref(new Set<number>())

  // Computed
  const partGroups = computed((): PartGroup[] => {
    return [1, 2].map(number => ({
      number,
      topics: topics.value
        .filter(t => t.part === number)
        .sort((a, b) => a.id - b.id)
    }))
  })

  // Load topics from API
  async function loadTopics() {
    loading.value = true
    try {
      const data = await api.speaking.getTopics()
      if (Array.isArray(data)) {
        topics.value = JSON.parse(JSON.stringify(data))
      } else {
        speakingLogger.error('API返回的数据格式不正确:', data)
        topics.value = []
      }
    } catch (e) {
      speakingLogger.error('加载目录失败:', e)
      topics.value = []
    } finally {
      loading.value = false
    }
  }

  // Clear all data
  function clearData() {
    topics.value = []
    expandedParts.value.clear()
    expandedTopics.value.clear()
    selectedQuestion.value = null
  }

  // Toggle part expansion
  function togglePart(partNumber: number) {
    expandedParts.value.has(partNumber)
      ? expandedParts.value.delete(partNumber)
      : expandedParts.value.add(partNumber)
  }

  // Toggle topic expansion
  function toggleTopic(topicId: number) {
    expandedTopics.value.has(topicId)
      ? expandedTopics.value.delete(topicId)
      : expandedTopics.value.add(topicId)
  }

  // Select a question
  function selectQuestion(question: Question | null) {
    selectedQuestion.value = question
  }

  // Expand to show selected question
  function expandToQuestion(questionId: number | undefined) {
    if (!questionId || topics.value.length === 0) return

    for (const topic of topics.value) {
      const question = topic.questions?.find(q => q.id === questionId)
      if (question) {
        expandedParts.value.add(topic.part)
        expandedTopics.value.add(topic.id)
        return topic
      }
    }
    return null
  }

  // Add topic
  async function addTopic(partNumber: number, title: string) {
    loading.value = true
    try {
      const newTopic = await api.speaking.createTopic({ part: partNumber, title })
      topics.value = [...topics.value, { ...newTopic }]
      expandedTopics.value.add(newTopic.id)
      return newTopic
    } catch (e) {
      speakingLogger.error('添加主题失败:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  // Edit topic
  async function editTopic(topicId: number, newTitle: string) {
    loading.value = true
    try {
      const updatedTopic = await api.speaking.updateTopic(topicId, { title: newTitle })
      topics.value = topics.value.map(topic =>
        topic.id === topicId ? { ...updatedTopic } : topic
      )
      return updatedTopic
    } catch (e) {
      speakingLogger.error('编辑主题失败:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  // Delete topic
  async function deleteTopic(topicId: number) {
    loading.value = true
    try {
      const topicToDelete = topics.value.find(t => t.id === topicId)
      const shouldClearSelection = topicToDelete?.questions?.some(
        q => q.id === selectedQuestion.value?.id
      )

      await api.speaking.deleteTopic(topicId)
      topics.value = topics.value.filter(t => t.id !== topicId)
      expandedTopics.value = new Set(
        [...expandedTopics.value].filter(id => id !== topicId)
      )

      if (shouldClearSelection) {
        selectedQuestion.value = null
        return { clearedSelection: true }
      }
      return { clearedSelection: false }
    } catch (e) {
      speakingLogger.error('删除主题失败:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  // Add question
  async function addQuestion(topicId: number, questionText: string) {
    loading.value = true
    try {
      const newQuestion = await api.speaking.createQuestion({
        topic_id: topicId,
        question_text: questionText
      })
      const index = topics.value.findIndex(t => t.id === topicId)
      if (index !== -1) {
        topics.value[index] = {
          ...topics.value[index],
          questions: [...topics.value[index].questions, newQuestion]
        }
        topics.value = [...topics.value]
        expandedTopics.value.add(topicId)
      }
      return newQuestion
    } catch (e) {
      speakingLogger.error('添加问题失败:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  // Edit question
  async function editQuestion(questionId: number, newText: string) {
    loading.value = true
    try {
      const updatedQuestion = await api.speaking.updateQuestion(questionId, {
        question_text: newText
      })
      topics.value = topics.value.map(topic => {
        if (topic.questions.some(q => q.id === questionId)) {
          return {
            ...topic,
            questions: topic.questions.map(q =>
              q.id === questionId ? updatedQuestion : q
            )
          }
        }
        return topic
      })
      return updatedQuestion
    } catch (e) {
      speakingLogger.error('编辑问题失败:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  // Delete question
  async function deleteQuestion(questionId: number) {
    loading.value = true
    try {
      await api.speaking.deleteQuestion(questionId)
      topics.value = topics.value.map(topic => ({
        ...topic,
        questions: topic.questions.filter(q => q.id !== questionId)
      }))

      const shouldClearSelection = selectedQuestion.value?.id === questionId
      if (shouldClearSelection) {
        selectedQuestion.value = null
        return { clearedSelection: true }
      }
      return { clearedSelection: false }
    } catch (e) {
      speakingLogger.error('删除问题失败:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  // Clear all questions
  async function clearAllQuestions() {
    loading.value = true
    try {
      await api.speaking.clearAllQuestions()
      clearData()
    } catch (e) {
      speakingLogger.error('清除题目失败:', e)
      throw e
    } finally {
      loading.value = false
    }
  }

  return {
    // State
    loading,
    topics,
    selectedQuestion,
    expandedParts,
    expandedTopics,
    partGroups,

    // Actions
    loadTopics,
    clearData,
    togglePart,
    toggleTopic,
    selectQuestion,
    expandToQuestion,
    addTopic,
    editTopic,
    deleteTopic,
    addQuestion,
    editQuestion,
    deleteQuestion,
    clearAllQuestions
  }
}
