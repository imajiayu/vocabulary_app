import { ref, computed, type Ref, type ComputedRef } from 'vue'
import type { Word } from '@/shared/types'
import { getUtcToday, addDays } from '@/shared/utils/date'

// ── Types ──────────────────────────────────────────────────

export type ReviewStatus = 'all' | 'unremembered' | 'remembered'
export type SpellStatus = 'all' | 'spelling' | 'stopped'
export type EasePreset = 'hard' | 'medium' | 'easy' | null
export type DateAddedPreset = 'today' | 'week' | 'month' | null
export type LastReviewPreset = 'never' | '7d' | '30d' | '90d' | null

interface EaseRange {
  min: number
  max: number
}

const EASE_RANGES: Record<string, EaseRange> = {
  hard: { min: 0, max: 1.8 },
  medium: { min: 1.8, max: 2.3 },
  easy: { min: 2.3, max: Infinity },
}

// ── Composable ─────────────────────────────────────────────

export function useWordFilters(allWords: Ref<Word[]>) {
  // Tier 1: always visible
  const source = ref<string>('all')
  const search = ref('')
  const reviewStatus = ref<ReviewStatus>('all')

  // Tier 1.5: quick toggles
  const spellStatus = ref<SpellStatus>('all')
  const lapseOnly = ref(false)
  const overdueOnly = ref(false)

  // Tier 2: advanced (collapsed)
  const easePreset = ref<EasePreset>(null)
  const dateAddedPreset = ref<DateAddedPreset>(null)
  const dateAddedCustom = ref<[string, string] | null>(null)
  const lastReviewPreset = ref<LastReviewPreset>(null)

  // ── Derived date ranges ────────────────────────────────

  const dateAddedRange = computed<[string, string] | null>(() => {
    if (dateAddedPreset.value === null) return dateAddedCustom.value
    const today = getUtcToday()
    switch (dateAddedPreset.value) {
      case 'today':
        return [today, today]
      case 'week':
        return [addDays(today, -6), today]
      case 'month':
        return [addDays(today, -29), today]
      default:
        return null
    }
  })

  // ── Filtering pipeline ─────────────────────────────────

  const filteredBySource = computed(() => {
    if (source.value === 'all') return allWords.value
    return allWords.value.filter(w => w.source === source.value)
  })

  const filteredWords: ComputedRef<Word[]> = computed(() => {
    const today = getUtcToday()

    return filteredBySource.value.filter(word => {
      // Review status
      if (reviewStatus.value === 'remembered' && word.stop_review !== 1) return false
      if (reviewStatus.value === 'unremembered' && word.stop_review !== 0) return false

      // Spell status
      if (spellStatus.value === 'stopped' && word.stop_spell !== 1) return false
      if (spellStatus.value === 'spelling' && word.stop_spell !== 0) return false

      // Lapse flag
      if (lapseOnly.value && word.lapse !== 1) return false

      // Overdue
      if (overdueOnly.value) {
        if (!word.next_review || word.next_review > today || word.stop_review === 1) return false
      }

      // Search (preserve existing logic: NFC normalization, Chinese vs English)
      if (search.value) {
        const query = search.value.normalize('NFC').trim().toLowerCase()
        const isChinese = /[\u4e00-\u9fa5]/.test(query)

        if (isChinese) {
          if (!word.definition.definitions?.join('\n').includes(query)) return false
        } else {
          const wordMatch = word.word.normalize('NFC').toLowerCase().includes(query)
          const defMatch = word.definition.definitions?.join('\n').toLowerCase().includes(query)
          if (!wordMatch && !defMatch) return false
        }
      }

      // Ease factor range (advanced)
      if (easePreset.value) {
        const range = EASE_RANGES[easePreset.value]
        if (range) {
          if (word.ease_factor < range.min || word.ease_factor >= range.max) return false
        }
      }

      // Date added range (advanced)
      const dateRange = dateAddedRange.value
      if (dateRange) {
        if (!word.date_added) return false
        if (word.date_added < dateRange[0] || word.date_added > dateRange[1]) return false
      }

      // Last review preset (advanced)
      if (lastReviewPreset.value) {
        switch (lastReviewPreset.value) {
          case 'never':
            if (word.last_review) return false
            break
          case '7d':
            if (!word.last_review || word.last_review > addDays(today, -7)) return false
            break
          case '30d':
            if (!word.last_review || word.last_review > addDays(today, -30)) return false
            break
          case '90d':
            if (!word.last_review || word.last_review > addDays(today, -90)) return false
            break
        }
      }

      return true
    })
  })

  // ── Counts for chips/badges ────────────────────────────

  const lapseCounts = computed(() => {
    return filteredBySource.value.filter(w => w.lapse === 1).length
  })

  const overdueCounts = computed(() => {
    const today = getUtcToday()
    return filteredBySource.value.filter(
      w => w.next_review && w.next_review <= today && w.stop_review !== 1
    ).length
  })

  const reviewCounts = computed(() => {
    const words = filteredBySource.value
    return {
      total: words.length,
      unremembered: words.filter(w => w.stop_review === 0).length,
      remembered: words.filter(w => w.stop_review === 1).length,
    }
  })

  const spellCounts = computed(() => {
    const words = filteredBySource.value
    return {
      total: words.length,
      spelling: words.filter(w => w.stop_spell === 0).length,
      stopped: words.filter(w => w.stop_spell === 1).length,
    }
  })

  // ── Advanced filter tracking ───────────────────────────

  const activeAdvancedFilterCount = computed(() => {
    let count = 0
    if (lapseOnly.value) count++
    if (overdueOnly.value) count++
    if (easePreset.value) count++
    if (dateAddedPreset.value || dateAddedCustom.value) count++
    if (lastReviewPreset.value) count++
    return count
  })

  const hasActiveAdvancedFilters = computed(() => activeAdvancedFilterCount.value > 0)

  const activeFilterSummary = computed<string[]>(() => {
    const summaries: string[] = []
    if (easePreset.value) {
      const labels: Record<string, string> = { hard: '困难', medium: '中等', easy: '简单' }
      summaries.push(labels[easePreset.value] || easePreset.value)
    }
    if (dateAddedPreset.value) {
      const labels: Record<string, string> = { today: '今天添加', week: '本周添加', month: '本月添加' }
      summaries.push(labels[dateAddedPreset.value] || '自定义日期')
    } else if (dateAddedCustom.value) {
      summaries.push('自定义日期')
    }
    if (lastReviewPreset.value) {
      const labels: Record<string, string> = { never: '从未复习', '7d': '超过7天未复习', '30d': '超过30天未复习', '90d': '超过90天未复习' }
      summaries.push(labels[lastReviewPreset.value] || lastReviewPreset.value)
    }
    return summaries
  })

  // ── Reset helpers ──────────────────────────────────────

  function resetAdvancedFilters() {
    lapseOnly.value = false
    overdueOnly.value = false
    easePreset.value = null
    dateAddedPreset.value = null
    dateAddedCustom.value = null
    lastReviewPreset.value = null
  }

  function resetAll() {
    source.value = 'all'
    search.value = ''
    reviewStatus.value = 'all'
    spellStatus.value = 'all'
    lapseOnly.value = false
    overdueOnly.value = false
    resetAdvancedFilters()
  }

  return {
    // Tier 1
    source,
    search,
    reviewStatus,

    // Tier 1.5
    spellStatus,
    lapseOnly,
    overdueOnly,

    // Tier 2
    easePreset,
    dateAddedPreset,
    dateAddedCustom,
    lastReviewPreset,

    // Computed
    filteredWords,
    filteredBySource,
    reviewCounts,
    spellCounts,
    lapseCounts,
    overdueCounts,
    activeAdvancedFilterCount,
    hasActiveAdvancedFilters,
    activeFilterSummary,

    // Methods
    resetAdvancedFilters,
    resetAll,
  }
}
