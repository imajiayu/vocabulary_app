<template>
  <div class="voice-practice-control-panel">
    <!-- 开始练习按钮 -->
    <div v-if="!isRecording && !isProcessing && !currentRecord.user_answer" class="practice-start">
      <button class="start-btn" @click="startPractice" :disabled="!question">
        <div class="btn-content">
          <div class="siri-circles">
            <div class="circle circle-1"></div>
            <div class="circle circle-2"></div>
            <div class="circle circle-3"></div>
          </div>
          <span class="btn-text">开始练习</span>
        </div>
      </button>
    </div>

    <!-- 控制面板 -->
    <div v-else class="control-panel">
      <!-- 状态指示器 -->
      <RecordingStatusPanel
        :status="currentStatus"
        :recording-time="recordingTime"
        :score="currentRecord.score"
        :error="machine.context.error"
      />

      <!-- 处理中提示或控制按钮 -->
      <div class="control-buttons">
        <template v-if="isRecording">
          <button class="control-btn secondary" @click="stopRecordingAndReset">
            停止录音
          </button>
          <button class="control-btn primary" @click="stopRecording">
            完成录音
          </button>
        </template>

        <template v-else-if="isProcessing">
          <div class="processing-hint">
            <div class="processing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <p class="processing-text">正在处理中，请耐心等待...</p>
          </div>
        </template>

        <template v-else-if="currentRecord.ai_feedback && currentRecord.score">
          <button class="control-btn secondary" @click="restartPractice">
            重新开始
          </button>
          <button class="control-btn primary" @click="submitPractice">
            提交答案
          </button>
        </template>

        <template v-else>
          <div class="waiting-hint">
            <p class="waiting-text">录音已完成，正在准备处理...</p>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { speakingLogger } from '@/shared/utils/logger'
import { Question, SpeakingRecord } from '@/shared/types'
import { api } from '@/shared/api'
import type { CreateRecordPayload } from '@/shared/api/speaking'
import RecordingStatusPanel from './RecordingStatusPanel.vue'
import { useAudioRecording } from '../composables/useAudioRecording'
import { transcribeAudio, getTranscriptionProvider } from '@/shared/services/transcription'
import { useWebSpeechRecognition } from '@/shared/services/webSpeechRecognition'

const props = defineProps<{ question: Question | null }>()
const emit = defineEmits<{
  newRecord: [record: SpeakingRecord]
  temporaryRecord: [record: Partial<SpeakingRecord> | null]
}>()

// =========================
// 状态机定义
// =========================
type State = 'IDLE' | 'RECORDING' | 'TRANSCRIBING' | 'ANALYZING' | 'COMPLETED' | 'ERROR'

type Event =
  | 'START_PRACTICE'
  | 'STOP_RECORDING'
  | 'CANCEL_RECORDING'
  | 'TRANSCRIPTION_SUCCESS'
  | 'TRANSCRIPTION_ERROR'
  | 'ANALYSIS_SUCCESS'
  | 'ANALYSIS_ERROR'
  | 'SUBMIT'
  | 'RESTART'
  | 'ERROR'

interface StateContext {
  record: Partial<SpeakingRecord & { cancelled?: boolean }>
  error?: string
}

interface StateMachine {
  state: State
  context: StateContext
  transitions: Record<State, Partial<Record<Event, State>>>
}

// 状态机配置
const createStateMachine = (): StateMachine => ({
  state: 'IDLE',
  context: {
    record: {},
    error: undefined
  },
  transitions: {
    IDLE: {
      START_PRACTICE: 'RECORDING'
    },
    RECORDING: {
      STOP_RECORDING: 'TRANSCRIBING',
      CANCEL_RECORDING: 'IDLE',
      ERROR: 'ERROR'
    },
    TRANSCRIBING: {
      TRANSCRIPTION_SUCCESS: 'ANALYZING',
      TRANSCRIPTION_ERROR: 'ERROR',
      ERROR: 'ERROR'
    },
    ANALYZING: {
      ANALYSIS_SUCCESS: 'COMPLETED',
      ANALYSIS_ERROR: 'ERROR',
      ERROR: 'ERROR'
    },
    COMPLETED: {
      SUBMIT: 'IDLE',
      RESTART: 'RECORDING'
    },
    ERROR: {
      RESTART: 'IDLE'
    }
  }
})

// 状态机实例
const machine = ref<StateMachine>(createStateMachine())

// 使用录音 composable
const audioRecording = useAudioRecording()

// 使用 Web Speech API 语音识别（英语）
const webSpeech = useWebSpeechRecognition({ lang: 'en-US' })

// 状态机操作
const transition = (event: Event): void => {
  const currentState = machine.value.state
  const nextState = machine.value.transitions[currentState][event]

  if (nextState) {
    machine.value.state = nextState

    // 状态进入处理
    handleStateEntry(nextState, event)
  } else {
    speakingLogger.warn(`Invalid transition: ${currentState} --${event}--> ?`)
  }
}

// 状态进入处理
const handleStateEntry = (state: State, event: Event): void => {
  switch (state) {
    case 'IDLE':
      handleIdleEntry()
      break
    case 'RECORDING':
      if (event === 'START_PRACTICE') {
        handleRecordingStart()
      } else if (event === 'RESTART') {
        handleRecordingRestart()
      }
      updateTemporaryRecord()
      break
    case 'TRANSCRIBING':
      handleTranscribingEntry()
      break
    case 'ANALYZING':
      handleAnalyzingEntry()
      break
    case 'COMPLETED':
      handleCompletedEntry()
      break
    case 'ERROR':
      handleErrorEntry()
      break
  }
}

// 兼容性计算属性 (保持现有模板兼容)
const isRecording = computed(() => audioRecording.isRecording.value)
const isProcessing = computed(() =>
  machine.value.state === 'TRANSCRIBING' || machine.value.state === 'ANALYZING'
)
const currentRecord = computed(() => machine.value.context.record)
const recordingTime = computed(() => audioRecording.context.value.recordingTime)

// 监听题目变化，重置状态机
watch(() => props.question, (newQuestion, oldQuestion) => {
  if (newQuestion !== oldQuestion) {
    // 重置状态机到初始状态
    machine.value = createStateMachine()
    // 调用IDLE状态处理器来清理所有资源
    handleIdleEntry()
  }
}, { immediate: false })

// 监听 Web Speech 识别结果变化，实时更新显示
watch(
  [() => webSpeech.transcript.value, () => webSpeech.interimTranscript.value],
  () => {
    if (machine.value.state === 'RECORDING') {
      updateTemporaryRecord()
    }
  }
)

// 组件卸载时清理资源
onUnmounted(() => {
  handleIdleEntry()
})

// =========================
// 状态机处理器
// =========================
const handleIdleEntry = (): void => {
  audioRecording.resetRecording()
  webSpeech.abort() // 中止语音识别
  machine.value.context.record = {}
  machine.value.context.error = undefined
  emit('temporaryRecord', null)
}

const handleRecordingStart = async (): Promise<void> => {
  if (!props.question) return

  try {
    // 初始化录音记录
    machine.value.context.record = {
      user_answer: '',
      ai_feedback: '',
      score: 0,
      created_at: new Date().toISOString()
    }

    // 如果使用 Web Speech API，同步启动语音识别
    if (getTranscriptionProvider() === 'web-speech' && webSpeech.isSupported.value) {
      webSpeech.start()
      speakingLogger.log('Web Speech API 已启动')
    }

    // 设置音频录制
    await audioRecording.setupAudioRecording(
      // 音频处理回调
      (_pcm16Data: Int16Array) => {
        updateTemporaryRecord()
      },
      // 录音停止回调
      () => {
        if (!machine.value.context.record.cancelled) {
          transition('STOP_RECORDING')
        }
      }
    )
  } catch (error) {
    speakingLogger.error('无法访问麦克风', error)
    alert('无法访问麦克风，请检查权限')
    transition('ERROR')
  }
}

const handleRecordingRestart = (): void => {
  handleIdleEntry()
  handleRecordingStart()
}

const handleTranscribingEntry = (): void => {
  processTranscription()
}

const handleAnalyzingEntry = (): void => {
  processAnalysis()
}

const handleCompletedEntry = (): void => {
  emit('temporaryRecord', { ...machine.value.context.record })
}

const handleErrorEntry = (): void => {
  speakingLogger.error('Entered ERROR state:', machine.value.context.error)
}

// 状态计算
const currentStatus = computed(() => {
  switch (machine.value.state) {
    case 'RECORDING': return 'recording'
    case 'TRANSCRIBING': return 'transcribing'
    case 'ANALYZING': return 'analyzing'
    case 'COMPLETED': return 'completed'
    default: return 'idle'
  }
})

// =========================
// 工具函数
// =========================

const updateTemporaryRecord = () => {
  if (!props.question) return

  // 如果使用 Web Speech API，显示实时识别的文字
  let displayText = '请开始说话...'
  let feedbackText = '录音完成后将自动转录...'

  if (machine.value.state === 'RECORDING') {
    if (getTranscriptionProvider() === 'web-speech' && webSpeech.isListening.value) {
      const currentText = webSpeech.getCurrentText()
      displayText = currentText || '正在录音，请说话...'
      feedbackText = currentText ? '实时识别中...' : '等待语音输入...'
    } else {
      displayText = '正在录音中...'
    }
  }

  const tempRecord: Partial<SpeakingRecord> = {
    question_id: props.question.id,
    user_answer: displayText,
    audio_file: '',
    ai_feedback: feedbackText,
    score: undefined
  }

  emit('temporaryRecord', tempRecord)
}

// =========================
// 状态机处理函数
// =========================
const processTranscription = async (): Promise<void> => {
  try {
    // 创建音频文件
    const audioFile = audioRecording.createAudioFile()
    machine.value.context.record.audio_file = audioFile
    machine.value.context.record.question_id = props.question?.id

    // 根据转录提供者处理
    const provider = getTranscriptionProvider()

    if (provider === 'web-speech') {
      // 停止 Web Speech API 并获取结果
      const webSpeechText = webSpeech.stop()
      speakingLogger.log('Web Speech API 结果:', webSpeechText)

      if (webSpeechText.trim()) {
        machine.value.context.record.user_answer = webSpeechText
        emit('temporaryRecord', { ...machine.value.context.record })
        transition('TRANSCRIPTION_SUCCESS')
      } else {
        machine.value.context.error = '未识别到语音内容，请重试'
        transition('TRANSCRIPTION_ERROR')
      }
    } else {
      // 其他转录服务（Whisper 等）
      speakingLogger.log('尝试转录音频...')
      const result = await transcribeAudio(audioFile)

      if (result.success && result.text.trim()) {
        machine.value.context.record.user_answer = result.text
        emit('temporaryRecord', { ...machine.value.context.record })
        transition('TRANSCRIPTION_SUCCESS')
      } else {
        machine.value.context.error = result.error || '转录失败，请重试'
        transition('TRANSCRIPTION_ERROR')
      }
    }
  } catch (error) {
    speakingLogger.error('转录错误:', error)
    machine.value.context.error = '转录出错，请重试'
    transition('TRANSCRIPTION_ERROR')
  }
}

const processAnalysis = async (): Promise<void> => {
  try {
    const userAnswer = machine.value.context.record.user_answer
    if (!userAnswer) {
      transition('ANALYSIS_ERROR')
      return
    }

    const feedback = await getAIFeedback(userAnswer)
    machine.value.context.record.ai_feedback = feedback.feedback
    machine.value.context.record.score = feedback.score

    emit('temporaryRecord', { ...machine.value.context.record })
    transition('ANALYSIS_SUCCESS')
  } catch (error) {
    speakingLogger.error('分析错误:', error)
    machine.value.context.error = '分析失败，请重试'
    transition('ANALYSIS_ERROR')
  }
}

// =========================
// 用户操作接口
// =========================
const startPractice = () => {
  transition('START_PRACTICE')
}

const stopRecording = () => {
  if (audioRecording.isRecording.value) {
    audioRecording.stopRecording()
  }
}

const stopRecordingAndReset = () => {
  if (audioRecording.isRecording.value) {
    machine.value.context.record.cancelled = true
    audioRecording.cancelRecording()
    transition('CANCEL_RECORDING')
  }
}

const restartPractice = () => {
  transition('RESTART')
}

const submitPractice = async () => {
  if (!props.question || !machine.value.context.record.user_answer ||
      !machine.value.context.record.audio_file || !machine.value.context.record.ai_feedback) return

  // 确保不是临时状态数据
  if (machine.value.context.record.user_answer.includes('转录中') ||
      machine.value.context.record.ai_feedback.includes('生成') ||
      !machine.value.context.record.score) {
    speakingLogger.warn('数据还在处理中，请等待完成后再提交')
    return
  }

  try {
    const response = await saveRecordToBackend({
      question_id: props.question.id,
      user_answer: machine.value.context.record.user_answer,
      audio_file: machine.value.context.record.audio_file as File,
      ai_feedback: machine.value.context.record.ai_feedback,
      score: machine.value.context.record.score
    })

    emit('newRecord', response)
    transition('SUBMIT')
  } catch (error) {
    speakingLogger.error('提交失败:', error)
    machine.value.context.error = '提交失败，请重试'
    transition('ERROR')
  }
}

// =========================
// API函数
// =========================
const getAIFeedback = async (userAnswer: string) => {
  try {
    const result = await api.speaking.getAiFeedback(
      props.question?.question_text || '',
      userAnswer,
      props.question?.topic_title
    )
    return { feedback: result.feedback || '', score: result.score || 0 }
  } catch (e) {
    speakingLogger.error('获取AI反馈失败:', e)
    return { feedback: '', score: 0 }
  }
}

const saveRecordToBackend = async (record: CreateRecordPayload): Promise<SpeakingRecord> => {
  try {
    const result = await api.speaking.createRecord(record)
    return result
  } catch (e) {
    speakingLogger.error('保存记录失败:', e)
    throw e
  }
}
</script>


<style scoped>
.voice-practice-control-panel {
  width: 100%;
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  box-sizing: border-box;
  overflow: visible;
}

.practice-start {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 100%;
  min-height: 200px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  padding: 20px;
  box-sizing: border-box;
  gap: 20px;
}

.start-btn {
  background: linear-gradient(135deg, var(--color-purple-vivid), var(--color-primary));
  border: 2px solid var(--color-purple-vivid-light);
  border-radius: var(--radius-full);
  padding: 20px 40px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 8px 25px var(--color-purple-vivid-light);
  position: relative;
  overflow: hidden;
}

.start-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 12px 35px var(--color-purple-vivid-light);
  border-color: var(--color-purple-vivid);
}

.start-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.btn-content {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--color-text-inverse);
}

.siri-circles {
  display: flex;
  gap: 3px;
  align-items: center;
}

.circle {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--color-text-inverse);
  opacity: 0.7;
  animation: pulse 1.5s ease-in-out infinite;
}

.circle-2 {
  animation-delay: 0.3s;
}

.circle-3 {
  animation-delay: 0.6s;
}

.btn-text {
  font-size: 16px;
  font-weight: 600;
}

.control-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  padding: var(--spacing-md);
  box-sizing: border-box;
}

.control-buttons {
  display: flex;
  gap: 12px;
  width: 100%;
  justify-content: center;
  flex-shrink: 0;
  min-height: 48px;
  align-items: center;
}

.processing-hint, .waiting-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
  width: 100%;
}

.processing-dots {
  display: flex;
  gap: 4px;
  justify-content: center;
}

.processing-dots span {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: linear-gradient(135deg, var(--color-primary), var(--color-primary));
  animation: processing-pulse 1.4s ease-in-out infinite both;
}

.processing-dots span:nth-child(1) { animation-delay: -0.32s; }
.processing-dots span:nth-child(2) { animation-delay: -0.16s; }
.processing-dots span:nth-child(3) { animation-delay: 0s; }

.processing-text, .waiting-text {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-secondary);
  font-weight: 500;
}

.processing-text {
  color: var(--color-primary);
}

.control-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: var(--radius-md);
  border: 2px solid transparent;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 120px;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.control-btn.primary {
  background: linear-gradient(135deg, var(--color-purple-vivid), var(--color-purple-vivid-dark));
  border-color: var(--color-purple-vivid-light);
  color: var(--color-text-inverse);
  box-shadow: 0 4px 12px var(--color-purple-vivid-light);
}

.control-btn.primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px var(--color-purple-vivid-light);
  border-color: var(--color-purple-vivid);
}

.control-btn.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.control-btn.secondary {
  background: var(--color-bg-glass-hover);
  color: var(--color-text-secondary);
  border-color: var(--color-border-light);
  box-shadow: var(--shadow-sm);
}

.control-btn.secondary:hover {
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  transform: translateY(-1px);
  border-color: var(--color-border-medium);
  box-shadow: var(--shadow-md);
}

@keyframes pulse {

  0%,
  100% {
    opacity: 0.7;
    transform: scale(1);
  }

  50% {
    opacity: 1;
    transform: scale(1.2);
  }
}

@keyframes processing-pulse {
  0%, 80%, 100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}
</style>
