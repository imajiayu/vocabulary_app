/**
 * 统一 Supabase API 错误处理
 *
 * 替换散落在各 API 文件中的 `if (error) throw new Error(error.message)`，
 * 统一添加操作上下文信息，便于调试。
 */

/**
 * 若 error 非空则抛出，支持可选的上下文描述
 *
 * @example
 * const { data, error } = await supabase.from('words').select()
 * throwIfError(error, '获取单词列表失败')
 */
export function throwIfError(error: unknown, context?: string): void {
  if (!error) return
  const msg = (error as { message?: string })?.message || 'Unknown error'
  throw new Error(context ? `${context}: ${msg}` : msg)
}
