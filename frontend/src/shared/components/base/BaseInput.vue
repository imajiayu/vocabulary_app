<template>
  <div
    :class="[
      'input-wrapper',
      `input-wrapper--${size}`,
      {
        'input-wrapper--error': error,
        'input-wrapper--disabled': disabled,
        'input-wrapper--focused': isFocused
      }
    ]"
  >
    <label v-if="label" :for="inputId" class="input-label">
      {{ label }}
      <span v-if="required" class="input-required">*</span>
    </label>

    <div class="input-container">
      <span v-if="$slots.prefix" class="input-prefix">
        <slot name="prefix" />
      </span>

      <input
        :id="inputId"
        ref="inputRef"
        class="input-field"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        v-bind="$attrs"
        @input="handleInput"
        @focus="isFocused = true"
        @blur="isFocused = false"
      />

      <span v-if="$slots.suffix" class="input-suffix">
        <slot name="suffix" />
      </span>
    </div>

    <p v-if="error" class="input-error">{{ error }}</p>
    <p v-else-if="hint" class="input-hint">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface Props {
  modelValue?: string
  label?: string
  placeholder?: string
  type?: string
  size?: 'sm' | 'md' | 'lg'
  error?: string
  hint?: string
  required?: boolean
  disabled?: boolean
  readonly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  size: 'md',
  modelValue: ''
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const inputId = computed(() => `input-${Math.random().toString(36).slice(2, 9)}`)
const isFocused = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.value)
}

// 暴露给父组件的方法
defineExpose({
  focus: () => inputRef.value?.focus(),
  blur: () => inputRef.value?.blur()
})
</script>

<style scoped>
.input-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.input-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.input-required {
  color: var(--color-state-error);
  margin-left: 2px;
}

.input-container {
  display: flex;
  align-items: center;
  background: var(--input-bg);
  border: 1.5px solid var(--input-border);
  border-radius: var(--radius-default);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.input-wrapper--focused .input-container {
  border-color: var(--input-border-focus);
  box-shadow: 0 0 0 3px rgba(153, 107, 61, 0.12);
}

.input-wrapper--error .input-container {
  border-color: var(--color-state-error);
}

.input-wrapper--error.input-wrapper--focused .input-container {
  box-shadow: 0 0 0 3px rgba(155, 59, 59, 0.12);
}

.input-wrapper--disabled .input-container {
  background: var(--color-bg-tertiary);
  opacity: 0.6;
}

.input-field {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  color: var(--input-text);
  font-family: var(--font-body);
  outline: none;
}

.input-field::placeholder {
  color: var(--input-placeholder);
}

.input-field:disabled {
  cursor: not-allowed;
}

/* ═══════════════════════════════════════════════════════════════════════════
   尺寸变体
   ═══════════════════════════════════════════════════════════════════════════ */

.input-wrapper--sm .input-container {
  height: 32px;
}

.input-wrapper--sm .input-field {
  padding: 0 var(--space-2);
  font-size: var(--font-size-sm);
}

.input-wrapper--md .input-container {
  height: 40px;
}

.input-wrapper--md .input-field {
  padding: 0 var(--space-3);
  font-size: var(--font-size-base);
}

.input-wrapper--lg .input-container {
  height: 48px;
}

.input-wrapper--lg .input-field {
  padding: 0 var(--space-4);
  font-size: var(--font-size-lg);
}

/* ═══════════════════════════════════════════════════════════════════════════
   前缀/后缀
   ═══════════════════════════════════════════════════════════════════════════ */

.input-prefix,
.input-suffix {
  display: flex;
  align-items: center;
  padding: 0 var(--space-2);
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}

.input-prefix {
  padding-left: var(--space-3);
}

.input-suffix {
  padding-right: var(--space-3);
}

/* ═══════════════════════════════════════════════════════════════════════════
   提示文字
   ═══════════════════════════════════════════════════════════════════════════ */

.input-error {
  font-size: var(--font-size-xs);
  color: var(--color-state-error);
  margin: 0;
}

.input-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  margin: 0;
}
</style>
