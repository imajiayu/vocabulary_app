import { describe, test, expect } from 'vitest'
import { findOptimalDay, findOptimalDayForStrong, computeSearchWindow } from '../loadBalancer'

describe('computeSearchWindow', () => {
  test('窗口从 baseInterval 起，偏移 = min(max(1, floor(base*0.5)), 7)', () => {
    expect(computeSearchWindow({ baseInterval: 10, dailyLimit: 5, currentLoads: new Array(45).fill(0) }))
      .toEqual([10, 15])
  })

  test('偏移上限 7 天', () => {
    expect(computeSearchWindow({ baseInterval: 30, dailyLimit: 5, currentLoads: new Array(45).fill(0) }))
      .toEqual([30, 37])
  })
})

describe('findOptimalDay — backward 不把高间隔词压缩到一半以下 (B4)', () => {
  test('窗口+向后全满时，宁可超限留在 base 也不回拉到 day2', () => {
    // base=10, limit=5；除 day2 外全满。旧实现会 backward 到 day2（压缩 80%）
    const loads = new Array(20).fill(5)
    loads[1] = 0 // day2 空闲
    const r = findOptimalDay({ baseInterval: 10, dailyLimit: 5, currentLoads: loads })
    expect(r.chosenDay).toBeGreaterThanOrEqual(5) // 不低于 floor(base*0.5)=5
  })

  test('backward 仍可在下限以内回拉', () => {
    // base=10, day7 空闲（7 >= floor=5），应被 backward 选中
    const loads = new Array(20).fill(5)
    loads[6] = 0 // day7
    const r = findOptimalDay({ baseInterval: 10, dailyLimit: 5, currentLoads: loads })
    expect(r.chosenDay).toBe(7)
  })

  test('窗口内有空位时正常 first-fit（行为不变）', () => {
    const loads = new Array(20).fill(0)
    loads[9] = 5 // day10 满
    const r = findOptimalDay({ baseInterval: 10, dailyLimit: 5, currentLoads: loads })
    expect(r.chosenDay).toBe(11) // 窗口内最早未满
  })
})

describe('findOptimalDayForStrong — backward 同样设下限 (B4)', () => {
  test('窗口+向后全满时不回拉到 day2', () => {
    const loads = new Array(20).fill(5)
    loads[1] = 0
    const r = findOptimalDayForStrong({ baseInterval: 10, dailyLimit: 5, currentLoads: loads })
    expect(r.chosenDay).toBeGreaterThanOrEqual(5)
  })

  test('基准天 <70% 直接返回 base（行为不变）', () => {
    const loads = new Array(20).fill(0)
    loads[9] = 3 // day10 负荷3 < 0.7*5=3.5
    const r = findOptimalDayForStrong({ baseInterval: 10, dailyLimit: 5, currentLoads: loads })
    expect(r.chosenDay).toBe(10)
    expect(r.phase).toBe('base')
  })
})
