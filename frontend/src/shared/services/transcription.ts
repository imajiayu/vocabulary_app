/**
 * 语音转文字服务
 *
 * 抽象层，为接入在线转录 API 做准备
 * 目前返回空字符串，触发手动输入流程
 *
 * 未来可接入：
 * - OpenAI Whisper API
 * - GPT-4o Realtime API
 * - 其他 STT 服务
 */

export interface TranscriptionResult {
  text: string
  success: boolean
  error?: string
}

/**
 * 转录服务配置
 */
export interface TranscriptionConfig {
  provider: 'none' | 'web-speech' | 'openai-whisper' | 'gpt-realtime'
  apiKey?: string
}

// 当前配置（未来可从环境变量或设置中读取）
// 默认使用 Web Speech API（浏览器原生支持）
const currentConfig: TranscriptionConfig = {
  provider: 'web-speech'
}

/**
 * 获取当前转录提供者
 */
export function getTranscriptionProvider(): TranscriptionConfig['provider'] {
  return currentConfig.provider
}

/**
 * 设置转录提供者
 */
export function setTranscriptionProvider(provider: TranscriptionConfig['provider']) {
  currentConfig.provider = provider
}

/**
 * 语音转文字
 *
 * @param audioFile 音频文件
 * @returns 转录结果
 */
export async function transcribeAudio(audioFile: File): Promise<TranscriptionResult> {
  switch (currentConfig.provider) {
    case 'web-speech':
      // Web Speech API 是实时识别，不能处理已录制的文件
      // 此分支不应被调用，Web Speech 结果应在录音时直接获取
      return {
        text: '',
        success: false,
        error: 'Web Speech API 需要实时识别，请检查集成代码'
      }
    case 'openai-whisper':
      return transcribeWithWhisper(audioFile)
    case 'gpt-realtime':
      return transcribeWithGptRealtime(audioFile)
    case 'none':
    default:
      // 返回空结果，触发手动输入流程
      return {
        text: '',
        success: false,
        error: '转录服务未配置，请手动输入文本'
      }
  }
}

/**
 * 使用 OpenAI Whisper API 转录（待实现）
 */
async function transcribeWithWhisper(_audioFile: File): Promise<TranscriptionResult> {
  // TODO: 实现 Whisper API 调用
  // const formData = new FormData()
  // formData.append('file', audioFile)
  // formData.append('model', 'whisper-1')
  // const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
  //   method: 'POST',
  //   headers: { 'Authorization': `Bearer ${apiKey}` },
  //   body: formData
  // })
  return {
    text: '',
    success: false,
    error: 'Whisper API 尚未配置'
  }
}

/**
 * 使用 GPT Realtime API 转录（待实现）
 */
async function transcribeWithGptRealtime(_audioFile: File): Promise<TranscriptionResult> {
  // TODO: 实现 GPT Realtime API 调用
  return {
    text: '',
    success: false,
    error: 'GPT Realtime API 尚未配置'
  }
}

/**
 * 检查转录服务是否可用
 */
export function isTranscriptionAvailable(): boolean {
  return currentConfig.provider !== 'none'
}
