<template>
  <span class="key-hint" :class="[`key-hint--${variant}`, { 'key-hint--compact': compact }]">
    <span class="key-hint__key">{{ displayKey }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  /** 快捷键值（如 'ArrowLeft', 'Enter', 'Tab'） */
  keyValue: string
  /** 样式变体 */
  variant?: 'default' | 'light' | 'dark' | 'success' | 'warning' | 'danger'
  /** 紧凑模式（更小的尺寸） */
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  compact: false
})

// 将键盘按键转换为友好的显示符号
const displayKey = computed(() => {
  const keyMap: Record<string, string> = {
    // 方向键
    'ArrowLeft': '←',
    'ArrowRight': '→',
    'ArrowUp': '↑',
    'ArrowDown': '↓',
    // 特殊键
    'Enter': '⏎',
    'Tab': '⇥',
    'Escape': 'Esc',
    'Backspace': '⌫',
    'Delete': '⌦',
    'Space': '␣',
    ' ': '␣',
    // 导航键
    'Home': '↖',
    'End': '↘',
    'PageUp': '⇞',
    'PageDown': '⇟',
    'Insert': '⎀',
  }

  return keyMap[props.keyValue] || props.keyValue
})
</script>

<style scoped>
.key-hint {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.key-hint__key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5em;
  height: 1.5em;
  padding: 0 0.35em;
  font-family: var(--font-mono);
  font-size: 0.7em;
  font-weight: 600;
  line-height: 1;
  border-radius: var(--radius-xs);
  background: rgba(0, 0, 0, 0.15);
  color: var(--primitive-ink-700);
  box-shadow:
    0 1px 0 rgba(0, 0, 0, 0.2),
    inset 0 -1px 0 rgba(0, 0, 0, 0.1);
  transition: all 0.15s ease;
}

/* 紧凑模式 */
.key-hint--compact .key-hint__key {
  min-width: 1.2em;
  height: 1.2em;
  padding: 0 0.25em;
  font-size: 0.6em;
}

/* 所有变体统一使用灰色，确保可读性 */
.key-hint--light .key-hint__key,
.key-hint--dark .key-hint__key,
.key-hint--success .key-hint__key,
.key-hint--warning .key-hint__key,
.key-hint--danger .key-hint__key {
  background: rgba(0, 0, 0, 0.15);
  color: var(--primitive-ink-700);
  box-shadow:
    0 1px 0 rgba(0, 0, 0, 0.2),
    inset 0 -1px 0 rgba(0, 0, 0, 0.1);
}
</style>
