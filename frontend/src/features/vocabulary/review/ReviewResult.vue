<template>
  <!-- onlyShowWord 模式 -->
  <div v-if="onlyShowWord && props.word" class="only-word-container">
    <div class="word-display clickable-word" @click="playWordAudio(props.word.word, audioAccent)">
      {{ props.word.word }}
    </div>
  </div>

  <!-- onlyShowDefinitions 模式 -->
  <div v-else-if="onlyShowDefinitions && props.word?.definition?.definitions?.length">
    <div class="definitions-display">
      <div v-for="(definition, index) in props.word.definition.definitions" :key="`${props.word?.id}-only-def-${index}-${definition}`" class="definition-item">
        {{ definition }}
      </div>
    </div>
  </div>

  <!-- 默认完整展示模式 -->
  <div v-else-if="hasDefinition" :class="['content-wrapper', { horizontal: props.horizontal }]">
    <!-- 右侧内容 -->
    <div class="main-content">
      <div class="field-group word-field-group">
        <label class="field-label">单词</label>
        <div class="word-display">
          {{ props.word?.word }}
        </div>
      </div>

      <div class="field-group">
        <label class="field-label">音标</label>
        <div class="phonetic-display">
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
      </div>

      <div class="field-group">
        <label class="field-label">释义</label>
        <div class="definitions-display">
          <div v-for="(definition, index) in props.word?.definition.definitions" :key="`${props.word?.id}-def-${index}-${definition}`" class="definition-item">
            {{ definition }}
          </div>
        </div>
      </div>
    </div>

    <!-- 左侧例句模块 - 仅在有例句时显示整个容器 -->
    <div v-if="hasExamples" class="examples-container">
      <div class="field-group">
        <label class="field-label">例句</label>
        <div class="examples-display">
          <div v-for="(example, index) in props.word?.definition.examples" :key="`${props.word?.id}-ex-${index}-${example.en}`" class="example-item">
            <div class="example-en" v-html="example.en"></div>
            <div class="example-zh">{{ example.zh }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 加载状态 -->
  <div v-else class="loading-container">
    <div class="loading-spinner"></div>
    <p>加载中...</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Word } from '@/shared/types';
import { playWordAudio } from '@/shared/utils/playWordAudio';
import { useAudioAccent } from '@/shared/composables/useAudioAccent';

interface Props {
  word?: Word;
  onlyShowWord?: boolean;
  onlyShowDefinitions?: boolean;
  horizontal?: boolean; // 新增
}

const props = withDefaults(defineProps<Props>(), {
  horizontal: false,
});

// 使用全局音频设置
const { audioAccent } = useAudioAccent();

const hasDefinition = computed(() => {
  if (!props.word) return false;
  const definition = props.word.definition;
  return definition && Object.keys(definition).length > 0;
});

const hasExamples = computed(() => {
  if (!props.word?.definition?.examples) return false;
  return props.word.definition.examples.length > 0;
});
</script>

<style scoped>
/* 主容器 - 优化以避免滚动冲突 */
.content-wrapper {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  /* 确保内容能够自然流动，不创建新的滚动上下文 */
}

/* 仅显示单词模式的容器 */
.only-word-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0;
  width: 100%;
  min-height: 120px; /* 固定高度确保位置一致 */
}

/* 横向布局 */
.content-wrapper.horizontal {
  flex-direction: row;
  align-items: flex-start;
  gap: 2rem;
}

/* 桌面端横向布局的特殊样式 */
@media (min-width: 481px) {
  .content-wrapper.horizontal {
    width: 100%;
    min-width: 600px;
  }

  .content-wrapper.horizontal .main-content {
    width: 50%;
    align-items: flex-start;
  }

  .content-wrapper.horizontal .examples-container {
    width: 50%;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .content-wrapper.horizontal .field-group {
    width: 100%;
    align-items: flex-start;
  }

  /* 桌面端横向布局时调整单词字段组 */
  .content-wrapper.horizontal .word-field-group {
    min-height: 80px; /* 减少最小高度 */
    position: relative;
    padding-top: 1.5rem; /* 为标题留出空间 */
  }

  /* 横向布局时调整单词标题标签位置 */
  .content-wrapper.horizontal .word-field-group .field-label {
    position: absolute;
    top: 0; /* 改为从顶部开始 */
    left: 0;
    right: 0;
    white-space: nowrap;
    overflow: visible;
  }

  /* 桌面端横向布局下only-show-word模式的居中样式 */
  .only-word-container .word-display {
    text-align: center;
  }
}

/* 非横向布局下的主内容区 */
.main-content {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 100%;
}

/* 非横向布局下的例句容器 */
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
  min-height: 120px; /* 与 only-word-container 保持一致 */
  justify-content: center;
  align-items: center;
  position: relative;
}

.word-field-group .field-label {
  position: absolute;
  top: -1.5rem;
  left: 0;
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
  text-align: left;
}

.clickable-word {
  cursor: pointer;
  color: var(--color-primary);
  transition: all 0.2s ease;
}

.clickable-word:hover {
  color: var(--color-primary-hover);
  /* 移除下划线 */
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
  color: var(--color-text-primary);
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

/* 例句标签特殊样式 - 覆盖word-field-group的绝对定位 */
.examples-container .field-label {
  position: static !important;
  top: auto !important;
  left: auto !important;
  margin-bottom: 0.75rem !important;
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
    width: 100%;
  }

  /* 移动端强制垂直布局 */
  .content-wrapper.horizontal {
    flex-direction: column !important;
    gap: 1.25rem;
  }

  .phonetic-display {
    gap: 0.75rem !important;
    display: flex !important;
    flex-direction: column !important;
  }

  .definitions-display {
    gap: 0.75rem !important;
    display: flex !important;
    flex-direction: column !important;
  }

  .main-content {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .field-group {
    margin-bottom: 1.25rem;
    width: auto;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .field-label {
    font-size: 0.8rem;
    margin-bottom: 0.5rem;
  }

  /* 单词字段组特殊处理 */
  .field-group:first-child,
  .word-field-group {
    width: 100%;
    align-items: center;
    min-height: 90px; /* 移动端减小高度 */
  }

  .field-group:first-child .field-label,
  .word-field-group .field-label {
    align-self: flex-start;
    position: absolute;
    top: 0;
    left: 0;
    margin-bottom: 0;
  }

  .word-display {
    font-size: 2rem;
    text-align: center !important;
    width: 100%;
  }

  .phonetic-display, .definitions-display {
    width: 100%;
    max-width: 100%;
    text-align: left;
  }

  .examples-display {
    width: 100%;
    max-width: 100%;
    text-align: left;
    align-items: flex-start;
  }

  .only-word-container {
    padding: 0;
    min-height: 90px; /* 与移动端word-field-group保持一致 */
    position: relative; /* 确保与word-field-group结构一致 */
  }


  .examples-container .examples-display {
    gap: 1rem !important;
  }

  .examples-container {
    width: 100%;
    max-width: 100%;
  }

  .examples-container .field-group {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
  }

  .examples-container .field-label {
    text-align: left !important;
    align-self: flex-start;
    position: static;
    margin-bottom: 0.75rem;
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
    width: 100%;
  }

  /* 小屏幕强制垂直布局 */
  .content-wrapper.horizontal {
    flex-direction: column !important;
    gap: 1rem;
  }

  .phonetic-display {
    gap: 0.625rem !important;
  }

  .definitions-display {
    gap: 0.625rem !important;
  }

  .main-content {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .field-group {
    margin-bottom: 1rem;
    width: auto;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  /* 单词字段组特殊处理 */
  .field-group:first-child,
  .word-field-group {
    width: 100%;
    align-items: center;
    min-height: 80px; /* 小屏幕进一步减小高度 */
  }

  .field-group:first-child .field-label,
  .word-field-group .field-label {
    align-self: flex-start;
    position: absolute;
    top: 0;
    left: 0;
    margin-bottom: 0;
  }

  .word-display {
    font-size: 1.75rem;
    text-align: center !important;
    width: 100%;
  }

  .phonetic-display, .definitions-display {
    width: 100%;
    max-width: 100%;
    display: flex;
    flex-direction: column;
    text-align: left;
  }

  .examples-display {
    width: 100%;
    max-width: 100%;
    text-align: left;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }

  .only-word-container {
    padding: 0;
    min-height: 80px; /* 与小屏幕word-field-group保持一致 */
    position: relative; /* 确保与word-field-group结构一致 */
  }


  .examples-container .examples-display {
    gap: 0.875rem !important;
  }

  .examples-container {
    width: 100%;
    max-width: 100%;
  }

  .examples-container .field-group {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
  }

  .examples-container .field-label {
    text-align: left !important;
    align-self: flex-start;
    position: static;
    margin-bottom: 0.5rem;
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
