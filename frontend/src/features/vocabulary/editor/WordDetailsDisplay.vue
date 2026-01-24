<template>
  <div class="content-wrapper">
    <!-- 主内容 -->
    <div class="main-content">
      <!-- 单词部分 - 始终显示 -->
      <div class="field-group word-field-group">
        <label class="field-label">单词</label>
        <div class="word-display">
          {{ props.word?.word }}
        </div>
      </div>

      <!-- 音标部分 -->
      <div class="field-group">
        <label class="field-label">音标</label>
        <!-- 有定义时显示音标 -->
        <div v-if="hasDefinition" class="phonetic-display">
          <div v-if="props.word?.definition.phonetic?.us" class="phonetic-item">
            <span class="phonetic-region">美音</span>
            <span class="phonetic-text clickable-phonetic" @click="playWordAudio(props.word.word, 'us')">
              {{ props.word.definition.phonetic.us }}
            </span>
          </div>

          <div v-if="props.word?.definition.phonetic?.uk" class="phonetic-item">
            <span class="phonetic-region">英音</span>
            <span class="phonetic-text clickable-phonetic" @click="playWordAudio(props.word.word, 'uk')">
              {{ props.word.definition.phonetic.uk }}
            </span>
          </div>
        </div>
        <!-- 无定义时显示加载动画 -->
        <div v-else class="loading-container">
          <div class="loading-spinner"></div>
          <p>加载中...</p>
        </div>
      </div>

      <!-- 释义部分 -->
      <div class="field-group">
        <label class="field-label">释义</label>
        <!-- 有定义时显示释义 -->
        <div v-if="hasDefinition" class="definitions-display">
          <div v-for="(definition, index) in props.word?.definition.definitions" :key="`${props.word?.id}-def-${index}-${definition}`" class="definition-item">
            {{ definition }}
          </div>
        </div>
        <!-- 无定义时显示加载动画 -->
        <div v-else class="loading-container">
          <div class="loading-spinner"></div>
          <p>加载中...</p>
        </div>
      </div>
    </div>

    <!-- 例句模块 -->
    <div class="examples-container">
      <div class="field-group">
        <label class="field-label">例句</label>
        <!-- 有定义时显示例句 -->
        <div v-if="hasDefinition" class="examples-display">
          <div v-for="(example, index) in props.word?.definition.examples" :key="`${props.word?.id}-ex-${index}-${example.en}`" class="example-item">
            <div class="example-en" v-html="example.en"></div>
            <div class="example-zh">{{ example.zh }}</div>
          </div>
        </div>
        <!-- 无定义时显示加载动画 -->
        <div v-else class="loading-container">
          <div class="loading-spinner"></div>
          <p>加载中...</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Word } from '@/shared/types';
import { playWordAudio } from '@/shared/utils/playWordAudio';

interface Props {
  word?: Word;
}

const props = defineProps<Props>();

const hasDefinition = computed(() => {
  if (!props.word) return false;
  const definition = props.word.definition;
  return definition && Object.keys(definition).length > 0;
});
</script>

<style scoped>
/* 主容器 */
.content-wrapper {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

/* 主内容区 */
.main-content {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 100%;
}

/* 例句容器 */
.examples-container {
  width: 100%;
  max-width: 100%;
}

/* 字段组 */
.field-group {
  display: flex;
  flex-direction: column;
  margin-bottom: 1.5rem;
  width: 100%;
  max-width: 100%;
  align-items: flex-start;
}

/* 单词字段组特殊样式 */
.word-field-group {
  align-items: center;
}

/* 单词字段组的标签保持左对齐 */
.word-field-group .field-label {
  width: 100%;
  text-align: left;
}

.field-group:last-child {
  margin-bottom: 0;
}

/* 字段标签 */
.field-label {
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* 单词显示 */
.word-display {
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--color-text-primary);
  line-height: 1.2;
  word-break: break-word;
  width: 100%;
  text-align: center;
}

/* 音标显示 */
.phonetic-display {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.phonetic-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-default);
  border: 1px solid var(--color-border-medium);
}

.phonetic-region {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  min-width: 3rem;
  text-align: center;
  background: var(--color-border-medium);
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-xs);
}

.phonetic-text {
  font-family: 'Courier New', monospace;
  color: var(--color-primary);
  font-weight: 500;
  font-size: 1rem;
}

.clickable-phonetic {
  cursor: pointer;
  transition: all 0.2s ease;
  padding: 0.25rem 0.5rem;
  border-radius: var(--radius-xs);
}

.clickable-phonetic:hover {
  /* 移除下划线 */
  color: var(--color-primary-hover);
  background: var(--color-primary-light);
}

/* 释义显示 */
.definitions-display {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.definition-item {
  color: var(--color-text-secondary);
  line-height: 1.6;
  font-size: 1rem;
  padding: 0.75rem;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-default);
  border-left: 4px solid var(--color-primary);
}

/* 例句显示 */
.examples-display {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}


.example-item {
  padding: 1rem;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-md);
  border-left: 4px solid var(--color-success);
}

.example-en {
  color: var(--color-text-primary);
  font-weight: 500;
  margin-bottom: 0.5rem;
  line-height: 1.5;
  font-size: 0.95rem;
}

.example-zh {
  color: var(--color-text-secondary);
  font-size: 0.875rem;
  line-height: 1.4;
  font-style: italic;
}

/* 加载状态 */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 0;
  gap: 1rem;
  color: var(--color-text-secondary);
}

.loading-spinner {
  width: 2rem;
  height: 2rem;
  border: 4px solid var(--color-border-medium);
  border-top: 4px solid var(--color-primary);
  border-radius: var(--radius-full);
  animation: spin 1s linear infinite;
}

/* spin animation defined in animations.css */

/* 手机端适配 */
@media (max-width: 480px) {
  .content-wrapper {
    gap: 1.25rem;
  }

  .phonetic-display {
    gap: 0.75rem;
  }

  .definitions-display {
    gap: 0.75rem;
  }

  .field-group {
    margin-bottom: 1.25rem;
  }

  .field-label {
    font-size: 0.8rem;
    margin-bottom: 0.5rem;
  }

  .word-display {
    font-size: 2rem;
  }

  .examples-display {
    gap: 1rem;
  }

  .phonetic-item {
    padding: 0.75rem;
    gap: 0.75rem;
  }

  .phonetic-region {
    min-width: 2.5rem;
    font-size: 0.7rem;
  }

  .phonetic-text {
    font-size: 0.9rem;
  }

  .definition-item {
    padding: 0.875rem;
    font-size: 0.95rem;
  }

  .example-item {
    padding: 0.875rem;
  }

  .example-en {
    font-size: 0.9rem;
  }

  .example-zh {
    font-size: 0.8rem;
  }
}

/* 小屏幕手机适配 */
@media (max-width: 480px) {
  .content-wrapper {
    gap: 1rem;
  }

  .phonetic-display {
    gap: 0.625rem;
  }

  .definitions-display {
    gap: 0.625rem;
  }

  .field-group {
    margin-bottom: 1rem;
  }

  .word-display {
    font-size: 1.75rem;
  }

  .examples-display {
    gap: 0.875rem;
  }

  .phonetic-item {
    padding: 0.625rem;
    gap: 0.5rem;
  }

  .phonetic-region {
    min-width: 2rem;
    font-size: 0.65rem;
    padding: 0.2rem 0.4rem;
  }

  .phonetic-text {
    font-size: 0.85rem;
  }

  .definition-item {
    padding: 0.75rem;
    font-size: 0.9rem;
  }

  .example-item {
    padding: 0.75rem;
  }

  .example-en {
    font-size: 0.85rem;
    margin-bottom: 0.375rem;
  }

  .example-zh {
    font-size: 0.75rem;
  }
}

/* 横屏适配 */
@media (max-height: 600px) and (orientation: landscape) {
  .word-display {
    font-size: 1.5rem;
  }

  .field-group {
    margin-bottom: 0.75rem;
  }

  .phonetic-item {
    padding: 0.5rem;
  }

  .definition-item {
    padding: 0.625rem;
  }

  .example-item {
    padding: 0.625rem;
  }
}

/* 高分辨率屏幕优化 */
@media (min-resolution: 2dppx) {
  .word-display {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  .phonetic-text {
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
}
</style>