/**
 * 单词管理页本地缓存（localStorage envelope）
 *
 * 缓存命中策略基于 (count, max(updated_at)) 指纹：
 * - 指纹一致 → 命中，直接用缓存渲染
 * - count 一致但 maxUpdatedAt 增大 → 增量同步
 * - count 不一致（含删除）→ 全量重拉
 *
 * 跨账号天然隔离：cache key 含 userId
 * QuotaExceededError 降级：写入失败时清除缓存继续运行（下次进页面照常全量加载）
 */
import type { Word } from '@/shared/types'
import { logger } from '@/shared/utils/logger'

const log = logger.create('wordsCache')

const SCHEMA_VERSION = 1
const KEY_PREFIX = 'words.cache.'
// 写入超 quota 后本会话不再尝试，避免每次 mutation/onMounted 反复 setItem 报错刷屏
const SKIP_SESSION_KEY = 'words.cache.skip-session'

export interface WordsFingerprint {
  count: number
  maxUpdatedAt: string | null
}

interface CacheEnvelope {
  schemaVersion: number
  userId: string
  fingerprint: WordsFingerprint
  syncedAt: string
  words: Word[]
}

function key(userId: string): string {
  return `${KEY_PREFIX}${userId}`
}

function shouldSkipSession(): boolean {
  try { return sessionStorage.getItem(SKIP_SESSION_KEY) === '1' } catch { return false }
}

function markSkipSession(): void {
  try { sessionStorage.setItem(SKIP_SESSION_KEY, '1') } catch { /* ignore */ }
}

export function computeFingerprint(words: Word[]): WordsFingerprint {
  if (words.length === 0) return { count: 0, maxUpdatedAt: null }
  let max = words[0].updated_at
  for (let i = 1; i < words.length; i++) {
    if (words[i].updated_at > max) max = words[i].updated_at
  }
  return { count: words.length, maxUpdatedAt: max }
}

/**
 * 读取缓存。schemaVersion 不匹配或 JSON 解析失败时返回 null（自动清理旧条目）
 */
export function load(userId: string): CacheEnvelope | null {
  try {
    const raw = localStorage.getItem(key(userId))
    if (!raw) return null
    const envelope = JSON.parse(raw) as CacheEnvelope
    if (envelope.schemaVersion !== SCHEMA_VERSION) {
      localStorage.removeItem(key(userId))
      return null
    }
    if (envelope.userId !== userId) {
      localStorage.removeItem(key(userId))
      return null
    }
    return envelope
  } catch (err) {
    log.warn('cache load failed, clearing', err)
    try { localStorage.removeItem(key(userId)) } catch { /* ignore */ }
    return null
  }
}

/**
 * 全量保存。QuotaExceededError 时清缓存 + 设置 session 跳过标记，避免本会话内反复重试
 */
export function save(userId: string, words: Word[]): WordsFingerprint {
  const fingerprint = computeFingerprint(words)
  if (shouldSkipSession()) return fingerprint
  const envelope: CacheEnvelope = {
    schemaVersion: SCHEMA_VERSION,
    userId,
    fingerprint,
    syncedAt: new Date().toISOString(),
    words,
  }
  try {
    localStorage.setItem(key(userId), JSON.stringify(envelope))
  } catch (err) {
    log.warn('cache save failed (likely quota), clearing + skipping cache for this session', err)
    try { localStorage.removeItem(key(userId)) } catch { /* ignore */ }
    markSkipSession()
  }
  return fingerprint
}

/**
 * Mutation 后增量更新缓存（upsert 单条或批量）
 * 找不到现存缓存时静默跳过（避免无缓存时反复写入）
 */
export function upsertWords(userId: string, updated: Word[]): void {
  if (updated.length === 0) return
  const envelope = load(userId)
  if (!envelope) return

  const indexMap = new Map<number, number>()
  envelope.words.forEach((w, i) => indexMap.set(w.id, i))

  for (const w of updated) {
    const idx = indexMap.get(w.id)
    if (idx !== undefined) {
      envelope.words[idx] = w
    } else {
      envelope.words.push(w)
      indexMap.set(w.id, envelope.words.length - 1)
    }
  }

  save(userId, envelope.words)
}

/**
 * Mutation 后从缓存删除单条或批量
 */
export function deleteWords(userId: string, wordIds: number[]): void {
  if (wordIds.length === 0) return
  const envelope = load(userId)
  if (!envelope) return

  const idSet = new Set(wordIds)
  const filtered = envelope.words.filter(w => !idSet.has(w.id))
  if (filtered.length === envelope.words.length) return  // 无变化

  save(userId, filtered)
}

/**
 * 清空缓存（登出或调试用）
 */
export function clear(userId: string): void {
  try { localStorage.removeItem(key(userId)) } catch { /* ignore */ }
}

/**
 * 比对两个指纹是否一致
 */
export function fingerprintEqual(a: WordsFingerprint, b: WordsFingerprint): boolean {
  return a.count === b.count && a.maxUpdatedAt === b.maxUpdatedAt
}
