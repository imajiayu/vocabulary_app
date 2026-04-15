/**
 * 课程配置 composable
 */

import { computed } from 'vue'
import { courses } from '../data/courses'
import type { CourseConfig } from '../types/course'

export function useCourseConfig(courseId: string) {
  const config = computed<CourseConfig>(() => {
    const c = courses[courseId]
    if (!c) throw new Error(`Unknown course: ${courseId}`)
    return c
  })

  return { config }
}
