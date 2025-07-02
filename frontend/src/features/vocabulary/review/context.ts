// features/vocabulary/review/context.ts
// Review Context - 使用 Provide/Inject 避免 props drilling
import { provide, inject, type InjectionKey, type Ref, type ComputedRef } from 'vue'
import type { Word } from '@/shared/types'
import type { ReviewMode, AudioType, WordResult } from '../stores/review'

/**
 * Review Context 接口
 * 提供复习页面的核心状态和操作给深层嵌套组件
 */
export interface ReviewContext {
  // 状态
  mode: Ref<ReviewMode>
  audioType: Ref<AudioType>
  currentWord: ComputedRef<Word | null>
  shuffle: Ref<boolean>

  // 操作
  submitResult: (wordId: number, result: WordResult) => void
  stopReviewWord: (wordId: number) => void
}

const REVIEW_CONTEXT_KEY: InjectionKey<ReviewContext> = Symbol('review-context')

/**
 * 在 ReviewPage 中调用，提供上下文给所有子组件
 */
export function provideReviewContext(context: ReviewContext) {
  provide(REVIEW_CONTEXT_KEY, context)
}

/**
 * 在子组件中调用，获取复习上下文
 * @throws 如果在 ReviewPage 之外调用会抛出错误
 */
export function useReviewContext(): ReviewContext {
  const context = inject(REVIEW_CONTEXT_KEY)
  if (!context) {
    throw new Error('useReviewContext must be used within ReviewPage')
  }
  return context
}

/**
 * 安全版本：尝试获取复习上下文，如果不存在返回 null
 * 用于可能在 ReviewPage 内外都使用的组件
 */
export function useReviewContextOptional(): ReviewContext | null {
  return inject(REVIEW_CONTEXT_KEY, null)
}
