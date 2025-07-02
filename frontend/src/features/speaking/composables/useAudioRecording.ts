import { ref, type Ref } from 'vue'
import { speakingLogger } from '@/shared/utils/logger'

export interface AudioRecordingContext {
  mediaRecorder: MediaRecorder | null
  audioChunks: Blob[]
  recordingTime: number
  recordingTimer: number | null
  audioDataTimer: number | null
  currentMimeType: string
}

export const useAudioRecording = () => {
  const context = ref<AudioRecordingContext>({
    mediaRecorder: null,
    audioChunks: [],
    recordingTime: 0,
    recordingTimer: null,
    audioDataTimer: null,
    currentMimeType: 'audio/mp4'
  })

  const isRecording = ref(false)

  const getSupportedMimeType = (preferWebm = false): string => {
    // Google Cloud STT 不支持 mp4/AAC，优先使用 webm/opus
    if (preferWebm) {
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus'
      if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm'
      if (MediaRecorder.isTypeSupported('audio/wav')) return 'audio/wav'
      if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4'
      return 'audio/webm'
    }
    if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4'
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus'
    if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm'
    if (MediaRecorder.isTypeSupported('audio/wav')) return 'audio/wav'
    return 'audio/webm'
  }

  const getFileExtension = (mimeType: string): string => {
    if (mimeType.includes('wav')) return 'wav'
    if (mimeType.includes('mp4')) return 'm4a'
    if (mimeType.includes('webm')) return 'webm'
    return 'webm'
  }

  const startRecordingTimer = () => {
    context.value.recordingTimer = setInterval(() => {
      context.value.recordingTime++
    }, 1000) as unknown as number
  }

  const stopRecordingTimer = () => {
    if (context.value.recordingTimer !== null) {
      clearInterval(context.value.recordingTimer)
      context.value.recordingTimer = null
    }
  }

  const stopAudioDataTimer = () => {
    if (context.value.audioDataTimer !== null) {
      clearInterval(context.value.audioDataTimer)
      context.value.audioDataTimer = null
    }
  }

  const setupAudioRecording = async (
    onAudioProcess?: (pcm16Data: Int16Array) => void,
    onRecordingStop?: () => void,
    preferWebm = false
  ): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      })

      const mimeType = getSupportedMimeType(preferWebm)
      context.value.currentMimeType = mimeType

      // MediaRecorder用于保存完整录音
      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 16000
      })

      context.value.mediaRecorder = recorder
      context.value.audioChunks = []
      context.value.recordingTime = 0

      // 设置Web Audio API用于实时PCM16数据
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      const audioContext = new AudioContextClass({
        sampleRate: 16000
      })
      const source = audioContext.createMediaStreamSource(stream)

      // 创建ScriptProcessorNode用于实时音频处理
      const bufferSize = 4096 // 约256ms at 16kHz
      const processor = audioContext.createScriptProcessor(bufferSize, 1, 1)

      processor.addEventListener('audioprocess', (event: AudioProcessingEvent) => {
        const inputBuffer = event.inputBuffer
        const inputData = inputBuffer.getChannelData(0) // 单声道

        // 转换为PCM16
        const pcm16Data = new Int16Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          // 将float32 (-1到1) 转换为int16 (-32768到32767)
          pcm16Data[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32767))
        }

        if (onAudioProcess) {
          onAudioProcess(pcm16Data)
        }
      })

      source.connect(processor)
      processor.connect(audioContext.destination)

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          context.value.audioChunks.push(e.data)
        }
      }

      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop())
        processor.disconnect()
        source.disconnect()
        audioContext.close()
        stopRecordingTimer()
        stopAudioDataTimer()
        isRecording.value = false

        if (onRecordingStop) {
          onRecordingStop()
        }
      }

      // 开始录音，每1000ms生成一次MediaRecorder数据块
      recorder.start(1000)
      startRecordingTimer()
      isRecording.value = true
    } catch (error) {
      speakingLogger.error('无法访问麦克风', error)
      throw new Error('无法访问麦克风，请检查权限')
    }
  }

  const stopRecording = () => {
    if (context.value.mediaRecorder && isRecording.value) {
      context.value.mediaRecorder.stop()
    }
  }

  const cancelRecording = () => {
    if (context.value.mediaRecorder && isRecording.value) {
      context.value.mediaRecorder.stop()
    }
  }

  const createAudioFile = (): File => {
    const mimeType = context.value.currentMimeType
    const extension = getFileExtension(mimeType)
    const audioBlob = new Blob(context.value.audioChunks, { type: mimeType })
    return new File([audioBlob], `recording-${Date.now()}.${extension}`, { type: mimeType })
  }

  const resetRecording = () => {
    context.value.mediaRecorder = null
    context.value.audioChunks = []
    context.value.recordingTime = 0
    context.value.currentMimeType = 'audio/mp4'
    stopRecordingTimer()
    stopAudioDataTimer()
    isRecording.value = false
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return {
    context,
    isRecording,
    setupAudioRecording,
    stopRecording,
    cancelRecording,
    createAudioFile,
    resetRecording,
    formatTime
  }
}