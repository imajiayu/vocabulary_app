/**
 * Web Speech API 语音识别服务
 *
 * 使用浏览器原生的 SpeechRecognition API 进行实时语音转文字
 *
 * 浏览器支持:
 * - Chrome (桌面/Android): 完整支持
 * - Edge: 完整支持
 * - Safari (macOS/iOS): 支持（需要 webkit 前缀）
 * - Firefox: 不支持
 *
 * 限制:
 * - 需要 HTTPS（localhost 除外）
 * - Chrome/Edge 需要网络连接（音频发送到 Google 服务器处理）
 * - 中国大陆可能无法使用（依赖 Google 服务）
 */

import { ref, shallowRef } from 'vue'
import { speakingLogger } from '@/shared/utils/logger'

// Web Speech API 类型声明（部分浏览器需要 webkit 前缀）
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList
  resultIndex: number
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  isFinal: boolean
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message?: string
}

interface SpeechRecognition extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null
  onend: ((this: SpeechRecognition, ev: Event) => void) | null
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null
  start(): void
  stop(): void
  abort(): void
}

interface SpeechRecognitionConstructor {
  new(): SpeechRecognition
}

// 扩展 Window 接口
declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

export interface WebSpeechConfig {
  /** 识别语言，默认英语 */
  lang: string
  /** 是否返回临时结果 */
  interimResults: boolean
  /** 是否持续识别（不会在一句话后自动停止） */
  continuous: boolean
  /** 最大备选结果数 */
  maxAlternatives: number
}

const defaultConfig: WebSpeechConfig = {
  lang: 'en-US',
  interimResults: true,
  continuous: true,
  maxAlternatives: 1
}

/**
 * 检查浏览器是否支持 Web Speech API
 */
export function isWebSpeechSupported(): boolean {
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window
}

/**
 * Web Speech API 语音识别 composable
 */
export function useWebSpeechRecognition(config: Partial<WebSpeechConfig> = {}) {
  const mergedConfig = { ...defaultConfig, ...config }

  // 状态
  const isListening = ref(false)
  const transcript = ref('')
  const interimTranscript = ref('')
  const error = ref<string | null>(null)
  const isSupported = ref(isWebSpeechSupported())

  // SpeechRecognition 实例（使用 shallowRef 避免深度响应）
  const recognition = shallowRef<SpeechRecognition | null>(null)

  /**
   * 初始化 SpeechRecognition 实例
   */
  function createRecognition(): SpeechRecognition | null {
    if (!isSupported.value) {
      error.value = '当前浏览器不支持语音识别'
      return null
    }

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognitionClass) return null
    const instance = new SpeechRecognitionClass()

    instance.lang = mergedConfig.lang
    instance.interimResults = mergedConfig.interimResults
    instance.continuous = mergedConfig.continuous
    instance.maxAlternatives = mergedConfig.maxAlternatives

    return instance
  }

  /**
   * 开始语音识别
   */
  function start(): boolean {
    if (isListening.value) {
      speakingLogger.warn('语音识别已在运行中')
      return false
    }

    if (!isSupported.value) {
      error.value = '当前浏览器不支持语音识别'
      return false
    }

    // 重置状态
    transcript.value = ''
    interimTranscript.value = ''
    error.value = null

    // 创建新实例
    const instance = createRecognition()
    if (!instance) return false

    // 设置事件处理
    instance.onstart = () => {
      isListening.value = true
      speakingLogger.log('Web Speech API: 开始识别')
    }

    instance.onresult = (event) => {
      let finalText = ''
      let interimText = ''

      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalText += result[0].transcript
        } else {
          interimText += result[0].transcript
        }
      }

      // 更新转录文本
      if (finalText) {
        transcript.value = finalText
      }
      interimTranscript.value = interimText

      speakingLogger.log('Web Speech API 结果:', {
        final: finalText,
        interim: interimText
      })
    }

    instance.onerror = (event) => {
      speakingLogger.error('Web Speech API 错误:', event.error)

      switch (event.error) {
        case 'network':
          error.value = '网络错误，无法连接到语音识别服务'
          break
        case 'not-allowed':
          error.value = '麦克风权限被拒绝'
          break
        case 'no-speech':
          error.value = '未检测到语音'
          break
        case 'audio-capture':
          error.value = '无法捕获音频'
          break
        case 'aborted':
          // 用户主动停止，不算错误
          break
        default:
          error.value = `语音识别错误: ${event.error}`
      }
    }

    instance.onend = () => {
      isListening.value = false
      speakingLogger.log('Web Speech API: 识别结束')

      // 如果 continuous 模式下意外结束且没有错误，尝试重启
      // 但这里我们不自动重启，让调用方决定
    }

    recognition.value = instance

    try {
      instance.start()
      return true
    } catch (e) {
      speakingLogger.error('启动语音识别失败:', e)
      error.value = '启动语音识别失败'
      return false
    }
  }

  /**
   * 停止语音识别
   */
  function stop(): string {
    if (recognition.value && isListening.value) {
      recognition.value.stop()
    }

    // 返回最终结果（合并 final 和 interim）
    const finalResult = transcript.value || interimTranscript.value
    return finalResult.trim()
  }

  /**
   * 中止语音识别（不等待最终结果）
   */
  function abort() {
    if (recognition.value && isListening.value) {
      recognition.value.abort()
    }
    transcript.value = ''
    interimTranscript.value = ''
  }

  /**
   * 获取当前识别的完整文本（包含临时结果）
   */
  function getCurrentText(): string {
    return (transcript.value + ' ' + interimTranscript.value).trim()
  }

  return {
    // 状态
    isListening,
    isSupported,
    transcript,
    interimTranscript,
    error,

    // 方法
    start,
    stop,
    abort,
    getCurrentText
  }
}
