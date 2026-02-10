<template>
  <div class="form-container">
    <div class="form-header">
      <h2 class="form-title">添加新单词</h2>

      <!-- 右侧切换 IELTS/GRE -->
      <SwitchTab
        v-model="source"
        :tabs="sourceTabs"
        container-class="secondary-theme small"
        :show-indicator="true"
        @change="handleSourceChange"
      />
    </div>

    <div class="form-content">
      <!-- 第一行：添加单词输入框 -->
      <div class="input-group">
        <div class="input-with-clear">
          <input v-model="word" @keydown.enter="handleSubmit" type="text" placeholder="请输入要添加的单词..." class="word-input"
            :disabled="isLoading" ref="inputRef" />
          <button v-if="word.trim()" @click="word = ''" class="clear-button" type="button">
            ×
          </button>
        </div>
        <button @click="handleSubmit" :disabled="isLoading || !word.trim()" class="submit-button">
          <div v-if="isLoading" class="loading-spinner"></div>
          <PlusIcon v-else class="plus-icon" />
          {{ isLoading ? '添加中...' : '添加' }}
        </button>
        <div class="batch-button-wrapper">
          <button @click="triggerFileInput" :disabled="isBatchLoading" class="batch-button">
            <div v-if="isBatchLoading" class="loading-spinner"></div>
            <UploadIcon v-else class="upload-icon" />
            {{ isBatchLoading ? '导入中...' : '批量导入' }}
          </button>
          <div class="batch-tooltip">
            文件格式为txt<br>每行一个单词
          </div>
        </div>
        <input
          ref="fileInputRef"
          type="file"
          accept=".txt"
          @change="handleFileSelect"
          style="display: none"
        />

        <!-- 消息提示紧贴输入框 -->
        <div class="message-area-wrapper" v-if="message.text">
          <div :class="['message-area', `message-${message.type}`]">
            <div class="message-content">
              <div :class="['status-dot', `status-dot-${message.type}`]"></div>
              <span>{{ message.text }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 第二行：单词查询输入框（对应搜索框） -->
      <div class="lookup-input-row">
        <div class="lookup-input-group">
          <div class="input-with-clear">
            <input
              v-model="lookupWord"
              @input="handleLookupInput"
              @keydown.enter="lookupDefinition"
              type="text"
              placeholder="在线搜索释义..."
              class="lookup-input"
            />
            <button v-if="lookupWord.trim()" @click="clearLookup" class="clear-button" type="button">
              ×
            </button>
          </div>
          <button
            @click="lookupDefinition"
            :disabled="isLookupLoading || !lookupWord.trim()"
            class="lookup-button"
          >
            <div v-if="isLookupLoading" class="loading-spinner"></div>
            <SearchIcon v-else class="search-icon" />
          </button>
        </div>

        <!-- 查询结果紧贴输入框 -->
        <Transition name="lookup-fade" appear>
          <div class="lookup-result-wrapper" v-if="lookupResult" key="lookup-result">
            <div class="lookup-result">
              <div class="word-header">
                <span class="word-text">{{ lookupResult.word }}</span>
                <button @click="closeLookupResult" class="close-button">×</button>
              </div>

              <div v-if="lookupResult.phonetic" class="phonetic">
                <span v-if="lookupResult.phonetic.us" class="phonetic-item">
                  US: {{ lookupResult.phonetic.us }}
                </span>
                <span v-if="lookupResult.phonetic.uk" class="phonetic-item">
                  UK: {{ lookupResult.phonetic.uk }}
                </span>
              </div>

              <div v-if="lookupResult.definitions" class="definitions">
                <div
                  v-for="(definition, index) in lookupResult.definitions"
                  :key="index"
                  class="definition-item"
                >
                  {{ index + 1 }}. {{ definition }}
                </div>
              </div>

              <div v-if="lookupResult.error" class="error-message">
                {{ lookupResult.error }}
              </div>
            </div>
          </div>
        </Transition>
      </div>


    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Plus as PlusIcon, Search as SearchIcon, Upload as UploadIcon } from 'lucide-vue-next'
import { type Word } from '@/shared/types'
import SwitchTab from '@/shared/components/controls/SwitchTab.vue'
import { useSourceSelectionReadOnly } from '@/shared/composables/useSourceSelection'
import { useWordLookup } from './composables/useWordLookup'
import { useWordImport } from './composables/useWordImport'
import { logger } from '@/shared/utils/logger'

const log = logger.create('WordInsert')

const inputRef = ref<HTMLInputElement>()

// Local source state for WordInsertForm only
const source = ref<string>('')

// Use read-only composable to get WordIndex selection
const { currentSource, availableSources, initializeFromData } = useSourceSelectionReadOnly()

// Define emit first so we can pass it to composable
const emit = defineEmits<{
  wordInserted: [word: Word]
  batchWordInserted: [words: Word[]]
}>()

// Composables
const {
  lookupWord,
  isLookupLoading,
  lookupResult,
  lookupDefinition,
  handleLookupInput,
  closeLookupResult,
  clearLookup
} = useWordLookup()

const {
  word,
  isLoading,
  isBatchLoading,
  message,
  fileInputRef,
  handleSubmit,
  triggerFileInput,
  handleFileSelect
} = useWordImport(source, inputRef, emit)

// Tab data - dynamically generated
const sourceTabs = computed(() => {
  return availableSources.value.map(src => ({
    value: src,
    label: src
  }))
})

// Handle source change - only changes local state
const handleSourceChange = (value: string) => {
  source.value = value
}

onMounted(async () => {
  try {
    await initializeFromData()
    if (currentSource.value) {
      source.value = currentSource.value
    }
  } catch (error) {
    log.error('Failed to initialize source:', error)
  }

  setTimeout(() => {
    inputRef.value?.focus()
  }, 50)
})
</script>

<style scoped>
.form-container {
  background: var(--color-surface-card);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  border: 1px solid var(--color-border-light);
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  height: 100%;
}

/* 标题 + tab 排版 */
.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 2.5rem; /* 固定高度确保对齐 */
}

.form-title {
  font-family: var(--font-serif);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
  line-height: 1.2;
  display: flex;
  align-items: center;
  letter-spacing: -0.01em;
}

.form-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  position: relative;
  flex: 1;
}

.message-area-wrapper {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  width: 100%;
  z-index: 15;
}

.message-area {
  display: inline-flex;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-default);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  transition: all 0.3s ease-in-out;
  background-color: var(--color-surface-elevated);
  box-shadow: var(--shadow-md);
  color: var(--color-text-secondary);
  max-width: 100%;
}

.message-content {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
}

.message-content span {
  white-space: pre;
  word-break: break-word;
  line-height: 1.5;
  font-family: var(--font-mono);
}

.status-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: var(--radius-full);
  background-color: var(--color-text-secondary);
  margin-top: 0.25rem;
  flex-shrink: 0;
}

.message-success {
  color: var(--color-success);
}

.status-dot-success {
  background-color: var(--color-success);
}

.message-error {
  color: var(--color-delete);
}

.status-dot-error {
  background-color: var(--color-delete);
}

.input-group {
  display: flex;
  gap: 0.75rem;
  height: 2.75rem;
  position: relative;
}

.input-with-clear {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
}

.word-input {
  flex: 1;
  width: 100%;
  box-sizing: border-box;
  padding: 0.75rem 2.5rem 0.75rem 1rem;
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-default);
  transition: all var(--transition-fast);
  height: 100%;
  font-size: 16px; /* 防止移动端自动缩放 */
  background: var(--color-surface-card);
  -webkit-appearance: none;
  appearance: none;
  -webkit-tap-highlight-color: transparent;
}

.word-input:focus {
  outline: none;
  border-color: var(--color-brand-primary);
  box-shadow: 0 0 0 3px rgba(153, 107, 61, 0.12);
}

.word-input:disabled {
  background-color: var(--color-bg-secondary);
  cursor: not-allowed;
}

.submit-button {
  background-color: var(--color-brand-primary);
  color: var(--color-text-inverse);
  padding: 0.75rem 1.5rem;
  border-radius: var(--radius-default);
  font-family: var(--font-ui);
  font-weight: var(--font-weight-medium);
  transition: all var(--transition-fast);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  height: 100%;
  box-sizing: border-box;
  touch-action: manipulation;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  min-width: 80px;
}

.submit-button:hover:not(:disabled) {
  background-color: var(--color-brand-primary-hover);
}

.submit-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.batch-button-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.batch-button {
  background-color: var(--color-state-success);
  color: var(--color-text-inverse);
  padding: 0.75rem 1.5rem;
  border-radius: var(--radius-default);
  font-family: var(--font-ui);
  font-weight: var(--font-weight-medium);
  transition: all var(--transition-fast);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  height: 100%;
  box-sizing: border-box;
  touch-action: manipulation;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  min-width: 110px;
}

.batch-button:hover:not(:disabled) {
  background-color: var(--color-state-success-hover);
}

.batch-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.batch-tooltip {
  position: absolute;
  bottom: calc(100% + 0.5rem);
  left: 50%;
  transform: translateX(-50%);
  background-color: var(--color-text-primary);
  color: var(--color-text-inverse);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  font-family: var(--font-ui);
  font-size: var(--font-size-xs);
  line-height: 1.4;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--transition-fast);
  z-index: 50;
  box-shadow: var(--shadow-lg);
}

.batch-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 0.25rem solid transparent;
  border-top-color: var(--color-text-primary);
}

.batch-button-wrapper:hover .batch-tooltip {
  opacity: 1;
}

.upload-icon {
  width: 1.25rem;
  height: 1.25rem;
}

/* 单词查询样式 - 仿照 SearchAndFilter 布局 */
.lookup-input-row {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
}

.lookup-input-group {
  display: flex;
  gap: 0.5rem;
  width: 100%;
  height: 2.75rem;
}

.lookup-input {
  flex: 1;
  width: 100%;
  box-sizing: border-box;
  padding: 0.75rem 2.5rem 0.75rem 1rem;
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-default);
  transition: all var(--transition-fast);
  height: 100%;
  font-size: 16px; /* 防止移动端自动缩放 */
  background: var(--color-surface-card);
  -webkit-appearance: none;
  appearance: none;
  -webkit-tap-highlight-color: transparent;
}

.lookup-input:focus {
  outline: none;
  border-color: var(--color-state-success);
  box-shadow: 0 0 0 3px rgba(93, 122, 93, 0.12);
}

.lookup-button {
  background-color: var(--color-state-success);
  color: var(--color-text-inverse);
  padding: 0.75rem;
  border-radius: var(--radius-default);
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 100%;
  box-sizing: border-box;
  touch-action: manipulation;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  min-width: 44px;
}

.lookup-button:hover:not(:disabled) {
  background-color: var(--color-state-success-hover);
}

.lookup-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.clear-button {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 1rem;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  line-height: 1;
  /* 移动端触摸优化 */
  touch-action: manipulation;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.clear-button:hover {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
}

.lookup-result-wrapper {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  width: 100%;
  z-index: 20;
  /* 确保完全隐藏时不占用空间 */
  pointer-events: auto;
}

/* 查询结果动画 */
.lookup-fade-enter-active, .lookup-fade-leave-active {
  transition: all 0.2s ease-in-out;
}

.lookup-fade-enter-from {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}

.lookup-fade-leave-to {
  opacity: 0;
  transform: translateY(-8px) scale(0.98);
}

.lookup-fade-enter-to, .lookup-fade-leave-from {
  opacity: 1;
  transform: translateY(0) scale(1);
}

.lookup-result {
  background-color: var(--color-surface-card);
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-default);
  padding: var(--space-4);
  box-shadow: var(--shadow-lg);
  max-height: 200px;
  overflow-y: auto;
}

.close-button {
  background: none;
  border: none;
  font-size: 1.25rem;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0.25rem;
  min-width: 2rem;
  min-height: 2rem;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  transition: all 0.2s ease;
  /* 移动端触摸优化 */
  touch-action: manipulation;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.close-button:hover {
  color: var(--color-text-secondary);
  background-color: var(--color-bg-tertiary);
}

.close-button:active {
  background-color: var(--color-border-medium);
  transform: scale(0.95);
}

.error-message {
  color: var(--color-delete);
  font-size: 0.9rem;
  text-align: center;
  padding: 0.5rem;
  margin-top: 0.5rem;
}

.word-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.word-text {
  font-family: var(--font-serif);
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.phonetic {
  margin-top: var(--space-2);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.phonetic-item {
  font-family: var(--font-mono);
}

.definitions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.definition-item {
  font-family: var(--font-serif);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  line-height: 1.6;
}

.loading-spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: var(--radius-full);
  animation: spin 1s linear infinite;
}

/* spin animation defined in animations.css */

/* 移动端响应式适配 */
@media (max-width: 768px) {
  .form-container {
    padding: var(--space-4);
    border-radius: var(--radius-default);
    gap: var(--space-3);
  }

  .form-header {
    flex-direction: column;
    align-items: stretch;
    height: auto;
    gap: var(--space-3);
  }

  .form-title {
    font-size: var(--font-size-lg);
    text-align: center;
  }

  .form-content {
    gap: var(--space-3);
  }

  .input-group {
    flex-direction: column;
    height: auto;
    gap: var(--space-3);
  }

  .word-input {
    height: 48px;
    padding: 0.875rem 2.5rem 0.875rem 1rem;
  }

  .submit-button {
    height: 48px;
    padding: 0.875rem 1.25rem;
    min-width: 120px;
    justify-content: center;
  }

  .batch-button-wrapper {
    width: 100%;
  }

  .batch-button {
    height: 48px;
    padding: 0.875rem 1.25rem;
    min-width: 130px;
    justify-content: center;
    width: 100%;
  }

  .lookup-input-group {
    height: 48px;
  }

  .lookup-input {
    height: 48px;
    padding: 0.875rem 2.5rem 0.875rem 1rem;
  }

  .lookup-button {
    width: 48px;
    min-width: 48px;
    height: 48px;
  }

  .clear-button {
    right: 0.25rem;
    width: 2rem;
    height: 2rem;
    min-width: 44px;
    min-height: 44px;
  }

  .lookup-result {
    padding: var(--space-3);
    max-height: 240px;
  }

  .word-text {
    font-size: var(--font-size-lg);
  }

  .phonetic {
    flex-direction: column;
    gap: var(--space-1);
  }

  .definition-item {
    font-size: var(--font-size-xs);
  }
}

/* 横屏适配 */
@media (max-height: 500px) and (orientation: landscape) {
  .form-container {
    padding: 0.75rem;
    gap: 0.625rem;
  }

  .form-header {
    gap: 0.5rem;
  }

  .form-title {
    font-size: 1rem;
  }

  .input-group {
    gap: 0.5rem;
  }

  .word-input,
  .lookup-input {
    height: 36px;
    padding: 0.5rem 2rem 0.5rem 0.75rem;
  }

  .submit-button {
    height: 36px;
    padding: 0.5rem 1rem;
    font-size: 0.8125rem;
  }

  .batch-button-wrapper {
    width: 100%;
  }

  .batch-button {
    height: 36px;
    padding: 0.5rem 1rem;
    font-size: 0.8125rem;
    min-width: 100px;
    width: 100%;
  }

  .lookup-input-group {
    height: 36px;
  }

  .lookup-button {
    width: 36px;
    min-width: 36px;
    height: 36px;
  }

  .clear-button {
    right: 0.25rem;
    width: 1.5rem;
    height: 1.5rem;
    min-width: 1.5rem;
    min-height: 1.5rem;
  }

  .lookup-result {
    padding: 0.5rem;
    max-height: 160px;
  }
}
</style>