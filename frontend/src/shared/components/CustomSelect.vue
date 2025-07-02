<template>
  <div class="custom-select-wrapper" ref="selectRef">
    <div
      class="custom-select-trigger"
      @click="toggleDropdown"
    >
      <slot name="trigger" :selected="selectedOption">
        <span class="selected-content">
          <span
            v-if="selectedOption?.color"
            class="option-indicator"
            :style="{ backgroundColor: selectedOption.color }"
          ></span>
          <span>{{ selectedOption?.label || placeholder }}</span>
        </span>
      </slot>
      <svg
        class="dropdown-arrow"
        :class="{ open: isOpen }"
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
      >
        <path d="M2 4L6 8L10 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </div>
    <div v-if="isOpen" class="custom-select-dropdown">
      <div
        v-for="option in options"
        :key="option.value"
        class="select-option"
        :class="{ selected: option.value === modelValue }"
        @click="selectOption(option.value)"
      >
        <slot name="option" :option="option">
          <span
            v-if="option.color"
            class="option-indicator"
            :style="{ backgroundColor: option.color }"
          ></span>
          <span>{{ option.label }}</span>
        </slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

export interface SelectOption {
  value: string | number
  label: string
  color?: string
  [key: string]: any
}

interface Props {
  modelValue: string | number
  options: SelectOption[]
  placeholder?: string
}

interface Emits {
  (e: 'update:modelValue', value: string | number): void
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '请选择'
})

const emit = defineEmits<Emits>()

const isOpen = ref(false)
const selectRef = ref<HTMLElement>()

const selectedOption = computed(() => {
  return props.options.find(opt => opt.value === props.modelValue)
})

const toggleDropdown = () => {
  isOpen.value = !isOpen.value
}

const selectOption = (value: string | number) => {
  emit('update:modelValue', value)
  isOpen.value = false
}

const handleClickOutside = (event: MouseEvent) => {
  if (selectRef.value && !selectRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.custom-select-wrapper {
  position: relative;
  width: 100%;
  box-sizing: border-box;
}

.custom-select-trigger {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-default);
  font-size: 14px;
  color: var(--color-text-primary);
  background: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.2s;
  box-sizing: border-box;
}

.custom-select-trigger:hover {
  border-color: var(--color-border-medium);
  background: var(--color-bg-secondary);
}

.selected-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.option-indicator {
  width: 12px;
  height: 12px;
  border-radius: var(--radius-full);
  display: inline-block;
  flex-shrink: 0;
}

.dropdown-arrow {
  color: var(--color-text-secondary);
  transition: transform 0.2s;
  flex-shrink: 0;
}

.dropdown-arrow.open {
  transform: rotate(180deg);
}

.custom-select-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: white;
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-default);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1001;
  overflow: hidden;
}

.select-option {
  padding: 10px 14px;
  cursor: pointer;
  transition: background-color 0.15s;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--color-text-primary);
}

.select-option:hover {
  background: var(--color-bg-secondary);
}

.select-option.selected {
  background: var(--color-bg-tertiary);
  font-weight: 500;
}
</style>
