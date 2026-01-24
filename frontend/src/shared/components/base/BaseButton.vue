<template>
  <button
    :class="[
      'btn',
      `btn--${variant}`,
      `btn--${size}`,
      { 'btn--loading': loading, 'btn--icon-only': iconOnly }
    ]"
    :disabled="disabled || loading"
    v-bind="$attrs"
  >
    <span v-if="loading" class="btn__spinner" />
    <span v-if="$slots.icon" class="btn__icon">
      <slot name="icon" />
    </span>
    <span v-if="!iconOnly" class="btn__text">
      <slot />
    </span>
  </button>
</template>

<script setup lang="ts">
interface Props {
  /** 按钮变体 */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
  /** 按钮尺寸 */
  size?: 'sm' | 'md' | 'lg'
  /** 加载状态 */
  loading?: boolean
  /** 禁用状态 */
  disabled?: boolean
  /** 仅图标模式 */
  iconOnly?: boolean
}

withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  loading: false,
  disabled: false,
  iconOnly: false
})
</script>

<style scoped>
.btn {
  /* 基础样式 */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font-family: var(--font-ui);
  font-weight: var(--font-weight-medium);
  border-radius: var(--radius-default);
  border: none;
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    transform var(--transition-fast),
    box-shadow var(--transition-fast),
    border-color var(--transition-fast);
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  white-space: nowrap;
}

.btn:focus-visible {
  outline: 2px solid var(--color-brand-primary);
  outline-offset: 2px;
}

/* ═══════════════════════════════════════════════════════════════════════════
   尺寸变体
   ═══════════════════════════════════════════════════════════════════════════ */

.btn--sm {
  height: 32px;
  padding: 0 var(--space-3);
  font-size: var(--font-size-sm);
}

.btn--md {
  height: 40px;
  padding: 0 var(--space-4);
  font-size: var(--font-size-base);
}

.btn--lg {
  height: 48px;
  padding: 0 var(--space-6);
  font-size: var(--font-size-lg);
}

/* ═══════════════════════════════════════════════════════════════════════════
   颜色变体
   ═══════════════════════════════════════════════════════════════════════════ */

/* Primary */
.btn--primary {
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
}

.btn--primary:hover:not(:disabled) {
  background: var(--button-primary-bg-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(153, 107, 61, 0.25);
}

.btn--primary:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 2px 6px rgba(153, 107, 61, 0.2);
}

/* Secondary */
.btn--secondary {
  background: var(--button-secondary-bg);
  color: var(--button-secondary-text);
  border: 1.5px solid var(--button-secondary-border);
}

.btn--secondary:hover:not(:disabled) {
  background: var(--color-brand-primary-light);
  border-color: var(--color-brand-primary-hover);
}

/* Ghost */
.btn--ghost {
  background: var(--button-ghost-bg);
  color: var(--button-ghost-text);
}

.btn--ghost:hover:not(:disabled) {
  background: var(--button-ghost-bg-hover);
  color: var(--button-ghost-text-hover);
}

/* Danger */
.btn--danger {
  background: var(--color-state-error);
  color: var(--color-text-inverse);
}

.btn--danger:hover:not(:disabled) {
  background: var(--primitive-brick-600);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(155, 59, 59, 0.25);
}

/* Success */
.btn--success {
  background: var(--color-state-success);
  color: var(--color-text-inverse);
}

.btn--success:hover:not(:disabled) {
  background: var(--color-state-success-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(93, 122, 93, 0.25);
}

/* ═══════════════════════════════════════════════════════════════════════════
   状态样式
   ═══════════════════════════════════════════════════════════════════════════ */

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn--loading {
  pointer-events: none;
  opacity: 0.7;
}

.btn__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* ═══════════════════════════════════════════════════════════════════════════
   图标按钮
   ═══════════════════════════════════════════════════════════════════════════ */

.btn--icon-only {
  padding: 0;
  aspect-ratio: 1;
}

.btn--icon-only.btn--sm { width: 32px; }
.btn--icon-only.btn--md { width: 40px; }
.btn--icon-only.btn--lg { width: 48px; }

.btn__icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ═══════════════════════════════════════════════════════════════════════════
   移动端适配
   ═══════════════════════════════════════════════════════════════════════════ */

@media (hover: none) and (pointer: coarse) {
  .btn:hover:not(:disabled) {
    transform: none;
    box-shadow: none;
  }

  .btn:active:not(:disabled) {
    transform: scale(0.97);
  }
}
</style>
