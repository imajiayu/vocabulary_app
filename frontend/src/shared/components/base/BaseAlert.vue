<script setup lang="ts">
import { computed } from 'vue'
import AppIcon from '@/shared/components/controls/Icons.vue'

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

const iconNameMap = {
  success: 'check-circle',
  warning: 'warning-triangle',
  error: 'error-x',
  info: 'info-circle'
} as const

const iconName = computed(() => iconNameMap[props.type])
</script>

<template>
  <div :class="['alert', `alert--${type}`]" role="alert">
    <span class="alert__icon">
      <AppIcon :name="iconName" />
    </span>
    <div class="alert__content">
      <slot />
    </div>
    <button
      v-if="dismissible"
      class="alert__dismiss"
      @click="emit('dismiss')"
      aria-label="关闭提示"
    >
      <AppIcon name="cross" />
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
  display: inline-flex;
  align-items: center;
}

.alert__icon .icon {
  width: 18px;
  height: 18px;
}

.alert__content {
  flex: 1;
  line-height: 1.5;
}

.alert__dismiss {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity var(--transition-fast);
}

.alert__dismiss .icon {
  width: 14px;
  height: 14px;
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
