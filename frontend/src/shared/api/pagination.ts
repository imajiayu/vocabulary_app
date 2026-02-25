/**
 * Supabase 分页查询工具
 *
 * 封装 PostgREST 1000 行限制的 while + range + break 循环，
 * 消除 words.ts / stats.ts / speaking.ts 中的重复分页代码。
 */

const DEFAULT_PAGE_SIZE = 1000

/**
 * 通用 Supabase 分页获取
 *
 * @param buildQuery 接收 (from, to) 范围参数，返回 Supabase query 的 Promise
 * @param pageSize 每页大小，默认 1000
 * @returns 所有行合并后的数组
 *
 * @example
 * const rows = await paginateSupabase<{ id: number }>((from, to) =>
 *   supabase.from('words').select('id').eq('user_id', userId).range(from, to)
 * )
 */
export async function paginateSupabase<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
  pageSize = DEFAULT_PAGE_SIZE,
  context?: string
): Promise<T[]> {
  const allRows: T[] = []
  let offset = 0
  while (true) {
    const { data, error } = await buildQuery(offset, offset + pageSize - 1)
    if (error) {
      const msg = context ? `${context}: ${error.message}` : error.message
      throw new Error(msg)
    }
    if (!data || data.length === 0) break
    allRows.push(...(data as T[]))
    if (data.length < pageSize) break
    offset += pageSize
  }
  return allRows
}
