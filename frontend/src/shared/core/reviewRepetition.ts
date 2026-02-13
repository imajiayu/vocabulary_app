/**
 * SM-2 间隔重复算法 + 负荷均衡
 *
 * 移植自 backend/core/review_repetition.py
 */
import { findOptimalDay, findOptimalDayForStrong } from './loadBalancer'
import type { LoadBalanceParams } from './loadBalancer'

export const LOW_EF_THRESHOLD = 2.5

const EF_DELTA_MAP: Record<number, number> = {
  5: 0.15,
  4: 0.08,
  3: -0.02,
  2: -0.20,
  1: -0.40,
}

/**
 * 基于认知心理学的评分函数（Weber-Fechner 对数映射）
 */
export function calculateScore(
  remembered: boolean,
  elapsedTime: number,
  thresholdFast = 2,
  thresholdSlow = 5
): number {
  if (!remembered) return 1

  if (elapsedTime <= thresholdFast) return 5
  if (elapsedTime >= thresholdSlow) return 3

  const logFast = Math.log(thresholdFast)
  const logSlow = Math.log(thresholdSlow)
  const logTime = Math.log(elapsedTime)

  const ratio = (logSlow - logTime) / (logSlow - logFast)
  const rawScore = 3 + 2 * ratio

  return Math.max(1, Math.min(5, Math.round(rawScore)))
}

/**
 * EF 更新函数（非线性调整）
 */
export function sm2UpdateEaseFactor(
  easeFactor: number,
  score: number,
  minEf = 1.3,
  maxEf = 3.0
): number {
  let delta = EF_DELTA_MAP[score] ?? 0
  if (score >= 4 && easeFactor < LOW_EF_THRESHOLD) {
    delta *= 1.3
  }

  const efNew = easeFactor + delta
  return Math.max(minEf, Math.min(efNew, maxEf))
}

export interface SrsResult {
  repetition: number
  interval: number          // 纯 SM-2 计算值（不受负荷均衡影响）
  scheduledDay: number      // 负荷均衡后的实际调度天数（用于计算 next_review）
  easeFactor: number
  lastRemembered: string | null  // ISO date string
  lastForgot: string | null      // ISO date string
  rememberInc: number
  forgetInc: number
  lapse: number
}

/**
 * 核心 SM-2 参数计算
 */
export function calculateSrsParameters(
  score: number,
  interval: number,
  repetition: number,
  easeFactor: number,
  lapse: number
): SrsResult {
  const today = new Date().toISOString().split('T')[0]

  const easeFactorNew = sm2UpdateEaseFactor(easeFactor, score)

  if (score >= 3) {
    const growthFactor = score === 3 ? 0.8 : 1.0
    const shrinkFactor = easeFactor <= LOW_EF_THRESHOLD ? 0.5 : 1.0

    let intervalNew: number
    if (repetition === 0) {
      intervalNew = 1
    } else if (repetition === 1) {
      intervalNew = shrinkFactor === 1.0 ? 6 : 2
    } else {
      intervalNew = Math.max(
        1,
        Math.round(interval * easeFactorNew * growthFactor * shrinkFactor)
      )
    }

    return {
      repetition: repetition + 1,
      interval: intervalNew,
      scheduledDay: intervalNew,
      easeFactor: easeFactorNew,
      lastRemembered: today,
      lastForgot: null,
      rememberInc: 1,
      forgetInc: 0,
      lapse,
    }
  } else {
    return {
      repetition: 0,
      interval: 1,
      scheduledDay: 1,
      easeFactor: easeFactorNew,
      lastRemembered: null,
      lastForgot: today,
      rememberInc: 0,
      forgetInc: 1,
      lapse: 1,
    }
  }
}

export function shouldApplyLoadBalancing(
  easeFactor: number,
  repetition: number,
  score: number
): boolean {
  return (
    easeFactor <= LOW_EF_THRESHOLD ||
    repetition < 3 ||
    score <= 3
  )
}

/**
 * SM-2 参数计算 + 负荷均衡
 *
 * interval 保持纯 SM-2 值（不被负荷均衡覆盖）
 * scheduledDay 为负荷均衡后的实际调度天数
 *
 * @param dailyReviewLimit - 每日复习上限（从 settings 获取）
 * @param currentLoads - 未来每天的复习负荷数组（由调用方传入）
 * @param maxPrepDays - 最大准备天数（从 settings 获取）
 */
export function calculateSrsParametersWithLoadBalancing(
  score: number,
  interval: number,
  repetition: number,
  easeFactor: number,
  lapse: number,
  dailyReviewLimit: number,
  currentLoads: number[],
  maxPrepDays: number = 45
): SrsResult {
  // 1. 基础 SM-2 计算
  const basic = calculateSrsParameters(score, interval, repetition, easeFactor, lapse)
  const easeFactorNew = basic.easeFactor
  const repetitionNew = basic.repetition

  // 2. 备考时间约束（仅约束 interval，scheduledDay 后续由负荷均衡决定）
  let constrainedInterval = basic.interval
  if (constrainedInterval > maxPrepDays) {
    constrainedInterval = maxPrepDays
  }

  // 3. 低强度单词 → 负荷均衡（填谷策略）
  if (shouldApplyLoadBalancing(easeFactorNew, repetitionNew, score)) {
    const params: LoadBalanceParams = {
      baseInterval: constrainedInterval,
      dailyLimit: dailyReviewLimit,
      currentLoads,
    }
    const result = findOptimalDay(params)
    return { ...basic, interval: constrainedInterval, scheduledDay: result.chosenDay }
  }

  // 4. 高强度单词 → 向后搜索，避免峰值堆积
  const params: LoadBalanceParams = {
    baseInterval: constrainedInterval,
    dailyLimit: dailyReviewLimit,
    currentLoads,
  }
  const result = findOptimalDayForStrong(params)
  return { ...basic, interval: constrainedInterval, scheduledDay: result.chosenDay }
}
