<template>
  <div class="key-selector">
    <CustomSelect
      :model-value="modelValue"
      @update:model-value="(value) => emit('update:modelValue', value as string)"
      :options="selectableKeys"
      class="key-select"
      :class="{ 'has-error': hasError }"
    />
    <span v-if="hasError" class="error-hint">此快捷键已被使用</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import CustomSelect from '../CustomSelect.vue'

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

// 过滤出可选择的快捷键（排除已被使用的键，但保留当前选中的键）
const selectableKeys = computed(() => {
  return availableKeys.filter(key => {
    // 如果这个键已被使用且不是当前选中的键，则过滤掉
    return !(props.usedKeys.includes(key.value) && key.value !== props.modelValue)
  })
})
</script>

<style scoped>
.key-selector {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.key-select {
  min-width: 180px;
}

.key-select.has-error :deep(.custom-select-trigger) {
  border-color: var(--color-delete);
}

.error-hint {
  font-size: 12px;
  color: var(--color-delete);
  margin-left: 4px;
}

/* 自定义 CustomSelect 样式以匹配原始设计 */
.key-select :deep(.custom-select-trigger) {
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  border: 1px solid var(--color-border-medium);
}

.key-select :deep(.custom-select-trigger:hover) {
  border-color: var(--color-primary);
}

.key-select :deep(.select-option) {
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
}
</style>
