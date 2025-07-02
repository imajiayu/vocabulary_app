<template>
  <Teleport to="body">
    <div class="toast-container" aria-live="polite">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="['toast', `toast--${toast.type}`]"
          role="alert"
        >
          <BaseIcon :name="iconMap[toast.type]" size="sm" />
          <span class="toast__message">{{ toast.message }}</span>
          <button
            v-if="toast.dismissible"
            class="toast__close"
            aria-label="关闭"
            @click="removeToast(toast.id)"
          >
            <BaseIcon name="X" size="xs" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, provide } from 'vue'
import BaseIcon from './BaseIcon.vue'

export interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  dismissible: boolean
  duration: number
}

export type ToastType = Toast['type']

export interface ToastOptions {
  type?: ToastType
  message: string
  dismissible?: boolean
  duration?: number
}

const toasts = ref<Toast[]>([])

const iconMap = {
  success: 'CheckCircle',
  error: 'XCircle',
  warning: 'AlertTriangle',
  info: 'Info'
} as const

const addToast = (options: ToastOptions) => {
  const id = Math.random().toString(36).slice(2)
  const toast: Toast = {
    id,
    type: options.type || 'info',
    message: options.message,
    dismissible: options.dismissible ?? true,
    duration: options.duration ?? 3000
  }

  toasts.value.push(toast)

  if (toast.duration > 0) {
    setTimeout(() => removeToast(id), toast.duration)
  }

  return id
}

const removeToast = (id: string) => {
  const index = toasts.value.findIndex(t => t.id === id)
  if (index > -1) {
    toasts.value.splice(index, 1)
  }
}

// 便捷方法
const success = (message: string, options?: Partial<ToastOptions>) =>
  addToast({ ...options, type: 'success', message })

const error = (message: string, options?: Partial<ToastOptions>) =>
  addToast({ ...options, type: 'error', message })

const warning = (message: string, options?: Partial<ToastOptions>) =>
  addToast({ ...options, type: 'warning', message })

const info = (message: string, options?: Partial<ToastOptions>) =>
  addToast({ ...options, type: 'info', message })

// 提供给子组件
const toastApi = {
  add: addToast,
  remove: removeToast,
  success,
  error,
  warning,
  info
}

provide('toast', toastApi)

// 暴露给父组件
defineExpose(toastApi)
</script>

<style scoped>
.toast-container {
  position: fixed;
  bottom: var(--space-6);
  right: var(--space-6);
  z-index: 2000;
  display: flex;
  flex-direction: column-reverse;
  gap: var(--space-3);
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface-elevated);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  pointer-events: auto;
  min-width: 280px;
  max-width: 400px;
}

/* 类型变体 */
.toast--success {
  border-left: 3px solid var(--color-state-success);
}

.toast--success .icon {
  color: var(--color-state-success);
}

.toast--error {
  border-left: 3px solid var(--color-state-error);
}

.toast--error .icon {
  color: var(--color-state-error);
}

.toast--warning {
  border-left: 3px solid var(--color-state-warning);
}

.toast--warning .icon {
  color: var(--color-state-warning);
}

.toast--info {
  border-left: 3px solid var(--color-brand-primary);
}

.toast--info .icon {
  color: var(--color-brand-primary);
}

.toast__message {
  flex: 1;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
}

.toast__close {
  display: flex;
  padding: var(--space-1);
  background: none;
  border: none;
  color: var(--color-text-tertiary);
  cursor: pointer;
  border-radius: var(--radius-xs);
  transition: background-color var(--transition-fast);
}

.toast__close:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

/* 过渡动画 */
.toast-enter-active {
  transition: all var(--duration-normal, 250ms) var(--ease-bounce, cubic-bezier(0.34, 1.56, 0.64, 1));
}

.toast-leave-active {
  transition: all var(--duration-fast, 150ms) var(--ease-in, cubic-bezier(0.4, 0, 1, 1));
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.toast-move {
  transition: transform var(--duration-normal, 250ms) var(--ease-default, cubic-bezier(0.4, 0, 0.2, 1));
}

/* 移动端适配 */
@media (max-width: 768px) {
  .toast-container {
    left: var(--space-4);
    right: var(--space-4);
    bottom: var(--space-4);
  }

  .toast {
    min-width: auto;
    max-width: none;
  }
}
</style>
