/**
 * 课时 JSON 数据加载 composable
 *
 * 从静态路径 fetch JSON 文件，支持缓存
 */

import { ref, watchEffect } from 'vue'
import { courses } from '../data/courses'
import type { Lesson } from '../types/lesson'

const cache = new Map<string, Lesson>()

export function useLessonData(courseId: string, lessonId: string) {
  const lesson = ref<Lesson | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)

  watchEffect(async () => {
    loading.value = true
    error.value = null
    lesson.value = null

    const config = courses[courseId]
    if (!config) {
      error.value = `未知课程: ${courseId}`
      loading.value = false
      return
    }

    const jsonUrl = `${config.basePath}/${lessonId}.json`
    const cacheKey = jsonUrl

    if (cache.has(cacheKey)) {
      lesson.value = cache.get(cacheKey)!
      loading.value = false
      return
    }

    try {
      const resp = await fetch(jsonUrl)
      if (!resp.ok) throw new Error(`加载失败: ${resp.status}`)
      const data: Lesson = await resp.json()
      cache.set(cacheKey, data)
      lesson.value = data
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载课时数据失败'
    } finally {
      loading.value = false
    }
  })

  return { lesson, loading, error }
}
