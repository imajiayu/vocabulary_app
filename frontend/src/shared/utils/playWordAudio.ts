// src/utils/playWordAudio.ts

let currentAudio: HTMLAudioElement | null = null

// 播放版本号：用于解决竞态条件，确保只有最新的播放请求能真正播放
let playId = 0

// 预加载缓存：存储已预加载的 Audio 对象（上限 30，超出淘汰最旧一半）
const MAX_PRELOAD_CACHE_SIZE = 30
const preloadCache = new Map<string, HTMLAudioElement>()

/**
 * 播放单词音频（US / UK）
 * 简化逻辑：尝试缓存 → 尝试直接播放 → 静默失败
 * @param word 单词文本
 * @param region 'us' | 'uk'，默认 'us'
 */
export async function playWordAudio(
  word: string,
  region: 'us' | 'uk' = 'us'
): Promise<void> {
  if (!word) return

  // 递增播放版本号，使之前的播放请求失效
  const currentPlayId = ++playId

  // 停止上一个音频（使用局部变量避免 onended 回调干扰）
  const prev = currentAudio
  currentAudio = null
  if (prev) {
    prev.onended = null
    prev.pause()
    prev.currentTime = 0
  }

  const cacheKey = getCacheKey(word, region)
  const url = buildAudioUrl(word, region)

  // 优先使用预加载的音频
  const cachedAudio = preloadCache.get(cacheKey)
  const audio = cachedAudio ?? new Audio(url)

  if (cachedAudio) {
    cachedAudio.currentTime = 0
  }

  currentAudio = audio

  // 仅在自然播放结束后清理（不设 onpause，避免 pause() 停止旧音频时被回调干扰）
  audio.onended = () => {
    if (currentAudio === audio) {
      currentAudio = null
    }
  }

  // 尝试播放，失败则静默处理
  try {
    await audio.play()
    // 播放成功后检查：如果已经有更新的播放请求，停止当前音频
    if (playId !== currentPlayId) {
      audio.pause()
      audio.currentTime = 0
    }
  } catch {
    // 静默失败：Youdao CDN 很稳定，失败时不阻塞用户操作
    if (cachedAudio) {
      preloadCache.delete(cacheKey)
    }
    if (currentAudio === audio) {
      currentAudio = null
    }
  }
}

/**
 * 停止当前音频播放
 */
export function stopWordAudio(): void {
  if (currentAudio) {
    const audio = currentAudio
    currentAudio = null
    audio.onended = null
    audio.pause()
    audio.currentTime = 0
  }
}

/**
 * 构建音频 URL 的辅助函数
 */
function buildAudioUrl(word: string, region: 'us' | 'uk'): string {
  const type = region === 'us' ? 2 : 1
  return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${type}`
}

/**
 * 生成缓存键
 */
function getCacheKey(word: string, region: 'us' | 'uk'): string {
  return `${word}_${region}`
}

/**
 * 预加载单词音频
 * @param word 单词文本
 * @param region 'us' | 'uk'，默认 'us'
 * @returns Promise<void>
 */
export async function preloadWordAudio(
  word: string,
  region: 'us' | 'uk' = 'us'
): Promise<void> {
  if (!word) return

  const cacheKey = getCacheKey(word, region)

  // 如果已经缓存，直接返回
  if (preloadCache.has(cacheKey)) {
    return
  }

  const url = buildAudioUrl(word, region)
  const audio = new Audio()

  // 设置预加载
  audio.preload = 'auto'
  audio.src = url

  // 监听加载完成
  return new Promise<void>((resolve) => {
    let isResolved = false

    audio.addEventListener('canplaythrough', () => {
      if (isResolved) return
      isResolved = true
      // 缓存上限：超出时淘汰最旧的一半
      if (preloadCache.size >= MAX_PRELOAD_CACHE_SIZE) {
        const evictCount = Math.floor(MAX_PRELOAD_CACHE_SIZE / 2)
        const keys = Array.from(preloadCache.keys())
        for (let i = 0; i < evictCount; i++) {
          preloadCache.delete(keys[i])
        }
      }
      preloadCache.set(cacheKey, audio)
      resolve()
    }, { once: true })

    audio.addEventListener('error', () => {
      if (isResolved) return
      isResolved = true
      // 静默处理预加载失败
      resolve() // 即使失败也 resolve，不阻塞后续操作
    }, { once: true })

    // 开始加载
    audio.load()
  })
}

/**
 * 批量预加载多个单词的音频（真正并行）
 * @param words 单词列表
 * @param region 'us' | 'uk'，默认 'us'
 */
export async function preloadMultipleWordAudio(
  words: string[],
  region: 'us' | 'uk' = 'us'
): Promise<void> {
  if (words.length === 0) return
  await Promise.all(words.map(word => preloadWordAudio(word, region)))
}

/**
 * 清理预加载缓存
 * @param keepCount 保留最近的多少个缓存，默认保留10个
 */
export function clearPreloadCache(keepCount: number = 10): void {
  if (preloadCache.size <= keepCount) return

  // 转换为数组并保留最后 keepCount 个
  const entries = Array.from(preloadCache.entries())
  const toKeep = entries.slice(-keepCount)

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
