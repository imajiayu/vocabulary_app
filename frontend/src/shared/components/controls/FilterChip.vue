<template>
  <button
    class="filter-chip"
    :class="{ active: modelValue }"
    @click="$emit('update:modelValue', !modelValue)"
  >
    <span class="chip-label">{{ label }}</span>
    <span v-if="count !== undefined && count > 0" class="chip-count">{{ count }}</span>
  </button>
</template>

<script setup lang="ts">
interface Props {
  modelValue: boolean
  label: string
  count?: number
}

defineProps<Props>()

defineEmits<{
  'update:modelValue': [value: boolean]
}>()
</script>

<style scoped>
.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--color-text-secondary);
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  outline: none;
}

.filter-chip:hover:not(.active) {
  border-color: var(--color-text-tertiary);
  color: var(--color-text-primary);
  background: var(--color-surface-hover);
}

.filter-chip.active {
  background: var(--primitive-copper-100, rgba(153, 107, 61, 0.1));
  border-color: var(--primitive-copper-400, rgba(153, 107, 61, 0.4));
  color: var(--primitive-copper-700, #7a5427);
}

.filter-chip.active:hover {
  background: var(--primitive-copper-200, rgba(153, 107, 61, 0.18));
}

.chip-label {
  line-height: 1;
}

.chip-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  background: var(--color-border-light);
  color: var(--color-text-secondary);
}

.filter-chip.active .chip-count {
  background: var(--primitive-copper-300, rgba(153, 107, 61, 0.3));
  color: var(--primitive-copper-800, #5e4120);
}

@media (max-width: 768px) {
  .filter-chip {
    padding: 8px 14px;
    font-size: 13px;
    min-height: 36px;
  }

  .chip-count {
    min-width: 20px;
    height: 20px;
    font-size: 12px;
  }
}
</style>
