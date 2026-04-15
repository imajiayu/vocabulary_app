/**
 * 练习状态持久化 composable（URL 无关 + 向前兼容 + Supabase 真相源）
 *
 * 存储 key 只与业务 ID 挂钩：`exercise.${courseId}.${lessonId}`
 * 代码重构、路由变更、组件改名都不影响已有数据。
 *
 * Envelope 格式保证未知字段透传 —— 未来增字段时，旧版本代码仍能读取旧数据
 * 且不丢失它不认识的字段。
 */

import { reactive, watch } from 'vue'
import { loadFromSupabase, saveToSupabase } from './useCourseExerciseSync'

const SCHEMA_VERSION = 1

export interface ExerciseState {
  radio: Record<string, string>
  textarea: Record<string, string>
  fillBlank: Record<string, string>
  quizGraded: number[]
  fillBlankGraded: number[]
  translateGraded: number[]
  aiResults: Record<string, unknown>
  hintsUsed: Record<string, number>
}

export interface StoredEnvelope {
  schemaVersion: number
  updatedAt: string
  data: ExerciseState
  [extra: string]: unknown
}

function createEmpty(): ExerciseState {
  return {
    radio: {},
    textarea: {},
    fillBlank: {},
    quizGraded: [],
    fillBlankGraded: [],
    translateGraded: [],
    aiResults: {},
    hintsUsed: {}
  }
}

function nowIso(): string {
  return new Date().toISOString()
}

/** 从任意形状的 parsed 对象提取 ExerciseState。兼容旧平铺格式（v8 之前）。 */
function unwrapData(parsed: unknown): ExerciseState {
  if (!parsed || typeof parsed !== 'object') return createEmpty()
  const obj = parsed as Record<string, unknown>
  // Envelope 格式
  if (obj.data && typeof obj.data === 'object') {
    return { ...createEmpty(), ...(obj.data as Partial<ExerciseState>) }
  }
  // 旧平铺格式
  return { ...createEmpty(), ...(obj as Partial<ExerciseState>) }
}

/** 尝试从 localStorage 取 envelope（含 updatedAt），失败返回 null */
function readLocalEnvelope(key: string): StoredEnvelope | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const data = unwrapData(parsed)
    const updatedAt = typeof parsed.updatedAt === 'string' ? parsed.updatedAt : nowIso()
    const schemaVersion = typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 0
    return { ...parsed, schemaVersion, updatedAt, data }
  } catch {
    return null
  }
}

/**
 * 一次性迁移：读旧 key（旧 exercise.js 使用的 `exercise_v8_${pathname}` 格式），
 * 写入新 key 并删除旧 key。
 */
function migrateLegacyKey(newKey: string, legacyKeys: string[]): StoredEnvelope | null {
  for (const legacyKey of legacyKeys) {
    try {
      const raw = localStorage.getItem(legacyKey)
      if (!raw) continue
      const parsed = JSON.parse(raw)
      const data = unwrapData(parsed)
      const envelope: StoredEnvelope = {
        schemaVersion: SCHEMA_VERSION,
        updatedAt: nowIso(),
        data
      }
      localStorage.setItem(newKey, JSON.stringify(envelope))
      localStorage.removeItem(legacyKey)
      return envelope
    } catch {
      // 忽略，尝试下一个
    }
  }
  return null
}

export interface UseExerciseStateOptions {
  /** 课程 ID，如 "legal-english"、"ukrainian" */
  courseId: string
  /** 课时 ID，如 "w1d2" */
  lessonId: string
  /** 课程 URL 前缀，仅用于 legacy 迁移，如 "/legal"、"/uk" */
  basePath: string
}

export function useExerciseState(options: UseExerciseStateOptions) {
  const { courseId, lessonId, basePath } = options

  const storageKey = `exercise.${courseId}.${lessonId}`

  // 旧 key 格式：
  //   1) exercise_v8_/legal/w1d2.html  — 旧 exercise.js 使用 location.pathname
  //   2) exercise_v8_/legal/w1d2       — 新代码早期版本（过渡期可能有）
  const legacyKeys = [
    `exercise_v8_${basePath}/${lessonId}.html`,
    `exercise_v8_${basePath}/${lessonId}`
  ]

  // ── 1. 初始化：本地 → legacy 迁移 ──
  let localEnvelope = readLocalEnvelope(storageKey)
  if (!localEnvelope) {
    localEnvelope = migrateLegacyKey(storageKey, legacyKeys)
  }

  const initial = localEnvelope ? localEnvelope.data : createEmpty()
  const state = reactive<ExerciseState>(initial)

  // 记录 envelope 中未知字段（未来版本可能新增），写回时透传
  let envelopeExtras: Record<string, unknown> = {}
  if (localEnvelope) {
    const { schemaVersion: _sv, updatedAt: _ua, data: _d, ...rest } = localEnvelope
    envelopeExtras = rest
  }

  let lastUpdatedAt = localEnvelope?.updatedAt || nowIso()

  // ── 2. 异步合并 Supabase ──
  loadFromSupabase(courseId, lessonId).then(remote => {
    if (!remote) return
    const remoteTs = new Date(remote.updatedAt || 0).getTime()
    const localTs = new Date(lastUpdatedAt).getTime()
    if (remoteTs > localTs) {
      // 云端更新，覆盖本地
      const remoteData = unwrapData(remote)
      Object.assign(state, createEmpty(), remoteData)
      lastUpdatedAt = remote.updatedAt
      // 保留 envelope 未知字段
      const { schemaVersion: _sv, updatedAt: _ua, data: _d, ...rest } = remote
      envelopeExtras = { ...envelopeExtras, ...rest }
      writeLocal()
    } else if (localTs > remoteTs) {
      // 本地更新，推到云端
      writeRemote()
    }
    // 相等则不动
  })

  // ── 3. 写入 ──
  function buildEnvelope(): StoredEnvelope {
    return {
      ...envelopeExtras,
      schemaVersion: SCHEMA_VERSION,
      updatedAt: lastUpdatedAt,
      data: { ...state }
    }
  }

  function writeLocal() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(buildEnvelope()))
    } catch {
      // ignore
    }
  }

  function writeRemote() {
    saveToSupabase(courseId, lessonId, buildEnvelope())
  }

  // ── 4. 自动保存 ──
  let localTimer: ReturnType<typeof setTimeout> | null = null
  let remoteTimer: ReturnType<typeof setTimeout> | null = null

  function scheduleSave() {
    lastUpdatedAt = nowIso()

    if (localTimer) clearTimeout(localTimer)
    localTimer = setTimeout(writeLocal, 300)

    if (remoteTimer) clearTimeout(remoteTimer)
    remoteTimer = setTimeout(writeRemote, 3000)
  }

  watch(state, scheduleSave, { deep: true })

  return { state }
}
