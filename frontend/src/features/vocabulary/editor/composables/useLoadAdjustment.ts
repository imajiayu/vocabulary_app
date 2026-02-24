/**
 * 负荷调整 Composable
 *
 * 核心原则：只修改日期字段，绝不触碰 SM-2 原始参数
 *
 * 数据流：
 * WordScheduleData[] → buildBuckets() → DayBucket[]
 *                                        ↓
 *                              用户操作（编辑/削峰/浓缩）
 *                                        ↓
 *                              computeChanges() → { wordId, newDate }[]
 *                                        ↓
 *                              applyChanges() → RPC 批量更新
 */

import { ref, computed, shallowRef } from 'vue'
import { WordsApi } from '@/shared/api/words'
import type { WordScheduleData } from '@/shared/api/words'
import { useSettings } from '@/shared/composables/useSettings'
import { logger } from '@/shared/utils/logger'

const log = logger.create('LoadAdjustment')

// ============================================================================
// 类型定义
// ============================================================================

export interface BucketWord {
  id: number
  word: string
  tolerance: number // ease_factor（复习）或 spell_strength（拼写）
}

export interface DayBucket {
  date: string          // YYYY-MM-DD
  weekday: string       // 周一、周二...
  isToday: boolean
  words: BucketWord[]
  originalCount: number // 初始数量（用于显示 delta）
}

interface ScheduleChange {
  wordId: number
  newDate: string
}

type TabType = 'review' | 'spell'

// ============================================================================
// 辅助函数
// ============================================================================

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function toDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return toDateString(d)
}

function getWeekday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return WEEKDAY_NAMES[d.getDay()]
}

function getToday(): string {
  return toDateString(new Date())
}

// ============================================================================
// 构建桶
// ============================================================================

function buildBuckets(
  words: WordScheduleData[],
  tab: TabType,
  daysAhead: number
): DayBucket[] {
  const today = getToday()

  // 生成连续日期桶（今天 + daysAhead 天）
  const bucketMap = new Map<string, BucketWord[]>()
  const dateList: string[] = []
  for (let i = 0; i <= daysAhead; i++) {
    const date = addDaysToDate(today, i)
    dateList.push(date)
    bucketMap.set(date, [])
  }

  // 分配单词到桶
  for (const w of words) {
    const dateField = tab === 'review' ? w.next_review : w.spell_next_review
    const stopField = tab === 'review' ? w.stop_review : w.stop_spell

    // 跳过已停止的和无日期的
    if (stopField === 1 || !dateField) continue

    const tolerance = tab === 'review'
      ? w.ease_factor
      : (w.spell_strength ?? 0)

    const bucketWord: BucketWord = { id: w.id, word: w.word, tolerance }

    // 过期词归入今天
    if (dateField <= today) {
      bucketMap.get(today)!.push(bucketWord)
    } else if (dateField > dateList[dateList.length - 1]) {
      // 超出范围的忽略
      continue
    } else if (bucketMap.has(dateField)) {
      bucketMap.get(dateField)!.push(bucketWord)
    }
  }

  // 构建 DayBucket 数组
  return dateList.map(date => {
    const words = bucketMap.get(date) || []
    return {
      date,
      weekday: getWeekday(date),
      isToday: date === today,
      words: [...words], // 浅拷贝
      originalCount: words.length,
    }
  })
}

// ============================================================================
// 算法：逐日调整
// ============================================================================

/**
 * 设置某天的目标数量
 * - 减少：按 tolerance 降序移除多余单词 → 分配到最近的有空余天
 * - 增加：从相邻天按 tolerance 降序拉取
 */
function adjustDay(
  buckets: DayBucket[],
  dayIndex: number,
  target: number,
  cap: number
): void {
  const bucket = buckets[dayIndex]
  const current = bucket.words.length

  if (target === current) return

  if (target < current) {
    // 减少：移走多余的（高 tolerance 先走）
    const sorted = [...bucket.words].sort((a, b) => b.tolerance - a.tolerance)
    const overflow = sorted.splice(0, current - target)
    bucket.words = sorted

    // 分配溢出单词到最近的有空余天
    for (const word of overflow) {
      const targetIdx = findNearestAvailable(buckets, dayIndex, cap)
      if (targetIdx !== -1) {
        buckets[targetIdx].words.push(word)
      } else {
        // 所有天都满了，放回原位
        bucket.words.push(word)
      }
    }
  } else {
    // 增加：从相邻天拉取（螺旋搜索）
    const needed = target - current
    let collected = 0

    for (let dist = 1; dist < buckets.length && collected < needed; dist++) {
      for (const sign of [-1, 1]) {
        if (collected >= needed) break
        const idx = dayIndex + dist * sign
        if (idx < 0 || idx >= buckets.length) continue

        const donor = buckets[idx]
        if (donor.words.length <= 0) continue

        // 从 donor 按 tolerance 降序取
        donor.words.sort((a, b) => b.tolerance - a.tolerance)
        while (donor.words.length > 0 && collected < needed) {
          bucket.words.push(donor.words.shift()!)
          collected++
        }
      }
    }
  }
}

/**
 * 螺旋搜索最近的有空余天
 */
function findNearestAvailable(
  buckets: DayBucket[],
  fromIndex: number,
  cap: number
): number {
  for (let dist = 1; dist < buckets.length; dist++) {
    for (const sign of [1, -1]) {
      const idx = fromIndex + dist * sign
      if (idx < 0 || idx >= buckets.length) continue
      if (buckets[idx].words.length < cap) return idx
    }
  }
  return -1
}

// ============================================================================
// 算法：削峰
// ============================================================================

function flattenPeaks(buckets: DayBucket[], cap: number): void {
  for (let i = 0; i < buckets.length; i++) {
    const bucket = buckets[i]
    if (bucket.words.length <= cap) continue

    // 按 tolerance 降序取出溢出
    bucket.words.sort((a, b) => b.tolerance - a.tolerance)
    const overflow = bucket.words.splice(cap)

    // 螺旋分配
    for (const word of overflow) {
      const targetIdx = findNearestAvailable(buckets, i, cap)
      if (targetIdx !== -1) {
        buckets[targetIdx].words.push(word)
      } else {
        // 无法分配，放回
        bucket.words.push(word)
      }
    }
  }
}

// ============================================================================
// 算法：浓缩
// ============================================================================

function condense(buckets: DayBucket[], limit: number): void {
  // 收集所有单词，按 tolerance 升序（不熟悉的先排）
  const allWords: BucketWord[] = []
  for (const bucket of buckets) {
    allWords.push(...bucket.words)
    bucket.words = []
  }
  allWords.sort((a, b) => a.tolerance - b.tolerance)

  // 从第一天开始逐天填满
  let wordIdx = 0
  for (const bucket of buckets) {
    while (wordIdx < allWords.length && bucket.words.length < limit) {
      bucket.words.push(allWords[wordIdx++])
    }
    if (wordIdx >= allWords.length) break
  }

  // 溢出的放在最后一个非空桶
  if (wordIdx < allWords.length) {
    const lastBucket = buckets[buckets.length - 1]
    while (wordIdx < allWords.length) {
      lastBucket.words.push(allWords[wordIdx++])
    }
  }
}

// ============================================================================
// 计算变更
// ============================================================================

function computeChanges(
  originalWords: WordScheduleData[],
  buckets: DayBucket[],
  tab: TabType
): ScheduleChange[] {
  const today = getToday()

  // 构建 wordId → 当前桶日期 的映射
  const newDateMap = new Map<number, string>()
  for (const bucket of buckets) {
    for (const w of bucket.words) {
      newDateMap.set(w.id, bucket.date)
    }
  }

  const changes: ScheduleChange[] = []

  for (const w of originalWords) {
    const dateField = tab === 'review' ? w.next_review : w.spell_next_review
    const stopField = tab === 'review' ? w.stop_review : w.stop_spell
    if (stopField === 1 || !dateField) continue

    const newDate = newDateMap.get(w.id)
    if (!newDate) continue

    // 原始日期：过期的归今天
    const originalDate = dateField <= today ? today : dateField

    if (newDate !== originalDate) {
      changes.push({ wordId: w.id, newDate })
    }
  }

  return changes
}

// ============================================================================
// Composable
// ============================================================================

export function useLoadAdjustment() {
  const isOpen = ref(false)
  const isLoading = ref(false)
  const isSaving = ref(false)
  const activeTab = ref<TabType>('review')
  const daysAhead = 45

  // 原始数据
  const rawWords = shallowRef<WordScheduleData[]>([])
  const currentSource = ref('all')

  // 桶数据（响应式）
  const reviewBuckets = ref<DayBucket[]>([])
  const spellBuckets = ref<DayBucket[]>([])

  // 每日上限
  const dailyReviewLimit = ref(20)
  const dailySpellLimit = ref(15)

  // 当前 tab 的桶
  const buckets = computed(() =>
    activeTab.value === 'review' ? reviewBuckets.value : spellBuckets.value
  )

  const dailyLimit = computed({
    get: () => activeTab.value === 'review' ? dailyReviewLimit.value : dailySpellLimit.value,
    set: (v: number) => {
      if (activeTab.value === 'review') dailyReviewLimit.value = v
      else dailySpellLimit.value = v
    }
  })

  // 变更计算
  const changes = computed(() =>
    computeChanges(rawWords.value, buckets.value, activeTab.value)
  )

  const hasChanges = computed(() => changes.value.length > 0)
  const totalMoved = computed(() => changes.value.length)

  // ── 操作 ──

  async function open(source: string) {
    isOpen.value = true
    isLoading.value = true
    currentSource.value = source

    try {
      const { loadSettings } = useSettings()
      const [data, settings] = await Promise.all([
        WordsApi.getScheduleDataDirect(source),
        loadSettings(),
      ])
      rawWords.value = data

      reviewBuckets.value = buildBuckets(data, 'review', daysAhead)
      spellBuckets.value = buildBuckets(data, 'spell', daysAhead)

      dailyReviewLimit.value = settings.learning?.dailyReviewLimit ?? 50
      dailySpellLimit.value = settings.learning?.dailySpellLimit ?? 50
    } catch (e) {
      log.error('Failed to load schedule data:', e)
      throw e
    } finally {
      isLoading.value = false
    }
  }

  function close() {
    isOpen.value = false
    rawWords.value = []
    reviewBuckets.value = []
    spellBuckets.value = []
  }

  function switchTab(tab: TabType) {
    activeTab.value = tab
  }

  function setDayTarget(index: number, target: number) {
    const cap = dailyLimit.value
    const currentBuckets = activeTab.value === 'review' ? reviewBuckets.value : spellBuckets.value
    adjustDay(currentBuckets, index, Math.max(0, target), cap)
    // 触发响应式更新
    if (activeTab.value === 'review') {
      reviewBuckets.value = [...currentBuckets]
    } else {
      spellBuckets.value = [...currentBuckets]
    }
  }

  function doFlattenPeaks(cap: number) {
    const currentBuckets = activeTab.value === 'review' ? reviewBuckets.value : spellBuckets.value
    flattenPeaks(currentBuckets, cap)
    if (activeTab.value === 'review') {
      reviewBuckets.value = [...currentBuckets]
    } else {
      spellBuckets.value = [...currentBuckets]
    }
  }

  function doCondense(limit: number) {
    const currentBuckets = activeTab.value === 'review' ? reviewBuckets.value : spellBuckets.value
    condense(currentBuckets, limit)
    if (activeTab.value === 'review') {
      reviewBuckets.value = [...currentBuckets]
    } else {
      spellBuckets.value = [...currentBuckets]
    }
  }

  function reset() {
    reviewBuckets.value = buildBuckets(rawWords.value, 'review', daysAhead)
    spellBuckets.value = buildBuckets(rawWords.value, 'spell', daysAhead)
  }

  async function applyChanges(): Promise<boolean> {
    const currentChanges = changes.value
    if (currentChanges.length === 0) return true

    isSaving.value = true
    try {
      const wordIds = currentChanges.map(c => c.wordId)
      const dates = currentChanges.map(c => c.newDate)

      if (activeTab.value === 'review') {
        await WordsApi.batchRescheduleReview(wordIds, dates)
      } else {
        await WordsApi.batchRescheduleSpell(wordIds, dates)
      }

      // 更新 rawWords 以反映最新状态
      const dateMap = new Map(currentChanges.map(c => [c.wordId, c.newDate]))
      rawWords.value = rawWords.value.map(w => {
        const newDate = dateMap.get(w.id)
        if (!newDate) return w
        if (activeTab.value === 'review') {
          return { ...w, next_review: newDate }
        } else {
          return { ...w, spell_next_review: newDate }
        }
      })

      // 重建当前 tab 的 originalCount
      const currentBuckets = activeTab.value === 'review' ? reviewBuckets.value : spellBuckets.value
      for (const bucket of currentBuckets) {
        bucket.originalCount = bucket.words.length
      }
      if (activeTab.value === 'review') {
        reviewBuckets.value = [...currentBuckets]
      } else {
        spellBuckets.value = [...currentBuckets]
      }

      return true
    } catch (e) {
      log.error('Failed to apply changes:', e)
      return false
    } finally {
      isSaving.value = false
    }
  }

  return {
    isOpen,
    isLoading,
    isSaving,
    activeTab,
    buckets,
    dailyLimit,
    changes,
    hasChanges,
    totalMoved,
    open,
    close,
    switchTab,
    setDayTarget,
    flattenPeaks: doFlattenPeaks,
    condense: doCondense,
    applyChanges,
    reset,
  }
}
