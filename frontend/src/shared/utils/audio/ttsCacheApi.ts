// 后端 TTS 缓存 CRUD（fire-and-forget）

import { supabase } from '@/shared/config/supabase'
import { API_BASE_URL } from '@/shared/config/env'

/**
 * 上传音频到服务器缓存（fire-and-forget）
 */
export function uploadTtsCache(word: string, source: string, audioBase64: string): void {
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
