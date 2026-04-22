// 音频源：URL 构建 + AI TTS（经 Flask /api/ai/synthesize）+ 服务器缓存探测

import { API_BASE_URL } from '@/shared/config/env'
import { supabase } from '@/shared/config/supabase'
import { resolveTtsModel } from '@/shared/services/aiModelPrefs'
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
 * 调用 AI TTS（Flask 代理），返回音频 URL
 * 有 source 时先尝试服务器缓存，未命中再调后端并异步写回缓存
 *
 * 性能优化：serverCacheKnown 记录已知存在的缓存条目，跳过 HEAD 请求
 */
export async function fetchAiTtsUrl(word: string, lang: string, source?: string): Promise<string> {
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
    } catch { /* 缓存不可用，继续调后端 */ }
  }

  // 2. 调用 Flask /api/ai/synthesize
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('未登录，无法合成语音')

  const resp = await fetch(`${API_BASE_URL}/api/ai/synthesize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      text: word,
      lang,
      model: await resolveTtsModel(),
    }),
  })
  if (!resp.ok) throw new Error(`AI TTS 失败: HTTP ${resp.status}`)
  const payload = await resp.json()
  if (!payload?.success || !payload?.data?.audio_base64) {
    throw new Error(payload?.error || 'AI TTS 响应缺少 audio_base64')
  }
  const audioContent: string = payload.data.audio_base64

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
