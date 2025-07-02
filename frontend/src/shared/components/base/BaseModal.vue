<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="modal-overlay"
        @click.self="closeOnOverlay && close()"
      >
        <div
          ref="modalRef"
          :class="['modal', `modal--${size}`]"
          role="dialog"
          :aria-modal="true"
          :aria-labelledby="titleId"
        >
          <!-- 头部 -->
          <header v-if="$slots.header || title" class="modal__header">
            <slot name="header">
              <h2 :id="titleId" class="modal__title">{{ title }}</h2>
            </slot>
            <button
              v-if="closable"
              class="modal__close"
              aria-label="关闭"
              @click="close"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </header>

          <!-- 内容 -->
          <div class="modal__body">
            <slot />
          </div>

          <!-- 底部 -->
          <footer v-if="$slots.footer" class="modal__footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'

interface Props {
  modelValue: boolean
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  closable?: boolean
  closeOnOverlay?: boolean
  closeOnEsc?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  closable: true,
  closeOnOverlay: true,
  closeOnEsc: true
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'close': []
}>()

const titleId = computed(() => `modal-title-${Math.random().toString(36).slice(2, 9)}`)
const modalRef = ref<HTMLElement | null>(null)

const close = () => {
  emit('update:modelValue', false)
  emit('close')
}

// 锁定滚动
watch(() => props.modelValue, (open) => {
  if (open) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})

// ESC 关闭
const handleEsc = (e: KeyboardEvent) => {
  if (props.closeOnEsc && e.key === 'Escape' && props.modelValue) {
    close()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleEsc)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEsc)
  // 确保卸载时恢复滚动
  document.body.style.overflow = ''
})

// 暴露关闭方法
defineExpose({ close })
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  position: relative;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - var(--space-8));
  background: var(--color-surface-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  overflow: hidden;
}

/* ═══════════════════════════════════════════════════════════════════════════
   尺寸变体
   ═══════════════════════════════════════════════════════════════════════════ */

.modal--sm { width: 100%; max-width: 360px; }
.modal--md { width: 100%; max-width: 480px; }
.modal--lg { width: 100%; max-width: 640px; }
.modal--xl { width: 100%; max-width: 800px; }
.modal--full {
  width: calc(100vw - var(--space-8));
  height: calc(100vh - var(--space-8));
  max-width: none;
}

/* ═══════════════════════════════════════════════════════════════════════════
   头部
   ═══════════════════════════════════════════════════════════════════════════ */

.modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--color-border-light);
  flex-shrink: 0;
}

.modal__title {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.modal__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: var(--radius-full);
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.modal__close:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.modal__close:focus-visible {
  outline: 2px solid var(--color-brand-primary);
  outline-offset: 2px;
}

/* ═══════════════════════════════════════════════════════════════════════════
   内容区域
   ═══════════════════════════════════════════════════════════════════════════ */

.modal__body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
}

/* ═══════════════════════════════════════════════════════════════════════════
   底部
   ═══════════════════════════════════════════════════════════════════════════ */

.modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--color-border-light);
  background: var(--color-bg-secondary);
  flex-shrink: 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
   过渡动画
   ═══════════════════════════════════════════════════════════════════════════ */

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}

.modal-enter-active .modal,
.modal-leave-active .modal {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal {
  transform: scale(0.95) translateY(10px);
}

.modal-leave-to .modal {
  transform: scale(0.95) translateY(-10px);
}

/* ═══════════════════════════════════════════════════════════════════════════
   移动端适配
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .modal-overlay {
    padding: var(--space-2);
    align-items: flex-end;
  }

  .modal {
    max-height: calc(100vh - var(--space-4));
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  }

  .modal--sm,
  .modal--md,
  .modal--lg,
  .modal--xl {
    max-width: none;
  }

  .modal-enter-from .modal {
    transform: translateY(100%);
  }

  .modal-leave-to .modal {
    transform: translateY(100%);
  }
}
</style>
