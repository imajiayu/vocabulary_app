/**
 * Google Cloud Speech-to-Text REST API 服务
 *
 * 使用 V1 REST API，支持两种识别模式：
 * - 同步识别 (≤55秒音频): speech:recognize
 * - 异步识别 (>55秒音频): speech:longrunningrecognize + 轮询
 *
 * 免费额度：60分钟/月
 * 定价：$0.016/分钟（超出免费额度后）
 *
 * 支持的音频格式：WEBM_OPUS, LINEAR16, FLAC, MP3 等
 * 注意：audio/mp4 (AAC) 不在官方支持列表中，建议使用 webm 格式
 */

import { speakingLogger } from '@/shared/utils/logger'

const API_KEY = import.meta.env.VITE_GOOGLE_STT_API_KEY as string | undefined

// ─── 类型定义 ─────────────────────────────────────────────

interface RecognitionConfig {
  encoding: string
  sampleRateHertz?: number
  languageCode: string
  model: string
  enableAutomaticPunctuation: boolean
}

interface SpeechRecognitionResult {
  alternatives?: Array<{
    transcript: string
    confidence: number
  }>
}

interface RecognizeResponse {
  results?: SpeechRecognitionResult[]
}

interface LongRunningOperation {
  name: string
  done?: boolean
  response?: RecognizeResponse
  error?: { code: number; message: string }
}

export interface GoogleSTTResult {
  text: string
  confidence: number
}

// ─── 工具函数 ─────────────────────────────────────────────

/**
 * 检查 Google Cloud STT 是否已配置
 */
export function isGoogleSTTConfigured(): boolean {
  return !!API_KEY
}

/**
 * 根据 MIME 类型映射 Google STT 音频编码
 */
function getEncoding(mimeType: string): string {
  if (mimeType.includes('webm')) return 'WEBM_OPUS'
  if (mimeType.includes('wav')) return 'LINEAR16'
  if (mimeType.includes('flac')) return 'FLAC'
  if (mimeType.includes('mp3')) return 'MP3'
  if (mimeType.includes('ogg')) return 'OGG_OPUS'
  // mp4/m4a 不在官方支持列表，尝试自动检测
  return 'ENCODING_UNSPECIFIED'
}

/**
 * 将 File 转换为 base64 字符串
 */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      // 去掉 data URL 前缀 (data:audio/xxx;base64,)
      resolve(dataUrl.split(',')[1])
    }
    reader.onerror = () => reject(new Error('读取音频文件失败'))
    reader.readAsDataURL(file)
  })
}

/**
 * 从识别结果中提取完整文本
 */
function extractTranscript(data: RecognizeResponse): GoogleSTTResult {
  if (!data.results || data.results.length === 0) {
    return { text: '', confidence: 0 }
  }

  const fullTranscript = data.results
    .map(r => r.alternatives?.[0]?.transcript || '')
    .join(' ')
    .trim()

  const confidences = data.results
    .map(r => r.alternatives?.[0]?.confidence || 0)
    .filter(c => c > 0)

  const avgConfidence = confidences.length > 0
    ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
    : 0

  return { text: fullTranscript, confidence: avgConfidence }
}

// ─── 核心 API 调用 ────────────────────────────────────────

/**
 * 同步识别（适用于 ≤55 秒的音频）
 */
async function syncRecognize(base64Audio: string, config: RecognitionConfig): Promise<GoogleSTTResult> {
  const response = await fetch(
    `https://speech.googleapis.com/v1/speech:recognize?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config,
        audio: { content: base64Audio }
      })
    }
  )

  if (!response.ok) {
    const errorBody = await response.text()
    speakingLogger.error('Google STT sync recognize failed:', response.status, errorBody)
    throw new Error(`语音识别失败 (${response.status})`)
  }

  return extractTranscript(await response.json())
}

/**
 * 异步识别（适用于 >55 秒的音频）
 * 发起长时间运行操作，然后轮询结果
 */
async function asyncRecognize(base64Audio: string, config: RecognitionConfig): Promise<GoogleSTTResult> {
  // 1. 发起异步识别请求
  const response = await fetch(
    `https://speech.googleapis.com/v1/speech:longrunningrecognize?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config,
        audio: { content: base64Audio }
      })
    }
  )

  if (!response.ok) {
    const errorBody = await response.text()
    speakingLogger.error('Google STT async recognize failed:', response.status, errorBody)
    throw new Error(`语音识别失败 (${response.status})`)
  }

  const operation: LongRunningOperation = await response.json()

  // 2. 轮询操作状态
  return pollOperation(operation.name)
}

/**
 * 轮询长时间运行操作的结果
 */
async function pollOperation(operationName: string): Promise<GoogleSTTResult> {
  const maxAttempts = 30
  const pollIntervalMs = 2000

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs))

    const response = await fetch(
      `https://speech.googleapis.com/v1/operations/${operationName}?key=${API_KEY}`
    )

    if (!response.ok) {
      speakingLogger.error('Poll operation failed:', response.status)
      throw new Error('查询转录状态失败')
    }

    const result: LongRunningOperation = await response.json()

    if (result.error) {
      throw new Error(`转录失败: ${result.error.message}`)
    }

    if (result.done && result.response) {
      return extractTranscript(result.response)
    }

    speakingLogger.log(`转录进行中... (${i + 1}/${maxAttempts})`)
  }

  throw new Error('转录超时，请重试')
}

// ─── 对外接口 ─────────────────────────────────────────────

/**
 * 使用 Google Cloud STT 转录音频文件
 *
 * @param audioFile 音频文件（推荐 webm/opus 格式）
 * @param durationSeconds 音频时长（秒），用于选择同步/异步模式
 */
export async function transcribeWithGoogleSTT(
  audioFile: File,
  durationSeconds: number
): Promise<GoogleSTTResult> {
  if (!API_KEY) {
    throw new Error('请在根目录 .env 中配置 GOOGLE_STT_API_KEY')
  }

  const base64Audio = await fileToBase64(audioFile)
  const encoding = getEncoding(audioFile.type)

  speakingLogger.log('Google STT 开始转录:', {
    mimeType: audioFile.type,
    encoding,
    durationSeconds,
    fileSizeKB: Math.round(audioFile.size / 1024)
  })

  // WEBM_OPUS / OGG_OPUS 采样率在文件头中，不需要手动指定
  // 其他格式（LINEAR16、FLAC 等）需要显式指定
  const needsSampleRate = !['WEBM_OPUS', 'OGG_OPUS'].includes(encoding)

  const config: RecognitionConfig = {
    encoding,
    ...(needsSampleRate && { sampleRateHertz: 16000 }),
    languageCode: 'en-US',
    model: 'latest_long',
    enableAutomaticPunctuation: true,
  }

  const result = durationSeconds <= 55
    ? await syncRecognize(base64Audio, config)
    : await asyncRecognize(base64Audio, config)

  speakingLogger.log('Google STT 转录完成:', {
    textLength: result.text.length,
    confidence: result.confidence.toFixed(3)
  })

  return result
}
