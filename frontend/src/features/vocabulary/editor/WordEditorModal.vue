<template>
  <div
    v-if="isOpen && currentWord"
    class="modal-overlay"
    @touchmove.prevent
    @wheel.prevent
    @scroll.prevent
    @touchstart.passive="false"
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
        <h2 class="modal-title">单词详情</h2>
        <button v-if="!isEditing" @click="store.close()" class="close-button">
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
</template>

<script setup lang="ts">
import { watch, onBeforeUnmount, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { X as XIcon } from 'lucide-vue-next';
import WordInfoSection from './WordInfoSection.vue';
import WordActionsSidebar from './WordActionsSidebar.vue';
import { useWordEditorStore } from '../stores/wordEditor';
import { api } from '@/shared/api';
import { logger } from '@/shared/utils/logger';

// 使用 Pinia Store
const store = useWordEditorStore();
const { currentWord, isOpen, isEditing, isSaving } = storeToRefs(store);

const abortController = ref<AbortController | null>(null);
const wasSaving = ref(false); // 用于追踪保存状态变化

// 释义更新轮询
let definitionPollingTimer: ReturnType<typeof setInterval> | null = null;
const DEFINITION_POLLING_INTERVAL = 1000;

// 轮询检查当前单词的释义更新
const pollDefinitionUpdates = async () => {
  if (!currentWord.value) return;

  try {
    const result = await api.words.getDefinitionUpdates();

    // 检查当前单词是否有更新
    const update = result.updates.find(u => u.id === currentWord.value?.id);
    if (update) {
      store.updateCurrentWord({ definition: update.definition });
      logger.log('[WordEditor] Definition updated for current word');
    }

    // 如果队列为空，停止轮询
    if (result.queue_size === 0 && result.updates.length === 0) {
      stopDefinitionPolling();
    }
  } catch (error) {
    logger.error('[WordEditor] Failed to poll definition updates:', error);
  }
};

// 启动释义更新轮询
const startDefinitionPolling = () => {
  if (definitionPollingTimer) return;
  definitionPollingTimer = setInterval(pollDefinitionUpdates, DEFINITION_POLLING_INTERVAL);
  // 立即执行一次
  pollDefinitionUpdates();
};

// 停止释义更新轮询
const stopDefinitionPolling = () => {
  if (definitionPollingTimer) {
    clearInterval(definitionPollingTimer);
    definitionPollingTimer = null;
  }
};

// 阻止键盘事件传播到父组件
const handleKeydown = (event: KeyboardEvent) => {
  event.stopPropagation();
};

// 监听保存状态变化，保存完成后启动轮询（因为可能修改了单词字段，后台会重新获取释义）
watch(isSaving, (saving) => {
  if (wasSaving.value && !saving) {
    // 保存完成，启动轮询获取可能的释义更新
    startDefinitionPolling();
  }
  wasSaving.value = saving;
});

// 根据模态框的开启状态控制 body 的滚动 - 加强版
watch(isOpen, async (open) => {
  if (open) {
    // 保存当前滚动位置
    const scrollY = window.scrollY;

    // 阻止背景滚动 - 加强版
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    document.documentElement.style.overflow = 'hidden';

    // 存储滚动位置
    document.body.setAttribute('data-scroll-y', scrollY.toString());

    // 创建新的 AbortController 并添加全局键盘事件拦截
    abortController.value = new AbortController();
    document.addEventListener('keydown', handleKeydown, {
      capture: true,
      signal: abortController.value.signal
    });

    // 检查是否有待处理的释义更新，如果有则启动轮询
    try {
      const result = await api.words.getDefinitionUpdates();
      if (result.queue_size > 0) {
        // 检查当前单词是否有更新
        const update = result.updates.find(u => u.id === currentWord.value?.id);
        if (update) {
          store.updateCurrentWord({ definition: update.definition });
        }
        startDefinitionPolling();
      }
    } catch (error) {
      logger.error('[WordEditor] Failed to check definition queue:', error);
    }
  } else {
    // 恢复背景滚动
    const scrollY = parseInt(document.body.getAttribute('data-scroll-y') || '0');

    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.documentElement.style.overflow = '';

    // 恢复滚动位置
    window.scrollTo(0, scrollY);
    document.body.removeAttribute('data-scroll-y');

    // 使用 AbortController 移除全局键盘事件拦截
    if (abortController.value) {
      abortController.value.abort();
      abortController.value = null;
    }

    // 停止释义更新轮询
    stopDefinitionPolling();
  }
});

// 组件卸载前清理事件监听器
onBeforeUnmount(() => {
  if (abortController.value) {
    abortController.value.abort();
    abortController.value = null;
  }
  stopDefinitionPolling();
});
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999; /* 提高z-index确保在topbar上方 */
  padding: 1rem;
  /* 移动端触摸优化 */
  touch-action: none;
  -webkit-overflow-scrolling: touch;
  /* 防止背景滚动 - 加强版 */
  overflow: hidden;
  overscroll-behavior: none;
  /* 确保完全覆盖页面 */
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.modal-content {
  background: white;
  border-radius: 1rem;
  max-width: 60rem;
  width: 100%;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  /* 允许模态框内容滚动 */
  touch-action: auto;
  overflow: hidden;
  /* 确保内容能正确计算高度 */
  min-height: 0;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.modal-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #111827;
}

.close-button {
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: background-color 0.2s;
  /* 移动端触摸优化 */
  touch-action: manipulation;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  min-width: 44px;
  min-height: 44px;
}

.close-button:hover {
  background-color: #f3f4f6;
}

.close-icon {
  width: 1.25rem;
  height: 1.25rem;
  color: #6b7280;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto;
  flex: 1;
  /* 确保能正确滚动到底部 */
  min-height: 0;
  -webkit-overflow-scrolling: touch;
  /* 增加底部padding确保内容可见 */
  padding-bottom: 2rem;
}

.content-grid {
  display: grid;
  grid-template-columns: 1fr 200px;
  gap: 2rem;
  min-height: 0;
  /* 确保grid内容能正确计算高度 */
  height: auto;
  width: 100%;
}

/* 移动端全面适配 */
@media (max-width: 768px) {
  .modal-overlay {
    padding: 0;
    align-items: stretch;
    /* 使用动态视口高度，适应浏览器UI变化 */
    height: 100vh;
    height: 100dvh;
    min-height: -webkit-fill-available;
  }

  .modal-content {
    max-width: 100%;
    width: 100%;
    margin: 0;
    border-radius: 0;
    /* 确保占满整个空间 */
    max-height: 100vh;
    max-height: 100dvh;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
  }

  .modal-header {
    padding: 1rem;
    padding-top: calc(1rem + env(safe-area-inset-top));
    flex-shrink: 0;
    border-bottom: 1px solid #e5e7eb;
    position: sticky;
    top: 0;
    background: white;
    z-index: 1;
  }

  .modal-title {
    font-size: 1.125rem;
  }

  .modal-body {
    padding: 1rem;
    overflow-y: auto;
    flex: 1;
    -webkit-overflow-scrolling: touch;
    /* 移动端确保能滚动到底部 - 考虑安全区域和浏览器UI */
    min-height: 0;
    padding-bottom: calc(3rem + env(safe-area-inset-bottom) + 40px) !important;
    box-sizing: border-box;
  }

  .content-grid {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  .close-button {
    width: 2.5rem;
    height: 2.5rem;
    min-width: 2.5rem;
    min-height: 2.5rem;
  }

  .close-icon {
    width: 1.5rem;
    height: 1.5rem;
  }
}

/* 小屏手机适配 */
@media (max-width: 480px) {
  .modal-header {
    padding: 0.875rem;
    padding-top: calc(0.875rem + env(safe-area-inset-top));
  }

  .modal-title {
    font-size: 1rem;
  }

  .modal-body {
    padding: 0.875rem;
    /* 小屏手机底部空间 - 考虑安全区域和浏览器UI */
    padding-bottom: calc(1.5rem + env(safe-area-inset-bottom) + 25px);
  }

  .content-grid {
    gap: 1rem;
  }
}

/* 横屏手机适配 */
@media (max-height: 500px) and (orientation: landscape) {
  .modal-content {
    max-height: 100vh;
    max-height: 100dvh;
    height: 100vh;
    height: 100dvh;
  }

  .modal-header {
    padding: 0.75rem 1rem;
    padding-top: calc(0.75rem + env(safe-area-inset-top));
  }

  .modal-title {
    font-size: 1rem;
  }

  .modal-body {
    padding: 0.75rem 1rem;
    /* 横屏模式底部空间 - 考虑浏览器UI */
    padding-bottom: calc(1.5rem + env(safe-area-inset-bottom) + 15px);
  }
}

/* Safari特殊处理 - 针对不支持dvh的浏览器 */
@supports not (height: 100dvh) {
  @media (max-width: 768px) {
    .modal-overlay {
      /* iOS Safari使用-webkit-fill-available */
      height: -webkit-fill-available;
    }

    .modal-content {
      max-height: -webkit-fill-available;
      height: -webkit-fill-available;
    }

    .modal-body {
      /* iOS Safari需要更多底部空间 */
      padding-bottom: calc(2rem + env(safe-area-inset-bottom) + 30px) !important;
    }
  }
}

/* Chrome移动端特殊处理 */
@media (max-width: 768px) and (-webkit-min-device-pixel-ratio: 1) {
  .modal-body {
    /* Chrome移动端额外的底部空间 */
    padding-bottom: calc(2rem + env(safe-area-inset-bottom) + 35px) !important;
  }
}


/* Firefox移动端特殊处理 */
@-moz-document url-prefix() {
  @media (max-width: 768px) {
    .modal-body {
      padding-bottom: calc(2.5rem + env(safe-area-inset-bottom) + 35px) !important;
    }
  }
}
</style>