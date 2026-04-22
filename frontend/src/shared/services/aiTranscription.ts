/**
 * AI 语音转文字 — 经 Flask /api/ai/transcribe 代理到上游 STT 供应商
 *
 * 后端单次同步请求上游 OpenAI 兼容 /audio/transcriptions，音频体积上限由上游决定
 * （OpenAI ~25MB）。供应商切换仅需改后端，前端零改动。
 */

import { API_BASE_URL } from '@/shared/config/env'
import { supabase } from '@/shared/config/supabase'
import { speakingLogger } from '@/shared/utils/logger'
import { resolveSttModel } from './aiModelPrefs'

export interface AiTranscriptionResult {
  text: string
  confidence: number
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      resolve(dataUrl.split(',')[1])
    }
    reader.onerror = () => reject(new Error('读取音频文件失败'))
    reader.readAsDataURL(file)
  })
}

/**
 * 转录音频文件
 * @param audioFile 音频文件（推荐 webm/opus 格式）
 * @param durationSeconds 音频时长（秒），用于后端选择同步/异步模式
 */
export async function transcribeWithAi(
  audioFile: File,
  durationSeconds: number
): Promise<AiTranscriptionResult> {
  const base64 = await fileToBase64(audioFile)

  speakingLogger.log('AI 转录开始:', {
    mimeType: audioFile.type,
    durationSeconds,
    fileSizeKB: Math.round(audioFile.size / 1024),
  })

  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('未登录，无法调用转录')

  const response = await fetch(`${API_BASE_URL}/api/ai/transcribe`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      audio_base64: base64,
      mime_type: audioFile.type,
      language_code: 'en',
      duration_sec: durationSeconds,
      model: await resolveSttModel(),
    }),
  })

  let json: { success?: boolean; data?: AiTranscriptionResult; error?: string }
  try {
    json = await response.json()
  } catch {
    throw new Error(`转录失败 (HTTP ${response.status})`)
  }
  if (!response.ok || !json.success || !json.data) {
    throw new Error(json.error || `转录失败 (HTTP ${response.status})`)
  }

  speakingLogger.log('AI 转录完成:', {
    textLength: json.data.text.length,
    confidence: json.data.confidence.toFixed(3),
  })
  return json.data
}
