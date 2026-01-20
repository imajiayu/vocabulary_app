<template>
  <div class="word-spelling-container">
    <!-- 释义固定容器 -->
    <div class="definition-container">
      <ReviewResult :word="word" :only-show-definitions="true" />
    </div>

    <!-- 输入框固定在按钮栏上方 -->
    <div class="spelling-input-container">
      <input ref="inputRef" v-model="userInput" type="text" class="spelling-input" :class="inputClass"
        placeholder="输入单词拼写..." autocomplete="off" @keydown="handleKeydown" :disabled="isSubmitting"
        :readonly="isMobile" @focus="handleInputFocus" />
    </div>

    <!-- 移动端自定义键盘 -->
    <SpellingKeyboard
      v-if="isMobile"
      :disabled="isSubmitting"
      :forgot-disabled="isCorrect || isSubmitting"
      :enter-disabled="!canProceed || isSubmitting"
      @key="handleVirtualKey"
      @backspace="handleVirtualBackspace"
      @enter="handleVirtualEnter"
      @play-audio="handlePlayAudio"
      @forgot="handleForgot"
    />

    <!-- 按钮栏固定在底部 - 仅桌面端显示 -->
    <div v-if="!isMobile" class="button-bar">
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
import { ref, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import type { AudioType } from '@/features/vocabulary/stores/review'
import { Word } from '@/shared/types'
import ReviewResult from '../review/ReviewResult.vue'
import SpellingKeyboard from './SpellingKeyboard.vue'
import { playWordAudio } from '@/shared/utils/playWordAudio'
import { useHotkeys } from '@/shared/composables/useHotkeys'
import { useAudioAccent } from '@/shared/composables/useAudioAccent'
import { logger } from '@/shared/utils/logger'

const log = logger.create('Spelling')

// 检测是否为移动端
const isMobile = ref(false)
const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768 || ('ontouchstart' in window)
}

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

// 使用全局快捷键设置
const { hotkeys, loadHotkeys } = useHotkeys()

const inputRef = ref<HTMLInputElement>()
const userInput = ref('')
const forgotClicked = ref(false)
const isSubmitting = ref(false)

// 详细输入数据记录
const startTime = ref<number>(0)
const keyEvents = ref<KeyEvent[]>([])
const interactions = ref({
  audioRequestCount: 0
})
const backspaceSequences = ref<BackspaceSequence[]>([])
const currentBackspaceSequence = ref<BackspaceSequence | null>(null)


const isCorrect = computed(() => userInput.value.trim().toLowerCase() === props.word.word.toLowerCase())
const canProceed = computed(() => isCorrect.value)
const inputClass = computed(() => (!userInput.value ? '' : isCorrect.value ? 'correct' : 'incorrect'))

const { audioAccent, loadAudioAccent } = useAudioAccent()

const handlePlayAudio = async () => {
  if (isSubmitting.value) return
  interactions.value.audioRequestCount++
  playWordAudio(props.word.word, audioAccent.value)
  await nextTick()
  inputRef.value?.focus()
}

const handleForgot = async () => {
  if (isSubmitting.value) return
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

  // 移动端阻止物理键盘输入
  if (isMobile.value) {
    event.preventDefault()
    return
  }

  // 获取自定义快捷键
  const spellingKeys = hotkeys.value.spelling

  // 处理自定义的下一个快捷键（不记录事件）
  if (event.key === spellingKeys.next) {
    if (canProceed.value) {
      event.preventDefault()
      handleNext()
    }
    return // 直接返回，不记录此快捷键事件
  }

  // 使用自定义快捷键
  if (event.key === spellingKeys.playAudio) {
    event.preventDefault()
    handlePlayAudio()
    return // 不记录快捷键事件
  } else if (event.key === spellingKeys.forgot) {
    event.preventDefault()
    handleForgot()
    return // 不记录快捷键事件
  }

  // 下面是普通输入键的处理（非快捷键）
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
}

// 阻止移动端输入框聚焦时弹出键盘
const handleInputFocus = (event: FocusEvent) => {
  if (isMobile.value) {
    (event.target as HTMLInputElement).blur()
  }
}

// 虚拟键盘按键处理
const handleVirtualKey = (key: string) => {
  if (isSubmitting.value) return

  // 模拟KeyEvent结构记录虚拟按键
  const virtualKeyEvent: KeyEvent = {
    timestamp: Date.now() - startTime.value,
    key: key,
    code: `Key${key.toUpperCase()}`,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    inputValue: userInput.value + key
  }
  keyEvents.value.push(virtualKeyEvent)

  // 结束退格序列（开始正常输入）
  finishBackspaceSequence()

  // 更新输入值
  userInput.value += key
}

// 虚拟键盘退格键处理
const handleVirtualBackspace = () => {
  if (isSubmitting.value || userInput.value.length === 0) return

  const cursorPos = userInput.value.length

  // 记录退格事件
  const virtualKeyEvent: KeyEvent = {
    timestamp: Date.now() - startTime.value,
    key: 'Backspace',
    code: 'Backspace',
    metaKey: false,
    altKey: false,
    shiftKey: false,
    inputValue: userInput.value.slice(0, -1)
  }
  keyEvents.value.push(virtualKeyEvent)

  // 处理退格序列
  if (!currentBackspaceSequence.value) {
    currentBackspaceSequence.value = {
      startPos: cursorPos,
      deletedChars: 0,
      timestamp: Date.now() - startTime.value
    }
  }
  currentBackspaceSequence.value.deletedChars++

  // 更新输入值
  userInput.value = userInput.value.slice(0, -1)
}

// 虚拟键盘回车键处理
const handleVirtualEnter = () => {
  if (canProceed.value && !isSubmitting.value) {
    handleNext()
  }
}


const calculateInputAnalysis = (): DetailedSpellingData['inputAnalysis'] => {
  const totalTime = keyEvents.value.length > 1
    ? keyEvents.value[keyEvents.value.length - 1].timestamp - keyEvents.value[0].timestamp
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

    // 不需要手动 resetState()，watch 会在单词变化时自动调用
    // 不需要手动播放音频，watch 会在单词变化时自动播放
  } catch (error) {
    log.error('Submit spelling result failed:', error)
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
    audioRequestCount: 0
  }
  backspaceSequences.value = []
  currentBackspaceSequence.value = null
}

// 监听单词变化，自动重置状态和播放音频
watch(() => props.word, (newWord, oldWord) => {
  if (newWord && newWord !== oldWord) {
    // 重置状态
    resetState()

    // 播放新单词音频（非阻塞）
    playWordAudio(newWord.word, audioAccent.value)

    // 聚焦输入框
    if (!isMobile.value) {
      setTimeout(() => inputRef.value?.focus(), 50)
    }
  }
})

onMounted(async () => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  await Promise.all([
        loadAudioAccent(),
        loadHotkeys()
    ])

  resetState()
  await nextTick()
  playWordAudio(props.word.word, audioAccent.value)
  if (!isMobile.value) {
    setTimeout(() => inputRef.value?.focus(), 50)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', checkMobile)
})

</script>

<style scoped>
.definition-container {
  position: fixed;
  top: calc(48px + 1.5rem); /* TopBar 高度 + 间距 */
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 2rem);
  max-width: 600px;
  min-height: auto;
  max-height: calc(100vh - 48px - 2 * 3.5rem - 0.75rem - 2rem - 1rem - 4rem - 3rem); /* 屏幕高度 - TopBar - 按钮栏 - 输入框 - 间距 */
  overflow-y: auto;
  font-weight: 600;
  font-size: 1.3em;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
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
  border-radius: var(--radius-default);
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
  border-radius: var(--radius-default);
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
  background-color: var(--color-primary);
  color: white;
}

.play-btn:hover:not(:disabled):not(.hidden) {
  background-color: var(--color-primary-hover);
}

.forgot-btn {
  background-color: #a855f7;
  color: white;
}

.forgot-btn:hover:not(:disabled):not(.hidden) {
  background-color: #9333ea;
}

.next-btn {
  background-color: var(--color-success);
  color: white;
  font-size: 1.1em;
}

.next-btn:hover:not(:disabled):not(.hidden) {
  background-color: var(--color-success-hover);
}

/* 移动端适配 */
@media (max-width: 480px) {
  .word-spelling-container {
    padding-bottom: 2em;
    margin: 1em auto;
  }

  .definition-container {
    position: fixed;
    top: calc(44px + 1rem); /* TopBar 高度 + 间距 */
    bottom: auto;
    left: 50%;
    transform: translateX(-50%);
    width: calc(100% - 2rem);
    max-width: 600px;
    min-height: auto;
    max-height: calc(100vh - 44px - 14rem - 3rem - 2rem); /* 屏幕高度 - TopBar - 键盘高度(4行*3rem+间距) - 输入框 - 间距 */
    overflow-y: auto;
    font-weight: 600;
    font-size: 1.1em;
    padding: 1em;
    z-index: 500;
  }

  .spelling-input-container {
    bottom: calc(14rem + 1rem); /* 键盘高度(4行*3rem+间距+padding) + 间距 */
  }

  .spelling-input {
    font-size: 1.4em;
    padding: 0.6em;
  }
}

@media (max-width: 480px) {
  .definition-container {
    top: calc(48px + 0.75rem); /* TopBar 高度 + 间距 */
    max-height: calc(100vh - 48px - 13rem - 3rem - 1.5rem); /* 屏幕高度 - TopBar - 键盘(4行*2.8rem+间距) - 输入框 - 间距 */
    font-size: 1em;
    padding: 0.75em;
  }

  .spelling-input-container {
    bottom: calc(13rem + 0.75rem); /* 键盘高度(4行*2.8rem+间距+padding) + 间距 */
  }

  .spelling-input {
    font-size: 1.2em;
    padding: 0.5em;
  }

  .word-spelling-container {
    padding-bottom: 2em;
  }
}
</style>