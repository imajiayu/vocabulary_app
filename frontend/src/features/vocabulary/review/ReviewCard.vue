<template>
  <div class="review-card" :class="{ 'revealed': showDefinition }">
    <!-- 卡片主体 -->
    <div class="card-body">
      <!-- 单词展示区域 - 使用动态定位实现平滑过渡 -->
      <div class="word-presenter" :class="{ 'to-header': showDefinition }">
        <span class="word-text" @click="playAudio">{{ word.word }}</span>
        <div class="word-hint" :class="{ 'hidden': showDefinition }">点击播放发音</div>
      </div>

      <!-- 阶段二：显示完整内容 -->
      <Transition name="reveal" :css="false" @enter="onRevealEnter" @leave="onRevealLeave">
        <div v-if="showDefinition" class="content-stage">
          <!-- 音标区域 -->
          <div class="phonetics-bar">
            <div v-if="displayWord.definition?.phonetic" class="phonetics">
              <span
                v-if="displayWord.definition.phonetic.us"
                class="phonetic-tag"
                @click="playWordAudio(displayWord.word, 'us')"
              >
                <span class="accent">US</span>
                <span class="ipa">{{ displayWord.definition.phonetic.us }}</span>
              </span>
              <span
                v-if="displayWord.definition.phonetic.uk"
                class="phonetic-tag"
                @click="playWordAudio(displayWord.word, 'uk')"
              >
                <span class="accent">UK</span>
                <span class="ipa">{{ displayWord.definition.phonetic.uk }}</span>
              </span>
            </div>
            <!-- 装饰线 -->
            <div class="divider-line"></div>
          </div>

          <!-- 释义列表 -->
          <div class="definitions-section">
            <div
              v-for="(def, i) in displayWord.definition?.definitions || []"
              :key="i"
              class="definition-card"
              :style="{ '--stagger-index': i }"
            >
              <span class="def-marker">{{ i + 1 }}</span>
              <span class="def-text">{{ def }}</span>
            </div>
          </div>

          <!-- 例句 -->
          <div v-if="displayWord.definition?.examples?.length" class="examples-section">
            <div class="section-label">例句</div>
            <div
              v-for="(ex, i) in displayWord.definition.examples"
              :key="i"
              class="example-card"
              :style="{ '--stagger-index': (displayWord.definition?.definitions?.length || 0) + i }"
            >
              <div class="example-en" v-html="ex.en"></div>
              <div class="example-zh">{{ ex.zh }}</div>
            </div>
          </div>

          <!-- 相关词汇 -->
          <RelatedWordsPanel
            v-if="displayWord.related_words?.length"
            :relatedWords="displayWord.related_words"
            class="related-section"
          />
        </div>
      </Transition>
    </div>

    <!-- 底部操作栏 -->
    <div class="action-bar">
      <Transition name="action-switch" mode="out-in">
        <!-- 阶段一按钮 -->
        <div v-if="!showDefinition" class="action-stage stage-initial" key="initial">
          <!-- 主按钮：没记住 + 记住了 -->
          <div class="primary-actions">
            <button
              class="action-btn forgot"
              :disabled="isSubmitting"
              @click="handleChoice('no')"
            >
              <span class="btn-icon"><AppIcon name="cross" /></span>
              <span class="btn-label">没记住</span>
              <KeyHint
                v-if="!isMobile"
                :key-value="hotkeys.reviewInitial.notRemembered"
                variant="danger"
                class="btn-key-hint"
              />
            </button>

            <button
              class="action-btn remembered"
              :disabled="isSubmitting"
              @click="handleChoice('yes')"
            >
              <span class="btn-icon"><AppIcon name="check" /></span>
              <span class="btn-label">记住了</span>
              <KeyHint
                v-if="!isMobile"
                :key-value="hotkeys.reviewInitial.remembered"
                variant="success"
                class="btn-key-hint"
              />
            </button>
          </div>

          <!-- 辅助按钮：右侧竖排 -->
          <div v-if="!isLapseMode" class="secondary-actions">
            <button
              class="action-btn-sm skip"
              :disabled="isSubmitting"
              @click="handleChoice('stop')"
            >
              <span class="btn-sm-icon"><AppIcon name="stop-circle" /></span>
              <span class="btn-sm-label">不再复习</span>
              <KeyHint
                v-if="!isMobile"
                :key-value="hotkeys.reviewInitial.stopReview"
                variant="default"
                class="btn-key-hint-sm"
              />
            </button>

            <button
              class="action-btn-sm timer-reset"
              @click="handleResetTimer"
              title="重置计时器"
            >
              <span class="btn-sm-icon">↻</span>
              <span class="btn-sm-label">重置计时器</span>
              <KeyHint
                v-if="!isMobile && hotkeys.reviewInitial.resetTimer"
                :key-value="hotkeys.reviewInitial.resetTimer"
                variant="default"
                class="btn-key-hint-sm"
              />
            </button>
          </div>
        </div>

        <!-- 阶段二按钮 -->
        <div v-else class="action-stage stage-confirmed" key="confirmed">
          <div class="primary-actions">
            <button
              v-if="pendingChoice === 'yes'"
              class="action-btn correction"
              :disabled="isSubmitting"
              @click="handleCorrection"
            >
              <span class="btn-icon">↩︎</span>
              <span class="btn-label">记错了</span>
              <KeyHint
                v-if="!isMobile"
                :key-value="hotkeys.reviewAfter.wrong"
                variant="warning"
                class="btn-key-hint"
              />
            </button>

            <button
              class="action-btn next"
              :class="{
                'next-success': pendingChoice === 'yes',
                'next-error': pendingChoice === 'no',
                'next-full': pendingChoice === 'no'
              }"
              :disabled="isSubmitting"
              @click="handleNext"
            >
              <span class="btn-icon">→</span>
              <span class="btn-label">下一个</span>
              <KeyHint
                v-if="!isMobile"
                :key-value="hotkeys.reviewAfter.next"
                :variant="pendingChoice === 'yes' ? 'success' : pendingChoice === 'no' ? 'danger' : 'default'"
                class="btn-key-hint"
              />
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useBreakpoint } from '@/shared/composables/useBreakpoint'
import type { AudioType } from '@/features/vocabulary/stores/review'
import { Word } from '@/shared/types'
import RelatedWordsPanel from '@/features/vocabulary/relations/RelatedWordsPanel.vue'
import KeyHint from '@/shared/components/controls/KeyHint.vue'
import AppIcon from '@/shared/components/controls/Icons.vue'
import { playWordAudio, stopWordAudio } from '@/shared/utils/playWordAudio'
import { useAudioAccent } from '@/shared/composables/useAudioAccent'
import { useHotkeys } from '@/shared/composables/useHotkeys'
import { useKeyboardManager } from '@/shared/composables/useKeyboardManager'
import { useReviewStore } from '@/features/vocabulary/stores/review'
import { useTimer } from '@/shared/composables/useTimer'
import { useTimerPause } from '@/shared/composables/useTimerPause'
import { reviewLogger as log } from '@/shared/utils/logger'

interface Props {
  word: Word
  audioType: AudioType
  onResult: (result: { remembered: boolean; elapsedTime: number }) => Promise<void>
  onSkip: () => Promise<void>
}

interface Emits {
  (e: 'result', result: { remembered: boolean; elapsedTime: number }): void
  (e: 'skip'): void
  (e: 'audioTypeChange', type: AudioType): void
}

const props = defineProps<Props>()
defineEmits<Emits>()

// 状态
const showDefinition = ref(false)
const pendingChoice = ref<string | null>(null)
const isSubmitting = ref(false)

// 移动端检测（快捷键提示只在桌面端显示）
const { isMobile } = useBreakpoint()

// 缓存用于显示释义的单词数据（避免 Transition leave 动画期间内容跳变）
const displayWord = ref<Word>(props.word)

// 延迟播放的定时器 ID（用于取消）
let autoPlayTimer: ReturnType<typeof setTimeout> | null = null

// 使用计时器
const timer = useTimer()

// 使用全局计时器暂停管理
const { pauseCount } = useTimerPause()

// 使用全局音频设置
const { audioAccent, autoPlayOnWordChange, autoPlayAfterAnswer, loadAudioAccent } = useAudioAccent()

// 使用全局快捷键设置
const { hotkeys, loadHotkeys } = useHotkeys()

// 使用全局键盘管理器
const { setContext, registerKeys, cleanup } = useKeyboardManager()

// 获取当前复习模式
const reviewStore = useReviewStore()
const isLapseMode = computed(() => reviewStore.mode === 'mode_lapse')

// 播放音频
const playAudio = () => {
  playWordAudio(props.word.word, audioAccent.value)
}

// 监听全局暂停状态
watch(pauseCount, (newCount, oldCount) => {
  if (newCount > 0 && oldCount === 0) {
    if (timer.isRunning.value) {
      timer.pause()
    }
  } else if (newCount === 0 && oldCount > 0) {
    if (!timer.isRunning.value && !showDefinition.value) {
      timer.resume()
    }
  }
})

const handleChoice = (choice: string) => {
  if (isSubmitting.value) return

  timer.pause()
  pendingChoice.value = choice
  // 锁定当前单词数据，避免 leave 动画期间内容跳变
  displayWord.value = props.word
  showDefinition.value = true

  if (autoPlayAfterAnswer.value) {
    if (autoPlayTimer) clearTimeout(autoPlayTimer)
    autoPlayTimer = setTimeout(() => {
      autoPlayTimer = null
      playAudio()
    }, 0)
  }
}

const handleCorrection = async () => {
  if (isSubmitting.value) return
  await submitResult(false, true)
}

const handleNext = async () => {
  if (isSubmitting.value) return
  const unRemembered = pendingChoice.value === 'no'
  await submitResult(!unRemembered, false)
}

const handleSkip = async () => {
  try {
    await props.onSkip()
  } catch (error) {
    log.error('Skip failed:', error)
  }
}

const handleResetTimer = () => {
  timer.reset()
  timer.start()
}

const submitResult = async (remembered: boolean, forceResult: boolean = false) => {
  if (isSubmitting.value) return

  isSubmitting.value = true
  try {
    const elapsedTime = timer.readAndReset(10.0)
    const isStop = pendingChoice.value === 'stop'

    // 先隐藏释义，避免新单词到来时旧释义闪现
    showDefinition.value = false
    pendingChoice.value = null

    if (forceResult || !isStop) {
      await props.onResult({ remembered, elapsedTime })
    } else {
      await handleSkip()
    }
  } catch (error) {
    log.error('Submit result failed:', error)
  } finally {
    isSubmitting.value = false
  }
}

// 键盘快捷键
const setupKeyboardShortcuts = () => {
  cleanup()

  if (!showDefinition.value) {
    setContext('review-initial')
    const initialKeys = hotkeys.value.reviewInitial
    const keys: Record<string, () => void> = {}
    if (initialKeys.remembered) keys[initialKeys.remembered] = () => handleChoice('yes')
    if (initialKeys.notRemembered) keys[initialKeys.notRemembered] = () => handleChoice('no')
    if (!isLapseMode.value) {
      if (initialKeys.stopReview) keys[initialKeys.stopReview] = () => handleChoice('stop')
      if (initialKeys.resetTimer) keys[initialKeys.resetTimer] = () => handleResetTimer()
    }
    registerKeys(keys)
  } else {
    setContext('review-after')
    const afterKeys = hotkeys.value.reviewAfter
    const keys: Record<string, () => void | Promise<void>> = {}
    if (afterKeys.next) keys[afterKeys.next] = async () => await handleNext()
    // 只在选择「记住了」时才注册「记错了」快捷键
    if (pendingChoice.value === 'yes' && afterKeys.wrong) {
      keys[afterKeys.wrong] = async () => await handleCorrection()
    }
    registerKeys(keys)
  }
}

watch(showDefinition, () => {
  setupKeyboardShortcuts()
}, { flush: 'post' })

// Transition 钩子：enter 有精心编排的动画，leave 立即完成
const onRevealEnter = (el: Element, done: () => void) => {
  const htmlEl = el as HTMLElement
  // 移动端使用更短的动画时间
  const duration = isMobile.value ? '0.3s' : '0.6s'
  htmlEl.style.animation = `contentReveal ${duration} cubic-bezier(0.22, 1, 0.36, 1) forwards`
  htmlEl.addEventListener('animationend', done, { once: true })
}

const onRevealLeave = (_el: Element, done: () => void) => {
  // 立即完成，不要 leave 动画
  done()
}

// 监听单词变化
watch(() => props.word?.id, (newWordId, oldWordId) => {
  if (newWordId && newWordId !== oldWordId) {
    // 取消前一个单词的延迟播放
    if (autoPlayTimer) {
      clearTimeout(autoPlayTimer)
      autoPlayTimer = null
    }

    showDefinition.value = false
    pendingChoice.value = null
    // 注意：不在这里更新 displayWord，等 @after-leave 动画完成后再更新
    // 这样可以避免 leave 动画期间内容跳变
    timer.reset()
    timer.start()

    if (autoPlayOnWordChange.value && props.word) {
      playWordAudio(props.word.word, audioAccent.value)
    }
  }
}, { immediate: false })

onMounted(async () => {
  await Promise.all([loadAudioAccent(), loadHotkeys()])
  setupKeyboardShortcuts()
  timer.start()

  if (props.word && autoPlayOnWordChange.value) {
    playWordAudio(props.word.word, audioAccent.value)
  }
})

onBeforeUnmount(() => {
  if (autoPlayTimer) {
    clearTimeout(autoPlayTimer)
    autoPlayTimer = null
  }
  stopWordAudio()
})
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   Neo-Editorial Flash Card - 沉浸式复习卡片
   ═══════════════════════════════════════════════════════════════════════════ */

.review-card {
  display: flex;
  flex-direction: column;
  flex: 1;
  max-width: 800px;
  width: 100%;
  margin: 0 auto;
  padding: 0 1.5rem;
}

/* ── 卡片主体 ── */
.card-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  padding-top: 2rem;
  padding-bottom: calc(var(--button-bar-height) + 1.5rem);
  position: relative;
}

/* ══════════════════════════════════════════════════════════════════════════
   单词展示器 - 聚光灯式过渡
   从舞台中央平滑移动到页眉位置
   ══════════════════════════════════════════════════════════════════════════ */

.word-presenter {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  /* 初始状态：垂直居中在可视区域 */
  min-height: 180px;
  justify-content: center;
  /* 平滑过渡所有属性 */
  transition:
    min-height 0.5s cubic-bezier(0.22, 1, 0.36, 1),
    margin-bottom 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}

.word-presenter.to-header {
  /* 过渡后：收缩到页眉 */
  min-height: auto;
  margin-bottom: 0.75rem;
}

.word-text {
  font-family: var(--font-serif);
  font-weight: 600;
  color: var(--color-text-primary);
  letter-spacing: -0.02em;
  cursor: pointer;
  text-align: center;
  line-height: 1.2;
  /* 字体大小平滑过渡 */
  font-size: clamp(2.5rem, 8vw, 4.5rem);
  transition:
    font-size 0.5s cubic-bezier(0.22, 1, 0.36, 1),
    color 0.5s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.2s ease;
}

.word-presenter.to-header .word-text {
  /* 过渡后：缩小为页眉大小，变为主题色 */
  font-size: clamp(1.75rem, 5vw, 2.5rem);
  color: var(--color-primary);
}

.word-text:hover {
  transform: scale(1.02);
}

.word-text:active {
  transform: scale(0.98);
}

.word-hint {
  margin-top: 1rem;
  font-family: var(--font-ui);
  font-size: 0.875rem;
  color: var(--color-text-tertiary);
  opacity: 0;
  animation: hintFadeIn 0.6s ease 0.5s forwards;
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.word-hint.hidden {
  opacity: 0 !important;
  transform: translateY(-8px);
  animation: none;
}

/* ══════════════════════════════════════════════════════════════════════════
   内容展示阶段 - 墨水晕染展开
   ══════════════════════════════════════════════════════════════════════════ */

.content-stage {
  /* enter 动画由 JS 钩子控制 */
  transform-origin: top center;
  /* 硬件加速 */
  will-change: transform, opacity;
  transform: translateZ(0);
}

/* 音标栏 - 作为单词和释义之间的过渡 */
.phonetics-bar {
  text-align: center;
  margin-bottom: 1.75rem;
}

.phonetics {
  display: flex;
  justify-content: center;
  gap: 1rem;
  flex-wrap: wrap;
  animation: phoneticsReveal 0.4s cubic-bezier(0.22, 1, 0.36, 1) 0.15s backwards;
}

/* 装饰分隔线 - 墨水扩散效果 */
.divider-line {
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--color-border-light) 15%,
    var(--color-primary) 50%,
    var(--color-border-light) 85%,
    transparent 100%
  );
  margin-top: 1.25rem;
  transform: scaleX(0);
  animation: lineExpand 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.25s forwards;
}

.phonetic-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid var(--color-border-light);
}

.phonetic-tag:hover {
  background: var(--color-bg-tertiary);
  transform: translateY(-1px);
}

.phonetic-tag .accent {
  font-family: var(--font-ui);
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.phonetic-tag .ipa {
  font-family: var(--font-mono);
  font-size: 0.9rem;
  color: var(--color-text-secondary);
}

/* ── 释义区域 ── */
.definitions-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 2rem;
}

.definition-card {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  background: var(--color-bg-primary);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--color-primary);
  box-shadow: var(--shadow-sm);
  /* 交错动画：基于 CSS 变量的延迟 */
  animation: cardSlideIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) backwards;
  animation-delay: calc(0.3s + var(--stagger-index, 0) * 0.07s);
  /* 硬件加速 */
  will-change: transform, opacity;
  transform: translateZ(0);
}

.def-marker {
  flex-shrink: 0;
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--gradient-primary);
  color: white;
  font-family: var(--font-ui);
  font-size: 0.75rem;
  font-weight: 600;
  border-radius: var(--radius-full);
}

.def-text {
  font-family: var(--font-serif);
  font-size: 1rem;
  line-height: 1.6;
  color: var(--color-text-primary);
}

/* ── 例句区域 ── */
.examples-section {
  margin-bottom: 2rem;
}

.section-label {
  font-family: var(--font-ui);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 0.75rem;
}

.example-card {
  padding: 1rem 1.25rem;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  margin-bottom: 0.75rem;
  border-left: 3px solid var(--color-success);
  /* 交错动画：延续释义卡片的节奏 */
  animation: cardSlideIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) backwards;
  animation-delay: calc(0.3s + var(--stagger-index, 0) * 0.07s);
  /* 硬件加速 */
  will-change: transform, opacity;
  transform: translateZ(0);
}

.example-card:last-child {
  margin-bottom: 0;
}

.example-en {
  font-family: var(--font-serif);
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--color-text-primary);
  margin-bottom: 0.5rem;
}

.example-zh {
  font-family: var(--font-serif);
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--color-text-secondary);
  font-style: italic;
}

/* ── 相关词汇 ── */
.related-section {
  padding-top: 1.5rem;
  border-top: 1px solid var(--color-border-light);
}

/* ══════════════════════════════════════════════════════════════════════════
   操作栏 - 分层按钮布局
   ══════════════════════════════════════════════════════════════════════════ */

.action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0.75rem 1rem;
  padding-bottom: calc(0.75rem + env(safe-area-inset-bottom));
  z-index: 100;
  display: flex;
  justify-content: center;
}

.action-stage {
  display: flex;
  align-items: stretch;
  gap: 0.5rem;
  width: 100%;
  max-width: 600px;
}

/* ── 主按钮区 ── */
.primary-actions {
  display: flex;
  justify-content: center;
  gap: 0.75rem;
  flex: 1;
  min-width: 0;
}

/* ── 辅助按钮区：右侧竖排 ── */
.secondary-actions {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.35rem;
  flex-shrink: 0;
}

/* ── 主按钮基础样式 ── */
.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.875rem 1.5rem;
  min-width: 90px;
  border: none;
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.22, 1, 0.36, 1);
  font-family: var(--font-ui);
  position: relative;
  touch-action: manipulation;
}

.action-btn:active {
  transform: scale(0.96);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.btn-icon {
  display: inline-flex;
  align-items: center;
}

.btn-icon .icon {
  width: 24px;
  height: 24px;
}

.btn-label {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

/* ── 辅助小按钮样式 ── */
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
  position: relative;
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

.btn-sm-icon .icon {
  width: 14px;
  height: 14px;
}

.btn-sm-label {
  font-size: 0.65rem;
  font-weight: 500;
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

.btn-key-hint-sm {
  font-size: 0.7rem;
  opacity: 0.5;
  margin-left: 0.15rem;
}

/* ══════════════════════════════════════════════════════════════════════════
   阶段一 - 主操作按钮
   ══════════════════════════════════════════════════════════════════════════ */

/* ── 记住按钮 ── */
.action-btn.remembered {
  background: var(--color-success-light);
  color: var(--color-success);
  flex: 1;
}

.action-btn.remembered:hover {
  background: var(--color-success);
  color: white;
}

/* ── 没记住按钮 ── */
.action-btn.forgot {
  background: var(--color-danger-light);
  color: var(--color-danger);
  flex: 1;
}

.action-btn.forgot:hover {
  background: var(--color-danger);
  color: white;
}

/* ══════════════════════════════════════════════════════════════════════════
   阶段二 - 确认/纠正按钮
   ══════════════════════════════════════════════════════════════════════════ */

/* ── 记错了按钮（弱化） ── */
.action-btn.correction {
  background: var(--color-bg-tertiary);
  color: var(--color-text-tertiary);
  flex: 0 0 auto;
  min-width: 72px;
  padding: 0.75rem 1rem;
}

.action-btn.correction .btn-icon {
  font-size: 1.1rem;
}

.action-btn.correction .btn-label {
  font-size: 0.65rem;
}

.action-btn.correction:hover {
  background: var(--color-warning-light);
  color: var(--color-warning);
}

/* ── 下一个按钮 ── */
.action-btn.next {
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  flex: 1;
}

.action-btn.next:hover {
  background: var(--color-primary);
  color: white;
}

.action-btn.next.next-success {
  background: var(--color-success);
  color: white;
}

.action-btn.next.next-error {
  background: var(--color-danger);
  color: white;
}

/* 前一阶段选了"没记住"时，下一个按钮占满宽度 */
.action-btn.next.next-full {
  min-width: 100%;
}

/* ══════════════════════════════════════════════════════════════════════════
   动画系统 - 墨水晕染主题
   ══════════════════════════════════════════════════════════════════════════ */

/* 提示文字淡入 */
@keyframes hintFadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 内容区域整体展开 */
@keyframes contentReveal {
  from {
    opacity: 0;
    transform: translate3d(0, 12px, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

/* 音标标签浮现 */
@keyframes phoneticsReveal {
  from {
    opacity: 0;
    transform: translate3d(0, -6px, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

/* 装饰线扩展 - 墨水扩散 */
@keyframes lineExpand {
  from {
    transform: scaleX(0);
    opacity: 0;
  }
  to {
    transform: scaleX(1);
    opacity: 1;
  }
}

/* 卡片滑入 - 统一的交错动画 */
@keyframes cardSlideIn {
  from {
    opacity: 0;
    transform: translate3d(0, 16px, 0);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0);
  }
}

/* fadeIn, slideUp: defined globally in animations.css */

@keyframes slideInFromRight {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* Reveal 过渡（由 JS 钩子控制，leave 立即完成无动画） */

/* Action Switch 过渡 (mode="out-in") */
.action-switch-enter-active,
.action-switch-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
  will-change: transform, opacity;
}

.action-switch-enter-from {
  opacity: 0;
  transform: translate3d(0, 8px, 0);
}

.action-switch-leave-to {
  opacity: 0;
  transform: translate3d(0, -8px, 0);
}

/* ══════════════════════════════════════════════════════════════════════════
   移动端适配
   ══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .review-card {
    padding: 0 1rem;
  }

  .card-body {
    padding-top: 1.5rem;
    padding-bottom: calc(var(--button-bar-height-mobile) + 1rem);
  }

  .word-presenter {
    min-height: 140px;
    /* 移动端简化过渡 */
    transition:
      min-height 0.35s cubic-bezier(0.22, 1, 0.36, 1),
      margin-bottom 0.35s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .word-text {
    font-size: clamp(2rem, 10vw, 3rem);
    /* 移动端简化过渡 */
    transition:
      font-size 0.35s cubic-bezier(0.22, 1, 0.36, 1),
      color 0.35s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .word-presenter.to-header .word-text {
    font-size: clamp(1.5rem, 7vw, 2rem);
  }

  .word-hint {
    font-size: 0.8rem;
  }

  .phonetics-bar {
    margin-bottom: 1.25rem;
  }

  .phonetic-tag {
    padding: 0.35rem 0.6rem;
  }

  .phonetic-tag .ipa {
    font-size: 0.85rem;
  }

  /* 移动端：简化分隔线动画 */
  .divider-line {
    margin-top: 1rem;
    animation-duration: 0.4s;
  }

  /* 移动端：移除交错延迟，统一快速淡入 */
  .phonetics {
    animation-duration: 0.25s;
    animation-delay: 0s;
  }

  .definition-card {
    padding: 0.875rem 1rem;
    /* 移除交错延迟，统一动画 */
    animation: cardSlideInMobile 0.3s cubic-bezier(0.22, 1, 0.36, 1) backwards;
    animation-delay: 0.1s;
  }

  .def-text {
    font-size: 0.95rem;
  }

  .example-card {
    padding: 0.875rem 1rem;
    /* 移除交错延迟，统一动画 */
    animation: cardSlideInMobile 0.3s cubic-bezier(0.22, 1, 0.36, 1) backwards;
    animation-delay: 0.1s;
  }

  .example-en {
    font-size: 0.9rem;
  }

  .example-zh {
    font-size: 0.8rem;
  }

  /* 移动端按钮 */
  .action-bar {
    padding: 0.625rem 0.75rem;
    padding-bottom: calc(0.625rem + env(safe-area-inset-bottom));
  }

  .action-stage {
    gap: 0.375rem;
  }

  .primary-actions {
    gap: 0.5rem;
  }

  .action-btn {
    padding: 0.75rem 0.5rem;
    min-width: 70px;
    border-radius: var(--radius-md);
  }

  .btn-icon .icon {
    width: 20px;
    height: 20px;
  }

  .btn-label {
    font-size: 0.7rem;
  }

  .action-btn.correction {
    min-width: 60px;
    padding: 0.625rem 0.5rem;
  }
}

/* 移动端简化卡片动画 */
@keyframes cardSlideInMobile {
  from {
    opacity: 0;
    transform: translateY(8px) translateZ(0);
  }
  to {
    opacity: 1;
    transform: translateY(0) translateZ(0);
  }
}


/* 横屏适配 */
@media (max-height: 500px) and (orientation: landscape) {
  .card-body {
    padding-top: 0.75rem;
    padding-bottom: 75px;
  }

  .word-presenter {
    min-height: 70px;
  }

  .word-text {
    font-size: 1.75rem;
  }

  .word-presenter.to-header .word-text {
    font-size: 1.5rem;
  }

  .phonetics-bar {
    margin-bottom: 1rem;
  }

  .divider-line {
    margin-top: 0.75rem;
  }

  .action-bar {
    padding: 0.375rem 0.5rem;
    padding-bottom: calc(0.375rem + env(safe-area-inset-bottom));
  }

  .action-stage {
    gap: 0.25rem;
  }

  .action-btn {
    padding: 0.4rem 0.75rem;
    flex-direction: row;
    gap: 0.4rem;
  }

  .btn-icon .icon {
    width: 16px;
    height: 16px;
  }

  .btn-label {
    font-size: 0.7rem;
  }

  .secondary-actions {
    gap: 0.375rem;
  }

  .action-btn-sm {
    padding: 0.2rem 0.5rem;
  }
}
</style>
