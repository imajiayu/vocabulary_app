/**
 * 练习状态持久化 composable —— 云端单一真相源（Supabase only）。
 *
 * 不再使用 localStorage：所有答题记录只存 course_progress.progress._exercises[lessonId]。
 * 打开课时（挂载）即异步从云端拉取并填充 state；答题时短 debounce 实时写回云端。
 *
 * 多端语义：每台设备挂载时先把云端记录读入内存 state，新答案叠加其上后整体写回，
 * 因此「本设备未答、云端已答」的题目会被带入，「本设备本次新答」的题目也会保留。
 * 仅当两台设备在同一秒级窗口内并发答同一课时时，才可能后写覆盖（同一用户，罕见，可接受）。
 *
 * Envelope 格式（{schemaVersion, updatedAt, data, ...extras}）继续沿用以兼容历史云端数据，
 * 并为未来新增字段保留透传能力；updatedAt 仅作元数据，不再参与合并裁决。
 */

import { reactive, watch, nextTick } from 'vue'
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

/** 从任意形状的 parsed 对象提取 ExerciseState。兼容旧平铺格式与 envelope 格式。 */
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

const MAP_KEYS = ['radio', 'textarea', 'fillBlank', 'aiResults', 'hintsUsed'] as const
const ARRAY_KEYS = ['quizGraded', 'fillBlankGraded', 'translateGraded'] as const

/**
 * 把云端记录并入内存 state：云端为底，加载期间用户已输入的新答案胜（冲突取本地）。
 * 只补云端独有的键 / 数组元素，绝不删除本地已有内容 —— 保证两侧答案并集不丢失。
 */
function mergeRemoteInto(state: ExerciseState, remote: ExerciseState) {
  for (const key of MAP_KEYS) {
    const localMap = state[key] as Record<string, unknown>
    const remoteMap = remote[key] as Record<string, unknown>
    for (const k of Object.keys(remoteMap)) {
      if (!(k in localMap)) localMap[k] = remoteMap[k]
    }
  }
  for (const key of ARRAY_KEYS) {
    const union = [...new Set([...remote[key], ...state[key]])]
    state[key].splice(0, state[key].length, ...union)
  }
}

export interface UseExerciseStateOptions {
  /** 课程 ID，如 "ukrainian" */
  courseId: string
  /** 课时 ID，如 "w1d2" */
  lessonId: string
}

export function useExerciseState(options: UseExerciseStateOptions) {
  const { courseId, lessonId } = options

  const state = reactive<ExerciseState>(createEmpty())

  // envelope 中未知字段（未来版本可能新增），写回时透传
  let envelopeExtras: Record<string, unknown> = {}

  let loadDone = false       // 初始云端拉取是否完成
  let userDirty = false      // 加载完成前用户是否已答题
  let applyingRemote = false // 合并云端数据期间，抑制 watcher 触发的自动保存

  // ── 打开课时即拉取云端记录 ──
  loadFromSupabase(courseId, lessonId).then(remote => {
    applyingRemote = true
    if (remote) {
      mergeRemoteInto(state, unwrapData(remote))
      const { schemaVersion: _sv, updatedAt: _ua, data: _d, ...rest } = remote
      envelopeExtras = { ...envelopeExtras, ...rest }
    }
    loadDone = true
    // 合并产生的 state mutation 会异步触发 watcher；applyingRemote 拦截这一轮，
    // nextTick 在 watcher flush 之后再解锁，避免把刚拉取的数据原样回写（多端 ping-pong）。
    nextTick(() => {
      applyingRemote = false
      // 用户在加载期间答了题 → 把「云端 ∪ 本地新答案」推上云端
      if (userDirty) writeRemote()
    })
  })

  // ── 写入云端 ──
  function buildEnvelope(): StoredEnvelope {
    return {
      ...envelopeExtras,
      schemaVersion: SCHEMA_VERSION,
      updatedAt: nowIso(),
      data: { ...state }
    }
  }

  function writeRemote() {
    saveToSupabase(courseId, lessonId, buildEnvelope())
  }

  // ── 答题实时同步（短 debounce 批量合并连续输入）──
  let remoteTimer: ReturnType<typeof setTimeout> | null = null
  function scheduleRemoteSave() {
    if (remoteTimer) clearTimeout(remoteTimer)
    remoteTimer = setTimeout(writeRemote, 800)
  }

  watch(state, () => {
    if (applyingRemote) return
    // 加载尚未完成：先标脏不写，待 merge 后统一推送，避免覆盖云端真实记录
    if (!loadDone) {
      userDirty = true
      return
    }
    scheduleRemoteSave()
  }, { deep: true })

  return { state }
}
