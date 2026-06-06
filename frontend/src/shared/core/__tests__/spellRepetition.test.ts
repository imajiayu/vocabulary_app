import { describe, test, expect } from 'vitest'
import {
  clampDeferral,
  calculateSpellStrengthWithLoadBalancing,
} from '../spellRepetition'
import type { SpellingData } from '@/shared/types'

// 一个"完美拼写"的输入：精确按词长按键、无退格、节奏快、无音频请求 → totalScore≈1.0 → 增益≈+1.0
function perfectSpellingData(word: string): SpellingData {
  return {
    keyEvents: word.split('').map((ch, i) => ({
      timestamp: i * 150,
      key: ch,
      code: `Key${ch.toUpperCase()}`,
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      inputValue: word.slice(0, i + 1),
    })),
    interactions: { audioRequestCount: 0 },
    inputAnalysis: {
      totalTypingTime: word.length * 150,
      longestPause: 0,
      averageKeyInterval: 150,
      backspaceSequences: [],
    },
  }
}

const EMPTY_SPELLING: SpellingData = {
  keyEvents: [],
  interactions: { audioRequestCount: 0 },
  inputAnalysis: { totalTypingTime: 0, longestPause: 0, averageKeyInterval: 0, backspaceSequences: [] },
}

describe('clampDeferral — 强制推迟上限 (S2)', () => {
  test('rawDay 在 cap 内时原样返回', () => {
    expect(clampDeferral(5, 3, 10, new Array(20).fill(0))).toBe(5)
  })

  test('rawDay 超过 cap 时，落到 [lowBound, cap] 内负荷最低天', () => {
    // [3,10] 全满，[1,2] 空闲；lowBound=3 → 不应回拉到 day1，应在 [3,10] 取最早（全满则 base）
    const loads = new Array(20).fill(2)
    loads[0] = 0
    loads[1] = 0
    expect(clampDeferral(11, 3, 10, loads)).toBe(3) // [3,10] 全满 → 取最早 day3（超限）
  })

  test('cap 内有空位时落到最低负荷天', () => {
    const loads = new Array(20).fill(2)
    loads[6] = 0 // day7 空闲，在 [3,10] 内
    expect(clampDeferral(11, 3, 10, loads)).toBe(7)
  })

  test('空 loads 原样返回', () => {
    expect(clampDeferral(11, 3, 10, [])).toBe(11)
  })
})

describe('calculateSpellStrengthWithLoadBalancing — 失败词近期重测 (S2)', () => {
  test('失败词不会因负荷被无界后推（近几天满也最多推迟 2 天）', () => {
    // day1..5 全满，day6 空闲。失败词 interval 基准为 1，cap = 1+2 = 3。
    const loads = [2, 2, 2, 2, 2, 0, 0, 0, 0, 0]
    const r = calculateSpellStrengthWithLoadBalancing(
      EMPTY_SPELLING, /*remembered*/ false, 'planet',
      /*dailySpellLimit*/ 2, loads, /*currentStrength*/ 2.0,
      /*initialStrength*/ 0, /*baseInterval*/ 1, /*maxPrepDays*/ 45
    )
    expect(r.interval).toBeLessThanOrEqual(3)
  })
})

describe('calculateSpellStrengthWithLoadBalancing — 低强度词严格推迟上限 (S2)', () => {
  test('低强度词被推迟不超过 maxDelay，超出则就近超限而非远推', () => {
    // currentStrength=1.0 + 完美增益≈+1.0 → newStrength≈2.0（低强度带，maxDelay=7）
    // basicInterval≈3；窗口 [3,4] 与其后到 day10 全满，day11 空闲。
    // 修复前：findOptimalDay forward 会返回 11（远超 base+maxDelay 但本测试用 cap 验证就近）。
    const loads = new Array(20).fill(0)
    for (let d = 3; d <= 10; d++) loads[d - 1] = 2 // day3..10 全满
    // day11+ 空闲
    const r = calculateSpellStrengthWithLoadBalancing(
      perfectSpellingData('test'), /*remembered*/ true, 'test',
      /*dailySpellLimit*/ 2, loads, /*currentStrength*/ 1.0,
      /*initialStrength*/ 0, /*baseInterval*/ 1, /*maxPrepDays*/ 45
    )
    // 不应被推到 day11（远推）；应落在 base 附近（就近超限）
    expect(r.interval).toBeLessThanOrEqual(10)
  })
})
