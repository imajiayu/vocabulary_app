<template>
  <div class="voice-console" :class="consoleStateClass">
    <!-- 主控制台 -->
    <div class="console-body">
      <!-- 状态显示区 -->
      <div class="status-display">
        <div class="waveform-container">
          <div class="waveform-bars" :class="{ active: machine.state === 'RECORDING' }">
            <span v-for="i in 12" :key="i" :style="{ animationDelay: `${i * 0.05}s` }"></span>
          </div>
        </div>
        <div class="status-info">
          <div class="status-label">{{ statusLabel }}</div>
          <div class="status-detail">{{ statusDetail }}</div>
        </div>
        <div class="time-display" v-if="machine.state === 'RECORDING' || machine.state === 'COMPLETED'">
          <span class="time-value">{{ formatTime(recordingTime) }}</span>
        </div>
      </div>

      <!-- 中间可变区域：固定高度，不同状态切换内容 -->
      <div class="body-stage">
        <!-- 转录方式（仅空闲时显示） -->
        <div class="provider-section" v-if="machine.state === 'IDLE'">
          <SwitchTab
            v-model="selectedProvider"
            :tabs="providerTabs"
            container-class="dark-theme small"
            :show-indicator="true"
          />
          <Transition name="provider-desc" mode="out-in">
            <p class="provider-desc" :key="selectedProvider">
              {{ providerDescription }}
            </p>
          </Transition>
        </div>

        <!-- 分数显示 (完成时) -->
        <div class="score-display" v-if="machine.state === 'COMPLETED' && currentRecord.score">
          <div class="score-ring">
            <svg viewBox="0 0 100 100">
              <circle class="score-bg" cx="50" cy="50" r="42" />
              <circle
                class="score-fill"
                cx="50" cy="50" r="42"
                :style="{ strokeDashoffset: scoreOffset }"
              />
            </svg>
            <div class="score-value">{{ currentRecord.score }}</div>
          </div>
          <div class="score-label">分数</div>
        </div>

        <!-- 处理中动画 -->
        <div class="processing-animation" v-if="isProcessing">
          <div class="processing-ring">
            <div class="ring-segment" v-for="i in 3" :key="i"></div>
          </div>
          <div class="processing-text">{{ processingText }}</div>
        </div>
      </div>
    </div>

    <!-- 控制按钮区 -->
    <div class="console-controls">
      <!-- 空闲状态：开始按钮 -->
      <template v-if="machine.state === 'IDLE'">
        <button class="control-btn start-btn" @click="startPractice" :disabled="!question">
          <div class="btn-glow"></div>
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="4" fill="currentColor"/>
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
          </svg>
          <span class="btn-label">开始录音</span>
        </button>
      </template>

      <!-- 录音中：停止/完成按钮 -->
      <template v-else-if="machine.state === 'RECORDING'">
        <button class="control-btn cancel-btn" @click="stopRecordingAndReset">
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none">
            <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>
          </svg>
          <span class="btn-label">取消</span>
        </button>
        <button class="control-btn finish-btn" @click="stopRecording">
          <div class="btn-glow"></div>
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="btn-label">完成</span>
        </button>
      </template>

      <!-- 处理中：等待 -->
      <template v-else-if="isProcessing">
        <div class="waiting-indicator">
          <div class="waiting-dots">
            <span></span><span></span><span></span>
          </div>
          <span class="waiting-text">正在处理...</span>
        </div>
      </template>

      <!-- 完成状态：重试/提交按钮 -->
      <template v-else-if="currentRecord.ai_feedback && currentRecord.score">
        <button class="control-btn retry-btn" @click="restartPractice">
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none">
            <path d="M1 4V10H7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M3.51 15A9 9 0 1 0 5.64 5.64L1 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="btn-label">重试</span>
        </button>
        <button class="control-btn submit-btn" @click="submitPractice">
          <div class="btn-glow"></div>
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span class="btn-label">保存记录</span>
        </button>
      </template>
    </div>

    <!-- 错误提示 -->
    <div class="error-toast" v-if="machine.state === 'ERROR'">
      <svg class="error-icon" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
        <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <circle cx="12" cy="16" r="1" fill="currentColor"/>
      </svg>
      <span>{{ machine.context.error || '出错了' }}</span>
      <button class="error-dismiss" @click="restartPractice">重试</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { speakingLogger } from '@/shared/utils/logger'
import { Question, SpeakingRecord } from '@/shared/types'
import { api } from '@/shared/api'
import type { CreateRecordPayload } from '@/shared/api/speaking'
import { useAudioRecording } from '../composables/useAudioRecording'
import { transcribeAudio } from '@/shared/services/transcription'
import { useWebSpeechRecognition } from '@/shared/services/webSpeechRecognition'
import { isGoogleSTTConfigured } from '@/shared/services/googleCloudSTT'
import SwitchTab from '@/shared/components/controls/SwitchTab.vue'

const props = defineProps<{ question: Question | null }>()
const emit = defineEmits<{
  newRecord: [record: SpeakingRecord]
  temporaryRecord: [record: Partial<SpeakingRecord> | null]
  recordSaved: [payload: { tempId: number, savedRecord: SpeakingRecord }]
  recordSaveFailed: [tempId: number]
}>()

// =========================
// 状态机定义
// =========================
type State = 'IDLE' | 'RECORDING' | 'ANALYZING' | 'COMPLETED' | 'ERROR'

type Event =
  | 'START_PRACTICE'
  | 'STOP_RECORDING'
  | 'CANCEL_RECORDING'
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
      STOP_RECORDING: 'ANALYZING',
      CANCEL_RECORDING: 'IDLE',
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

// 转录方式 — 本地状态，不持久化
const providerTabs = [
  { value: 'web-speech', label: '实时识别' },
  { value: 'google-cloud-stt', label: 'Google 转录' },
]
const selectedProvider = ref('web-speech')
const useWebSpeech = computed(() => selectedProvider.value === 'web-speech')
const providerDescription = computed(() => {
  if (selectedProvider.value === 'web-speech') {
    return '边说边看文字，实时显示识别结果'
  }
  return '录音结束后统一转录，识别更准确'
})

// Google STT 未配置时自动回退
watch(selectedProvider, (val) => {
  if (val === 'google-cloud-stt' && !isGoogleSTTConfigured()) {
    selectedProvider.value = 'web-speech'
  }
})

// 状态机操作
const transition = (event: Event): void => {
  const currentState = machine.value.state
  const nextState = machine.value.transitions[currentState][event]

  if (nextState) {
    machine.value.state = nextState
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
    case 'ANALYZING':
      processTranscriptionAndAnalysis()
      break
    case 'COMPLETED':
      handleCompletedEntry()
      break
    case 'ERROR':
      handleErrorEntry()
      break
  }
}

// 计算属性
const isProcessing = computed(() => machine.value.state === 'ANALYZING')
const currentRecord = computed(() => machine.value.context.record)
const recordingTime = computed(() => audioRecording.context.value.recordingTime)

const consoleStateClass = computed(() => ({
  'state-idle': machine.value.state === 'IDLE',
  'state-recording': machine.value.state === 'RECORDING',
  'state-analyzing': machine.value.state === 'ANALYZING',
  'state-completed': machine.value.state === 'COMPLETED',
  'state-error': machine.value.state === 'ERROR'
}))

const statusLabel = computed(() => {
  switch (machine.value.state) {
    case 'RECORDING': return '录音中'
    case 'ANALYZING': return '分析中'
    case 'COMPLETED': return '完成'
    case 'ERROR': return '错误'
    default: return '就绪'
  }
})

const statusDetail = computed(() => {
  switch (machine.value.state) {
    case 'RECORDING': return '请清晰地说出你的回答'
    case 'ANALYZING': return '正在处理你的回答...'
    case 'COMPLETED': return '查看下方的结果'
    case 'ERROR': return machine.value.context.error || '请重试'
    default: return '点击按钮开始'
  }
})

const processingText = computed(() => {
  if (!useWebSpeech.value && !currentRecord.value.user_answer) {
    return '正在转录语音...'
  }
  return '正在生成反馈...'
})

const scoreOffset = computed(() => {
  const score = currentRecord.value.score || 0
  const circumference = 2 * Math.PI * 42
  return circumference - (score / 9) * circumference
})

// 监听题目变化，重置状态机
watch(() => props.question, (newQuestion, oldQuestion) => {
  if (newQuestion !== oldQuestion) {
    machine.value = createStateMachine()
    handleIdleEntry()
  }
}, { immediate: false })

// 监听 Web Speech 识别结果变化
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
  webSpeech.abort()
  machine.value.context.record = {}
  machine.value.context.error = undefined
  emit('temporaryRecord', null)
}

const handleRecordingStart = async (): Promise<void> => {
  if (!props.question) return

  try {
    machine.value.context.record = {
      user_answer: '',
      ai_feedback: '',
      score: 0,
      created_at: new Date().toISOString()
    }

    if (useWebSpeech.value && webSpeech.isSupported.value) {
      webSpeech.start()
      speakingLogger.log('Web Speech API 已启动')
    }

    await audioRecording.setupAudioRecording(
      (_pcm16Data: Int16Array) => {
        updateTemporaryRecord()
      },
      () => {
        if (!machine.value.context.record.cancelled) {
          transition('STOP_RECORDING')
        }
      },
      !useWebSpeech.value // Google STT 需要 webm 格式
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

const handleCompletedEntry = (): void => {
  emit('temporaryRecord', { ...machine.value.context.record })
}

const handleErrorEntry = (): void => {
  speakingLogger.error('Entered ERROR state:', machine.value.context.error)
  emit('temporaryRecord', null)
}

// =========================
// 工具函数
// =========================
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

const updateTemporaryRecord = () => {
  if (!props.question) return

  let displayText = '等待语音...'
  let feedbackText = '录音结束后将进行转录...'

  if (machine.value.state === 'RECORDING') {
    if (useWebSpeech.value && webSpeech.isListening.value) {
      const currentText = webSpeech.getCurrentText()
      displayText = currentText || '正在聆听...'
    } else {
      displayText = '正在聆听...'
    }
    feedbackText = '等待录音结束...'
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
// 处理函数
// =========================
const processTranscriptionAndAnalysis = async (): Promise<void> => {
  try {
    const audioFile = audioRecording.createAudioFile()
    machine.value.context.record.audio_file = audioFile
    machine.value.context.record.question_id = props.question?.id

    let transcriptText = ''

    if (useWebSpeech.value) {
      // Web Speech API：实时识别，停止时获取最终结果
      transcriptText = webSpeech.stop()
      speakingLogger.log('Web Speech API 结果:', transcriptText)
    } else {
      // Google Cloud STT：录音结束后批量转录
      speakingLogger.log('Google Cloud STT 转录中...')
      const durationSeconds = audioRecording.context.value.recordingTime
      const result = await transcribeAudio(audioFile, durationSeconds)
      if (result.success) {
        transcriptText = result.text
      } else {
        machine.value.context.error = result.error || '转录失败'
        transition('ANALYSIS_ERROR')
        return
      }
    }

    if (!transcriptText.trim()) {
      machine.value.context.error = '未检测到语音，请重试'
      transition('ANALYSIS_ERROR')
      return
    }

    machine.value.context.record.user_answer = transcriptText
    emit('temporaryRecord', { ...machine.value.context.record })

    const feedback = await getAIFeedback(transcriptText)
    // 用分隔符合并两部分存入 ai_feedback
    machine.value.context.record.ai_feedback = feedback.chineseFeedback && feedback.improvedEnglish
      ? `${feedback.chineseFeedback}\n---\n${feedback.improvedEnglish}`
      : feedback.chineseFeedback || feedback.improvedEnglish || ''
    machine.value.context.record.score = feedback.score

    emit('temporaryRecord', { ...machine.value.context.record })
    transition('ANALYSIS_SUCCESS')
  } catch (error) {
    speakingLogger.error('处理错误:', error)
    machine.value.context.error = '处理失败，请重试'
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

const submitPractice = () => {
  if (!props.question || !machine.value.context.record.user_answer ||
      !machine.value.context.record.audio_file || !machine.value.context.record.ai_feedback) return

  if (machine.value.context.record.user_answer.includes('转录中') ||
      machine.value.context.record.ai_feedback.includes('生成') ||
      !machine.value.context.record.score) {
    speakingLogger.warn('数据还在处理中，请等待完成后再提交')
    return
  }

  // 在 transition 清空 context 之前，先快照所有数据
  const audioFile = machine.value.context.record.audio_file as File
  const userAnswer = machine.value.context.record.user_answer
  const aiFeedback = machine.value.context.record.ai_feedback!
  const score = machine.value.context.record.score!
  const questionId = props.question.id

  // 构建乐观记录（负数 ID 标记为未持久化，blob URL 用于本地播放）
  const tempId = -Date.now()
  const optimisticRecord: SpeakingRecord = {
    id: tempId,
    question_id: questionId,
    user_answer: userAnswer,
    audio_file: URL.createObjectURL(audioFile),
    ai_feedback: aiFeedback,
    score: score,
    created_at: new Date().toISOString()
  }

  // 立即更新 UI，不等待网络
  emit('newRecord', optimisticRecord)
  transition('SUBMIT')

  // 异步持久化（上传音频 + 写入数据库）
  saveRecord({
    question_id: questionId,
    user_answer: userAnswer,
    audio_file: audioFile,
    ai_feedback: aiFeedback,
    score: score
  })
    .then(savedRecord => {
      URL.revokeObjectURL(optimisticRecord.audio_file as string)
      emit('recordSaved', { tempId, savedRecord })
    })
    .catch(() => {
      emit('recordSaveFailed', tempId)
    })
}

// =========================
// API函数
// =========================
const getAIFeedback = async (userAnswer: string) => {
  try {
    const result = await api.speaking.getAiFeedback(
      props.question?.question_text || '',
      userAnswer,
      props.question?.topic_title,
      props.question?.part
    )
    return {
      chineseFeedback: result.chineseFeedback || '',
      improvedEnglish: result.improvedEnglish || '',
      score: result.score || 0
    }
  } catch (e) {
    speakingLogger.error('获取AI反馈失败:', e)
    return { chineseFeedback: '', improvedEnglish: '', score: 0 }
  }
}

const saveRecord = async (record: CreateRecordPayload): Promise<SpeakingRecord> => {
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
/* ═══════════════════════════════════════════════════════════════════════════
   Voice Console - 音频控制台风格
   ═══════════════════════════════════════════════════════════════════════════ */

.voice-console {
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0.4) 0%,
    rgba(0, 0, 0, 0.6) 100%
  );
  border: 1px solid rgba(250, 247, 242, 0.1);
  border-radius: var(--radius-xl);
  overflow: hidden;
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
}

.voice-console.state-recording {
  border-color: rgba(155, 59, 59, 0.5);
  box-shadow: 0 0 40px rgba(155, 59, 59, 0.2);
}

.voice-console.state-completed {
  border-color: rgba(93, 122, 93, 0.4);
}

.voice-console.state-error {
  border-color: rgba(155, 59, 59, 0.4);
}

/* ═══════════════════════════════════════════════════════════════════════════
   控制台主体
   ═══════════════════════════════════════════════════════════════════════════ */

.console-body {
  padding: 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

/* 固定高度的中间区域，防止不同状态间高度跳变 */
.body-stage {
  width: 100%;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ═══════════════════════════════════════════════════════════════════════════
   状态显示区
   ═══════════════════════════════════════════════════════════════════════════ */

.status-display {
  display: flex;
  align-items: center;
  gap: 20px;
  width: 100%;
}

.waveform-container {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  border-radius: var(--radius-lg);
  border: 1px solid rgba(250, 247, 242, 0.08);
}

.waveform-bars {
  display: flex;
  align-items: center;
  gap: 3px;
  height: 32px;
}

.waveform-bars span {
  width: 3px;
  height: 8px;
  background: var(--primitive-ink-500);
  border-radius: 2px;
  transition: background 0.2s ease;
}

.waveform-bars.active span {
  background: var(--primitive-brick-500);
  animation: waveform 0.6s ease-in-out infinite alternate;
}

.waveform-bars.active span:nth-child(1) { animation-delay: 0s; }
.waveform-bars.active span:nth-child(2) { animation-delay: 0.1s; }
.waveform-bars.active span:nth-child(3) { animation-delay: 0.15s; }
.waveform-bars.active span:nth-child(4) { animation-delay: 0.2s; }
.waveform-bars.active span:nth-child(5) { animation-delay: 0.25s; }
.waveform-bars.active span:nth-child(6) { animation-delay: 0.3s; }
.waveform-bars.active span:nth-child(7) { animation-delay: 0.25s; }
.waveform-bars.active span:nth-child(8) { animation-delay: 0.2s; }
.waveform-bars.active span:nth-child(9) { animation-delay: 0.15s; }
.waveform-bars.active span:nth-child(10) { animation-delay: 0.1s; }
.waveform-bars.active span:nth-child(11) { animation-delay: 0.05s; }
.waveform-bars.active span:nth-child(12) { animation-delay: 0s; }

@keyframes waveform {
  0% { height: 8px; }
  100% { height: 28px; }
}

.status-info {
  flex: 1;
}

.status-label {
  font-family: var(--font-ui);
  font-size: 18px;
  font-weight: 700;
  color: var(--primitive-paper-100);
  margin-bottom: 4px;
  letter-spacing: 0.02em;
}

.state-recording .status-label {
  color: var(--primitive-brick-400);
}

.state-completed .status-label {
  color: var(--primitive-olive-400);
}

.status-detail {
  font-family: var(--font-serif);
  font-size: 14px;
  color: var(--primitive-ink-400);
  line-height: 1.4;
}

.time-display {
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.4);
  border-radius: var(--radius-md);
  border: 1px solid rgba(250, 247, 242, 0.08);
}

.time-value {
  font-family: var(--font-data);
  font-size: 24px;
  font-weight: 700;
  color: var(--primitive-paper-200);
  letter-spacing: 0.05em;
}

.state-recording .time-value {
  color: var(--primitive-brick-400);
}

/* ═══════════════════════════════════════════════════════════════════════════
   转录方式选择区
   ═══════════════════════════════════════════════════════════════════════════ */

.provider-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.provider-section :deep(.switch-tab-container) {
  max-width: 280px;
}

.provider-desc {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 12px;
  color: var(--primitive-ink-500);
  text-align: center;
  line-height: 1.5;
  letter-spacing: 0.01em;
}

/* 切换描述文案的过渡动画 */
.provider-desc-enter-active,
.provider-desc-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.provider-desc-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}

.provider-desc-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

/* ═══════════════════════════════════════════════════════════════════════════
   分数显示
   ═══════════════════════════════════════════════════════════════════════════ */

.score-display {
  display: flex;
  align-items: center;
  gap: 14px;
}

.score-ring {
  position: relative;
  width: 72px;
  height: 72px;
}

.score-ring svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.score-bg {
  fill: none;
  stroke: rgba(250, 247, 242, 0.1);
  stroke-width: 6;
}

.score-fill {
  fill: none;
  stroke: var(--primitive-olive-400);
  stroke-width: 6;
  stroke-linecap: round;
  stroke-dasharray: 264;
  transition: stroke-dashoffset 1s ease-out;
}

.score-value {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-family: var(--font-data);
  font-size: 22px;
  font-weight: 700;
  color: var(--primitive-paper-100);
}

.score-label {
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--primitive-ink-400);
}

/* ═══════════════════════════════════════════════════════════════════════════
   处理中动画
   ═══════════════════════════════════════════════════════════════════════════ */

.processing-animation {
  display: flex;
  align-items: center;
  gap: 16px;
}

.processing-ring {
  width: 48px;
  height: 48px;
  position: relative;
  flex-shrink: 0;
}

.ring-segment {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border: 3px solid transparent;
  border-top-color: var(--primitive-gold-500);
  border-radius: 50%;
  animation: spin 1.2s linear infinite;
}

.ring-segment:nth-child(2) {
  animation-delay: 0.15s;
  opacity: 0.7;
}

.ring-segment:nth-child(3) {
  animation-delay: 0.3s;
  opacity: 0.4;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.processing-text {
  font-family: var(--font-ui);
  font-size: 13px;
  color: var(--primitive-gold-400);
  letter-spacing: 0.02em;
}

/* ═══════════════════════════════════════════════════════════════════════════
   控制按钮区
   ═══════════════════════════════════════════════════════════════════════════ */

.console-controls {
  display: flex;
  justify-content: center;
  gap: 16px;
  padding: 20px 28px 28px;
  background: rgba(0, 0, 0, 0.2);
  border-top: 1px solid rgba(250, 247, 242, 0.06);
}

.control-btn {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 28px;
  border: none;
  border-radius: var(--radius-lg);
  font-family: var(--font-ui);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  overflow: hidden;
}

.btn-glow {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.btn-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.btn-label {
  white-space: nowrap;
}

/* 开始按钮 */
.start-btn {
  background: linear-gradient(135deg, var(--primitive-gold-500), var(--primitive-copper-500));
  color: var(--primitive-paper-100);
  padding: 14px 32px;
}

.start-btn .btn-glow {
  background: radial-gradient(circle at center, rgba(255, 255, 255, 0.3), transparent 70%);
}

.start-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(184, 134, 11, 0.4);
}

.start-btn:hover:not(:disabled) .btn-glow {
  opacity: 1;
}

.start-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
}

/* 取消按钮 */
.cancel-btn {
  background: rgba(250, 247, 242, 0.08);
  color: var(--primitive-paper-400);
  border: 1px solid rgba(250, 247, 242, 0.15);
}

.cancel-btn:hover {
  background: rgba(250, 247, 242, 0.12);
  border-color: rgba(250, 247, 242, 0.2);
}

/* 完成按钮 */
.finish-btn {
  background: linear-gradient(135deg, var(--primitive-olive-500), var(--primitive-olive-600));
  color: var(--primitive-paper-100);
}

.finish-btn .btn-glow {
  background: radial-gradient(circle at center, rgba(255, 255, 255, 0.25), transparent 70%);
}

.finish-btn:hover .btn-glow {
  opacity: 1;
}

.finish-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(93, 122, 93, 0.4);
}

/* 重试按钮 */
.retry-btn {
  background: rgba(250, 247, 242, 0.08);
  color: var(--primitive-paper-400);
  border: 1px solid rgba(250, 247, 242, 0.15);
}

.retry-btn:hover {
  background: rgba(250, 247, 242, 0.12);
  border-color: rgba(250, 247, 242, 0.2);
}

/* 提交按钮 */
.submit-btn {
  background: linear-gradient(135deg, var(--primitive-gold-500), var(--primitive-copper-500));
  color: var(--primitive-paper-100);
}

.submit-btn .btn-glow {
  background: radial-gradient(circle at center, rgba(255, 255, 255, 0.3), transparent 70%);
}

.submit-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(184, 134, 11, 0.4);
}

.submit-btn:hover .btn-glow {
  opacity: 1;
}

/* 等待指示器 */
.waiting-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.waiting-dots {
  display: flex;
  gap: 6px;
}

.waiting-dots span {
  width: 8px;
  height: 8px;
  background: var(--primitive-gold-500);
  border-radius: 50%;
  animation: waitingPulse 1.4s ease-in-out infinite;
}

.waiting-dots span:nth-child(2) { animation-delay: 0.2s; }
.waiting-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes waitingPulse {
  0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
  40% { transform: scale(1); opacity: 1; }
}

.waiting-text {
  font-family: var(--font-ui);
  font-size: 13px;
  color: var(--primitive-ink-400);
}

/* ═══════════════════════════════════════════════════════════════════════════
   错误提示
   ═══════════════════════════════════════════════════════════════════════════ */

.error-toast {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: rgba(155, 59, 59, 0.15);
  border-top: 1px solid rgba(155, 59, 59, 0.3);
  color: var(--primitive-brick-400);
  font-family: var(--font-ui);
  font-size: 14px;
}

.error-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.error-dismiss {
  margin-left: auto;
  padding: 6px 14px;
  background: rgba(155, 59, 59, 0.2);
  border: 1px solid rgba(155, 59, 59, 0.4);
  border-radius: var(--radius-sm);
  color: var(--primitive-brick-400);
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.error-dismiss:hover {
  background: rgba(155, 59, 59, 0.3);
}

/* ═══════════════════════════════════════════════════════════════════════════
   移动端适配
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .console-body {
    padding: 20px;
    gap: 16px;
  }

  .body-stage {
    height: 80px;
  }

  .status-display {
    gap: 16px;
  }

  .waveform-container {
    width: 50px;
    height: 50px;
  }

  .waveform-bars {
    height: 24px;
    gap: 2px;
  }

  .waveform-bars span {
    width: 2px;
    height: 6px;
  }

  @keyframes waveform {
    0% { height: 6px; }
    100% { height: 20px; }
  }

  .status-label {
    font-size: 16px;
  }

  .status-detail {
    font-size: 13px;
  }

  .time-display {
    padding: 6px 12px;
  }

  .time-value {
    font-size: 20px;
  }

  .provider-section .switch-tab-container {
    max-width: 260px;
  }

  .provider-desc {
    font-size: 11px;
  }

  .score-ring {
    width: 60px;
    height: 60px;
  }

  .score-value {
    font-size: 18px;
  }

  .console-controls {
    padding: 16px 20px 20px;
    gap: 12px;
  }

  .control-btn {
    padding: 12px 20px;
    font-size: 13px;
    gap: 8px;
  }

  .start-btn {
    padding: 12px 24px;
  }

  .btn-icon {
    width: 18px;
    height: 18px;
  }
}

/* 横屏适配 */
@media (max-height: 500px) and (orientation: landscape) {
  .console-body {
    padding: 12px 16px;
    flex-direction: row;
    justify-content: space-between;
    gap: 12px;
  }

  .body-stage {
    height: 60px;
  }

  .status-display {
    flex: 1;
  }

  .score-ring {
    width: 48px;
    height: 48px;
  }

  .score-value {
    font-size: 16px;
  }

  .console-controls {
    padding: 12px 16px;
  }
}
</style>
