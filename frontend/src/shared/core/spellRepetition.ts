/**
 * 拼写记忆强度计算和负荷均衡模块
 *
 * 移植自 backend/core/spell_repetition.py
 */
import { findOptimalDay, findOptimalDayForStrong } from './loadBalancer'
import type { LoadBalanceParams } from './loadBalancer'
import type { SpellingData } from '@/shared/types'

export interface SpellBreakdownInfo {
  remembered: boolean
  strength_gain: number
  typed_count?: number
  backspace_count?: number
  word_length?: number
  avg_key_interval?: number
  longest_pause?: number
  total_typing_time?: number
  audio_requests?: number
  accuracy_score?: number
  fluency_score?: number
  independence_score?: number
  weighted_accuracy?: number
  weighted_fluency?: number
  weighted_independence?: number
  total_score?: number
}

/**
 * 计算拼写记忆强度的变化量
 */
export function calculateSpellStrength(
  spellingData: SpellingData,
  remembered: boolean,
  word: string,
  currentStrength: number | null = null,
  initialStrength = 0.0
): [number, SpellBreakdownInfo] {
  const strength = currentStrength ?? initialStrength

  if (!remembered) {
    const newStrength = Math.round(strength * 0.3 * 100) / 100
    const breakdownInfo: SpellBreakdownInfo = {
      remembered: false,
      strength_gain: Math.round((newStrength - strength) * 100) / 100,
    }
    return [newStrength - strength, breakdownInfo]
  }

  const [newStrength, breakdownInfo] = _calculateDetailedSpellStrength(
    spellingData, word, strength
  )
  breakdownInfo.remembered = true
  return [newStrength - strength, breakdownInfo]
}

function _calculateDetailedSpellStrength(
  spellingData: SpellingData,
  word: string,
  currentStrength: number
): [number, SpellBreakdownInfo] {
  const wordLength = word.length
  const keyEvents = spellingData.keyEvents || []
  const interactions = spellingData.interactions || {}
  const inputAnalysis = spellingData.inputAnalysis || {}

  const NON_TYPING_KEYS = new Set([
    'ArrowLeft', 'ArrowRight', 'Tab', 'Shift', 'Control', 'Alt', 'Meta', 'Escape', 'Backspace'
  ])

  const typedCount = keyEvents.filter(e => !NON_TYPING_KEYS.has(e.key)).length
  const backspaceCount = keyEvents.filter(e => e.key === 'Backspace').length

  // 1. 输入准确性（60%权重）
  const accuracyRaw = _calculateInputAccuracy(typedCount, backspaceCount, wordLength, keyEvents)
  const accuracyScore = accuracyRaw * 0.6

  // 2. 输入流畅度（20%权重）
  const fluencyRaw = _analyzeInputFluency(inputAnalysis, wordLength)
  const fluencyScore = fluencyRaw * 0.2

  // 3. 独立性（20%权重）
  const independenceRaw = _analyzeIndependence(interactions)
  const independenceScore = independenceRaw * 0.2

  const totalScore = accuracyScore + fluencyScore + independenceScore

  let strengthGain: number
  if (totalScore >= 0.55) {
    strengthGain = (totalScore - 0.55) / 0.45 * 1.0
  } else {
    strengthGain = (totalScore / 0.55) * 0.7 - 0.7
  }
  const newStrength = currentStrength + strengthGain

  const breakdownInfo: SpellBreakdownInfo = {
    remembered: true,
    typed_count: typedCount,
    backspace_count: backspaceCount,
    word_length: wordLength,
    avg_key_interval: inputAnalysis.averageKeyInterval || 0,
    longest_pause: inputAnalysis.longestPause || 0,
    total_typing_time: inputAnalysis.totalTypingTime || 0,
    audio_requests: interactions.audioRequestCount || 0,
    accuracy_score: Math.round(accuracyRaw * 1000) / 1000,
    fluency_score: Math.round(fluencyRaw * 1000) / 1000,
    independence_score: Math.round(independenceRaw * 1000) / 1000,
    weighted_accuracy: Math.round(accuracyScore * 1000) / 1000,
    weighted_fluency: Math.round(fluencyScore * 1000) / 1000,
    weighted_independence: Math.round(independenceScore * 1000) / 1000,
    total_score: Math.round(totalScore * 1000) / 1000,
    strength_gain: Math.round(strengthGain * 100) / 100,
  }

  return [
    Math.round(Math.max(0.0, Math.min(5.0, newStrength)) * 100) / 100,
    breakdownInfo,
  ]
}

function _calculateInputAccuracy(
  typedCount: number,
  backspaceCount: number,
  wordLength: number,
  keyEvents: SpellingData['keyEvents']
): number {
  let baseAccuracy = wordLength / Math.max(1, typedCount)
  baseAccuracy = Math.min(1.0, baseAccuracy)

  const hasModifierBackspace = keyEvents.some(
    e => e.key === 'Backspace' && (e.metaKey || e.ctrlKey)
  )

  let severityPenalty: number
  if (hasModifierBackspace) {
    severityPenalty = 0.50
  } else if (backspaceCount >= 10) {
    severityPenalty = 0.45
  } else if (backspaceCount >= 6) {
    severityPenalty = 0.35
  } else if (backspaceCount >= 3) {
    severityPenalty = 0.25
  } else if (backspaceCount >= 1) {
    severityPenalty = 0.15
  } else {
    severityPenalty = 0.0
  }

  return Math.max(0.0, Math.min(1.0, baseAccuracy - severityPenalty))
}

function _analyzeInputFluency(
  inputAnalysis: SpellingData['inputAnalysis'],
  wordLength: number
): number {
  if (!inputAnalysis) return 0.5

  const totalTime = inputAnalysis.totalTypingTime ?? 1000
  const longestPause = inputAnalysis.longestPause ?? 0
  const avgInterval = inputAnalysis.averageKeyInterval ?? 0

  const targetTimePerChar = 180
  const expectedTime = 500 + wordLength * targetTimePerChar
  const timeEfficiency = Math.min(1.0, expectedTime / Math.max(1, totalTime))

  const rhythmScore = avgInterval <= 200
    ? 1.0
    : Math.max(0.0, 1.0 - (avgInterval - 200) / 600)

  const pausePenalty = longestPause <= 800
    ? 0.0
    : Math.min(0.3, 0.3 * (longestPause - 800) / 2200)

  const fluency = timeEfficiency * 0.45 + rhythmScore * 0.45 + (1 - pausePenalty) * 0.10
  return Math.max(0.0, Math.min(1.0, fluency))
}

function _analyzeIndependence(interactions: SpellingData['interactions']): number {
  const audioRequests = interactions?.audioRequestCount ?? 0
  return Math.max(0.0, 1.0 - audioRequests * 0.2)
}

/**
 * 基于强度变化计算下次拼写复习间隔
 *
 * growthFactor 由 maxPrepDays 动态推导：
 *   strength=5 时 interval = maxPrepDays / 2（保证备考周期内至少复习 2 次）
 *   → growthFactor = (maxPrepDays / 2) ^ (1/5)
 */
export function calculateNextSpellReview(
  strengthChange: number,
  originalStrength: number,
  remembered: boolean,
  baseInterval = 1,
  maxPrepDays = 45
): number {
  let newStrength = originalStrength + strengthChange
  newStrength = Math.max(0, newStrength)

  if (!remembered) return 1

  if (newStrength <= 0) return baseInterval

  const maxInterval = maxPrepDays / 2
  const growthFactor = maxInterval ** (1 / 5)
  const interval = baseInterval * (growthFactor ** newStrength)
  return Math.min(maxPrepDays, Math.max(1, Math.round(interval)))
}

export interface SpellResult {
  strengthChange: number
  interval: number
  breakdownInfo: SpellBreakdownInfo
}

/**
 * 硬上限检查：如果目标天已满，向后找第一个未满天；全满则回退到最低负荷天
 */
function enforceSpellLimit(
  targetDay: number,
  loads: number[],
  limit: number
): number {
  if (loads.length === 0 || targetDay < 1) return targetDay

  const maxDay = loads.length
  const day = Math.min(targetDay, maxDay)

  if (loads[day - 1] < limit) return day

  for (let d = day + 1; d <= maxDay; d++) {
    if (loads[d - 1] < limit) return d
  }

  for (let d = day - 1; d >= 1; d--) {
    if (loads[d - 1] < limit) return d
  }

  return day
}

/**
 * 拼写强度计算 + 负荷均衡
 *
 * @param dailySpellLimit - 每日拼写上限（从 settings 获取）
 * @param spellLoads - 未来每天的拼写负荷数组（由调用方传入）
 * @param maxPrepDays - 最大准备天数（从 settings 获取）
 */
export function calculateSpellStrengthWithLoadBalancing(
  spellingData: SpellingData,
  remembered: boolean,
  word: string,
  dailySpellLimit: number,
  spellLoads: number[],
  currentStrength: number | null = null,
  initialStrength = 0.0,
  baseInterval = 1,
  maxPrepDays = 45
): SpellResult {
  // 1. 计算强度变化
  const [strengthChange, breakdownInfo] = calculateSpellStrength(
    spellingData, remembered, word, currentStrength, initialStrength
  )

  const strength = currentStrength ?? initialStrength

  // 2. 计算基础间隔（已内置 maxPrepDays 上限）
  let basicInterval = calculateNextSpellReview(
    strengthChange, strength, remembered, baseInterval, maxPrepDays
  )

  const newStrength = strength + strengthChange

  // 4. 极低强度或未记住 → 不参与完整负荷均衡，但仍检查硬上限
  if (newStrength < 0.8 || !remembered) {
    const clampedInterval = enforceSpellLimit(basicInterval, spellLoads, dailySpellLimit)
    return { strengthChange, interval: clampedInterval, breakdownInfo }
  }

  let optimizedInterval = basicInterval

  // 5. 低强度（0.8-2.5）→ 负荷均衡 + 严格推迟上限
  if (newStrength <= 2.5) {
    let maxDelay: number
    if (newStrength < 1.5) {
      maxDelay = 3
    } else if (newStrength < 2.0) {
      maxDelay = 5
    } else {
      maxDelay = 7
    }

    const params: LoadBalanceParams = {
      baseInterval: basicInterval,
      dailyLimit: dailySpellLimit,
      currentLoads: spellLoads,
      maxDeviationDays: maxDelay,
      maxDeviationRatio: 0.5,
      minDeviationDays: 1,
    }
    const result = findOptimalDay(params)
    optimizedInterval = result.chosenDay
  } else {
    // 6. 高强度（> 2.5）→ 向后寻找负荷较小的日期
    const params: LoadBalanceParams = {
      baseInterval: basicInterval,
      dailyLimit: dailySpellLimit,
      currentLoads: spellLoads,
    }
    const result = findOptimalDayForStrong(params)
    optimizedInterval = result.chosenDay
  }

  return { strengthChange, interval: optimizedInterval, breakdownInfo }
}
