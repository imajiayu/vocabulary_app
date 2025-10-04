<template>
  <div class="key-selector">
    <select
      :value="modelValue"
      @change="handleChange"
      class="key-select"
      :class="{ 'has-error': hasError }"
    >
      <option
        v-for="key in availableKeys"
        :key="key.value"
        :value="key.value"
        :disabled="isDisabled(key.value)"
      >
        {{ key.label }}
      </option>
    </select>
    <span v-if="hasError" class="error-hint">此快捷键已被使用</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface KeyOption {
  value: string
  label: string
}

interface Props {
  modelValue: string
  usedKeys?: string[]  // 当前组中已使用的快捷键
}

interface Emits {
  (e: 'update:modelValue', value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  usedKeys: () => []
})

const emit = defineEmits<Emits>()

// 可用的快捷键列表（排除26个字母、空格、数字、连字符）
const availableKeys: KeyOption[] = [
  { value: 'ArrowLeft', label: '← 左方向键' },
  { value: 'ArrowRight', label: '→ 右方向键' },
  { value: 'ArrowUp', label: '↑ 上方向键' },
  { value: 'ArrowDown', label: '↓ 下方向键' },
  { value: 'Enter', label: '⏎ Enter' },
  { value: 'Tab', label: '⇥ Tab' },
  { value: 'Escape', label: '⎋ Escape' },
  { value: 'Backspace', label: '⌫ Backspace' },
  { value: 'Delete', label: '⌦ Delete' },
  { value: 'Home', label: '↖ Home' },
  { value: 'End', label: '↘ End' },
  { value: 'PageUp', label: '⇞ Page Up' },
  { value: 'PageDown', label: '⇟ Page Down' },
  { value: 'Insert', label: '⎀ Insert' },
  { value: '[', label: '[ 左方括号' },
  { value: ']', label: '] 右方括号' },
  { value: '(', label: '( 左圆括号' },
  { value: ')', label: ') 右圆括号' },
  { value: '{', label: '{ 左花括号' },
  { value: '}', label: '} 右花括号' },
  { value: '<', label: '< 小于号' },
  { value: '>', label: '> 大于号' },
  { value: ';', label: '; 分号' },
  { value: ':', label: ': 冒号' },
  { value: ',', label: ', 逗号' },
  { value: '.', label: '. 句号' },
  { value: '/', label: '/ 斜杠' },
  { value: '\\', label: '\\ 反斜杠' },
  { value: '|', label: '| 竖线' },
  { value: '?', label: '? 问号' },
  { value: '!', label: '! 感叹号' },
  { value: '@', label: '@ At符号' },
  { value: '#', label: '# 井号' },
  { value: '$', label: '$ 美元符号' },
  { value: '%', label: '% 百分号' },
  { value: '^', label: '^ 插入符号' },
  { value: '&', label: '& 和号' },
  { value: '*', label: '* 星号' },
  { value: '_', label: '_ 下划线' },
  { value: '+', label: '+ 加号' },
  { value: '=', label: '= 等号' },
  { value: '~', label: '~ 波浪号' },
  { value: '`', label: '` 反引号' },
  { value: "'", label: "' 单引号" },
  { value: '"', label: '" 双引号' },
]

const hasError = computed(() => {
  return props.usedKeys.includes(props.modelValue)
})

const isDisabled = (key: string) => {
  // 如果这个键已被使用且不是当前选中的键，则禁用
  return props.usedKeys.includes(key) && key !== props.modelValue
}

const handleChange = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value
  emit('update:modelValue', value)
}
</script>

<style scoped>
.key-selector {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.key-select {
  padding: 8px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 14px;
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 180px;
}

.key-select:hover {
  border-color: #667eea;
}

.key-select:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.key-select.has-error {
  border-color: #ef4444;
}

.key-select option:disabled {
  color: #9ca3af;
  font-style: italic;
}

.error-hint {
  font-size: 12px;
  color: #ef4444;
  margin-left: 4px;
}
</style>
