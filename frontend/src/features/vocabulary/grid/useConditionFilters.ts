import { ref, computed, type Ref, type ComputedRef } from 'vue'
import type { Word, DefinitionObject } from '@/shared/types'

// ── Types ──────────────────────────────────────────────────

export type FieldType = 'string' | 'number' | 'date' | 'boolean' | 'definition'

export type FilterOperator =
  | 'eq' | 'neq'
  | 'contains' | 'not_contains'
  | 'gt' | 'lt' | 'gte' | 'lte'
  | 'between'
  | 'is_null' | 'is_not_null'

export type LogicMode = 'and' | 'or'

export interface FilterCondition {
  id: string
  field: string
  operator: FilterOperator
  value: string
  value2: string
}

export interface FieldDef {
  key: string
  label: string
  type: FieldType
  operators: FilterOperator[]
}

// ── Operator labels ────────────────────────────────────────

export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  eq: '等于',
  neq: '不等于',
  contains: '包含',
  not_contains: '不包含',
  gt: '大于',
  lt: '小于',
  gte: '大于等于',
  lte: '小于等于',
  between: '介于',
  is_null: '为空',
  is_not_null: '非空',
}

export const VALUE_FREE_OPS = new Set<FilterOperator>(['is_null', 'is_not_null'])

// ── Field definitions ──────────────────────────────────────

const STRING_OPS: FilterOperator[] = ['eq', 'neq', 'contains', 'not_contains', 'is_null', 'is_not_null']
const NUMBER_OPS: FilterOperator[] = ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'between', 'is_null', 'is_not_null']
const DATE_OPS: FilterOperator[] = ['eq', 'neq', 'gt', 'lt', 'between', 'is_null', 'is_not_null']
const BOOLEAN_OPS: FilterOperator[] = ['eq', 'neq']
const DEF_OPS: FilterOperator[] = ['contains', 'not_contains', 'is_null', 'is_not_null']

export const FIELD_DEFS: FieldDef[] = [
  { key: 'word', label: '单词', type: 'string', operators: STRING_OPS },
  { key: 'source', label: '来源', type: 'string', operators: STRING_OPS },
  { key: 'definition', label: '释义', type: 'definition', operators: DEF_OPS },
  { key: 'ease_factor', label: '熟练度', type: 'number', operators: NUMBER_OPS },
  { key: 'stop_review', label: '停止复习', type: 'boolean', operators: BOOLEAN_OPS },
  { key: 'stop_spell', label: '停止拼写', type: 'boolean', operators: BOOLEAN_OPS },
  { key: 'lapse', label: '遗忘标记', type: 'boolean', operators: BOOLEAN_OPS },
  { key: 'date_added', label: '添加日期', type: 'date', operators: DATE_OPS },
  { key: 'next_review', label: '下次复习', type: 'date', operators: DATE_OPS },
  { key: 'interval', label: '间隔(天)', type: 'number', operators: NUMBER_OPS },
  { key: 'repetition', label: '重复次数', type: 'number', operators: NUMBER_OPS },
  { key: 'spell_strength', label: '拼写强度', type: 'number', operators: NUMBER_OPS },
  { key: 'spell_next_review', label: '下次拼写', type: 'date', operators: DATE_OPS },
  { key: 'last_review', label: '上次复习', type: 'date', operators: DATE_OPS },
  { key: 'last_spell', label: '上次拼写', type: 'date', operators: DATE_OPS },
  { key: 'remember_count', label: '记住次数', type: 'number', operators: NUMBER_OPS },
  { key: 'forget_count', label: '忘记次数', type: 'number', operators: NUMBER_OPS },
  { key: 'avg_elapsed_time', label: '平均用时(ms)', type: 'number', operators: NUMBER_OPS },
]

const FIELD_MAP = new Map(FIELD_DEFS.map(f => [f.key, f]))

// ── Helpers ────────────────────────────────────────────────

let _idCounter = 0
function nextId(): string {
  return `cond_${++_idCounter}_${Date.now()}`
}

function getDefinitionText(def: DefinitionObject | undefined | null): string {
  if (!def) return ''
  return (def.definitions ?? []).join('\n').toLowerCase()
}

function getFieldValue(word: Word, field: string): unknown {
  if (field === 'definition') return getDefinitionText(word.definition)
  return (word as unknown as Record<string, unknown>)[field]
}

function evaluateCondition(word: Word, cond: FilterCondition): boolean {
  const fieldDef = FIELD_MAP.get(cond.field)
  if (!fieldDef) return true

  const raw = getFieldValue(word, cond.field)
  const { operator } = cond

  if (operator === 'is_null') return raw == null || raw === ''
  if (operator === 'is_not_null') return raw != null && raw !== ''

  if (fieldDef.type === 'string' || fieldDef.type === 'definition') {
    const val = String(raw ?? '').toLowerCase()
    const target = cond.value.toLowerCase()
    switch (operator) {
      case 'eq': return val === target
      case 'neq': return val !== target
      case 'contains': return target !== '' && val.includes(target)
      case 'not_contains': return target === '' || !val.includes(target)
      default: return true
    }
  }

  if (fieldDef.type === 'boolean') {
    const val = Number(raw ?? 0)
    const target = cond.value === '1' || cond.value.toLowerCase() === 'true' ? 1 : 0
    switch (operator) {
      case 'eq': return val === target
      case 'neq': return val !== target
      default: return true
    }
  }

  if (fieldDef.type === 'number') {
    const val = Number(raw)
    if (isNaN(val)) return operator === 'neq'
    const target = parseFloat(cond.value)
    if (isNaN(target) && operator !== 'between') return true
    switch (operator) {
      case 'eq': return val === target
      case 'neq': return val !== target
      case 'gt': return val > target
      case 'lt': return val < target
      case 'gte': return val >= target
      case 'lte': return val <= target
      case 'between': {
        const t2 = parseFloat(cond.value2)
        if (isNaN(target) || isNaN(t2)) return true
        return val >= target && val <= t2
      }
      default: return true
    }
  }

  if (fieldDef.type === 'date') {
    const val = raw as string | null
    if (!val) return operator === 'neq'
    const target = cond.value
    if (!target && operator !== 'between') return true
    switch (operator) {
      case 'eq': return val === target
      case 'neq': return val !== target
      case 'gt': return val > target
      case 'lt': return val < target
      case 'between': {
        if (!target || !cond.value2) return true
        return val >= target && val <= cond.value2
      }
      default: return true
    }
  }

  return true
}

// ── Composable ─────────────────────────────────────────────

export function useConditionFilters(allWords: Ref<Word[]>) {
  const conditions = ref<FilterCondition[]>([])
  const logicMode = ref<LogicMode>('and')

  function addCondition() {
    conditions.value.push({
      id: nextId(),
      field: 'word',
      operator: 'contains',
      value: '',
      value2: '',
    })
  }

  function removeCondition(id: string) {
    conditions.value = conditions.value.filter(c => c.id !== id)
  }

  function updateCondition(id: string, partial: Partial<FilterCondition>) {
    const cond = conditions.value.find(c => c.id === id)
    if (cond) Object.assign(cond, partial)
  }

  function clearAll() {
    conditions.value = []
  }

  const activeConditions = computed(() =>
    conditions.value.filter(c => {
      if (VALUE_FREE_OPS.has(c.operator)) return true
      if (c.operator === 'between') return c.value !== '' && c.value2 !== ''
      return c.value !== ''
    })
  )

  const filteredWords: ComputedRef<Word[]> = computed(() => {
    const active = activeConditions.value
    if (active.length === 0) return allWords.value

    return allWords.value.filter(word => {
      if (logicMode.value === 'and') {
        return active.every(c => evaluateCondition(word, c))
      }
      return active.some(c => evaluateCondition(word, c))
    })
  })

  return {
    conditions,
    logicMode,
    filteredWords,
    addCondition,
    removeCondition,
    updateCondition,
    clearAll,
    FIELD_DEFS,
    FIELD_MAP,
    OPERATOR_LABELS,
    VALUE_FREE_OPS,
  }
}
