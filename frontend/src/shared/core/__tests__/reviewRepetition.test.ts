import { describe, test, expect } from 'vitest'
import {
  calculateScore,
  sm2UpdateEaseFactor,
  shouldStopReview,
  shouldApplyLoadBalancing,
  calculateSrsParametersWithLoadBalancing,
} from '../reviewRepetition'

describe('calculateScore — 放宽 thresholdSlow 至 8s (T1)', () => {
  test('≤2s 仍为满分 5', () => {
    expect(calculateScore(true, 1.5)).toBe(5)
    expect(calculateScore(true, 2)).toBe(5)
  })

  test('5s 这种"记得但偏慢"应得 4（旧实现会降到 3）', () => {
    expect(calculateScore(true, 5)).toBe(4)
  })

  test('≥8s 才降到最低的 3', () => {
    expect(calculateScore(true, 8)).toBe(3)
    expect(calculateScore(true, 12)).toBe(3)
  })

  test('没记住始终为 1', () => {
    expect(calculateScore(false, 1)).toBe(1)
    expect(calculateScore(false, 20)).toBe(1)
  })
})

describe('sm2UpdateEaseFactor — score3 不再降 EF (T1)', () => {
  test('score 3 时 EF 保持不变（旧实现 -0.02）', () => {
    expect(sm2UpdateEaseFactor(2.5, 3)).toBe(2.5)
    expect(sm2UpdateEaseFactor(2.0, 3)).toBe(2.0)
  })

  test('score 5 仍 +0.15，且受上限 3.0 约束', () => {
    expect(sm2UpdateEaseFactor(2.5, 5)).toBeCloseTo(2.65, 5)
    expect(sm2UpdateEaseFactor(2.95, 5)).toBe(3.0)
  })

  test('score 2 仍 -0.20，受下限 1.3 约束', () => {
    expect(sm2UpdateEaseFactor(2.5, 2)).toBeCloseTo(2.3, 5)
    expect(sm2UpdateEaseFactor(1.4, 2)).toBe(1.3)
  })
})

describe('shouldStopReview — 毕业判定去掉累计遗忘率门槛 (T2/B2)', () => {
  test('EF≥3.0 且 rep≥6 即可毕业（不再看累计遗忘率）', () => {
    expect(shouldStopReview(3.0, 6)).toBe(true)
    expect(shouldStopReview(3.0, 10)).toBe(true)
  })

  test('EF 未达标不毕业', () => {
    expect(shouldStopReview(2.9, 6)).toBe(false)
  })

  test('连续成功次数不足不毕业', () => {
    expect(shouldStopReview(3.0, 5)).toBe(false)
  })
})

describe('shouldApplyLoadBalancing — 仅依据 EF/rep/score（去掉 forgetRate）(B2)', () => {
  test('强词（高EF、高rep、score5）不进填谷分支', () => {
    expect(shouldApplyLoadBalancing(3.0, 6, 5)).toBe(false)
  })

  test('低EF / 年轻词 / 慢回忆 进入填谷分支', () => {
    expect(shouldApplyLoadBalancing(2.5, 6, 5)).toBe(true) // EF==阈值
    expect(shouldApplyLoadBalancing(3.0, 2, 5)).toBe(true) // rep<3
    expect(shouldApplyLoadBalancing(3.0, 6, 3)).toBe(true) // score<=3
  })
})

describe('calculateSrsParametersWithLoadBalancing — 失败词近期重测 (B3)', () => {
  test('失败词不会因负荷被远推（近几天满也最多推迟 2 天，宁可超限）', () => {
    // dailyLimit=2，未来 day1..3 全满，day4 空闲
    const loads = [2, 2, 2, 0, 0, 0, 0, 0, 0, 0]
    const srs = calculateSrsParametersWithLoadBalancing(
      /*score*/ 1, /*interval*/ 10, /*repetition*/ 5, /*easeFactor*/ 2.4,
      /*lapse*/ 0, /*dailyReviewLimit*/ 2, loads, /*maxPrepDays*/ 45
    )
    expect(srs.scheduledDay).toBeLessThanOrEqual(3)
    expect(srs.interval).toBe(1) // 失败 → 纯 SM-2 interval 重置为 1
  })

  test('成功的低强度词仍按填谷正常向后寻找空位', () => {
    const loads = [5, 5, 0, 0, 0]
    const srs = calculateSrsParametersWithLoadBalancing(
      /*score*/ 4, /*interval*/ 1, /*repetition*/ 1, /*easeFactor*/ 2.6,
      /*lapse*/ 0, /*dailyReviewLimit*/ 5, loads, /*maxPrepDays*/ 45
    )
    // repetition 1 且旧 EF>2.5 → 纯 SM-2 interval=6，但 day6 超出数组(len5)
    expect(srs.scheduledDay).toBeGreaterThanOrEqual(1)
  })
})
