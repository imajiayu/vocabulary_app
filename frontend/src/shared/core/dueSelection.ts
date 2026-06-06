/**
 * 到期复习词的选取逻辑（纯函数，便于测试）
 *
 * 修复 B1：旧实现先按字母排序再截断 limit，导致到期量 > limit 时字母靠后的词
 * 长期被饿死。正确做法：先按 next_review 紧急度（最逾期优先）选出 limit 个，
 * 再按字母重排用于展示。
 */
export interface DueRow {
  id: number
  word: string
  next_review: string  // ISO date，可直接字符串比较
}

function byWord(a: { word: string }, b: { word: string }): number {
  return a.word.toLowerCase().localeCompare(b.word.toLowerCase())
}

/**
 * 按紧急度（next_review 升序，最逾期优先；同日按字母）排序，返回新数组（不改原数组）。
 * 用于拼写到期分组：避免"先字母排序再截断 limit"导致字母靠后的到期词被饿死（S1）。
 */
export function orderDueByUrgency<T extends { word: string; next_review: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.next_review < b.next_review) return -1
    if (a.next_review > b.next_review) return 1
    return byWord(a, b)
  })
}

export function selectDueWordIds(rows: DueRow[], limit?: number): number[] {
  // 1. 按紧急度排序：next_review 升序（最逾期优先），同日按字母
  const byUrgency = [...rows].sort((a, b) => {
    if (a.next_review < b.next_review) return -1
    if (a.next_review > b.next_review) return 1
    return byWord(a, b)
  })

  // 2. 取最紧急的 limit 个
  const selected = limit != null ? byUrgency.slice(0, limit) : byUrgency

  // 3. 展示顺序：字母升序
  selected.sort(byWord)
  return selected.map(r => r.id)
}
