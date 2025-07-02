/**
 * 语音转文字服务
 *
 * 支持两种转录提供者，用户可在 VoicePractice 组件中切换：
 * - Web Speech API：浏览器原生实时识别（默认）
 * - Google Cloud STT：批量识别，精度更高，每月 60 分钟免费
 */

import { transcribeWithGoogleSTT } from './googleCloudSTT'

export interface TranscriptionResult {
  text: string
  success: boolean
  error?: string
}

/**
 * 使用 Google Cloud STT 转录音频文件
 *
 * 仅当 provider 为 'google-cloud-stt' 时在 ANALYZING 阶段调用
 * Web Speech API 的转录由 VoicePractice 直接管理（实时识别）
 */
export async function transcribeAudio(
  audioFile: File,
  durationSeconds: number
): Promise<TranscriptionResult> {
  try {
    const result = await transcribeWithGoogleSTT(audioFile, durationSeconds)
    return {
      text: result.text,
      success: !!result.text.trim()
    }
  } catch (e) {
    return {
      text: '',
      success: false,
      error: e instanceof Error ? e.message : '转录失败'
    }
  }
}
