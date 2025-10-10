// src/utils/playWordAudio.ts

let currentAudio: HTMLAudioElement | null = null
let currentRetryController: AbortController | null = null

// 预加载缓存：存储已预加载的 Audio 对象
const preloadCache = new Map<string, HTMLAudioElement>()

/**
 * 播放单词音频（US / UK）
 * @param word 单词文本
 * @param region 'us' | 'uk'，默认 'us'
 * @param maxRetries 最大重试次数，默认5次
 * @param retryDelay 重试延迟（毫秒），默认300ms
 */
export async function playWordAudio(
  word: string,
  region: 'us' | 'uk' = 'us',
  maxRetries: number = 5,
  retryDelay: number = 300
) {
  if (!word) return

  // 取消之前的重试任务
  if (currentRetryController) {
    currentRetryController.abort()
    currentRetryController = null
  }

  // 停止上一个音频
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio.src = ''
    currentAudio = null
  }

  const cacheKey = getCacheKey(word, region)
  const url = buildAudioUrl(word, region)

  // 创建重试控制器
  const retryController = new AbortController()
  currentRetryController = retryController

  // 优先使用预加载的音频
  const cachedAudio = preloadCache.get(cacheKey)
  if (cachedAudio) {
    // 使用预加载的音频
    currentAudio = cachedAudio
    cachedAudio.currentTime = 0 // 重置播放位置

    try {
      await cachedAudio.play()

      // 播放成功，清理重试控制器
      if (currentRetryController === retryController) {
        currentRetryController = null
      }

      // 播放结束后清理
      cachedAudio.onended = () => {
        if (currentAudio === cachedAudio) {
          currentAudio = null
        }
      }
      cachedAudio.onpause = () => {
        if (currentAudio === cachedAudio) {
          currentAudio = null
        }
      }

      return // 播放成功，退出
    } catch (err) {
      console.warn('预加载音频播放失败，尝试重新加载', err)
      // 从缓存中移除失败的音频
      preloadCache.delete(cacheKey)
      if (currentAudio === cachedAudio) {
        currentAudio = null
      }
      // 继续执行后续的重试逻辑
    }
  }

  // 如果没有预加载或预加载播放失败，进行带重试的播放逻辑
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // 检查是否被取消
    if (retryController.signal.aborted) {
      return
    }

    // 创建新的 Audio 播放
    const audio = new Audio(url)
    currentAudio = audio

    try {
      await audio.play()

      // 播放成功，清理重试控制器
      if (currentRetryController === retryController) {
        currentRetryController = null
      }

      // 播放结束后清理
      audio.onended = () => {
        if (currentAudio === audio) {
          currentAudio = null
        }
      }
      audio.onpause = () => {
        if (currentAudio === audio) {
          currentAudio = null
        }
      }

      return // 播放成功，退出
    } catch (err) {
      // 清理失败的音频对象
      if (currentAudio === audio) {
        currentAudio = null
      }

      // 检查是否被取消
      if (retryController.signal.aborted) {
        return
      }

      // 判断是否是最后一次尝试
      if (attempt === maxRetries) {
        console.error(`播放音频失败，已重试 ${maxRetries} 次`, err)
        // 清理重试控制器
        if (currentRetryController === retryController) {
          currentRetryController = null
        }
        return
      }

      // 不是最后一次，等待后重试
      console.warn(`播放音频失败 (尝试 ${attempt + 1}/${maxRetries + 1})，${retryDelay}ms 后重试...`, err)

      // 等待指定时间后重试
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, retryDelay)
        // 如果被取消，清除定时器
        retryController.signal.addEventListener('abort', () => {
          clearTimeout(timer)
          resolve()
        })
      })
    }
  }
}

/**
 * 停止当前音频播放（可选）
 */
export function stopWordAudio() {
  // 取消重试任务
  if (currentRetryController) {
    currentRetryController.abort()
    currentRetryController = null
  }

  // 停止音频
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio.src = ''
    currentAudio = null
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
    audio.addEventListener('canplaythrough', () => {
      preloadCache.set(cacheKey, audio)
      resolve()
    }, { once: true })

    audio.addEventListener('error', (err) => {
      console.warn(`预加载音频失败: ${word} (${region})`, err)
      resolve() // 即使失败也 resolve，不阻塞后续操作
    }, { once: true })

    // 开始加载
    audio.load()
  })
}

/**
 * 批量预加载多个单词的音频
 * @param words 单词列表
 * @param region 'us' | 'uk'，默认 'us'
 * @param maxConcurrent 最大并发数，默认3
 */
export async function preloadMultipleWordAudio(
  words: string[],
  region: 'us' | 'uk' = 'us',
  maxConcurrent: number = 3
): Promise<void> {
  if (words.length === 0) return

  // 分批预加载，避免过多并发请求
  for (let i = 0; i < words.length; i += maxConcurrent) {
    const batch = words.slice(i, i + maxConcurrent)
    await Promise.all(batch.map(word => preloadWordAudio(word, region)))
  }
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
