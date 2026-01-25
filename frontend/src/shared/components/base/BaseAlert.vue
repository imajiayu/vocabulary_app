<script setup lang="ts">
import { computed } from 'vue'

type AlertType = 'success' | 'warning' | 'error' | 'info'

interface Props {
  type?: AlertType
  dismissible?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: 'info',
  dismissible: false
})

const emit = defineEmits<{
  dismiss: []
}>()

const iconMap: Record<AlertType, string> = {
  success: '✓',
  warning: '⚠',
  error: '✕',
  info: 'ℹ'
}

const icon = computed(() => iconMap[props.type])
</script>

<template>
  <div :class="['alert', `alert--${type}`]" role="alert">
    <span class="alert__icon">{{ icon }}</span>
    <div class="alert__content">
      <slot />
    </div>
    <button
      v-if="dismissible"
      class="alert__dismiss"
      @click="emit('dismiss')"
      aria-label="关闭提示"
    >
      ×
    </button>
  </div>
</template>

<style scoped>
.alert {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-default);
  border: 1px solid;
  font-size: var(--font-size-base);
  font-weight: 500;
}

.alert__icon {
  flex-shrink: 0;
  font-size: var(--font-size-lg);
  line-height: 1;
}

.alert__content {
  flex: 1;
  line-height: 1.5;
}

.alert__dismiss {
  flex-shrink: 0;
  padding: 0;
  border: none;
  background: transparent;
  font-size: var(--font-size-xl);
  line-height: 1;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity var(--transition-fast);
}

.alert__dismiss:hover {
  opacity: 1;
}

/* 状态变体 */
.alert--success {
  background: var(--alert-success-bg);
  border-color: var(--alert-success-border);
  color: var(--alert-success-text);
}

.alert--warning {
  background: var(--alert-warning-bg);
  border-color: var(--alert-warning-border);
  color: var(--alert-warning-text);
}

.alert--error {
  background: var(--alert-error-bg);
  border-color: var(--alert-error-border);
  color: var(--alert-error-text);
}

.alert--info {
  background: var(--alert-info-bg);
  border-color: var(--alert-info-border);
  color: var(--alert-info-text);
}
</style>
