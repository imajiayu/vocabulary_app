/**
 * 共享 Source 选择状态（模块级单例）
 *
 * 原因：Source 选择已从课时页面内部提升到课程顶部导航栏。
 * TopBar / VocabPreloadSection / CourseLessonPage 需要响应式共享同一份状态，
 * 避免在不同组件中各自持有独立 ref 导致更新不同步。
 *
 * 按 courseId 分组缓存，切换课程时自动恢复该课程上次选择的 source。
 */

import { ref, computed } from 'vue'
import { api } from '@/shared/api'
import type { CourseConfig } from '../types/course'
import type { SourceLang } from '@/shared/types'

const STORAGE_KEY_PREFIX = 'course_selected_source:'

interface CourseSourceState {
  list: string[]
  selected: string
  loading: boolean
  loaded: boolean
}

const stateMap = new Map<string, ReturnType<typeof createState>>()

function createState() {
  const list = ref<string[]>([])
  const selected = ref('')
  const loading = ref(false)
  const loaded = ref(false)
  return { list, selected, loading, loaded } satisfies Record<keyof CourseSourceState, any>
}

function getState(courseId: string) {
  if (!stateMap.has(courseId)) stateMap.set(courseId, createState())
  return stateMap.get(courseId)!
}

export function useCourseSource(config: CourseConfig) {
  const state = getState(config.id)
  const storageKey = STORAGE_KEY_PREFIX + config.id

  async function loadSources(force = false) {
    if (state.loading.value) return
    if (state.loaded.value && !force) return
    state.loading.value = true
    try {
      const settings = await api.settings.getSettings()
      const customSources = (settings.sources?.customSources ?? {}) as Record<string, SourceLang>
      const order = settings.sources?.sourceOrder?.length
        ? settings.sources.sourceOrder
        : Object.keys(customSources)

      state.list.value = order.filter(s => customSources[s] === config.lang)

      if (state.list.value.length) {
        const stored = localStorage.getItem(storageKey) || ''
        state.selected.value = state.list.value.includes(stored)
          ? stored
          : state.list.value[0]
      } else {
        state.selected.value = ''
      }
      state.loaded.value = true
    } finally {
      state.loading.value = false
    }
  }

  function setSelected(source: string) {
    if (!state.list.value.includes(source)) return
    state.selected.value = source
    localStorage.setItem(storageKey, source)
  }

  return {
    sourceList: state.list,
    selectedSource: state.selected,
    hasSources: computed(() => state.list.value.length > 0),
    isLoading: state.loading,
    loadSources,
    setSelected
  }
}
