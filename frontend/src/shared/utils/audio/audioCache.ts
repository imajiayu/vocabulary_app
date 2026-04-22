// 音频缓存管理：preloadCache (Audio 对象) + ttsCache (TTS URL)
// 两层缓存各上限 30，超出时淘汰最旧 50%

export const MAX_PRELOAD_CACHE_SIZE = 30
export const MAX_TTS_CACHE_SIZE = 30

// 预加载缓存：存储已预加载的 Audio 对象
export const preloadCache = new Map<string, HTMLAudioElement>()

// AI TTS URL 缓存（避免重复 API 调用 / HEAD 请求）
export const ttsCache = new Map<string, string>()

/**
 * 生成缓存键（仅有道词典 / 英语）
 */
export function getCacheKey(word: string, region: 'us' | 'uk'): string {
  return `${word}_${region}`
}

/**
 * preloadCache 淘汰：超 MAX 时淘汰最旧 50%
 */
export function evictIfNeeded(): void {
  if (preloadCache.size >= MAX_PRELOAD_CACHE_SIZE) {
    const evictCount = Math.floor(MAX_PRELOAD_CACHE_SIZE / 2)
    const keys = Array.from(preloadCache.keys())
    for (let i = 0; i < evictCount; i++) {
      const audio = preloadCache.get(keys[i])
      if (audio?.src.startsWith('blob:')) URL.revokeObjectURL(audio.src)
      ttsCache.delete(keys[i])
      preloadCache.delete(keys[i])
    }
  }
  evictTtsCacheIfNeeded()
}

/**
 * ttsCache 独立淘汰：超 MAX 时淘汰最旧 50%，revoke blob URL
 */
export function evictTtsCacheIfNeeded(): void {
  if (ttsCache.size >= MAX_TTS_CACHE_SIZE) {
    const evictCount = Math.floor(MAX_TTS_CACHE_SIZE / 2)
    const keys = Array.from(ttsCache.keys())
    for (let i = 0; i < evictCount; i++) {
      const url = ttsCache.get(keys[i])
      if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
      ttsCache.delete(keys[i])
      preloadCache.delete(keys[i])
    }
  }
}

/**
 * 清理预加载缓存
 * @param keepCount 保留最近的多少个缓存，默认保留10个
 */
export function clearPreloadCache(keepCount: number = 10): void {
  if (preloadCache.size <= keepCount) return

  const entries = Array.from(preloadCache.entries())
  const toKeep = keepCount > 0 ? entries.slice(-keepCount) : []
  const keepKeys = new Set(toKeep.map(([k]) => k))

  // revoke 被驱逐条目的 TTS blob URL + 清理 ttsCache
  for (const [key, audio] of entries) {
    if (!keepKeys.has(key)) {
      if (audio.src.startsWith('blob:')) URL.revokeObjectURL(audio.src)
      ttsCache.delete(key)
    }
  }

  // 清理 ttsCache 中的孤儿条目（playWordAudio 直接播放时只写 ttsCache 不写 preloadCache）
  for (const [key, url] of Array.from(ttsCache.entries())) {
    if (!keepKeys.has(key)) {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url)
      ttsCache.delete(key)
    }
  }

  preloadCache.clear()
  toKeep.forEach(([key, audio]) => {
    preloadCache.set(key, audio)
  })
}

/**
 * 获取缓存统计信息
 */
export function getPreloadCacheStats() {
  return {
    size: preloadCache.size,
    words: Array.from(preloadCache.keys())
  }
}
