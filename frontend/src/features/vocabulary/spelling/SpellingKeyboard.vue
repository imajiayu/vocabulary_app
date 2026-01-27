<template>
  <div class="spelling-keyboard">
    <!-- 字母键盘区域 -->
    <div class="keyboard-rows">
      <!-- 第一行: QWERTYUIOP -->
      <div class="keyboard-row">
        <button
          v-for="letter in ROW_1"
          :key="letter"
          class="key letter-key"
          :disabled="disabled"
          @click="emit('key', letter.toLowerCase())"
        >
          {{ letter }}
        </button>
      </div>

      <!-- 第二行: ASDFGHJKL -->
      <div class="keyboard-row">
        <button
          v-for="letter in ROW_2"
          :key="letter"
          class="key letter-key"
          :disabled="disabled"
          @click="emit('key', letter.toLowerCase())"
        >
          {{ letter }}
        </button>
      </div>

      <!-- 第三行: ZXCVBNM + 退格 -->
      <div class="keyboard-row row-with-special">
        <div class="letter-group">
          <button
            v-for="letter in ROW_3"
            :key="letter"
            class="key letter-key"
            :disabled="disabled"
            @click="emit('key', letter.toLowerCase())"
          >
            {{ letter }}
          </button>
        </div>
        <button
          class="key special-key backspace"
          :disabled="disabled"
          @click="emit('backspace')"
        >
          <AppIcon name="backspace" class="key-icon-svg" />
        </button>
      </div>
    </div>

    <!-- 功能键区域 -->
    <div class="action-row">
      <button
        class="key action-key hyphen"
        :disabled="disabled"
        @click="emit('key', '-')"
      >
        <span class="key-symbol">-</span>
      </button>

      <button
        class="key action-key play"
        :disabled="disabled"
        @click="emit('playAudio')"
      >
        <AppIcon name="volume" class="key-icon-svg" />
      </button>

      <button
        class="key action-key space"
        :disabled="disabled"
        @click="emit('key', ' ')"
      >
        <span class="key-label">空格</span>
      </button>

      <button
        class="key action-key hint"
        :disabled="forgotDisabled"
        @click="emit('forgot')"
      >
        <AppIcon name="eye" class="key-icon-svg" />
      </button>

      <button
        class="key action-key enter"
        :class="{ 'ready': !enterDisabled }"
        :disabled="enterDisabled"
        @click="emit('enter')"
      >
        <AppIcon name="check" class="key-icon-svg" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
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
}>()
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   Neo-Editorial Spelling Keyboard - 精致移动端键盘
   ═══════════════════════════════════════════════════════════════════════════ */

.spelling-keyboard {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(to bottom,
    var(--color-bg-tertiary) 0%,
    var(--primitive-paper-400) 100%
  );
  padding: 0.625rem 0.375rem;
  padding-bottom: calc(0.625rem + env(safe-area-inset-bottom));
  z-index: 1000;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.08);
  border-top: 1px solid var(--color-border-light);
}

/* ── 键盘行 ── */
.keyboard-rows {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  margin-bottom: 0.5rem;
}

.keyboard-row {
  display: flex;
  justify-content: center;
  gap: 0.25rem;
}

.row-with-special {
  display: flex;
  justify-content: center;
  gap: 0.25rem;
  position: relative;
}

.letter-group {
  display: flex;
  justify-content: center;
  gap: 0.25rem;
}

/* ── 按键基础样式 ── */
.key {
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.12s ease;
  font-family: var(--font-ui);
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  position: relative;
  overflow: hidden;
}

.key::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, transparent 50%, rgba(0, 0, 0, 0.05) 100%);
  pointer-events: none;
}

.key:active:not(:disabled) {
  transform: scale(0.95);
}

.key:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  transform: none;
}

/* ── 字母键 ── */
.letter-key {
  flex: 1;
  max-width: 2.25rem;
  height: 2.75rem;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: 1.05rem;
  font-weight: 500;
  box-shadow:
    0 1px 0 var(--color-border-medium),
    0 2px 3px rgba(0, 0, 0, 0.06);
}

.letter-key:active:not(:disabled) {
  background: var(--color-bg-tertiary);
  box-shadow: none;
}

/* ── 特殊键（退格） ── */
.special-key {
  width: 3rem;
  height: 2.75rem;
  background: var(--primitive-ink-200);
  color: var(--color-text-primary);
  font-size: 1.2rem;
  box-shadow:
    0 1px 0 var(--primitive-ink-300),
    0 2px 3px rgba(0, 0, 0, 0.08);
}

.special-key:active:not(:disabled) {
  background: var(--primitive-ink-300);
  box-shadow: none;
}

/* ── 功能键区域 ── */
.action-row {
  display: flex;
  justify-content: center;
  gap: 0.375rem;
  padding: 0 0.25rem;
}

.action-key {
  height: 2.75rem;
  box-shadow:
    0 1px 0 rgba(0, 0, 0, 0.1),
    0 2px 4px rgba(0, 0, 0, 0.08);
}

.action-key:active:not(:disabled) {
  box-shadow: none;
}

/* 连字符键 */
.action-key.hyphen {
  width: 2.5rem;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: 1.25rem;
  font-weight: 600;
}

.action-key.hyphen:active:not(:disabled) {
  background: var(--color-bg-tertiary);
}

/* 播放键 */
.action-key.play {
  width: 3rem;
  background: var(--color-primary);
  color: white;
  font-size: 1.2rem;
}

.action-key.play:active:not(:disabled) {
  background: var(--color-primary-hover);
}

/* 空格键 */
.action-key.space {
  flex: 1;
  max-width: 10rem;
  background: var(--color-bg-primary);
  color: var(--color-text-secondary);
  font-size: 0.8rem;
  font-weight: 500;
  letter-spacing: 0.1em;
}

.action-key.space:active:not(:disabled) {
  background: var(--color-bg-tertiary);
}

/* 提示键 */
.action-key.hint {
  width: 3rem;
  background: var(--color-warning);
  color: white;
  font-size: 1.2rem;
}

.action-key.hint:active:not(:disabled) {
  background: var(--primitive-gold-600);
}

/* 确认键 */
.action-key.enter {
  width: 3rem;
  background: var(--primitive-ink-200);
  color: var(--color-text-tertiary);
  font-size: 1.3rem;
  font-weight: 700;
}

.action-key.enter.ready {
  background: var(--color-success);
  color: white;
  animation: readyPulse 1.5s ease-in-out infinite;
}

.action-key.enter.ready:active:not(:disabled) {
  background: var(--color-success-hover);
  animation: none;
}

.action-key.enter:disabled {
  background: var(--primitive-ink-200);
  color: var(--color-text-muted);
}

/* ── 图标和文字样式 ── */
.key-icon-svg {
  width: 1.2em;
  height: 1.2em;
  fill: currentColor;
}

.key-symbol {
  font-size: inherit;
  font-weight: inherit;
}

.key-label {
  font-size: inherit;
  font-weight: inherit;
  letter-spacing: inherit;
}

/* ══════════════════════════════════════════════════════════════════════════
   动画
   ══════════════════════════════════════════════════════════════════════════ */

@keyframes readyPulse {
  0%, 100% {
    box-shadow:
      0 1px 0 rgba(0, 0, 0, 0.1),
      0 2px 4px rgba(0, 0, 0, 0.08),
      0 0 0 0 rgba(93, 122, 93, 0.4);
  }
  50% {
    box-shadow:
      0 1px 0 rgba(0, 0, 0, 0.1),
      0 2px 4px rgba(0, 0, 0, 0.08),
      0 0 0 6px rgba(93, 122, 93, 0);
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   屏幕尺寸适配
   ══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 360px) {
  .spelling-keyboard {
    padding: 0.5rem 0.25rem;
    padding-bottom: calc(0.5rem + env(safe-area-inset-bottom));
  }

  .keyboard-rows {
    gap: 0.3rem;
    margin-bottom: 0.4rem;
  }

  .keyboard-row {
    gap: 0.2rem;
  }

  .letter-key {
    max-width: 2rem;
    height: 2.5rem;
    font-size: 0.95rem;
  }

  .special-key {
    width: 2.5rem;
    height: 2.5rem;
    font-size: 1.1rem;
  }

  .action-row {
    gap: 0.3rem;
  }

  .action-key {
    height: 2.5rem;
  }

  .action-key.hyphen {
    width: 2.25rem;
    font-size: 1.1rem;
  }

  .action-key.play,
  .action-key.hint,
  .action-key.enter {
    width: 2.5rem;
    font-size: 1.1rem;
  }

  .action-key.space {
    max-width: 8rem;
    font-size: 0.75rem;
  }
}

/* 大屏幕手机优化 */
@media (min-width: 414px) {
  .letter-key {
    max-width: 2.5rem;
    height: 3rem;
    font-size: 1.15rem;
  }

  .special-key {
    width: 3.25rem;
    height: 3rem;
    font-size: 1.3rem;
  }

  .action-key {
    height: 3rem;
  }

  .action-key.hyphen {
    width: 2.75rem;
  }

  .action-key.play,
  .action-key.hint,
  .action-key.enter {
    width: 3.25rem;
    font-size: 1.3rem;
  }

  .action-key.space {
    max-width: 11rem;
    font-size: 0.85rem;
  }
}

/* 横屏优化 */
@media (max-height: 500px) and (orientation: landscape) {
  .spelling-keyboard {
    padding: 0.375rem 0.5rem;
    padding-bottom: calc(0.375rem + env(safe-area-inset-bottom));
  }

  .keyboard-rows {
    gap: 0.25rem;
    margin-bottom: 0.375rem;
  }

  .letter-key {
    height: 2.25rem;
    font-size: 0.95rem;
  }

  .special-key {
    height: 2.25rem;
    font-size: 1.05rem;
  }

  .action-key {
    height: 2.25rem;
  }
}
</style>
