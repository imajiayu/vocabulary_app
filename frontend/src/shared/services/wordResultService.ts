/**
 * 单词复习/拼写结果服务层
 *
 * 编排算法计算 + Supabase 持久化，替代后端 word_update_service.py
 * 移植自 backend/services/word_update_service.py
 */
import { calculateScore, calculateSrsParametersWithLoadBalancing } from '@/shared/core/reviewRepetition'
import { calculateSpellStrengthWithLoadBalancing } from '@/shared/core/spellRepetition'
import { WordsApi } from '@/shared/api/words'
import type { ReviewNotificationData } from '@/shared/api/words'
import type { Word, SpellingData, SpellingBreakdown, ReviewPersistData, SpellingPersistData, UserSettings } from '@/shared/types'
import { addDays } from '@/shared/utils/date'
import { logger } from '@/shared/utils/logger'

const log = logger.create('WordResultService')

// ============================================================================
// 复习模式
// ============================================================================

export interface ReviewCalculationResult {
  notification: ReviewNotificationData
  persistData: ReviewPersistData & {
    current_remember_count: number
    current_forget_count: number
  }
  scheduledDay: number  // 负荷均衡后的实际调度天数，用于缓存更新
}

/**
 * 计算复习结果（纯前端，不访问数据库）
 *
 * @param word - 当前单词对象（已有完整数据）
 * @param remembered - 是否记住
 * @param elapsedTime - 反应时间（秒）
 * @param settings - 用户设置
 * @param reviewLoads - 未来每天的复习负荷（由调用方提前获取）
 */
export function calculateReviewResult(
  word: Word,
  remembered: boolean,
  elapsedTime: number,
  settings: UserSettings,
  reviewLoads: number[]
): ReviewCalculationResult {
  const oldEaseFactor = word.ease_factor
  const interval = word.interval || 1
  const repetition = word.repetition || 0
  const easeFactor = oldEaseFactor || 2.5
  const lapse = word.lapse || 0

  // 计算 avg_elapsed_time
  const prevAvg = word.avg_elapsed_time || 0
  const rememberCount = word.remember_count || 0
  const forgetCount = word.forget_count || 0
  const totalReviews = rememberCount + forgetCount
  const avgElapsedTime = Math.round(
    totalReviews > 0
      ? (prevAvg * totalReviews + elapsedTime) / (totalReviews + 1)
      : elapsedTime
  )

  const score = calculateScore(remembered, elapsedTime)
  const today = new Date().toISOString().split('T')[0]
  const sourceLearning = settings.sourceSettings[word.source]?.learning
  const maxPrepDays = sourceLearning?.maxPrepDays || 45
  const dailyReviewLimit = sourceLearning?.dailyReviewLimit || 100

  // 计算遗忘率（包含本次结果）
  const newRememberCount = rememberCount + (remembered ? 1 : 0)
  const newForgetCount = forgetCount + (remembered ? 0 : 1)
  const totalAfter = newRememberCount + newForgetCount
  const forgetRate = totalAfter >= 5 ? newForgetCount / totalAfter : 0

  const srs = calculateSrsParametersWithLoadBalancing(
    score,
    interval,
    repetition,
    easeFactor,
    lapse,
    dailyReviewLimit,
    reviewLoads,
    maxPrepDays,
    forgetRate
  )

  const nextReviewDate = addDays(today, srs.scheduledDay)
  const shouldStopReview = srs.easeFactor >= 3.0 && srs.repetition >= 6 && forgetRate < 0.3

  const easeFactorChange = Math.round((srs.easeFactor - oldEaseFactor) * 100) / 100

  return {
    notification: {
      word: word.word,
      param_type: 'ease_factor',
      param_change: easeFactorChange,
      new_param_value: Math.round(srs.easeFactor * 100) / 100,
      next_review_date: nextReviewDate,
      breakdown: {
        elapsed_time: elapsedTime,
        remembered,
        score,
        repetition: srs.repetition,
        interval: srs.interval,
      },
      mastered: shouldStopReview,
    },
    persistData: {
      word_id: word.id,
      last_review: srs.lastReview,
      remember_inc: srs.rememberInc,
      forget_inc: srs.forgetInc,
      repetition: srs.repetition,
      interval: srs.interval,
      ease_factor: Math.round(srs.easeFactor * 100) / 100,
      score,
      next_review: nextReviewDate,
      lapse: srs.lapse,
      avg_elapsed_time: avgElapsedTime,
      should_stop_review: shouldStopReview,
      current_remember_count: rememberCount,
      current_forget_count: forgetCount,
    },
    scheduledDay: srs.scheduledDay,
  }
}

export interface HistoryContext {
  source: string
  elapsed_time: number
  score: number
}

/** 共享的 history 写入逻辑 */
function _saveHistory(
  wordId: number, mode: 'review' | 'spelling',
  remembered: boolean, ctx: HistoryContext
): void {
  WordsApi.insertReviewHistory({
    word_id: wordId, score: ctx.score, remembered,
    elapsed_time: ctx.elapsed_time, mode, source: ctx.source,
  }).catch(err => log.warn('Failed to save review history:', err))
}

/**
 * 持久化复习结果到 Supabase（fire-and-forget）
 */
export async function persistReviewResult(
  persistData: ReviewCalculationResult['persistData'],
  historyContext?: HistoryContext
): Promise<void> {
  await WordsApi.persistReviewResultDirect(persistData.word_id, persistData)
  if (historyContext) {
    _saveHistory(persistData.word_id, 'review', persistData.remember_inc > 0, historyContext)
  }
}

// ============================================================================
// 拼写模式
// ============================================================================

export interface SpellingCalculationResult {
  notification: ReviewNotificationData
  persistData: SpellingPersistData
  interval: number  // day offset for cache update
}

/**
 * 计算拼写结果（纯前端，不访问数据库）
 *
 * @param word - 当前单词对象
 * @param remembered - 是否记住
 * @param spellingData - 拼写输入数据
 * @param settings - 用户设置
 * @param spellLoads - 未来每天的拼写负荷（由调用方提前获取）
 */
export function calculateSpellingResult(
  word: Word,
  remembered: boolean,
  spellingData: SpellingData,
  settings: UserSettings,
  spellLoads: number[]
): SpellingCalculationResult {
  const currentStrength = word.spell_strength ?? 0
  const sourceLearning = settings.sourceSettings[word.source]?.learning
  const maxPrepDays = sourceLearning?.maxPrepDays || 45
  const dailySpellLimit = sourceLearning?.dailySpellLimit || 100
  const today = new Date().toISOString().split('T')[0]

  const result = calculateSpellStrengthWithLoadBalancing(
    spellingData,
    remembered,
    word.word,
    dailySpellLimit,
    spellLoads,
    currentStrength,
    0.0,
    1,
    maxPrepDays
  )

  const newStrength = Math.max(0, Math.min(5.0, currentStrength + result.strengthChange))
  const roundedNewStrength = Math.round(newStrength * 100) / 100
  const nextReviewDate = addDays(today, result.interval)
  const shouldStopSpell = currentStrength >= 5.0 && roundedNewStrength >= 5.0

  return {
    notification: {
      word: word.word,
      param_type: 'spell_strength',
      param_change: Math.round(result.strengthChange * 100) / 100,
      new_param_value: roundedNewStrength,
      next_review_date: nextReviewDate,
      breakdown: result.breakdownInfo as SpellingBreakdown,
      mastered: shouldStopSpell,
    },
    persistData: {
      word_id: word.id,
      new_strength: roundedNewStrength,
      next_review: nextReviewDate,
      should_stop_spell: shouldStopSpell,
    },
    interval: result.interval,
  }
}

/**
 * 持久化拼写结果到 Supabase（fire-and-forget）
 */
export async function persistSpellingResult(
  persistData: SpellingPersistData,
  historyContext?: HistoryContext
): Promise<void> {
  await WordsApi.persistSpellingResultDirect(persistData.word_id, persistData)
  if (historyContext) {
    _saveHistory(persistData.word_id, 'spelling', historyContext.score >= 3, historyContext)
  }
}

// Re-export for backwards compatibility
export { addDays } from '@/shared/utils/date'
