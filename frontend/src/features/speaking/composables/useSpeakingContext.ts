import { provide, inject, computed, type InjectionKey, type Ref, type ComputedRef } from 'vue'
import type { Question, TopicGroup } from '@/shared/types'
import { useSpeakingData } from './useSpeakingData'

/**
 * Speaking Context 接口
 * 提供给深层组件的状态和操作函数
 */
export interface SpeakingContext {
  // 状态 (只读)
  loading: Ref<boolean>
  expandedParts: Ref<Set<number>>
  expandedTopics: Ref<Set<number>>
  selectedQuestionId: ComputedRef<number | null>

  // Part 操作
  togglePart: (partNumber: number) => void

  // Topic 操作
  toggleTopic: (topicId: number) => void
  addTopic: (partNumber: number, title: string) => Promise<TopicGroup>
  editTopic: (topicId: number, title: string) => Promise<TopicGroup>
  deleteTopic: (topicId: number) => Promise<void>

  // Question 操作
  addQuestion: (topicId: number, text: string) => Promise<Question>
  editQuestion: (questionId: number, text: string) => Promise<Question>
  deleteQuestion: (questionId: number) => Promise<void>
  selectQuestion: (question: Question) => void

  // 需要向外部通知的回调
  onQuestionSelected?: (question: Question | null) => void
}

/**
 * 创建 Speaking Context 的参数
 */
export interface CreateSpeakingContextOptions {
  onQuestionSelected?: (question: Question | null) => void
}

const SPEAKING_CONTEXT_KEY: InjectionKey<SpeakingContext> = Symbol('speaking-context')

/**
 * 创建并提供 Speaking Context
 * 在 SpeakingSidebar 中调用，整合 useSpeakingData 并提供给子组件
 */
export function createSpeakingContext(options: CreateSpeakingContextOptions = {}) {
  const data = useSpeakingData()

  const selectedQuestionId = computed(() => data.selectedQuestion.value?.id ?? null)

  // 包装删除操作，处理选中状态清除
  async function handleDeleteTopic(topicId: number) {
    if (!confirm('确定要删除此主题及其所有问题吗？')) return
    const result = await data.deleteTopic(topicId)
    if (result.clearedSelection) {
      options.onQuestionSelected?.(null)
    }
  }

  async function handleDeleteQuestion(questionId: number) {
    if (!confirm('确定要删除此问题吗？')) return
    const result = await data.deleteQuestion(questionId)
    if (result.clearedSelection) {
      options.onQuestionSelected?.(null)
    }
  }

  // 包装选中操作，支持 toggle（再次点击取消选中）
  function handleSelectQuestion(question: Question) {
    const isAlreadySelected = data.selectedQuestion.value?.id === question.id
    if (isAlreadySelected) {
      data.selectQuestion(null)
      options.onQuestionSelected?.(null)
    } else {
      data.selectQuestion(question)
      options.onQuestionSelected?.(question)
    }
  }

  const context: SpeakingContext = {
    // 状态
    loading: data.loading,
    expandedParts: data.expandedParts,
    expandedTopics: data.expandedTopics,
    selectedQuestionId,

    // Part 操作
    togglePart: data.togglePart,

    // Topic 操作
    toggleTopic: data.toggleTopic,
    addTopic: data.addTopic,
    editTopic: data.editTopic,
    deleteTopic: handleDeleteTopic,

    // Question 操作
    addQuestion: data.addQuestion,
    editQuestion: data.editQuestion,
    deleteQuestion: handleDeleteQuestion,
    selectQuestion: handleSelectQuestion,

    onQuestionSelected: options.onQuestionSelected
  }

  provide(SPEAKING_CONTEXT_KEY, context)

  // 返回 data 以便 SpeakingSidebar 使用其他方法
  return {
    context,
    data
  }
}

/**
 * 在子组件中注入 Speaking Context
 * @returns Speaking Context 对象
 * @throws Error 如果在 SpeakingSidebar 外部使用
 */
export function useSpeakingContext(): SpeakingContext {
  const context = inject(SPEAKING_CONTEXT_KEY)
  if (!context) {
    throw new Error('useSpeakingContext must be used within SpeakingSidebar')
  }
  return context
}
