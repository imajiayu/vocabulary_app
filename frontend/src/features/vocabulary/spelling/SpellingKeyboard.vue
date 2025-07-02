<template>
  <div ref="keyboardRef" class="spelling-keyboard" @selectstart.prevent @contextmenu.prevent>
    <!-- 按键字符预览气泡 -->
    <div
      v-show="previewVisible"
      class="key-preview"
      :style="previewStyle"
    >
      {{ previewChar }}
    </div>

    <!-- 字母键盘区域 -->
    <div class="keyboard-rows">
      <!-- 第一行: QWERTYUIOP -->
      <div class="keyboard-row">
        <button
          v-for="letter in ROW_1"
          :key="letter"
          class="key letter-key"
          :disabled="disabled"
          @pointerdown="onKeyDown($event, letter.toLowerCase())"
          @pointerup="onKeyUp"
          @pointerleave="onKeyUp"
          @pointercancel="onKeyUp"
        >
          <span class="key-cap">{{ letter }}</span>
        </button>
      </div>

      <!-- 第二行: ASDFGHJKL -->
      <div class="keyboard-row">
        <button
          v-for="letter in ROW_2"
          :key="letter"
          class="key letter-key"
          :disabled="disabled"
          @pointerdown="onKeyDown($event, letter.toLowerCase())"
          @pointerup="onKeyUp"
          @pointerleave="onKeyUp"
          @pointercancel="onKeyUp"
        >
          <span class="key-cap">{{ letter }}</span>
        </button>
      </div>

      <!-- 第三行: 重置 + ZXCVBNM + 退格（对称布局） -->
      <div class="keyboard-row row-with-special">
        <button
          class="key special-key reset"
          :disabled="disabled"
          @pointerdown="onSpecialKeyDown($event, 'reset')"
          @pointerup="onKeyUp"
          @pointerleave="onKeyUp"
          @pointercancel="onKeyUp"
        >
          <span class="key-cap">
            <AppIcon name="refresh" class="key-icon-svg" />
          </span>
        </button>
        <div class="letter-group">
          <button
            v-for="letter in ROW_3"
            :key="letter"
            class="key letter-key"
            :disabled="disabled"
            @pointerdown="onKeyDown($event, letter.toLowerCase())"
            @pointerup="onKeyUp"
            @pointerleave="onKeyUp"
            @pointercancel="onKeyUp"
          >
            <span class="key-cap">{{ letter }}</span>
          </button>
        </div>
        <button
          class="key special-key backspace"
          :disabled="disabled"
          @pointerdown="onSpecialKeyDown($event, 'backspace')"
          @pointerup="onKeyUp"
          @pointerleave="onKeyUp"
          @pointercancel="onKeyUp"
        >
          <span class="key-cap">
            <AppIcon name="backspace" class="key-icon-svg" />
          </span>
        </button>
      </div>
    </div>

    <!-- 功能键区域（对称：hyphen↔enter, play↔hint, 空格居中） -->
    <div class="action-row">
      <button
        class="key action-key hyphen"
        :disabled="disabled"
        @pointerdown="onKeyDown($event, '-')"
        @pointerup="onKeyUp"
        @pointerleave="onKeyUp"
        @pointercancel="onKeyUp"
      >
        <span class="key-cap key-symbol">-</span>
      </button>

      <button
        class="key action-key play"
        :disabled="disabled"
        @pointerdown="onSpecialKeyDown($event, 'playAudio')"
        @pointerup="onKeyUp"
        @pointerleave="onKeyUp"
        @pointercancel="onKeyUp"
      >
        <span class="key-cap">
          <AppIcon name="volume" class="key-icon-svg" />
        </span>
      </button>

      <button
        class="key action-key space"
        :disabled="disabled"
        @pointerdown="onKeyDown($event, ' ')"
        @pointerup="onKeyUp"
        @pointerleave="onKeyUp"
        @pointercancel="onKeyUp"
      >
        <span class="key-cap key-label">空格</span>
      </button>

      <button
        class="key action-key hint"
        :disabled="forgotDisabled"
        @pointerdown="onSpecialKeyDown($event, 'forgot')"
        @pointerup="onKeyUp"
        @pointerleave="onKeyUp"
        @pointercancel="onKeyUp"
      >
        <span class="key-cap">
          <AppIcon name="eye" class="key-icon-svg" />
        </span>
      </button>

      <button
        class="key action-key enter"
        :class="{ 'ready': !enterDisabled }"
        :disabled="enterDisabled"
        @pointerdown="onSpecialKeyDown($event, 'enter')"
        @pointerup="onKeyUp"
        @pointerleave="onKeyUp"
        @pointercancel="onKeyUp"
      >
        <span class="key-cap">
          <AppIcon name="check" class="key-icon-svg" />
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import AppIcon from '@/shared/components/controls/Icons.vue'

const ROW_1 = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'] as const
const ROW_2 = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'] as const
const ROW_3 = ['Z', 'X', 'C', 'V', 'B', 'N', 'M'] as const

interface Props {
  disabled?: boolean
  forgotDisabled?: boolean
  enterDisabled?: boolean
}

withDefaults(defineProps<Props>(), {
  disabled: false,
  forgotDisabled: false,
  enterDisabled: true
})

const emit = defineEmits<{
  key: [value: string]
  backspace: []
  enter: []
  playAudio: []
  forgot: []
  reset: []
}>()

// Audio context for keyboard sounds
const audioContext = ref<AudioContext | null>(null)

// Keyboard element ref for height measurement
const keyboardRef = ref<HTMLElement | null>(null)

// Key preview state
const previewChar = ref('')
const previewStyle = ref({ left: '0px', top: '0px' })
const previewVisible = ref(false)
let previewTimer: ReturnType<typeof setTimeout> | null = null

// Backspace repeat state
let backspaceRepeatTimer: ReturnType<typeof setTimeout> | null = null
let backspaceIntervalTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  // Create audio context on mount (will be resumed on first user interaction)
  if (typeof AudioContext !== 'undefined') {
    audioContext.value = new AudioContext()
  }

  // Set keyboard height CSS variable for other components to use
  if (keyboardRef.value) {
    const height = keyboardRef.value.offsetHeight
    document.documentElement.style.setProperty('--spelling-keyboard-height', `${height}px`)
  }
})

onUnmounted(() => {
  audioContext.value?.close()
  clearBackspaceRepeat()
  // Clean up CSS variable
  document.documentElement.style.removeProperty('--spelling-keyboard-height')
})

// Play a crisp click sound similar to iPhone keyboard
function playClickSound(isSpecial = false) {
  if (!audioContext.value) return

  const ctx = audioContext.value
  if (ctx.state === 'suspended') {
    ctx.resume()
  }

  const now = ctx.currentTime

  // Create oscillator for the click
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  // Higher frequency for crisp click, slightly lower for special keys
  osc.frequency.setValueAtTime(isSpecial ? 1100 : 1400, now)
  osc.type = 'sine'

  // Very short attack and decay for crisp sound
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.08, now + 0.001)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(now)
  osc.stop(now + 0.04)
}

// Show character preview above the pressed key (like iOS keyboard pop-up)
function showPreview(target: HTMLElement, char: string) {
  const rect = target.getBoundingClientRect()
  const kbRect = keyboardRef.value?.getBoundingClientRect()
  if (!kbRect) return

  // Position preview centered above the key, relative to keyboard container
  previewChar.value = char.toUpperCase()
  previewStyle.value = {
    left: `${rect.left - kbRect.left + rect.width / 2}px`,
    top: `${rect.top - kbRect.top - 4}px`
  }
  previewVisible.value = true

  // Auto-hide after a short delay
  if (previewTimer) clearTimeout(previewTimer)
  previewTimer = setTimeout(() => {
    previewVisible.value = false
  }, 200)
}

// Clear backspace repeat timers
function clearBackspaceRepeat() {
  if (backspaceRepeatTimer) {
    clearTimeout(backspaceRepeatTimer)
    backspaceRepeatTimer = null
  }
  if (backspaceIntervalTimer) {
    clearInterval(backspaceIntervalTimer)
    backspaceIntervalTimer = null
  }
}

// Handle key press events
function onKeyDown(event: Event, value: string) {
  event.preventDefault()
  const target = event.currentTarget as HTMLElement
  if (target.hasAttribute('disabled')) return

  target.classList.add('pressed')
  playClickSound()
  showPreview(target, value)
  emit('key', value)
}

function onSpecialKeyDown(event: Event, action: 'backspace' | 'enter' | 'playAudio' | 'forgot' | 'reset') {
  event.preventDefault()
  const target = event.currentTarget as HTMLElement
  if (target.hasAttribute('disabled')) return

  target.classList.add('pressed')
  playClickSound(true)
  emit(action as 'enter')

  // Start backspace repeat-on-hold (like iOS native keyboard)
  if (action === 'backspace') {
    clearBackspaceRepeat()
    backspaceRepeatTimer = setTimeout(() => {
      // After initial delay, start repeating at 100ms intervals
      backspaceIntervalTimer = setInterval(() => {
        playClickSound(true)
        emit('backspace')
      }, 100)
    }, 400)
  }
}

function onKeyUp(event: Event) {
  const target = event.currentTarget as HTMLElement
  target.classList.remove('pressed')
  clearBackspaceRepeat()
}
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   Editorial Typewriter Keyboard - 拟物化移动端键盘
   ═══════════════════════════════════════════════════════════════════════════
   设计理念：复古打字机质感 + 现代触感反馈
   - 更宽敞的按键触控区域
   - 3D 按压效果（阴影 + 位移）
   - 清脆的音频反馈
   ═══════════════════════════════════════════════════════════════════════════ */

.spelling-keyboard {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  touch-action: manipulation;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
  background: linear-gradient(
    180deg,
    var(--primitive-paper-300) 0%,
    var(--primitive-paper-400) 50%,
    var(--primitive-paper-500) 100%
  );
  padding: 10px 6px 12px;
  padding-bottom: calc(14px + env(safe-area-inset-bottom));
  z-index: 1000;
  box-shadow:
    0 -1px 0 var(--primitive-paper-600),
    0 -4px 16px rgba(0, 0, 0, 0.12);
  box-sizing: border-box;
  overflow: visible;
}

/* ── 按键字符预览气泡（模拟 iOS 键盘 pop-up） ── */
.key-preview {
  position: absolute;
  z-index: 10;
  transform: translate(-50%, -100%);
  min-width: 44px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primitive-paper-50);
  color: var(--primitive-ink-900);
  font-family: var(--font-ui);
  font-size: 24px;
  font-weight: 600;
  border-radius: 10px;
  box-shadow:
    0 2px 0 var(--primitive-paper-400),
    0 4px 12px rgba(0, 0, 0, 0.2);
  pointer-events: none;
  animation: previewPop 0.12s cubic-bezier(0.2, 1, 0.3, 1);
}

@keyframes previewPop {
  from {
    opacity: 0;
    transform: translate(-50%, -90%) scale(0.7);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -100%) scale(1);
  }
}

/* ── 键盘行 ── */
.keyboard-rows {
  display: flex;
  flex-direction: column;
  margin-bottom: 2px;
  width: 100%;
}

.keyboard-row {
  display: flex;
  justify-content: center;
  gap: 5px;
  width: 100%;
  padding: 0 2px;
  /* 向下扩展触控区域，吞掉行间空隙（模拟 iPhone 原生键盘行为） */
  padding-bottom: 8px;
}

.row-with-special {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 0 2px;
  padding-bottom: 8px;
}

.letter-group {
  display: flex;
  justify-content: center;
  gap: 5px;
  flex: 1;
  min-width: 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
   按键基础样式 - 3D 拟物设计
   ═══════════════════════════════════════════════════════════════════════════ */

.key {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-family: var(--font-ui);
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
  -webkit-user-select: none;
  touch-action: manipulation;
  user-select: none;
  position: relative;
  /* 3D 效果基础 */
  transform-style: preserve-3d;
  transition:
    transform 0.08s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.08s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 按键内的文字/图标容器 - 用于按压时的微位移 */
.key-cap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  transition: transform 0.08s cubic-bezier(0.4, 0, 0.2, 1);
}

.key:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 按下状态 - 向下位移 + 阴影消失 */
.key.pressed:not(:disabled) {
  transform: translateY(3px);
}

.key.pressed:not(:disabled) .key-cap {
  transform: scale(0.96);
}

/* ═══════════════════════════════════════════════════════════════════════════
   字母键 - 更宽敞的触控区域
   ═══════════════════════════════════════════════════════════════════════════ */

.letter-key {
  flex: 1;
  min-width: 30px;
  max-width: 36px;      /* 从 2.25rem (36px) 扩展到固定 36px */
  height: 52px;          /* 从 2.75rem (44px) 扩展到 52px */
  background: linear-gradient(
    180deg,
    var(--primitive-paper-50) 0%,
    var(--primitive-paper-100) 100%
  );
  color: var(--primitive-ink-800);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
  /* 3D 阴影层 */
  box-shadow:
    0 1px 0 var(--primitive-paper-300),
    0 3px 0 var(--primitive-paper-400),
    0 4px 2px rgba(0, 0, 0, 0.1),
    0 6px 8px rgba(0, 0, 0, 0.06);
}

.letter-key.pressed:not(:disabled) {
  box-shadow:
    0 0 0 var(--primitive-paper-300),
    0 1px 0 var(--primitive-paper-400),
    0 1px 2px rgba(0, 0, 0, 0.08);
  background: linear-gradient(
    180deg,
    var(--primitive-paper-100) 0%,
    var(--primitive-paper-200) 100%
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   特殊键（重置 + 退格，对称布局）
   ═══════════════════════════════════════════════════════════════════════════ */

.special-key {
  flex-shrink: 0;
  width: 50px;
  height: 52px;
  background: linear-gradient(
    180deg,
    var(--primitive-ink-100) 0%,
    var(--primitive-ink-200) 100%
  );
  color: var(--primitive-ink-700);
  box-shadow:
    0 1px 0 var(--primitive-ink-200),
    0 3px 0 var(--primitive-ink-300),
    0 4px 2px rgba(0, 0, 0, 0.1),
    0 6px 8px rgba(0, 0, 0, 0.06);
}

.special-key.pressed:not(:disabled) {
  box-shadow:
    0 0 0 var(--primitive-ink-200),
    0 1px 0 var(--primitive-ink-300),
    0 1px 2px rgba(0, 0, 0, 0.08);
  background: linear-gradient(
    180deg,
    var(--primitive-ink-200) 0%,
    var(--primitive-ink-300) 100%
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   功能键区域
   ═══════════════════════════════════════════════════════════════════════════ */

.action-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  padding: 2px 4px 0;
  width: 100%;
  box-sizing: border-box;
}

.action-key {
  flex-shrink: 0;
  height: 52px;
}

/* 连字符键 */
.action-key.hyphen {
  width: 52px;
  background: linear-gradient(
    180deg,
    var(--primitive-paper-50) 0%,
    var(--primitive-paper-100) 100%
  );
  color: var(--primitive-ink-700);
  font-size: 24px;
  font-weight: 700;
  box-shadow:
    0 1px 0 var(--primitive-paper-300),
    0 3px 0 var(--primitive-paper-400),
    0 4px 2px rgba(0, 0, 0, 0.1),
    0 6px 8px rgba(0, 0, 0, 0.06);
}

.action-key.hyphen.pressed:not(:disabled) {
  box-shadow:
    0 0 0 var(--primitive-paper-300),
    0 1px 0 var(--primitive-paper-400),
    0 1px 2px rgba(0, 0, 0, 0.08);
  background: var(--primitive-paper-200);
}

/* 播放键 */
.action-key.play {
  width: 52px;
  background: linear-gradient(
    180deg,
    var(--primitive-copper-400) 0%,
    var(--primitive-copper-500) 100%
  );
  color: white;
  box-shadow:
    0 1px 0 var(--primitive-copper-500),
    0 3px 0 var(--primitive-copper-600),
    0 4px 2px rgba(153, 107, 61, 0.2),
    0 6px 8px rgba(153, 107, 61, 0.15);
}

.action-key.play.pressed:not(:disabled) {
  box-shadow:
    0 0 0 var(--primitive-copper-500),
    0 1px 0 var(--primitive-copper-600),
    0 1px 2px rgba(153, 107, 61, 0.15);
  background: var(--primitive-copper-600);
}

/* 空格键 */
.action-key.space {
  flex: 1;
  min-width: 80px;
  max-width: 140px;
  background: linear-gradient(
    180deg,
    var(--primitive-paper-50) 0%,
    var(--primitive-paper-100) 100%
  );
  color: var(--primitive-ink-500);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.15em;
  box-shadow:
    0 1px 0 var(--primitive-paper-300),
    0 3px 0 var(--primitive-paper-400),
    0 4px 2px rgba(0, 0, 0, 0.1),
    0 6px 8px rgba(0, 0, 0, 0.06);
}

.action-key.space.pressed:not(:disabled) {
  box-shadow:
    0 0 0 var(--primitive-paper-300),
    0 1px 0 var(--primitive-paper-400),
    0 1px 2px rgba(0, 0, 0, 0.08);
  background: var(--primitive-paper-200);
}

/* 提示键 */
.action-key.hint {
  width: 52px;
  background: linear-gradient(
    180deg,
    var(--primitive-gold-400) 0%,
    var(--primitive-gold-500) 100%
  );
  color: white;
  box-shadow:
    0 1px 0 var(--primitive-gold-500),
    0 3px 0 var(--primitive-gold-600),
    0 4px 2px rgba(184, 134, 11, 0.2),
    0 6px 8px rgba(184, 134, 11, 0.15);
}

.action-key.hint.pressed:not(:disabled) {
  box-shadow:
    0 0 0 var(--primitive-gold-500),
    0 1px 0 var(--primitive-gold-600),
    0 1px 2px rgba(184, 134, 11, 0.15);
  background: var(--primitive-gold-600);
}

/* 确认键 */
.action-key.enter {
  width: 52px;
  background: linear-gradient(
    180deg,
    var(--primitive-ink-100) 0%,
    var(--primitive-ink-200) 100%
  );
  color: var(--primitive-ink-400);
  box-shadow:
    0 1px 0 var(--primitive-ink-200),
    0 3px 0 var(--primitive-ink-300),
    0 4px 2px rgba(0, 0, 0, 0.1),
    0 6px 8px rgba(0, 0, 0, 0.06);
}

.action-key.enter.pressed:not(:disabled) {
  box-shadow:
    0 0 0 var(--primitive-ink-200),
    0 1px 0 var(--primitive-ink-300),
    0 1px 2px rgba(0, 0, 0, 0.08);
}

.action-key.enter.ready {
  background: linear-gradient(
    180deg,
    var(--primitive-olive-400) 0%,
    var(--primitive-olive-500) 100%
  );
  color: white;
  box-shadow:
    0 1px 0 var(--primitive-olive-500),
    0 3px 0 var(--primitive-olive-600),
    0 4px 2px rgba(93, 122, 93, 0.2),
    0 6px 8px rgba(93, 122, 93, 0.15),
    0 0 0 0 rgba(93, 122, 93, 0.4);
  animation: readyPulse 2s ease-in-out infinite;
}

.action-key.enter.ready.pressed:not(:disabled) {
  box-shadow:
    0 0 0 var(--primitive-olive-500),
    0 1px 0 var(--primitive-olive-600),
    0 1px 2px rgba(93, 122, 93, 0.15);
  background: var(--primitive-olive-600);
  animation: none;
}

.action-key.enter:disabled {
  opacity: 0.5;
}

/* ═══════════════════════════════════════════════════════════════════════════
   图标和文字样式
   ═══════════════════════════════════════════════════════════════════════════ */

.key-icon-svg {
  width: 22px;
  height: 22px;
  fill: currentColor;
}

.key-symbol {
  font-size: inherit;
  font-weight: inherit;
  line-height: 1;
}

.key-label {
  font-size: inherit;
  font-weight: inherit;
  letter-spacing: inherit;
}

/* ═══════════════════════════════════════════════════════════════════════════
   动画
   ═══════════════════════════════════════════════════════════════════════════ */

@keyframes readyPulse {
  0%, 100% {
    box-shadow:
      0 1px 0 var(--primitive-olive-500),
      0 3px 0 var(--primitive-olive-600),
      0 4px 2px rgba(93, 122, 93, 0.2),
      0 6px 8px rgba(93, 122, 93, 0.15),
      0 0 0 0 rgba(93, 122, 93, 0.3);
  }
  50% {
    box-shadow:
      0 1px 0 var(--primitive-olive-500),
      0 3px 0 var(--primitive-olive-600),
      0 4px 2px rgba(93, 122, 93, 0.2),
      0 6px 8px rgba(93, 122, 93, 0.15),
      0 0 0 8px rgba(93, 122, 93, 0);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   响应式适配
   ═══════════════════════════════════════════════════════════════════════════ */

/* 横屏优化 */
@media (max-height: 500px) and (orientation: landscape) {
  .spelling-keyboard {
    padding: 6px 8px 8px;
    padding-bottom: calc(8px + env(safe-area-inset-bottom));
  }

  .keyboard-rows {
    margin-bottom: 2px;
  }

  .keyboard-row,
  .row-with-special {
    padding-bottom: 5px;
  }

  .letter-key {
    height: 44px;
    font-size: 16px;
  }

  .special-key {
    height: 44px;
    width: 44px;
  }

  .action-key {
    height: 44px;
  }

  .key-icon-svg {
    width: 20px;
    height: 20px;
  }
}
</style>
