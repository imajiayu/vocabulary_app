/**
 * Pool-based concurrent map: runs `fn` on each item with at most
 * `concurrency` tasks in flight at once. Results preserve input order.
 *
 * Options:
 *  - retries: max retry attempts per item (default 0 = no retry)
 *  - retryDelay: base delay in ms, doubled on each retry (default 500)
 *
 * Individual task failures (after all retries) are caught —
 * the corresponding slot becomes `undefined`.
 */
export interface ConcurrentMapOptions {
  retries?: number
  retryDelay?: number
}

export async function concurrentMap<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number,
  options: ConcurrentMapOptions = {},
): Promise<(R | undefined)[]> {
  const { retries = 0, retryDelay = 500 } = options
  const results: (R | undefined)[] = new Array(items.length)
  let nextIndex = 0

  const worker = async () => {
    while (nextIndex < items.length) {
      const i = nextIndex++
      let lastError: unknown
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          results[i] = await fn(items[i])
          lastError = undefined
          break
        } catch (err) {
          lastError = err
          if (attempt < retries) {
            await new Promise(r => setTimeout(r, retryDelay * 2 ** attempt))
          }
        }
      }
      if (lastError !== undefined) {
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
