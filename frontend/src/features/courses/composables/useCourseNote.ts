/**
 * 课程便笺 composable
 *
 * 便笺存在 course_progress.progress._notes（与 _exercises 并列），
 * 不新建表。body 由作者通过本地脚本直连数据库写入；
 * 当前登录用户（收件人）只读 body，可写 reply（回复）。
 *
 * _notes 结构：
 *   { "<lessonId>": { body, author?, reply?, repliedAt?, createdAt? },
 *     "__all":      { ... 全课程通用，所有课时页都显示 } }
 */

import { ref } from 'vue'
import { supabase } from '@/shared/config/supabase'
import { getCurrentUserId } from '@/shared/composables/useAuth'

/** 全课程通用便笺的键 */
export const ALL_LESSONS_KEY = '__all'

export interface CourseNote {
  /** lessonId 或 ALL_LESSONS_KEY */
  key: string
  body: string
  author?: string
  reply?: string | null
  repliedAt?: string | null
  createdAt?: string
}

type RawNote = Omit<CourseNote, 'key'>

export function useCourseNote(course: string, lessonId: string) {
  const notes = ref<CourseNote[]>([])

  /** 读当前登录用户的 _notes，返回当前课时专属 + 全课程通用的便笺 */
  async function fetchNotes(): Promise<void> {
    let userId: string
    try {
      userId = getCurrentUserId()
    } catch {
      notes.value = []
      return
    }

    const { data } = await supabase
      .from('course_progress')
      .select('progress')
      .eq('user_id', userId)
      .eq('course', course)
      .maybeSingle()

    const progress = data?.progress as Record<string, unknown> | undefined
    const raw = progress?._notes as Record<string, RawNote> | undefined
    if (!raw) {
      notes.value = []
      return
    }

    const result: CourseNote[] = []
    const specific = raw[lessonId]
    if (specific?.body) result.push({ key: lessonId, ...specific })
    const all = raw[ALL_LESSONS_KEY]
    if (all?.body) result.push({ key: ALL_LESSONS_KEY, ...all })
    notes.value = result
  }

  /**
   * 回复某条便笺：读 → 改 _notes[key].reply → 回写整个 progress（保留其它键）。
   * 收件人对自己的 course_progress 有 RLS FOR ALL 权限。
   */
  async function reply(noteKey: string, text: string): Promise<boolean> {
    let userId: string
    try {
      userId = getCurrentUserId()
    } catch {
      return false
    }

    const { data: existing } = await supabase
      .from('course_progress')
      .select('progress')
      .eq('user_id', userId)
      .eq('course', course)
      .maybeSingle()

    const progress = (existing?.progress as Record<string, unknown>) || {}
    const allNotes = (progress._notes as Record<string, RawNote>) || {}
    if (!allNotes[noteKey]) return false

    const repliedAt = new Date().toISOString()
    allNotes[noteKey] = { ...allNotes[noteKey], reply: text, repliedAt }
    const merged = { ...progress, _notes: allNotes }

    const { error } = await supabase
      .from('course_progress')
      .upsert(
        { user_id: userId, course, progress: merged },
        { onConflict: 'user_id,course' }
      )
    if (error) return false

    const local = notes.value.find(n => n.key === noteKey)
    if (local) {
      local.reply = text
      local.repliedAt = repliedAt
    }
    return true
  }

  return { notes, fetchNotes, reply }
}
