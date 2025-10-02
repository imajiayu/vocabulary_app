<template>
  <div class="word-spelling-container">
    <!-- 释义固定容器 -->
    <div class="definition-container">
      <WordDetailsReview :word="word" :only-show-definitions="true" />
    </div>

    <!-- 输入框固定在按钮栏上方 -->
    <div class="spelling-input-container">
      <input ref="inputRef" v-model="userInput" type="text" class="spelling-input" :class="inputClass"
        placeholder="输入单词拼写..." autocomplete="off" @keydown="handleKeydown" :disabled="isSubmitting" />
    </div>

    <!-- 按钮栏固定在底部 -->
    <div class="button-bar">
      <div class="button-group">
        <div class="row-buttons">
          <button class="button play-btn" @click="handlePlayAudio" :disabled="isSubmitting">
            🔊 播放音频
          </button>
          <button class="button forgot-btn" @click="handleForgot" :disabled="isCorrect || isSubmitting">
            😵 没记住
          </button>
        </div>

        <div class="row-buttons">
          <button class="button next-btn full-width" @click="handleNext" :disabled="!canProceed || isSubmitting" :class="{ hidden: !canProceed }">
            下一个 ➡️
          </button>
        </div>
      </div>
    </div>
  </div>
</template>


<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue'
import type { AudioType } from '@/features/vocabulary/stores/review'
import { Word } from '@/shared/types'
import WordDetailsReview from './WordDetailsReview.vue'
import { playWordAudio } from '@/shared/utils/playWordAudio'

interface KeyEvent {
  timestamp: number
  key: string
  code: string
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
  inputValue: string
}

interface BackspaceSequence {
  startPos: number
  deletedChars: number
  timestamp: number
}

interface DetailedSpellingData {
  keyEvents: KeyEvent[]
  interactions: {
    audioRequestCount: number    // 音频播放请求次数（按钮+快捷键）
    forgotRequestCount: number   // 忘记请求次数（按钮+快捷键）
  }
  inputAnalysis: {
    totalTypingTime: number
    longestPause: number
    averageKeyInterval: number
    backspaceSequences: BackspaceSequence[]
  }
}

interface Props {
  word: Word
  audioType: AudioType
  onResult: (result: {
    remembered: boolean
    spellingData: DetailedSpellingData
  }) => Promise<void>
}

const props = defineProps<Props>()

const inputRef = ref<HTMLInputElement>()
const userInput = ref('')
const forgotClicked = ref(false)
const isSubmitting = ref(false)

// 详细输入数据记录
const startTime = ref<number>(0)
const keyEvents = ref<KeyEvent[]>([])
const interactions = ref({
  audioRequestCount: 0,
  forgotRequestCount: 0
})
const backspaceSequences = ref<BackspaceSequence[]>([])
const currentBackspaceSequence = ref<BackspaceSequence | null>(null)


const isCorrect = computed(() => userInput.value.trim().toLowerCase() === props.word.word.toLowerCase())
const canProceed = computed(() => isCorrect.value)
const inputClass = computed(() => (!userInput.value ? '' : isCorrect.value ? 'correct' : 'incorrect'))

const handlePlayAudio = async () => {
  if (isSubmitting.value) return
  interactions.value.audioRequestCount++
  playWordAudio(props.word.word)
  await nextTick()
  inputRef.value?.focus()
}

const handleForgot = async () => {
  if (isSubmitting.value) return
  interactions.value.forgotRequestCount++
  forgotClicked.value = true
  userInput.value = props.word.word
  await nextTick()
  inputRef.value?.focus()
}

const recordKeyEvent = (event: KeyboardEvent) => {
  const timestamp = Date.now() - startTime.value
  const keyEvent: KeyEvent = {
    timestamp,
    key: event.key,
    code: event.code,
    metaKey: event.metaKey,
    altKey: event.altKey,
    shiftKey: event.shiftKey,
    inputValue: userInput.value
  }
  keyEvents.value.push(keyEvent)
}

const handleBackspace = (event: KeyboardEvent) => {
  const cursorPos = (event.target as HTMLInputElement).selectionStart || 0

  if (!currentBackspaceSequence.value) {
    currentBackspaceSequence.value = {
      startPos: cursorPos,
      deletedChars: 0,
      timestamp: Date.now() - startTime.value
    }
  }

  currentBackspaceSequence.value.deletedChars++
}

const finishBackspaceSequence = () => {
  if (currentBackspaceSequence.value && currentBackspaceSequence.value.deletedChars > 0) {
    backspaceSequences.value.push({ ...currentBackspaceSequence.value })
    currentBackspaceSequence.value = null
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (isSubmitting.value) return

  // 处理Enter键（不记录事件）
  if (event.key === 'Enter') {
    if (canProceed.value) {
      event.preventDefault()
      handleNext()
    }
    return // 直接返回，不记录Enter键事件
  }

  recordKeyEvent(event)

  // 统计普通按键
  if (!['ArrowLeft', 'ArrowRight', 'Tab', 'Shift', 'Control', 'Alt', 'Meta', 'Escape', 'Backspace'].includes(event.key)) {
    finishBackspaceSequence() // 开始正常输入时结束退格序列
  }

  // 处理退格键
  if (event.key === 'Backspace') {
    handleBackspace(event)
  } else {
    finishBackspaceSequence() // 非退格键时结束退格序列
  }

  switch (event.key) {
    case ' ':
    case 'ArrowLeft':
      event.preventDefault()
      handlePlayAudio()
      break
    case 'ArrowRight':
      event.preventDefault()
      handleForgot()
      break
  }
}


const calculateInputAnalysis = (): DetailedSpellingData['inputAnalysis'] => {
  const totalTime = keyEvents.value.length > 0
    ? keyEvents.value[keyEvents.value.length - 1].timestamp
    : 0

  let longestPause = 0
  let totalInterval = 0

  for (let i = 1; i < keyEvents.value.length; i++) {
    const interval = keyEvents.value[i].timestamp - keyEvents.value[i - 1].timestamp
    totalInterval += interval
    longestPause = Math.max(longestPause, interval)
  }

  const averageInterval = keyEvents.value.length > 1
    ? totalInterval / (keyEvents.value.length - 1)
    : 0

  return {
    totalTypingTime: totalTime,
    longestPause,
    averageKeyInterval: averageInterval,
    backspaceSequences: [...backspaceSequences.value]
  }
}

const handleNext = async () => {
  if (!canProceed.value || isSubmitting.value) return
  isSubmitting.value = true
  try {
    finishBackspaceSequence() // 确保最后的退格序列被记录

    const remembered = !forgotClicked.value && isCorrect.value

    const spellingData: DetailedSpellingData = {
      keyEvents: [...keyEvents.value],
      interactions: { ...interactions.value },
      inputAnalysis: calculateInputAnalysis()
    }

    await props.onResult({ remembered, spellingData })

    resetState()
    await nextTick()
    playWordAudio(props.word.word)
    setTimeout(() => inputRef.value?.focus(), 50)
  } catch (error) {
    console.error('Submit spelling result failed:', error)
  } finally {
    isSubmitting.value = false
  }
}

const resetState = () => {
  userInput.value = ''
  forgotClicked.value = false

  // 重置详细记录
  startTime.value = Date.now()
  keyEvents.value = []
  interactions.value = {
    audioRequestCount: 0,
    forgotRequestCount: 0
  }
  backspaceSequences.value = []
  currentBackspaceSequence.value = null

}

onMounted(async () => {
  resetState()
  await nextTick()
  playWordAudio(props.word.word)
  setTimeout(() => inputRef.value?.focus(), 50)
})
</script>

<style scoped>
.definition-container {
  position: fixed;
  top: 30%;
  /* 垂直居中 */
  left: 50%;
  /* 水平居中 */
  transform: translate(-50%, -50%);
  width: calc(100% - 2rem);
  /* 左右都有1rem间距 */
  max-width: 600px;
  min-height: 120px;
  font-weight: 600;
  font-size: 1.3em;
  display: flex;
  align-items: flex-start;
  /* 上对齐 */
  justify-content: flex-start;
  /* 左对齐 */
  text-align: left;
  padding: 1em;
  box-sizing: border-box;
  background: #ffffff00;
  z-index: 500;
}

/* 输入框容器 - 固定在按钮栏上方 */
.spelling-input-container {
  position: fixed;
  bottom: calc(2 * 3.5rem + 0.75rem + 2rem + 1rem); /* 按钮栏高度 + padding + 间距 */
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  max-width: 400px;
  z-index: 999;
}

/* 按钮栏 - 固定在底部 */
.button-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  padding: 1rem;
  background: none;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 -2px 20px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  box-sizing: border-box;
  /* 设置最小高度防止布局跳动 */
  min-height: calc(2 * 2.8rem + 0.75rem + 2rem); /* 按钮高度 + 间距 + padding */
}

.spelling-input {
  width: 100%;
  font-size: 1.6em;
  text-align: center;
  padding: 0.5em;
  border-radius: 8px;
  border: 2px solid #e1e5e9;
  outline: none;
  background: #fff;
  box-sizing: border-box;
}

/* 按钮组 */
.button-group {
  max-width: 600px;
  margin: 0 auto;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}

.word-spelling-container {
  max-width: 600px;
  margin: 2em auto;
  padding: 0 1em;
  padding-bottom: 8em;
}

.control-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2em;
  margin-top: 2em;
}

.spelling-input:focus {
  border-color: #1677ff;
  box-shadow: 0 0 0 3px rgba(22, 119, 255, 0.1);
}

.spelling-input.correct {
  color: #52c41a;
  border-color: #52c41a;
  box-shadow: 0 0 0 3px rgba(82, 196, 26, 0.1);
}

.spelling-input.incorrect {
  color: #ff4d4f;
  border-color: #ff4d4f;
  box-shadow: 0 0 0 3px rgba(255, 77, 79, 0.1);
}

.spelling-input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
}

/* 移除重复的button-group定义 */

.row-buttons {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.row-buttons:last-child {
  margin-bottom: 0;
}

/* 隐藏按钮样式 */
.button.hidden {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.1s ease;
}

/* 确保移动端和桌面端按钮状态显示一致 */
@media (hover: none) and (pointer: coarse) {
  .button.hidden {
    opacity: 0;
    pointer-events: none;
    /* 移动端禁用任何触摸反馈 */
    -webkit-tap-highlight-color: transparent;
    touch-action: none;
  }

  .button:not(.hidden):not(:disabled) {
    /* 移动端可用按钮的触摸优化 */
    -webkit-tap-highlight-color: transparent;
    touch-action: manipulation;
  }

  .button:active:not(.hidden):not(:disabled) {
    transform: scale(0.98);
    transition: transform 0.1s ease;
  }
}

/* 桌面端保持原有行为 */
@media (hover: hover) and (pointer: fine) {
  .button.hidden {
    opacity: 0;
    pointer-events: none;
  }
}

/* 按钮基础样式 - 完全采用WordReview的样式 */
.button {
  flex: 1;
  font-size: 1.1em;
  padding: 0.8em;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  background-color: #f0f0f0;
  transition: all 0.2s ease;
  color: #333;
  touch-action: manipulation;
}

.button:hover:not(:disabled):not(.hidden) {
  background-color: #e0e0e0;
  transform: translateY(-1px);
}

/* 按钮禁用状态 - 与WordReview一致 */
.button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.full-width {
  width: 100%;
}

.play-btn {
  background-color: #3b82f6;
  color: white;
}

.play-btn:hover:not(:disabled):not(.hidden) {
  background-color: #2563eb;
}

.forgot-btn {
  background-color: #a855f7;
  color: white;
}

.forgot-btn:hover:not(:disabled):not(.hidden) {
  background-color: #9333ea;
}

.next-btn {
  background-color: #10b981;
  color: white;
  font-size: 1.1em;
}

.next-btn:hover:not(:disabled):not(.hidden) {
  background-color: #059669;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .word-spelling-container {
    padding-bottom: 10em;
    margin: 1em auto;
  }

  .definition-container {
    position: fixed;
    top: auto;
    bottom: calc(2 * 3.5rem + 0.75rem + 2rem + 1rem + 4rem); /* 在输入框上方4rem */
    left: 50%;
    transform: translateX(-50%);
    width: calc(100% - 2rem);
    max-width: 600px;
    min-height: 120px;
    font-weight: 600;
    font-size: 1.1em;
    padding: 1em;
    z-index: 500;
  }

  .spelling-input-container {
    bottom: calc(2 * 3.5rem + 0.75rem + 2rem + 1rem); /* 移动端按钮栏高度计算 */
  }

  .spelling-input {
    font-size: 1.4em;
    padding: 0.6em;
  }

  .button-bar {
    /* 移动端最小高度 */
    min-height: calc(2 * 3.5rem + 0.75rem + 2rem + env(safe-area-inset-bottom));
  }

  .row-buttons {
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .button {
    min-height: 3.5rem;
    padding: 0.875rem;
    font-size: 1rem;
  }
}

@media (max-width: 480px) {
  .definition-container {
    bottom: calc(2 * 3.25rem + 0.625rem + 2rem + 1rem + 3.5rem); /* 在输入框上方3.5rem */
    font-size: 1em;
    min-height: 100px;
    padding: 0.75em;
  }

  .spelling-input-container {
    bottom: calc(2 * 3.25rem + 0.625rem + 2rem + 1rem); /* 小屏手机按钮栏高度计算 */
  }

  .spelling-input {
    font-size: 1.2em;
    padding: 0.5em;
  }

  .button-bar {
    /* 小屏手机最小高度 */
    min-height: calc(2 * 3.25rem + 0.625rem + 1.75rem + env(safe-area-inset-bottom));
  }

  .button {
    min-height: 3.25rem;
    padding: 0.75rem;
    font-size: 0.95rem;
  }

  .row-buttons {
    gap: 0.375rem;
    margin-bottom: 0.625rem;
  }

  .word-spelling-container {
    padding-bottom: 11em;
  }
}
</style>