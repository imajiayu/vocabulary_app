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
  priorityWeight?: number    // 优先级权重（越大越不应偏离），默认 1.0
  maxDeviationRatio?: number // 最大偏离 = baseInterval × ratio，默认 0.5
  maxDeviationDays?: number  // 偏离天数绝对上限，默认 7
  minDeviationDays?: number  // 最小搜索窗口，默认 1
  overflowTolerance?: number // 可接受的超限比例，默认 0.3（即 limit × 1.3）
}

export interface LoadBalanceResult {
  chosenDay: number      // 最终选择的天数
  baseInterval: number   // 原始基础间隔
  phase: string          // 选择阶段 ("base", "best_fit", "scored")
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

export function computeScore(
  day: number,
  baseInterval: number,
  load: number,
  limit: number,
  priorityWeight: number
): number {
  const offset = Math.abs(day - baseInterval)
  const timePenalty = (offset ** 2) * priorityWeight * 0.15

  const loadRatio = limit > 0 ? load / limit : 1.0
  const loadPenalty = (loadRatio ** 3) * 2.0

  return timePenalty + loadPenalty
}

/**
 * 为需要负载均衡的单词找到最优日期（低强度 / 低EF / 新词等）
 *
 * 四阶段渐进策略：
 *   Phase 1: 初始窗口内 best-fit（< dailyLimit）
 *   Phase 2: 向前扩展至 maxDay（< dailyLimit）
 *   Phase 3: 全范围搜索（< dailyLimit × (1 + overflowTolerance)）
 *   Phase 4: 全范围最低负荷（绝对兜底）
 */
export function findOptimalDay(params: LoadBalanceParams): LoadBalanceResult {
  if (params.currentLoads.length === 0) {
    return { chosenDay: params.baseInterval, baseInterval: params.baseInterval, phase: 'base' }
  }

  const [start, end] = computeSearchWindow(params)
  const maxDay = params.currentLoads.length
  const overflowTolerance = params.overflowTolerance ?? 0.3

  // Phase 1: 初始窗口内 best-fit — 负荷最低的未满天
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

  // Phase 2: 向前扩展 (end, maxDay] — 找 < dailyLimit 且负荷最低的天
  bestDay = null
  bestLoad = Infinity

  for (let day = end + 1; day <= maxDay; day++) {
    const load = params.currentLoads[day - 1]
    if (load < params.dailyLimit && load < bestLoad) {
      bestDay = day
      bestLoad = load
    }
  }

  if (bestDay !== null) {
    return { chosenDay: bestDay, baseInterval: params.baseInterval, phase: 'forward' }
  }

  // Phase 3: 全范围 [1, maxDay]，允许溢出 — < dailyLimit × (1 + overflowTolerance)
  const overflowLimit = params.dailyLimit * (1 + overflowTolerance)
  bestDay = null
  bestLoad = Infinity

  for (let day = 1; day <= maxDay; day++) {
    const load = params.currentLoads[day - 1]
    if (load < overflowLimit && load < bestLoad) {
      bestDay = day
      bestLoad = load
    }
  }

  if (bestDay !== null) {
    return { chosenDay: bestDay, baseInterval: params.baseInterval, phase: 'overflow' }
  }

  // Phase 4: 绝对兜底 — 全范围最低负荷天
  bestDay = params.baseInterval
  bestLoad = Infinity

  for (let day = 1; day <= maxDay; day++) {
    const load = params.currentLoads[day - 1]
    if (load < bestLoad) {
      bestLoad = load
      bestDay = day
    }
  }

  return { chosenDay: bestDay, baseInterval: params.baseInterval, phase: 'global_min' }
}

/**
 * 为高强度单词找到最优日期，只允许向后推迟
 *
 * 四阶段策略：
 *   1. 基准天负荷 < 70% 限制 → 直接返回
 *   2. 初始窗口内 < 70% 的最低负荷天
 *   3. 向前扩展至 maxDay（放宽至 < dailyLimit）
 *   4. 全范围最低负荷（绝对兜底）
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

  // Phase 2: 初始窗口内 < 70% 且负荷最低
  let bestDay: number | null = null
  let bestLoad = Infinity

  for (let day = start; day <= end; day++) {
    if (day < 1 || day > maxDay) continue
    const load = params.currentLoads[day - 1]
    if (load < threshold && load < bestLoad) {
      bestDay = day
      bestLoad = load
    }
  }

  if (bestDay !== null) {
    return { chosenDay: bestDay, baseInterval: params.baseInterval, phase: 'best_fit' }
  }

  // Phase 3: 向前扩展 (end, maxDay]，放宽至 < dailyLimit
  bestDay = null
  bestLoad = Infinity

  for (let day = end + 1; day <= maxDay; day++) {
    const load = params.currentLoads[day - 1]
    if (load < params.dailyLimit && load < bestLoad) {
      bestDay = day
      bestLoad = load
    }
  }

  if (bestDay !== null) {
    return { chosenDay: bestDay, baseInterval: params.baseInterval, phase: 'forward' }
  }

  // Phase 4: 全范围最低负荷天（绝对兜底）
  bestDay = params.baseInterval
  bestLoad = Infinity

  for (let day = 1; day <= maxDay; day++) {
    const load = params.currentLoads[day - 1]
    if (load < bestLoad) {
      bestLoad = load
      bestDay = day
    }
  }

  return { chosenDay: bestDay, baseInterval: params.baseInterval, phase: 'global_min' }
}
