<template>
  <div class="custom-keyboard">
    <!-- 第一行: QWERTYUIOP -->
    <div class="keyboard-row">
      <button
        v-for="letter in ROW_1"
        :key="letter"
        class="key-btn letter-key"
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
        class="key-btn letter-key"
        :disabled="disabled"
        @click="emit('key', letter.toLowerCase())"
      >
        {{ letter }}
      </button>
    </div>

    <!-- 第三行: ZXCVBNM + 退格键 -->
    <div class="keyboard-row third-row">
      <div class="letters-centered">
        <button
          v-for="letter in ROW_3"
          :key="letter"
          class="key-btn letter-key third-row-letter"
          :disabled="disabled"
          @click="emit('key', letter.toLowerCase())"
        >
          {{ letter }}
        </button>
      </div>
      <button
        class="key-btn backspace-key backspace-absolute"
        :disabled="disabled"
        @click="emit('backspace')"
      >
        ⌫
      </button>
    </div>

    <!-- 底部行: 连字符、播放、空格、忘记、确认 -->
    <div class="keyboard-row bottom-row">
      <button
        class="key-btn special-key"
        :disabled="disabled"
        @click="emit('key', '-')"
      >
        -
      </button>
      <button
        class="key-btn play-key"
        :disabled="disabled"
        @click="emit('playAudio')"
      >
        🔊
      </button>
      <button
        class="key-btn space-key"
        :disabled="disabled"
        @click="emit('key', ' ')"
      >
        空格
      </button>
      <button
        class="key-btn forgot-key"
        :disabled="forgotDisabled"
        @click="emit('forgot')"
      >
        😵
      </button>
      <button
        class="key-btn enter-key"
        :disabled="enterDisabled"
        @click="emit('enter')"
      >
        ✓
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// 键盘行定义
const ROW_1 = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'] as const
const ROW_2 = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'] as const
const ROW_3 = ['Z', 'X', 'C', 'V', 'B', 'N', 'M'] as const

interface Props {
  /** 是否禁用所有按键（提交中） */
  disabled?: boolean
  /** 是否禁用"忘记"按钮（已正确时禁用） */
  forgotDisabled?: boolean
  /** 是否禁用"确认"按钮（未完成时禁用） */
  enterDisabled?: boolean
}

withDefaults(defineProps<Props>(), {
  disabled: false,
  forgotDisabled: false,
  enterDisabled: true
})

const emit = defineEmits<{
  /** 字母/符号按键 */
  key: [value: string]
  /** 退格键 */
  backspace: []
  /** 确认键 */
  enter: []
  /** 播放音频 */
  playAudio: []
  /** 忘记按钮 */
  forgot: []
}>()
</script>

<style scoped>
.custom-keyboard {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--color-border-strong);
  padding: 0.5rem 0.25rem;
  padding-bottom: calc(0.5rem + env(safe-area-inset-bottom));
  z-index: 1000;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
}

.keyboard-row {
  display: flex;
  justify-content: center;
  gap: 0.25rem;
  margin-bottom: 0.4rem;
}

.keyboard-row:last-child {
  margin-bottom: 0;
}

.keyboard-row.third-row {
  position: relative;
  justify-content: center;
}

.letters-centered {
  display: flex;
  gap: 0.25rem;
}

.third-row-letter {
  width: 2.5rem;
  flex: 0 0 2.5rem;
}

.backspace-absolute {
  position: absolute;
  right: 0.25rem;
}

/* 按键基础样式 */
.key-btn {
  min-width: 2rem;
  height: 3rem;
  padding: 0.25rem 0.5rem;
  border: none;
  border-radius: var(--radius-xs);
  background: var(--key-bg);
  font-size: 1.1rem;
  font-weight: 400;
  color: var(--key-text);
  cursor: pointer;
  transition: all 0.1s ease;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
  box-shadow: 0 1px 0 rgba(0, 0, 0, 0.1);
}

.key-btn:active:not(:disabled) {
  background: var(--color-border-strong);
  transform: scale(0.97);
  box-shadow: none;
}

.key-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.letter-key {
  flex: 1;
  max-width: 2.5rem;
}

/* 特殊键样式 */
.special-key {
  flex: 1.5;
  background: var(--key-special-bg);
  color: var(--key-text);
}

.special-key:active:not(:disabled) {
  background: var(--color-text-muted);
}

.backspace-key {
  width: 3rem;
  background: var(--key-special-bg);
  color: var(--key-text);
  font-size: 1.2rem;
}

.backspace-key:active:not(:disabled) {
  background: var(--color-text-muted);
}

.space-key {
  flex: 3;
  background: var(--key-bg);
  color: var(--key-text);
  font-size: 0.9rem;
}

.space-key:active:not(:disabled) {
  background: var(--color-border-strong);
}

/* 功能键样式 */
.play-key {
  flex: 1.5;
  background: var(--color-primary);
  color: white;
  font-size: 1.2rem;
}

.play-key:active:not(:disabled) {
  background: var(--color-primary-hover);
}

.forgot-key {
  flex: 1.5;
  background: var(--color-primary);
  color: white;
  font-size: 1.2rem;
}

.forgot-key:active:not(:disabled) {
  background: var(--color-primary-hover);
}

.enter-key {
  flex: 1.5;
  background: var(--color-success);
  color: white;
  font-size: 1.2rem;
}

.enter-key:active:not(:disabled) {
  background: var(--color-success-hover);
}

.enter-key:disabled {
  background: var(--key-confirm-disabled-bg);
  opacity: 0.5;
}

/* 小屏幕适配 */
@media (max-width: 480px) {
  .custom-keyboard {
    padding: 0.4rem 0.2rem;
    padding-bottom: calc(0.4rem + env(safe-area-inset-bottom));
  }

  .key-btn {
    min-width: 1.8rem;
    height: 2.8rem;
    font-size: 1rem;
  }

  .keyboard-row {
    gap: 0.2rem;
    margin-bottom: 0.35rem;
  }
}
</style>
