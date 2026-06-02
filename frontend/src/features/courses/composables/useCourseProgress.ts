/**
 * 课程进度 composable
 *
 * 管理 checkbox 进度同步到 Supabase course_progress 表
 */

import { ref } from 'vue'
import { supabase } from '@/shared/config/supabase'
import { getCurrentUserId } from '@/shared/composables/useAuth'
import { serializeCourseWrite } from './useCourseExerciseSync'

export function useCourseProgress(courseId: string) {
  const progress = ref<Record<string, boolean>>({})

  async function fetchProgress() {
    const userId = getCurrentUserId()
    const { data } = await supabase
      .from('course_progress')
      .select('progress')
      .eq('user_id', userId)
      .eq('course', courseId)
      .maybeSingle()

    if (data?.progress) {
      // 排除 _exercises 子键，只取 checkbox 进度
      const raw = data.progress as Record<string, unknown>
      const cleaned: Record<string, boolean> = {}
      for (const [k, v] of Object.entries(raw)) {
        if (k !== '_exercises' && typeof v === 'boolean') {
          cleaned[k] = v
        }
      }
      progress.value = cleaned
    }
  }

  async function saveProgress() {
    // 与练习答案写入共用串行锁：进入临界区后再 re-read，避免互相覆盖（丢失更新）
    return serializeCourseWrite(async () => {
      const userId = getCurrentUserId()
      // 读取完整 progress（包含 _exercises），合并 checkbox 数据后写回
      const { data: existing } = await supabase
        .from('course_progress')
        .select('progress')
        .eq('user_id', userId)
        .eq('course', courseId)
        .maybeSingle()

      const merged = { ...(existing?.progress as Record<string, unknown> || {}), ...progress.value }

      await supabase
        .from('course_progress')
        .upsert({
          user_id: userId,
          course: courseId,
          progress: merged
        }, { onConflict: 'user_id,course' })
    })
  }

  function toggleLesson(lessonId: string) {
    progress.value[lessonId] = !progress.value[lessonId]
    saveProgress()
  }

  function isCompleted(lessonId: string): boolean {
    return !!progress.value[lessonId]
  }

  return { fetchProgress, toggleLesson, isCompleted }
}
