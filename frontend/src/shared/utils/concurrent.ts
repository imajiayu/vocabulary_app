/**
 * Pool-based concurrent map: runs `fn` on each item with at most
 * `concurrency` tasks in flight at once. Results preserve input order.
 * Individual task failures are caught — the corresponding slot becomes `undefined`.
 */
export async function concurrentMap<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number,
): Promise<(R | undefined)[]> {
  const results: (R | undefined)[] = new Array(items.length)
  let nextIndex = 0

  const worker = async () => {
    while (nextIndex < items.length) {
      const i = nextIndex++
      try {
        results[i] = await fn(items[i])
      } catch {
        results[i] = undefined
      }
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  )
  await Promise.all(workers)

  return results
}
