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
}
