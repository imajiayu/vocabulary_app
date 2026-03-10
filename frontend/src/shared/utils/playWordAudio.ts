// src/utils/playWordAudio.ts

import { supabase } from '@/shared/config/supabase'
import { API_BASE_URL } from '@/shared/config/env'

let currentAudio: HTMLAudioElement | null = null

// 播放版本号：用于解决竞态条件，确保只有最新的播放请求能真正播放
let playId = 0

// 预加载缓存：存储已预加载的 Audio 对象（上限 30，超出淘汰最旧一半）
const MAX_PRELOAD_CACHE_SIZE = 30
const preloadCache = new Map<string, HTMLAudioElement>()

// Google TTS URL 缓存（避免重复 API 调用 / HEAD 请求，上限与 preloadCache 一致）
const MAX_TTS_CACHE_SIZE = 30
const ttsCache = new Map<string, string>()

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
 * 构建有道词典音频 URL
 */
function buildYoudaoUrl(word: string, region: 'us' | 'uk'): string {
  const type = region === 'us' ? 2 : 1
  return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${type}`
}

/**
 * 计算单词的 SHA-256 哈希（与后端 hashlib.sha256 一致）
 */
async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 构建服务器 TTS 缓存 URL（用 SHA-256 哈希做文件名，避免编码不一致问题）
 */
async function buildTtsCacheUrl(word: string, source: string): Promise<string> {
  const hash = await sha256Hex(word)
  return `${window.location.origin}/tts-cache/${encodeURIComponent(source)}/${hash}.mp3`
}

/**
 * 上传音频到服务器缓存（fire-and-forget）
 */
function uploadTtsCache(word: string, source: string, audioBase64: string): void {
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session?.access_token) return
    fetch(`${API_BASE_URL}/api/tts/cache`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ word, source, audio: audioBase64 }),
    }).catch(() => {})
  })
}

/**
 * 删除指定单词的 TTS 缓存（fire-and-forget）
 */
export function deleteTtsCache(words: string[], source: string): void {
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session?.access_token) return
    fetch(`${API_BASE_URL}/api/tts/cache`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ source, words }),
    }).catch(() => {})
  })
}

/**
 * 删除整个 source 目录的 TTS 缓存（fire-and-forget）
 */
export function deleteTtsCacheSource(source: string): void {
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session?.access_token) return
    fetch(`${API_BASE_URL}/api/tts/cache`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ source }),
    }).catch(() => {})
  })
}

/**
 * 调用 Google Cloud TTS API，返回音频 URL
 * 有 source 时先尝试服务器缓存，未命中再调 API 并上传
 */
async function fetchGoogleTtsUrl(word: string, lang: string, source?: string): Promise<string> {
  // 1. 有 source 时，先尝试从服务器缓存获取
  if (source) {
    const cacheUrl = await buildTtsCacheUrl(word, source)
    try {
      const headResp = await fetch(cacheUrl, { method: 'HEAD' })
      if (headResp.ok) return cacheUrl
    } catch { /* 缓存不可用，继续调 API */ }
  }

  // 2. 调用 Google TTS API
  const apiKey = import.meta.env.VITE_GOOGLE_TTS_API_KEY
  if (!apiKey) throw new Error('VITE_GOOGLE_TTS_API_KEY not configured')
  const resp = await fetch(
    `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: { text: word },
        voice: { languageCode: lang },
        audioConfig: { audioEncoding: 'MP3' },
      }),
    }
  )
  if (!resp.ok) throw new Error(`Google TTS API error: ${resp.status}`)
  const data = await resp.json()
  const audioContent: string = data.audioContent

  // 3. 有 source 时，上传到服务器缓存（fire-and-forget）
  if (source) uploadTtsCache(word, source, audioContent)

  // 4. 转换为 blob URL 供本次播放
  const binary = atob(audioContent)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: 'audio/mp3' })
  return URL.createObjectURL(blob)
}

/**
 * 生成缓存键（仅有道词典）
 */
function getCacheKey(word: string, region: 'us' | 'uk'): string {
  return `${word}_${region}`
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
  // 注：Audio.load() 直接请求是 Low Priority（1-30s），link preload 是 High Priority（~100ms）
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

function evictIfNeeded() {
  if (preloadCache.size >= MAX_PRELOAD_CACHE_SIZE) {
    const evictCount = Math.floor(MAX_PRELOAD_CACHE_SIZE / 2)
    const keys = Array.from(preloadCache.keys())
    for (let i = 0; i < evictCount; i++) {
      // revoke TTS blob URL 防止内存泄漏
      const audio = preloadCache.get(keys[i])
      if (audio?.src.startsWith('blob:')) URL.revokeObjectURL(audio.src)
      ttsCache.delete(keys[i])
      preloadCache.delete(keys[i])
    }
  }
  evictTtsCacheIfNeeded()
}

function evictTtsCacheIfNeeded() {
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
 * 批量预加载多个单词的音频（真正并行）
 * @param words 单词列表
 * @param region 'us' | 'uk'，仅英语有效
 * @param ttsLang Google TTS 语言代码
 * @param source 单词来源（用于服务器缓存路径）
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
