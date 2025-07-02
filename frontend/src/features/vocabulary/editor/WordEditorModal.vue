<template>
  <Teleport to="body">
    <Transition name="word-modal">
      <div
        v-if="isOpen && currentWord"
        class="modal-overlay"
        @click.self="!isEditing && store.close()"
        @touchmove.prevent
        @wheel.prevent
        @scroll.prevent
        @keydown.stop
        @keyup.stop
        @keypress.stop
      >
        <div
          class="modal-content"
          @touchmove.stop
          @wheel.stop
          @scroll.stop
          @keydown.stop
          @keyup.stop
          @keypress.stop
        >
          <div class="modal-header">
            <div class="modal-header-left">
              <span class="modal-header-accent"></span>
              <h2 class="modal-title">单词详情</h2>
            </div>
            <button v-if="!isEditing" @click="store.close()" class="close-button" aria-label="关闭">
              <XIcon class="close-icon" />
            </button>
          </div>

          <div class="modal-body">
            <div class="content-grid">
              <WordInfoSection v-model:edit-data="currentWord" :is-editing="isEditing" />

              <WordActionsSidebar />
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { watch, onBeforeUnmount, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { X as XIcon } from 'lucide-vue-next';
import WordInfoSection from './WordInfoSection.vue';
import WordActionsSidebar from './WordActionsSidebar.vue';
import { useWordEditorStore } from '../stores/wordEditor';

// 使用 Pinia Store
const store = useWordEditorStore();
const { currentWord, isOpen, isEditing } = storeToRefs(store);

const abortController = ref<AbortController | null>(null);

// 阻止键盘事件传播到父组件
const handleKeydown = (event: KeyboardEvent) => {
  event.stopPropagation();
};

// 根据模态框的开启状态控制 body 的滚动 - 加强版
watch(isOpen, (open) => {
  if (open) {
    const scrollY = window.scrollY;

    // 锁定背景滚动：body fixed 保持视觉位置
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    // 强制 html 保留滚动条轨道（overflow: scroll 而非 hidden），
    // 避免滚动条消失导致 viewport 变宽、所有 fixed 元素抖动
    document.documentElement.style.overflowY = 'scroll';

    document.body.setAttribute('data-scroll-y', scrollY.toString());

    abortController.value = new AbortController();
    document.addEventListener('keydown', handleKeydown, {
      capture: true,
      signal: abortController.value.signal
    });
  } else {
    const scrollY = parseInt(document.body.getAttribute('data-scroll-y') || '0');

    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.documentElement.style.overflowY = '';

    window.scrollTo(0, scrollY);
    document.body.removeAttribute('data-scroll-y');

    // 使用 AbortController 移除全局键盘事件拦截
    if (abortController.value) {
      abortController.value.abort();
      abortController.value = null;
    }
  }
});

// 组件卸载前清理事件监听器
onBeforeUnmount(() => {
  if (abortController.value) {
    abortController.value.abort();
    abortController.value = null;
  }
});
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   WordEditorModal - Editorial Study 学术纸质风格
   ═══════════════════════════════════════════════════════════════════════════ */

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(26, 32, 44, 0.45);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: var(--space-6);
  touch-action: none;
  -webkit-overflow-scrolling: touch;
  overflow: hidden;
  overscroll-behavior: none;
}

.modal-content {
  background: var(--color-surface-card);
  border-radius: var(--radius-lg);
  max-width: 56rem;
  width: 100%;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  box-shadow:
    0 4px 6px rgba(0, 0, 0, 0.04),
    0 20px 50px -10px rgba(26, 32, 44, 0.18);
  border: 1px solid var(--color-border-light);
  touch-action: auto;
  overflow: hidden;
  min-height: 0;
}

/* ── Header ── */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--color-border-light);
  flex-shrink: 0;
  background: var(--color-surface-card);
}

.modal-header-left {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.modal-header-accent {
  width: 3px;
  height: 18px;
  background: var(--gradient-primary);
  border-radius: 2px;
  flex-shrink: 0;
}

.modal-title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  letter-spacing: -0.01em;
}

.close-button {
  width: 32px;
  height: 32px;
  min-width: 44px;
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-default);
  border: none;
  background: transparent;
  cursor: pointer;
  transition: all var(--transition-fast);
  touch-action: manipulation;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.close-button:hover {
  background-color: var(--color-bg-tertiary);
}

.close-button:focus-visible {
  outline: 2px solid var(--color-brand-primary);
  outline-offset: 2px;
}

.close-icon {
  width: 18px;
  height: 18px;
  color: var(--color-text-tertiary);
  transition: color var(--transition-fast);
}

.close-button:hover .close-icon {
  color: var(--color-text-primary);
}

/* ── Body ── */
.modal-body {
  padding: var(--space-6);
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  -webkit-overflow-scrolling: touch;
  padding-bottom: var(--space-8);
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr 210px;
  gap: var(--space-8);
  min-height: 0;
  height: auto;
  width: 100%;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Entry/Exit Transitions
   ═══════════════════════════════════════════════════════════════════════════ */

.word-modal-enter-active {
  transition: opacity 0.25s ease;
}

.word-modal-leave-active {
  transition: opacity 0.2s ease;
}

.word-modal-enter-active .modal-content {
  transition: transform 0.3s cubic-bezier(0.34, 1.2, 0.64, 1), opacity 0.25s ease;
}

.word-modal-leave-active .modal-content {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.word-modal-enter-from {
  opacity: 0;
}

.word-modal-enter-from .modal-content {
  opacity: 0;
  transform: scale(0.96) translateY(8px);
}

.word-modal-leave-to {
  opacity: 0;
}

.word-modal-leave-to .modal-content {
  opacity: 0;
  transform: scale(0.97) translateY(4px);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Mobile Responsive
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .modal-overlay {
    padding: 0;
    align-items: stretch;
    height: 100vh;
    height: 100dvh;
    min-height: -webkit-fill-available;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }

  .modal-content {
    max-width: 100%;
    width: 100%;
    margin: 0;
    border-radius: 0;
    border: none;
    max-height: 100vh;
    max-height: 100dvh;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
  }

  .modal-header {
    padding: 0.875rem 1rem;
    padding-top: calc(0.875rem + env(safe-area-inset-top));
    position: sticky;
    top: 0;
    z-index: 1;
    border-bottom: 1px solid var(--color-border-light);
  }

  .modal-header-accent {
    height: 14px;
  }

  .modal-title {
    font-size: var(--font-size-lg);
  }

  .modal-body {
    padding: 1rem;
    overflow-y: auto;
    flex: 1;
    -webkit-overflow-scrolling: touch;
    min-height: 0;
    padding-bottom: calc(2rem + env(safe-area-inset-bottom) + 30px);
    box-sizing: border-box;
  }

  .content-grid {
    grid-template-columns: 1fr;
    gap: var(--space-6);
  }

  .close-button {
    width: 2.5rem;
    height: 2.5rem;
    min-width: 2.5rem;
    min-height: 2.5rem;
  }

  .close-icon {
    width: 20px;
    height: 20px;
  }

  /* Mobile transition: slide up from bottom */
  .word-modal-enter-from .modal-content {
    transform: translateY(100%);
    opacity: 1;
  }

  .word-modal-leave-to .modal-content {
    transform: translateY(100%);
    opacity: 1;
  }

  .word-modal-enter-active .modal-content {
    transition: transform 0.35s cubic-bezier(0.34, 1.1, 0.64, 1);
  }

  .word-modal-leave-active .modal-content {
    transition: transform 0.25s ease-in;
  }
}

/* ── Landscape ── */
@media (max-height: 500px) and (orientation: landscape) {
  .modal-content {
    max-height: 100vh;
    max-height: 100dvh;
    height: 100vh;
    height: 100dvh;
  }

  .modal-header {
    padding: 0.625rem 1rem;
    padding-top: calc(0.625rem + env(safe-area-inset-top));
  }

  .modal-body {
    padding: 0.75rem 1rem;
    padding-bottom: calc(1.5rem + env(safe-area-inset-bottom) + 15px);
  }
}

/* ── Safari fallback ── */
@supports not (height: 100dvh) {
  @media (max-width: 768px) {
    .modal-overlay {
      height: -webkit-fill-available;
    }

    .modal-content {
      max-height: -webkit-fill-available;
      height: -webkit-fill-available;
    }
  }
}
</style>