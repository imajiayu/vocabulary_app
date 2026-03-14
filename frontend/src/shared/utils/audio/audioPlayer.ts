// 音频播放/停止/预加载 + 竞态控制

import { preloadCache, ttsCache, getCacheKey, evictIfNeeded, evictTtsCacheIfNeeded } from './audioCache'
import { buildYoudaoUrl, fetchGoogleTtsUrl } from './audioSources'

let currentAudio: HTMLAudioElement | null = null

// 播放版本号：用于解决竞态条件，确保只有最新的播放请求能真正播放
let playId = 0

/**
 * 播放单词音频
 * - 英语：有道词典（US / UK 口音）
 * - 非英语：Google Cloud TTS（通过 ttsLang 指定语言）
 * @param word 单词文本
 * @param region 'us' | 'uk'，仅英语有效
 * @param ttsLang Google TTS 语言代码（如 'uk-UA'），传入则使用 Google TTS
 * @param source 单词来源（用于服务器缓存路径）
 */
export async function playWordAudio(
  word: string,
  region: 'us' | 'uk' = 'us',
  ttsLang?: string,
  source?: string
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

  const cacheKey = ttsLang ? `tts_${ttsLang}_${word}` : getCacheKey(word, region)

  // 获取音频 URL（Google TTS 需要异步获取）
  let url: string
  if (ttsLang) {
    const cached = ttsCache.get(cacheKey)
    if (cached) {
      url = cached
    } else {
      try {
        url = await fetchGoogleTtsUrl(word, ttsLang, source)
        ttsCache.set(cacheKey, url)
        evictTtsCacheIfNeeded() // Bug 2 fix: 防止非复习场景下孤儿 blob URL 堆积
      } catch {
        return // API 调用失败，静默处理
      }
      if (playId !== currentPlayId) return
    }
  } else {
    url = buildYoudaoUrl(word, region)
  }

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
    // 缓存音频失败（浏览器可能已回收解码数据）→ 删除坏缓存，用新 Audio 重试
    if (cachedAudio) {
      preloadCache.delete(cacheKey)
      if (playId !== currentPlayId) return

      const freshAudio = new Audio(url)
      currentAudio = freshAudio
      freshAudio.onended = () => {
        if (currentAudio === freshAudio) currentAudio = null
      }
      try {
        await freshAudio.play()
        if (playId !== currentPlayId) {
          freshAudio.pause()
          freshAudio.currentTime = 0
        }
      } catch {
        if (currentAudio === freshAudio) currentAudio = null
      }
    } else {
      if (currentAudio === audio) currentAudio = null
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
 * 预加载单词音频
 * @param word 单词文本
 * @param region 'us' | 'uk'，仅英语有效
 * @param ttsLang Google TTS 语言代码，传入则预加载 Google TTS 音频
 * @param source 单词来源（用于服务器缓存路径）
 */
export async function preloadWordAudio(
  word: string,
  region: 'us' | 'uk' = 'us',
  ttsLang?: string,
  source?: string
): Promise<void> {
  if (!word) return

  const cacheKey = ttsLang ? `tts_${ttsLang}_${word}` : getCacheKey(word, region)

  // 如果已经缓存，直接返回
  if (preloadCache.has(cacheKey) || (ttsLang && ttsCache.has(cacheKey))) {
    return
  }

  // Google TTS：预先获取 URL 并创建 Audio
  if (ttsLang) {
    try {
      const url = await fetchGoogleTtsUrl(word, ttsLang, source)
      ttsCache.set(cacheKey, url)
      const audio = new Audio(url)
      audio.preload = 'auto'
      evictIfNeeded()
      preloadCache.set(cacheKey, audio)
    } catch {
      // 静默处理
    }
    return
  }

  // 有道词典：<link rel="preload"> 高优先级下载 → Audio.load() 从浏览器缓存读取
  const url = buildYoudaoUrl(word, region)

  // Step 1: link preload 高优先级下载到浏览器 preload cache
  await new Promise<void>((resolve) => {
    const link = document.createElement('link')
    link.rel = 'preload'
    link.as = 'audio'
    link.href = url
    const timer = setTimeout(() => { link.remove(); resolve() }, 5000)
    link.onload = () => { clearTimeout(timer); link.remove(); resolve() }
    link.onerror = () => { clearTimeout(timer); link.remove(); resolve() }
    document.head.appendChild(link)
  })

  // Step 2: Audio.load() 从 preload cache 读取（应近乎即时）
  await new Promise<void>((resolve) => {
    const audio = new Audio()
    audio.preload = 'auto'
    audio.src = url
    let done = false
    const finish = (ok: boolean) => {
      if (done) return
      done = true
      if (ok) { evictIfNeeded(); preloadCache.set(cacheKey, audio) }
      resolve()
    }
    audio.addEventListener('canplaythrough', () => finish(true), { once: true })
    audio.addEventListener('error', () => finish(false), { once: true })
    audio.load()
  })
}

/**
 * 批量预加载多个单词的音频（真正并行）
 */
export async function preloadMultipleWordAudio(
  words: string[],
  region: 'us' | 'uk' = 'us',
  ttsLang?: string,
  source?: string
): Promise<void> {
  if (words.length === 0) return
  await Promise.all(words.map(word => preloadWordAudio(word, region, ttsLang, source)))
}
