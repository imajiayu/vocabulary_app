<template>
  <div
    :class="[
      'card',
      `card--${elevation}`,
      { 'card--interactive': interactive, 'card--selected': selected }
    ]"
    v-bind="$attrs"
  >
    <div v-if="$slots.header" class="card__header">
      <slot name="header" />
    </div>
    <div class="card__body" :class="{ 'card__body--no-padding': noPadding }">
      <slot />
    </div>
    <div v-if="$slots.footer" class="card__footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  /** 层级效果 */
  elevation?: 'flat' | 'raised' | 'floating'
  /** 可交互（hover效果） */
  interactive?: boolean
  /** 选中状态 */
  selected?: boolean
  /** 无内边距 */
  noPadding?: boolean
}

withDefaults(defineProps<Props>(), {
  elevation: 'raised',
  interactive: false,
  selected: false,
  noPadding: false
})
</script>

<style scoped>
.card {
  background: var(--card-bg);
  border-radius: var(--radius-md);
  overflow: hidden;
}

/* ═══════════════════════════════════════════════════════════════════════════
   层级变体
   ═══════════════════════════════════════════════════════════════════════════ */

.card--flat {
  border: 1px solid var(--card-border);
}

.card--raised {
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--card-border);
}

.card--floating {
  box-shadow: var(--shadow-lg);
}

/* ═══════════════════════════════════════════════════════════════════════════
   交互状态
   ═══════════════════════════════════════════════════════════════════════════ */

.card--interactive {
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}

.card--interactive:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.card--interactive:active {
  transform: translateY(0);
}

.card--selected {
  outline: 2px solid var(--color-brand-primary);
  outline-offset: -2px;
}

/* ═══════════════════════════════════════════════════════════════════════════
   卡片区域
   ═══════════════════════════════════════════════════════════════════════════ */

.card__header {
  padding: var(--space-4);
  border-bottom: 1px solid var(--color-border-light);
}

.card__body {
  padding: var(--space-4);
}

.card__body--no-padding {
  padding: 0;
}

.card__footer {
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--color-border-light);
  background: var(--color-bg-secondary);
}

/* ═══════════════════════════════════════════════════════════════════════════
   移动端适配
   ═══════════════════════════════════════════════════════════════════════════ */

@media (hover: none) and (pointer: coarse) {
  .card--interactive:hover {
    transform: none;
    box-shadow: var(--shadow-sm);
  }

  .card--interactive:active {
    transform: scale(0.99);
  }
}
</style>
