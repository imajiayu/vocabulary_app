<template>
  <div class="spelling-card">
    <!-- 释义展示区 -->
    <div class="definition-area">
      <div class="definition-scroll">
        <div
          v-for="(def, i) in word.definition?.definitions || []"
          :key="i"
          class="definition-item"
          :style="{ animationDelay: `${i * 0.1}s` }"
        >
          <span class="def-number">{{ i + 1 }}</span>
          <span class="def-content">{{ maskEnglish(def) }}</span>
        </div>
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="input-area">
      <div class="input-wrapper" :class="inputStateClass">
        <input
          ref="inputRef"
          v-model="userInput"
          type="text"
          class="spelling-input"
          placeholder="输入单词拼写..."
          autocomplete="off"
          :disabled="isSubmitting"
          :readonly="isMobile"
          @keydown="handleKeydown"
          @focus="handleInputFocus"
        />
        <div class="input-indicator">
          <span v-if="isCorrect" class="indicator-icon correct"><AppIcon name="check" /></span>
          <span v-else-if="userInput && !isCorrect" class="indicator-icon incorrect"><AppIcon name="cross" /></span>
        </div>
      </div>

      <!-- 进度提示 -->
      <div class="input-hint">
        <span v-if="!userInput">听音频，输入正确拼写</span>
        <span v-else-if="isCorrect" class="hint-success">正确！按 Enter 继续</span>
        <span v-else class="hint-progress">{{ userInput.length }} / {{ word.word.length }} 字母</span>
      </div>
    </div>

    <!-- 移动端键盘 -->
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
      @reset="handleResetInput"
    />

    <!-- 桌面端操作栏 -->
    <div v-if="!isMobile" class="action-bar">
      <div class="action-bar-layout">
        <div class="action-group">
          <button
            class="action-btn play"
            :disabled="isSubmitting"
            @click="handlePlayAudio"
          >
            <AppIcon name="volume" class="btn-icon-svg" />
            <span class="btn-label">播放</span>
            <KeyHint
              :key-value="hotkeys.spelling.playAudio"
              variant="light"
              class="btn-key-hint"
            />
          </button>

          <button
            class="action-btn reveal"
            :disabled="isCorrect || isSubmitting"
            @click="handleForgot"
          >
            <AppIcon name="eye" class="btn-icon-svg" />
            <span class="btn-label">提示</span>
            <KeyHint
              :key-value="hotkeys.spelling.forgot"
              variant="warning"
              class="btn-key-hint"
            />
          </button>

          <button
            class="action-btn next"
            :class="{ 'ready': canProceed }"
            :disabled="!canProceed || isSubmitting"
            @click="handleNext"
          >
            <span class="btn-icon-arrow">→</span>
            <span class="btn-label">下一个</span>
            <KeyHint
              :key-value="hotkeys.spelling.next"
              :variant="canProceed ? 'success' : 'default'"
              class="btn-key-hint"
            />
          </button>
        </div>

        <div class="secondary-actions">
          <button
            class="action-btn-sm reset-input"
            :disabled="isSubmitting"
            @click="handleResetInput"
            title="重置输入"
          >
            <span class="btn-sm-icon">↻</span>
            <span class="btn-sm-label">重置输入</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import type { AudioType } from '@/features/vocabulary/stores/review'
import type { Word, SpellingData, SpellingKeyEvent, BackspaceSequence } from '@/shared/types'
import SpellingKeyboard from './SpellingKeyboard.vue'
import AppIcon from '@/shared/components/controls/Icons.vue'
import KeyHint from '@/shared/components/controls/KeyHint.vue'
import { playWordAudio, stopWordAudio } from '@/shared/utils/playWordAudio'
import { useHotkeys } from '@/shared/composables/useHotkeys'
import { useAudioAccent } from '@/shared/composables/useAudioAccent'
import { logger } from '@/shared/utils/logger'

const log = logger.create('Spelling')

// 移动端检测（快捷键提示只在桌面端显示）
const isMobile = ref(false)
const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768
}

interface Props {
  word: Word
  audioType: AudioType
  onResult: (result: {
    remembered: boolean
    spellingData: SpellingData
  }) => Promise<void>
}

const props = defineProps<Props>()

const { hotkeys, loadHotkeys } = useHotkeys()

const inputRef = ref<HTMLInputElement>()
const userInput = ref('')
const forgotClicked = ref(false)
const isSubmitting = ref(false)

// 详细输入数据
const startTime = ref<number>(0)
const keyEvents = ref<SpellingKeyEvent[]>([])
const interactions = ref({ audioRequestCount: 0 })
const backspaceSequences = ref<BackspaceSequence[]>([])
const currentBackspaceSequence = ref<BackspaceSequence | null>(null)

// 拼写模式下遮蔽释义中与目标单词相似的英文，防止提示拼写
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= n; j++) {
      const temp = dp[j]
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1])
      prev = temp
    }
  }
  return dp[n]
}

function shouldMask(defWord: string, target: string): boolean {
  const w = defWord.toLowerCase()
  const t = target.toLowerCase()
  if (w.length <= 2) return false
  if (w === t) return true
  // 前缀/后缀匹配（词形变化：run→running, organize→organized, un+happy）
  if (t.startsWith(w) || t.endsWith(w) || w.startsWith(t) || w.endsWith(t)) return true
  // 共同前缀 ≥ 4（共享词干：beauty/beautiful, happy/happiness）
  let prefix = 0
  for (let i = 0; i < Math.min(w.length, t.length); i++) {
    if (w[i] === t[i]) prefix++
    else break
  }
  if (prefix >= 4) return true
  // 编辑距离比 ≤ 0.3（英美拼写差异：organise/organize, colour/color）
  if (w.length >= 4 && t.length >= 4) {
    if (levenshtein(w, t) / Math.max(w.length, t.length) <= 0.3) return true
  }
  return false
}

const maskEnglish = (text: string) =>
  text.replace(/[a-zA-Z]+/g, (match) =>
    shouldMask(match, props.word.word) ? '*'.repeat(match.length) : match
  )

const isCorrect = computed(() => userInput.value.trim().toLowerCase() === props.word.word.toLowerCase())
const canProceed = computed(() => isCorrect.value)

const inputStateClass = computed(() => {
  if (!userInput.value) return ''
  return isCorrect.value ? 'correct' : 'incorrect'
})

const { audioAccent, loadAudioAccent } = useAudioAccent()

const handlePlayAudio = async () => {
  if (isSubmitting.value) return
  interactions.value.audioRequestCount++
  playWordAudio(props.word.word, audioAccent.value)
  await nextTick()
  inputRef.value?.focus()
}

const handleForgot = async () => {
  if (isCorrect.value || isSubmitting.value) return
  forgotClicked.value = true
  userInput.value = props.word.word
  await nextTick()
  inputRef.value?.focus()
}

const recordKeyEvent = (event: KeyboardEvent) => {
  const timestamp = Date.now() - startTime.value
  const keyEvent: SpellingKeyEvent = {
    timestamp,
    key: event.key,
    code: event.code,
    metaKey: event.metaKey,
    ctrlKey: event.ctrlKey,
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

  if (isMobile.value) {
    event.preventDefault()
    return
  }

  const spellingKeys = hotkeys.value.spelling

  if (event.key === spellingKeys.next) {
    if (canProceed.value) {
      event.preventDefault()
      handleNext()
    }
    return
  }

  if (event.key === spellingKeys.playAudio) {
    event.preventDefault()
    handlePlayAudio()
    return
  } else if (event.key === spellingKeys.forgot) {
    event.preventDefault()
    handleForgot()
    return
  }

  recordKeyEvent(event)

  if (!['ArrowLeft', 'ArrowRight', 'Tab', 'Shift', 'Control', 'Alt', 'Meta', 'Escape', 'Backspace'].includes(event.key)) {
    finishBackspaceSequence()
  }

  if (event.key === 'Backspace') {
    handleBackspace(event)
  } else {
    finishBackspaceSequence()
  }
}

const handleInputFocus = (event: FocusEvent) => {
  if (isMobile.value) {
    (event.target as HTMLInputElement).blur()
  }
}

// 虚拟键盘处理
const handleVirtualKey = (key: string) => {
  if (isSubmitting.value) return

  const virtualKeyEvent: SpellingKeyEvent = {
    timestamp: Date.now() - startTime.value,
    key: key,
    code: `Key${key.toUpperCase()}`,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    inputValue: userInput.value + key
  }
  keyEvents.value.push(virtualKeyEvent)
  finishBackspaceSequence()
  userInput.value += key
}

const handleVirtualBackspace = () => {
  if (isSubmitting.value || userInput.value.length === 0) return

  const cursorPos = userInput.value.length

  const virtualKeyEvent: SpellingKeyEvent = {
    timestamp: Date.now() - startTime.value,
    key: 'Backspace',
    code: 'Backspace',
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    inputValue: userInput.value.slice(0, -1)
  }
  keyEvents.value.push(virtualKeyEvent)

  if (!currentBackspaceSequence.value) {
    currentBackspaceSequence.value = {
      startPos: cursorPos,
      deletedChars: 0,
      timestamp: Date.now() - startTime.value
    }
  }
  currentBackspaceSequence.value.deletedChars++
  userInput.value = userInput.value.slice(0, -1)
}

const handleVirtualEnter = () => {
  if (canProceed.value && !isSubmitting.value) {
    handleNext()
  }
}

const calculateInputAnalysis = (): SpellingData['inputAnalysis'] => {
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
    finishBackspaceSequence()

    const remembered = !forgotClicked.value && isCorrect.value

    const spellingData: SpellingData = {
      keyEvents: [...keyEvents.value],
      interactions: { ...interactions.value },
      inputAnalysis: calculateInputAnalysis()
    }

    await props.onResult({ remembered, spellingData })
  } catch (error) {
    log.error('Submit spelling result failed:', error)
  } finally {
    isSubmitting.value = false
  }
}

const resetState = () => {
  userInput.value = ''
  forgotClicked.value = false
  startTime.value = Date.now()
  keyEvents.value = []
  interactions.value = { audioRequestCount: 0 }
  backspaceSequences.value = []
  currentBackspaceSequence.value = null
}

const handleResetInput = () => {
  resetState()
  if (!isMobile.value) {
    inputRef.value?.focus()
  }
}

watch(() => props.word, (newWord, oldWord) => {
  if (newWord && newWord !== oldWord) {
    resetState()
    playWordAudio(newWord.word, audioAccent.value)
    if (!isMobile.value) {
      setTimeout(() => inputRef.value?.focus(), 50)
    }
  }
})

onMounted(async () => {
  checkMobile()
  window.addEventListener('resize', checkMobile)
  await Promise.all([loadAudioAccent(), loadHotkeys()])
  resetState()
  await nextTick()
  playWordAudio(props.word.word, audioAccent.value)
  if (!isMobile.value) {
    setTimeout(() => inputRef.value?.focus(), 50)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', checkMobile)
  stopWordAudio()
})
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   Neo-Editorial Spelling Card - 沉浸式拼写练习
   ═══════════════════════════════════════════════════════════════════════════ */

.spelling-card {
  display: flex;
  flex-direction: column;
  flex: 1;
  max-width: 700px;
  width: 100%;
  margin: 0 auto;
  padding: 0 1.5rem;
}

/* ── 释义展示区 ── */
.definition-area {
  display: flex;
  flex-direction: column;
  padding-top: 1.5rem;
  padding-bottom: 0.5rem;
}

.definition-scroll {
  /* 桌面端不限制高度，自然撑开 */
}

.definition-item {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  margin-bottom: 1rem;
  background: var(--color-bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  border-left: 4px solid var(--color-primary);
  animation: slideInFromLeft 0.4s cubic-bezier(0.22, 1, 0.36, 1) backwards;
}

.definition-item:last-child {
  margin-bottom: 0;
}

.def-number {
  flex-shrink: 0;
  width: 1.75rem;
  height: 1.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gradient-primary);
  color: white;
  font-family: var(--font-ui);
  font-size: 0.8rem;
  font-weight: 700;
  border-radius: var(--radius-full);
}

.def-content {
  font-family: var(--font-body);
  font-size: 1.1rem;
  line-height: 1.7;
  color: var(--color-text-primary);
}

/* ── 输入区域 ── */
.input-area {
  flex-shrink: 0;
  padding: 1rem 0;
  padding-bottom: calc(var(--button-bar-height) + 1rem);
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  background: var(--color-bg-primary);
  border-radius: var(--radius-xl);
  border: 2px solid var(--color-border-medium);
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  box-shadow: var(--shadow-sm);
}

.input-wrapper:focus-within {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 4px var(--color-primary-light);
}

.input-wrapper.correct {
  border-color: var(--color-success);
  box-shadow: 0 0 0 4px var(--color-success-light);
}

.input-wrapper.incorrect {
  border-color: var(--color-danger);
  box-shadow: 0 0 0 4px var(--color-danger-light);
}

.spelling-input {
  flex: 1;
  font-family: var(--font-serif);
  font-size: 1.75rem;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-align: center;
  padding: 1rem 1.5rem;
  border: none;
  background: transparent;
  color: var(--color-text-primary);
  outline: none;
}

.spelling-input::placeholder {
  color: var(--color-text-muted);
  font-weight: 400;
  letter-spacing: 0;
}

.spelling-input:disabled {
  background: var(--color-bg-tertiary);
  cursor: not-allowed;
}

.input-indicator {
  position: absolute;
  right: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.indicator-icon {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  animation: popIn 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}

.indicator-icon .icon {
  width: 16px;
  height: 16px;
}

.indicator-icon.correct {
  background: var(--color-success);
  color: white;
}

.indicator-icon.incorrect {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

.input-hint {
  text-align: center;
  margin-top: 0.75rem;
  font-family: var(--font-ui);
  font-size: 0.875rem;
  color: var(--color-text-tertiary);
  transition: color 0.2s ease;
}

.input-hint .hint-success {
  color: var(--color-success);
  font-weight: 600;
}

.input-hint .hint-progress {
  color: var(--color-text-secondary);
}

/* ── 桌面端操作栏 ── */
.action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 1.25rem 1rem;
  padding-bottom: calc(1.25rem + env(safe-area-inset-bottom));
  background: linear-gradient(to top, var(--color-bg-page) 80%, transparent);
  z-index: 100;
}

.action-bar-layout {
  display: flex;
  align-items: stretch;
  gap: 0.5rem;
  max-width: 600px;
  margin: 0 auto;
}

.action-group {
  display: flex;
  justify-content: center;
  gap: 1rem;
  flex: 1;
  min-width: 0;
}

/* ── 辅助按钮区 ── */
.secondary-actions {
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex-shrink: 0;
}

.action-btn-sm {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.65rem;
  border: none;
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: var(--font-ui);
  background: var(--color-bg-tertiary);
  color: var(--color-text-tertiary);
  touch-action: manipulation;
}

.action-btn-sm:hover {
  background: var(--color-bg-glass-hover);
  color: var(--color-text-secondary);
}

.action-btn-sm:active {
  transform: scale(0.95);
}

.action-btn-sm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-sm-icon {
  display: inline-flex;
  align-items: center;
}

.btn-sm-label {
  font-size: 0.65rem;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.875rem 2rem;
  min-width: 100px;
  border: none;
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.22, 1, 0.36, 1);
  font-family: var(--font-ui);
  position: relative;
  flex: 1;
  touch-action: manipulation;
}

.action-btn:active {
  transform: scale(0.96);
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
}

.btn-icon-svg {
  width: 1.5rem;
  height: 1.5rem;
  fill: currentColor;
}

.btn-icon-arrow {
  font-size: 1.5rem;
  line-height: 1;
}

.btn-label {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

/* ── 快捷键提示 ── */
.btn-key-hint {
  position: absolute;
  bottom: 0.35rem;
  right: 0.35rem;
  font-size: 1rem;
  opacity: 0.6;
  transition: opacity 0.15s ease;
}

.action-btn:hover .btn-key-hint {
  opacity: 1;
}

/* 播放按钮 */
.action-btn.play {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.action-btn.play:hover {
  background: var(--color-primary);
  color: white;
}

/* 提示按钮 */
.action-btn.reveal {
  background: var(--color-warning-light);
  color: var(--color-warning);
}

.action-btn.reveal:hover:not(:disabled) {
  background: var(--color-warning);
  color: white;
}

/* 下一个按钮 */
.action-btn.next {
  background: var(--color-bg-tertiary);
  color: var(--color-text-tertiary);
}

.action-btn.next.ready {
  background: var(--color-success);
  color: white;
  animation: pulse 2s infinite;
}

.action-btn.next.ready:hover {
  animation: none;
  background: var(--color-success-hover);
}

/* ══════════════════════════════════════════════════════════════════════════
   动画
   ══════════════════════════════════════════════════════════════════════════ */

@keyframes slideInFromLeft {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes popIn {
  0% {
    opacity: 0;
    transform: scale(0.5);
  }
  70% {
    transform: scale(1.1);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(93, 122, 93, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(93, 122, 93, 0);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   移动端适配
   ══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .spelling-card {
    padding: 0 1rem;
  }

  .definition-area {
    padding-top: 1rem;
    padding-bottom: 0.5rem;
  }

  .definition-item {
    padding: 0.875rem 1rem;
    gap: 0.75rem;
  }

  .def-number {
    width: 1.5rem;
    height: 1.5rem;
    font-size: 0.7rem;
  }

  .def-content {
    font-size: 0.95rem;
    line-height: 1.5;
  }

  .input-area {
    padding: 1rem 0;
    padding-bottom: calc(13rem + 1rem);
  }

  .spelling-input {
    font-size: 1.3rem;
    padding: 0.75rem 1rem;
  }

  .indicator-icon {
    width: 1.5rem;
    height: 1.5rem;
  }

  .indicator-icon .icon {
    width: 12px;
    height: 12px;
  }

  .input-hint {
    font-size: 0.75rem;
    margin-top: 0.5rem;
  }

  .input-wrapper {
    border-radius: var(--radius-lg);
  }

  .secondary-actions {
    display: none;
  }
}

/* 横屏适配 */
@media (max-height: 500px) and (orientation: landscape) {
  .definition-area {
    padding-top: 0.5rem;
    padding-bottom: 0.25rem;
  }

  .definition-item {
    padding: 0.5rem 0.75rem;
    margin-bottom: 0.375rem;
  }

  .def-content {
    font-size: 0.85rem;
    line-height: 1.4;
  }

  .input-area {
    padding: 0.5rem 0;
    padding-bottom: 75px;
  }

  .spelling-input {
    font-size: 1.1rem;
    padding: 0.4rem 0.625rem;
  }

  .action-bar {
    padding: 0.5rem;
  }

  .action-btn {
    padding: 0.4rem 1rem;
    flex-direction: row;
    gap: 0.4rem;
  }

  .btn-icon {
    font-size: 1rem;
  }

  .btn-label {
    font-size: 0.7rem;
  }
}
</style>
