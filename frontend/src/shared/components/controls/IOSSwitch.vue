<script setup lang="ts">
interface Props {
  modelValue: boolean
  label?: string
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void
}

withDefaults(defineProps<Props>(), {
  label: ''
})

const emit = defineEmits<Emits>()

const handleChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  emit('update:modelValue', target.checked)
}
</script>

<template>
  <div class="ios-switch">
    <label class="switch-wrapper">
      <input
        type="checkbox"
        :checked="modelValue"
        @change="handleChange"
      />
      <span class="slider"></span>
    </label>
    <span v-if="label" class="label">{{ label }}</span>
  </div>
</template>

<style scoped>
.ios-switch {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  user-select: none;
}

.ios-switch .switch-wrapper {
  position: relative;
  display: inline-block;
  cursor: pointer;
  /* 移动端触摸优化 */
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}

.ios-switch input {
  display: none;
  /* 完全重置样式 */
  outline: none;
  border: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  -webkit-tap-highlight-color: transparent;
}

.ios-switch .slider {
  position: relative;
  display: block;
  width: 48px;
  height: 28px;
  background: var(--primitive-ink-200);
  border-radius: var(--radius-full);
  transition: background .2s ease;
  /* 防止点击时出现边框 */
  outline: none;
  border: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
}

.ios-switch .slider::after {
  content: "";
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  background: #fff;
  border-radius: var(--radius-full);
  box-shadow: 0 1px 2px rgba(0, 0, 0, .2);
  transition: transform .2s ease;
}

.ios-switch input:checked + .slider {
  background: var(--color-primary);
}

.ios-switch input:checked + .slider::after {
  transform: translateX(20px);
}

.ios-switch .label {
  font-weight: 600;
  pointer-events: none;
}

/* 移动端触摸反馈 */
@media (hover: none) and (pointer: coarse) {
  .ios-switch .switch-wrapper:active .slider {
    transform: scale(0.98);
  }

  .ios-switch .switch-wrapper:active .slider::after {
    box-shadow: 0 2px 4px rgba(0, 0, 0, .3);
  }
}

/* 桌面端鼠标悬停效果 */
@media (hover: hover) and (pointer: fine) {
  .ios-switch .switch-wrapper:hover .slider::after {
    box-shadow: 0 2px 4px rgba(0, 0, 0, .3);
  }
}
</style>