// 音频源：URL 构建 + Google TTS API + 服务器缓存探测

import { uploadTtsCache } from './ttsCacheApi'

// 服务器缓存已知存在集合（避免重复 HEAD 请求）
const MAX_SERVER_CACHE_KNOWN = 1000
const serverCacheKnown = new Set<string>()

/**
 * 构建有道词典音频 URL
 */
export function buildYoudaoUrl(word: string, region: 'us' | 'uk'): string {
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
 * 构建服务器 TTS 缓存 URL（用 SHA-256 哈希做文件名）
 */
async function buildTtsCacheUrl(word: string, source: string): Promise<string> {
  const hash = await sha256Hex(word)
  return `${window.location.origin}/tts-cache/${encodeURIComponent(source)}/${hash}.mp3`
}

/**
 * 调用 Google Cloud TTS API，返回音频 URL
 * 有 source 时先尝试服务器缓存，未命中再调 API 并上传
 *
 * 性能优化：serverCacheKnown 记录已知存在的缓存条目，跳过 HEAD 请求
 */
export async function fetchGoogleTtsUrl(word: string, lang: string, source?: string): Promise<string> {
  // 1. 有 source 时，先尝试从服务器缓存获取
  if (source) {
    const cacheUrl = await buildTtsCacheUrl(word, source)
    const knownKey = `${source}:${word}`

    // 已知存在，直接返回
    if (serverCacheKnown.has(knownKey)) return cacheUrl

    try {
      const headResp = await fetch(cacheUrl, { method: 'HEAD' })
      if (headResp.ok) {
        if (serverCacheKnown.size >= MAX_SERVER_CACHE_KNOWN) serverCacheKnown.clear()
        serverCacheKnown.add(knownKey)
        return cacheUrl
      }
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

  // 3. 有 source 时，上传到服务器缓存（fire-and-forget）+ 记录已知
  if (source) {
    uploadTtsCache(word, source, audioContent)
    const knownKey = `${source}:${word}`
    if (serverCacheKnown.size >= MAX_SERVER_CACHE_KNOWN) serverCacheKnown.clear()
    serverCacheKnown.add(knownKey)
  }

  // 4. 转换为 blob URL 供本次播放
  const binary = atob(audioContent)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const blob = new Blob([bytes], { type: 'audio/mp3' })
  return URL.createObjectURL(blob)
}
