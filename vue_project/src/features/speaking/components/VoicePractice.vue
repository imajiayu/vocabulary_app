<template>
  <div class="voice-practice-control-panel">
    <!-- 开始练习按钮 -->
    <div v-if="!isRecording && !isProcessing && !currentRecord.user_answer" class="practice-start">
      <!-- 转录模式选择器 -->
      <div class="transcription-mode-selector">
        <SwitchTab
          v-model="transcriptionMode"
          :tabs="transcriptionTabs"
          persist-key="transcriptionMode"
          :show-indicator="true"
          @change="onTranscriptionModeChange"
        />
      </div>

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
import { Question, SpeakingRecord } from '@/shared/types'
import { api } from '@/shared/api'
import type { CreateRecordPayload } from '@/shared/api/speaking'
import SwitchTab from '@/shared/components/ui/SwitchTab.vue'
import RecordingStatusPanel from './RecordingStatusPanel.vue'
import { useAudioRecording } from '../composables/useAudioRecording'
import { useWebSocketConnection } from '../composables/useWebSocketConnection'

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

// 使用新的composables
const audioRecording = useAudioRecording()
const webSocketConnection = useWebSocketConnection()

// 转录模式管理
type TranscriptionMode = 'realtime' | 'batch'
const transcriptionMode = ref<TranscriptionMode>('realtime')

// 转录模式选项卡数据
const transcriptionTabs = [
  { value: 'realtime', label: '实时转录', icon: '🎙️' },
  { value: 'batch', label: '完成后转录', icon: '📝' }
]

// 从localStorage恢复转录模式设置
const restoreTranscriptionMode = () => {
  const savedMode = localStorage.getItem('transcriptionMode') as TranscriptionMode
  if (savedMode && ['realtime', 'batch'].includes(savedMode)) {
    transcriptionMode.value = savedMode
  }
}

// 保存转录模式到localStorage
const saveTranscriptionMode = (mode: TranscriptionMode) => {
  localStorage.setItem('transcriptionMode', mode)
}

// 切换转录模式
const switchTranscriptionMode = (mode: TranscriptionMode) => {
  transcriptionMode.value = mode
  saveTranscriptionMode(mode)
}

// 处理转录模式变化 (用于新的SwitchTab组件)
const onTranscriptionModeChange = (mode: string) => {
  switchTranscriptionMode(mode as TranscriptionMode)
}


// 状态机操作
const transition = (event: Event): void => {
  const currentState = machine.value.state
  const nextState = machine.value.transitions[currentState][event]

  if (nextState) {
    machine.value.state = nextState

    // 状态进入处理
    handleStateEntry(nextState, event)
  } else {
    console.warn(`[StateMachine] Invalid transition: ${currentState} --${event}--> ?`)
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

      // 在处理完录音开始后再更新临时记录，确保转录文本已清空
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

// =========================
// 调试工具
// =========================
const debugStateMachine = () => {
  console.log('[StateMachine Debug]', {
    currentState: machine.value.state,
    context: machine.value.context,
    availableTransitions: Object.keys(machine.value.transitions[machine.value.state] || {})
  })
}

// 监听状态变化进行调试
watch(() => machine.value.state, (newState, oldState) => {
  console.log(`[StateMachine] State changed: ${oldState} -> ${newState}`)
}, { immediate: true })

// 监听题目变化，重置状态机
watch(() => props.question, (newQuestion, oldQuestion) => {
  if (newQuestion !== oldQuestion) {
    console.log('[VoicePractice] Question changed, resetting state machine')
    // 重置状态机到初始状态
    machine.value = createStateMachine()
    // 调用IDLE状态处理器来清理所有资源
    handleIdleEntry()
  }
}, { immediate: false })

// 开发环境下暴露调试函数到全局
if (import.meta.env.DEV) {
  ;(window as any).debugVoicePractice = debugStateMachine
}

// 组件挂载时初始化WebSocket和恢复设置
import { onMounted } from 'vue'
onMounted(async () => {
  await webSocketConnection.connectWebSocket()
  restoreTranscriptionMode()
  console.log('[VoicePractice] 组件初始化完成')
})

// 组件卸载时清理资源
onUnmounted(() => {
  handleIdleEntry()
  console.log('[VoicePractice] 组件已卸载，资源已清理')
})

// =========================
// 状态机处理器
// =========================
const handleIdleEntry = (): void => {
  // 先停止WebSocket转录再清空文本，确保没有残留的转录更新
  webSocketConnection.stopTranscription()
  webSocketConnection.resetTranscription()

  audioRecording.resetRecording()
  machine.value.context.record = {}
  machine.value.context.error = undefined
  emit('temporaryRecord', null)
}

const handleRecordingStart = async (): Promise<void> => {
  if (!props.question) return

  try {
    // 先清空转录文本，避免显示上次的内容
    webSocketConnection.resetTranscription()

    // 初始化录音记录
    machine.value.context.record = {
      user_answer: '',
      ai_feedback: '',
      score: 0,
      created_at: new Date().toISOString()
    }

    // 只在实时转录模式下开始转录会话
    if (transcriptionMode.value === 'realtime') {
      webSocketConnection.startTranscription()
    }

    // 设置音频录制
    await audioRecording.setupAudioRecording(
      // 音频处理回调
      (pcm16Data: Int16Array) => {
        if (transcriptionMode.value === 'realtime') {
          webSocketConnection.sendPCM16Data(pcm16Data)
        }
        // 实时更新临时记录
        updateTemporaryRecord()
      },
      // 录音停止回调
      () => {
        if (transcriptionMode.value === 'realtime') {
          webSocketConnection.stopTranscription()
        }
        if (!machine.value.context.record.cancelled) {
          transition('STOP_RECORDING')
        }
      }
    )
  } catch (error) {
    console.error('无法访问麦克风', error)
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
  console.error('[StateMachine] Entered ERROR state:', machine.value.context.error)
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

const getStatusPrimaryText = () => {
  switch (machine.value.state) {
    case 'RECORDING': return '正在录音'
    case 'TRANSCRIBING': return '正在转录'
    case 'ANALYZING': return '正在分析'
    case 'COMPLETED': return `得分：${machine.value.context.record.score}`
    case 'ERROR': return '出现错误'
    default: return '等待开始'
  }
}

const getStatusSecondaryText = () => {
  switch (machine.value.state) {
    case 'RECORDING': return '清楚地表达你的回答'
    case 'TRANSCRIBING': return '识别语音内容中...'
    case 'ANALYZING': return '生成反馈建议中...'
    case 'COMPLETED': return '已生成详细反馈'
    case 'ERROR': return machine.value.context.error || '请重试'
    default: return '等待处理结果'
  }
}

// =========================
// 工具函数
// =========================
// 其他工具函数已移至composables中

// =========================
// WebSocket 功能
// =========================
// WebSocket相关功能已移至useWebSocketConnection composable中

const updateTemporaryRecordWithTranscription = (transcriptionText: string): void => {
  // 更新实时转录文本，然后调用统一的更新函数
  updateTemporaryRecord()
}

const updateTemporaryRecord = () => {
  if (!props.question) return

  // 如果已有实时转录文本，优先使用它，否则显示默认文本
  const hasTranscription = webSocketConnection.realtimeTranscription.value.trim()
  const displayText = hasTranscription ||
    (machine.value.state === 'RECORDING' ? '正在聆听中...' : '请开始说话...')

  const tempRecord: Partial<SpeakingRecord> = {
    question_id: props.question.id,
    user_answer: displayText,
    audio_file: '',
    ai_feedback: hasTranscription ? '正在实时转录中...' : '正在录音中...',
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

    let transcriptText = ''

    if (transcriptionMode.value === 'realtime') {
      // 实时转录模式：优先使用实时转录结果
      transcriptText = webSocketConnection.realtimeTranscription.value.trim()

      if (transcriptText) {
        console.log('使用实时转录结果:', transcriptText)
        machine.value.context.record.user_answer = transcriptText
      } else {
        console.log('实时转录为空，回退到API转录')
        transcriptText = await speechToText(audioFile)
        machine.value.context.record.user_answer = transcriptText
      }
    } else {
      // 批处理模式：总是使用API转录
      console.log('批处理模式，使用API转录')
      transcriptText = await speechToText(audioFile)
      machine.value.context.record.user_answer = transcriptText
    }

    emit('temporaryRecord', { ...machine.value.context.record })

    if (!transcriptText.trim()) {
      machine.value.context.error = '转录失败，请重新录音'
      transition('TRANSCRIPTION_ERROR')
      return
    }

    transition('TRANSCRIPTION_SUCCESS')
  } catch (error) {
    console.error('转录错误:', error)
    machine.value.context.error = '转录失败，请重试'
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
    console.error('分析错误:', error)
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

    // 立即清空转录文本，避免显示上次的内容
    webSocketConnection.resetTranscription()
    webSocketConnection.stopTranscription()

    audioRecording.cancelRecording()
    transition('CANCEL_RECORDING')
  }
}

const restartPractice = () => {
  // 重新开始前先清空转录文本
  webSocketConnection.resetTranscription()
  transition('RESTART')
}

const submitPractice = async () => {
  if (!props.question || !machine.value.context.record.user_answer ||
      !machine.value.context.record.audio_file || !machine.value.context.record.ai_feedback) return

  // 确保不是临时状态数据
  if (machine.value.context.record.user_answer.includes('转录中') ||
      machine.value.context.record.ai_feedback.includes('生成') ||
      !machine.value.context.record.score) {
    console.warn('数据还在处理中，请等待完成后再提交')
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
    console.error(error)
    machine.value.context.error = '提交失败，请重试'
    transition('ERROR')
  }
}

// =========================
// API函数
// =========================
const speechToText = async (audioFile: File): Promise<string> => {
  try {
    const result = await api.speaking.speechToText(audioFile)
    return result.text || ''
  } catch (e) {
    console.error(e)
    return ''
  }
}

const getAIFeedback = async (userAnswer: string) => {
  try {
    const result = await api.speaking.getAiFeedback(
      props.question?.question_text || '',
      userAnswer,
      props.question?.topic_title
    )
    return { feedback: result.feedback || '', score: result.score || 0 }
  } catch (e) {
    console.error(e)
    return { feedback: '', score: 0 }
  }
}

const saveRecordToBackend = async (record: CreateRecordPayload): Promise<SpeakingRecord> => {
  try {
    const result = await api.speaking.createRecord(record)
    return result
  } catch (e) {
    console.error(e)
    throw e
  }
}
</script>


<style scoped>
.voice-practice-control-panel {
  width: 100%;
  min-height: 200px; /* 增加最小高度以容纳转录模式选择器 */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  box-sizing: border-box;
  overflow: visible; /* 改为visible以避免内容被裁剪 */
}

.practice-start {
  display: flex;
  flex-direction: column; /* 改为列布局 */
  justify-content: center;
  align-items: center;
  width: 100%;
  min-height: 200px; /* 设置最小高度 */
  background: rgba(248, 250, 252, 0.9);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 16px;
  padding: 20px;
  box-sizing: border-box;
  gap: 20px; /* 添加间距 */
}

.start-btn {
  background: linear-gradient(135deg, #a855f7, #3b82f6);
  border: 2px solid rgba(168, 85, 247, 0.3);
  border-radius: 50px;
  padding: 20px 40px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 8px 25px rgba(168, 85, 247, 0.25);
  position: relative;
  overflow: hidden;
}

.start-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 12px 35px rgba(168, 85, 247, 0.35);
  border-color: rgba(168, 85, 247, 0.5);
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
  color: white;
}

.siri-circles {
  display: flex;
  gap: 3px;
  align-items: center;
}

.circle {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: white;
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
  background: rgba(248, 250, 252, 0.9);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 16px;
  padding: 16px;
  box-sizing: border-box;
}

/* 状态显示样式已移至RecordingStatusPanel组件 */


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
  border-radius: 50%;
  background: linear-gradient(135deg, #a855f7, #3b82f6);
  animation: processing-pulse 1.4s ease-in-out infinite both;
}

.processing-dots span:nth-child(1) { animation-delay: -0.32s; }
.processing-dots span:nth-child(2) { animation-delay: -0.16s; }
.processing-dots span:nth-child(3) { animation-delay: 0s; }

.processing-text, .waiting-text {
  margin: 0;
  font-size: 14px;
  color: #6b7280;
  font-weight: 500;
}

.processing-text {
  color: #a855f7;
}

.control-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  border-radius: 12px;
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
  background: linear-gradient(135deg, #a855f7, #7c3aed);
  border-color: rgba(168, 85, 247, 0.3);
  color: white;
  box-shadow: 0 4px 12px rgba(168, 85, 247, 0.3);
}

.control-btn.primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(168, 85, 247, 0.4);
  border-color: rgba(168, 85, 247, 0.5);
}

.control-btn.secondary {
  background: rgba(255, 255, 255, 0.9);
  color: #6b7280;
  border-color: rgba(0, 0, 0, 0.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.control-btn.secondary:hover {
  background: rgba(255, 255, 255, 1);
  color: #374151;
  transform: translateY(-1px);
  border-color: rgba(0, 0, 0, 0.2);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
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

/* 动画样式已移至RecordingStatusPanel组件 */

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

/* 转录模式选择器样式 */
.transcription-mode-selector {
  width: 100%;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 12px;
  padding: 10px;
  box-sizing: border-box;
  backdrop-filter: blur(10px);
}


</style>