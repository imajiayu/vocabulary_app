/**
 * 课程练习状态 Supabase 同步
 *
 * 存储路径：course_progress.progress._exercises[lessonId] = envelope
 * 与 useCourseProgress（管 checkbox）共享同一行，互不冲突。
 */

import { supabase } from '@/shared/config/supabase'
import { getCurrentUserId } from '@/shared/composables/useAuth'
import type { StoredEnvelope } from './useExerciseState'

/**
 * course_progress.progress 是单个 JSON 列，练习答案（_exercises）与 checkbox 进度
 * 共用同一行。两者都做 read-merge-upsert，并发时会丢失更新。
 * 用一条全局 promise 链把所有写串行化：每次写都在前一次完成后才 re-read，杜绝交错覆盖。
 */
let writeChain: Promise<unknown> = Promise.resolve()

export function serializeCourseWrite<T>(task: () => Promise<T>): Promise<T> {
  const run = writeChain.then(task, task)
  // 链尾吞掉结果与异常，避免后续写被前一次失败阻断
  writeChain = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

/**
 * 从 Supabase 加载单个课时的练习 envelope。
 * 无记录或字段缺失时返回 null。
 */
export async function loadFromSupabase(
  courseId: string,
  lessonId: string
): Promise<StoredEnvelope | null> {
  try {
    const userId = getCurrentUserId()
    const { data, error } = await supabase
      .from('course_progress')
      .select('progress')
      .eq('user_id', userId)
      .eq('course', courseId)
      .maybeSingle()

    if (error || !data?.progress) return null

    const progress = data.progress as Record<string, unknown>
    const exercises = progress._exercises as Record<string, unknown> | undefined
    const envelope = exercises?.[lessonId] as StoredEnvelope | undefined
    if (!envelope || typeof envelope !== 'object') return null
    return envelope
  } catch {
    return null
  }
}

/**
 * 把 envelope 保存到 Supabase。
 * 读取现有 progress → 合并 _exercises[lessonId] → upsert。
 */
export async function saveToSupabase(
  courseId: string,
  lessonId: string,
  envelope: StoredEnvelope
): Promise<void> {
  return serializeCourseWrite(async () => {
    try {
      const userId = getCurrentUserId()

      // 读取当前 progress（保留 checkbox 数据和其他课时的 _exercises）
      const { data: existing } = await supabase
        .from('course_progress')
        .select('progress')
        .eq('user_id', userId)
        .eq('course', courseId)
        .maybeSingle()

      const currentProgress = (existing?.progress as Record<string, unknown>) || {}
      const currentExercises = (currentProgress._exercises as Record<string, unknown>) || {}

      const merged = {
        ...currentProgress,
        _exercises: {
          ...currentExercises,
          [lessonId]: envelope
        }
      }

      await supabase
        .from('course_progress')
        .upsert(
          { user_id: userId, course: courseId, progress: merged },
          { onConflict: 'user_id,course' }
        )
    } catch {
      // 网络错误静默失败，下次 state 变化会再次触发同步
    }
  })
}
