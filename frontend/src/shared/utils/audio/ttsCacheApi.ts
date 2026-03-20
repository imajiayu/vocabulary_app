// 后端 TTS 缓存 CRUD（fire-and-forget）

import { supabase } from '@/shared/config/supabase'
import { API_BASE_URL } from '@/shared/config/env'

/** 通用 fire-and-forget 请求 */
function _ttsRequest(method: string, body: Record<string, unknown>): void {
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!session?.access_token) return
    fetch(`${API_BASE_URL}/api/tts/cache`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    }).catch(() => {})
  })
}

/** 上传音频到服务器缓存 */
export function uploadTtsCache(word: string, source: string, audioBase64: string): void {
  _ttsRequest('POST', { word, source, audio: audioBase64 })
}

/** 删除指定单词的 TTS 缓存 */
export function deleteTtsCache(words: string[], source: string): void {
  _ttsRequest('DELETE', { source, words })
}

/** 删除整个 source 目录的 TTS 缓存 */
export function deleteTtsCacheSource(source: string): void {
  _ttsRequest('DELETE', { source })
}
