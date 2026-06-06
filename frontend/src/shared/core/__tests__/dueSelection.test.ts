import { describe, test, expect } from 'vitest'
import { selectDueWordIds, orderDueByUrgency } from '../dueSelection'

describe('selectDueWordIds — 到期词按紧急度选取，消除字母饿死 (B1)', () => {
  test('截断时保留最逾期的词，而非字母靠前的词', () => {
    // "zebra" 最逾期(2026-01-01)，"apple" 今天才到期。limit=1 时应保留 zebra。
    const rows = [
      { id: 1, word: 'apple', next_review: '2026-06-07' },
      { id: 2, word: 'zebra', next_review: '2026-01-01' },
    ]
    expect(selectDueWordIds(rows, 1)).toEqual([2])
  })

  test('选出的词用于展示时按字母升序排列', () => {
    const rows = [
      { id: 1, word: 'banana', next_review: '2026-01-01' },
      { id: 2, word: 'apple', next_review: '2026-01-01' },
      { id: 3, word: 'cherry', next_review: '2026-01-02' },
    ]
    // 三个都选中（无 limit），展示顺序按字母：apple, banana, cherry
    expect(selectDueWordIds(rows)).toEqual([2, 1, 3])
  })

  test('同一到期日内按字母决定谁先入选（紧急度相同）', () => {
    const rows = [
      { id: 1, word: 'delta', next_review: '2026-05-01' },
      { id: 2, word: 'alpha', next_review: '2026-05-01' },
      { id: 3, word: 'omega', next_review: '2026-04-01' }, // 更逾期
    ]
    // limit=2：先取最逾期 omega，再取同日中字母靠前 alpha；展示按字母 → alpha, omega
    expect(selectDueWordIds(rows, 2)).toEqual([2, 3])
  })

  test('无 limit 时返回全部（展示字母序）', () => {
    const rows = [
      { id: 1, word: 'gamma', next_review: '2026-03-01' },
      { id: 2, word: 'beta', next_review: '2026-03-02' },
    ]
    expect(selectDueWordIds(rows)).toEqual([2, 1])
  })

  test('空输入返回空数组', () => {
    expect(selectDueWordIds([])).toEqual([])
    expect(selectDueWordIds([], 5)).toEqual([])
  })
})

describe('orderDueByUrgency — 拼写到期分组按紧急度排序 (S1)', () => {
  test('next_review 升序（最逾期优先），同日按字母', () => {
    const rows = [
      { id: 1, word: 'banana', next_review: '2026-05-01' },
      { id: 2, word: 'apple', next_review: '2026-01-01' },  // 最逾期
      { id: 3, word: 'cherry', next_review: '2026-05-01' },
    ]
    expect(orderDueByUrgency(rows).map(r => r.id)).toEqual([2, 1, 3])
  })

  test('不修改原数组', () => {
    const rows = [
      { id: 1, word: 'b', next_review: '2026-05-01' },
      { id: 2, word: 'a', next_review: '2026-01-01' },
    ]
    orderDueByUrgency(rows)
    expect(rows.map(r => r.id)).toEqual([1, 2])
  })

  test('空输入返回空', () => {
    expect(orderDueByUrgency([])).toEqual([])
  })
})
