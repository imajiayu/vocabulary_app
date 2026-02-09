/**
 * 统一负载均衡模块
 *
 * 为复习(review)和拼写(spelling)提供共用的负载均衡算法。
 * 移植自 backend/core/load_balancer.py
 */

export interface LoadBalanceParams {
  baseInterval: number       // 基础间隔天数
  dailyLimit: number         // 每日负荷上限
  currentLoads: number[]     // 未来每天的已有负荷列表
  maxDeviationRatio?: number // 最大偏离 = baseInterval × ratio，默认 0.5
  maxDeviationDays?: number  // 偏离天数绝对上限，默认 7
  minDeviationDays?: number  // 最小搜索窗口，默认 1
}

export interface LoadBalanceResult {
  chosenDay: number      // 最终选择的天数
  baseInterval: number   // 原始基础间隔
  phase: string          // 选择阶段
}

export function computeSearchWindow(params: LoadBalanceParams): [number, number] {
  const maxDeviationRatio = params.maxDeviationRatio ?? 0.5
  const maxDeviationDays = params.maxDeviationDays ?? 7
  const minDeviationDays = params.minDeviationDays ?? 1

  const maxOffset = Math.min(
    Math.max(minDeviationDays, Math.floor(params.baseInterval * maxDeviationRatio)),
    maxDeviationDays
  )
  let start = params.baseInterval
  const end = Math.min(params.baseInterval + maxOffset, params.currentLoads.length)
  start = Math.min(start, params.currentLoads.length)
  return [start, end]
}

/**
 * 为低强度单词找到最优日期（first-fit，优先最早有空余的天）
 *
 *   Phase 1 (first_fit): [start, end] 窗口内最早的未满天
 *   Phase 2 (forward):   [end+1, maxDay] 向后扩展，最早的未满天
 *   Phase 3 (backward):  [start-1 .. 1] 向前搜索，最近的未满天
 *   Phase 4 (fallback):  全部满员，窗口内最低负荷天（允许超限）
 */
export function findOptimalDay(params: LoadBalanceParams): LoadBalanceResult {
  if (params.currentLoads.length === 0) {
    return { chosenDay: params.baseInterval, baseInterval: params.baseInterval, phase: 'base' }
  }

  const [start, end] = computeSearchWindow(params)
  const maxDay = params.currentLoads.length

  // Phase 1: 窗口内 first-fit — 最早的未满天
  for (let day = start; day <= end; day++) {
    if (day < 1 || day > maxDay) continue
    if (params.currentLoads[day - 1] < params.dailyLimit) {
      return { chosenDay: day, baseInterval: params.baseInterval, phase: 'first_fit' }
    }
  }

  // Phase 2: 向后扩展 — 窗口后最早的未满天
  for (let day = end + 1; day <= maxDay; day++) {
    if (params.currentLoads[day - 1] < params.dailyLimit) {
      return { chosenDay: day, baseInterval: params.baseInterval, phase: 'forward' }
    }
  }

  // Phase 3: 向前搜索 — 窗口前最近的未满天
  for (let day = start - 1; day >= 1; day--) {
    if (params.currentLoads[day - 1] < params.dailyLimit) {
      return { chosenDay: day, baseInterval: params.baseInterval, phase: 'backward' }
    }
  }

  // Phase 4: [1, maxDay] 全部满员 — 窗口内最低负荷天（允许超限）
  let bestDay = params.baseInterval
  let bestLoad = Infinity

  for (let day = start; day <= end; day++) {
    if (day < 1 || day > maxDay) continue
    const load = params.currentLoads[day - 1]
    if (load < bestLoad) {
      bestLoad = load
      bestDay = day
    }
  }

  return { chosenDay: bestDay, baseInterval: params.baseInterval, phase: 'fallback' }
}

/**
 * 为高强度单词找到最优日期（best-fit，窗口内负荷最低）
 *
 *   Phase 1 (base):      基准天 < 70% dailyLimit → 直接返回
 *   Phase 2 (best_fit):  [start, end] 窗口内负荷最低的未满天
 *   Phase 3 (forward):   [end+1, maxDay] 向后扩展，最早的未满天
 *   Phase 4 (backward):  [start-1 .. 1] 向前搜索，最近的未满天
 *   Phase 5 (fallback):  全部满员，窗口内最低负荷天（允许超限）
 */
export function findOptimalDayForStrong(params: LoadBalanceParams): LoadBalanceResult {
  if (params.currentLoads.length === 0) {
    return { chosenDay: params.baseInterval, baseInterval: params.baseInterval, phase: 'base' }
  }

  const threshold = params.dailyLimit * 0.7
  const maxDay = params.currentLoads.length

  // Phase 1: 基准天 < 70%
  if (params.baseInterval >= 1 && params.baseInterval <= maxDay) {
    if (params.currentLoads[params.baseInterval - 1] < threshold) {
      return { chosenDay: params.baseInterval, baseInterval: params.baseInterval, phase: 'base' }
    }
  }

  const [start, end] = computeSearchWindow(params)

  // Phase 2: 窗口内 best-fit — 负荷最低的未满天
  let bestDay: number | null = null
  let bestLoad = Infinity

  for (let day = start; day <= end; day++) {
    if (day < 1 || day > maxDay) continue
    const load = params.currentLoads[day - 1]
    if (load < params.dailyLimit && load < bestLoad) {
      bestDay = day
      bestLoad = load
    }
  }

  if (bestDay !== null) {
    return { chosenDay: bestDay, baseInterval: params.baseInterval, phase: 'best_fit' }
  }

  // Phase 3: 向后扩展 — 窗口后最早的未满天
  for (let day = end + 1; day <= maxDay; day++) {
    if (params.currentLoads[day - 1] < params.dailyLimit) {
      return { chosenDay: day, baseInterval: params.baseInterval, phase: 'forward' }
    }
  }

  // Phase 4: 向前搜索 — 窗口前最近的未满天
  for (let day = start - 1; day >= 1; day--) {
    if (params.currentLoads[day - 1] < params.dailyLimit) {
      return { chosenDay: day, baseInterval: params.baseInterval, phase: 'backward' }
    }
  }

  // Phase 5: [1, maxDay] 全部满员 — 窗口内最低负荷天（允许超限）
  bestDay = params.baseInterval
  bestLoad = Infinity

  for (let day = start; day <= end; day++) {
    if (day < 1 || day > maxDay) continue
    const load = params.currentLoads[day - 1]
    if (load < bestLoad) {
      bestLoad = load
      bestDay = day
    }
  }

  return { chosenDay: bestDay, baseInterval: params.baseInterval, phase: 'fallback' }
}
