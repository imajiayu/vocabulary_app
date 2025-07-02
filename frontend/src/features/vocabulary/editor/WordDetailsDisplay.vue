<template>
  <div class="content-wrapper">
    <!-- 单词标题区 -->
    <div class="word-hero">
      <h1 class="word-display">{{ props.word?.word }}</h1>

      <!-- 音标 inline -->
      <div v-if="hasDefinition" class="phonetic-row">
        <span
          v-if="props.word?.definition.phonetic?.us"
          class="phonetic-pill"
          @click="playWordAudio(props.word.word, 'us')"
        >
          <span class="phonetic-flag">US</span>
          <span class="phonetic-text">{{ props.word.definition.phonetic.us }}</span>
        </span>
        <span
          v-if="props.word?.definition.phonetic?.uk"
          class="phonetic-pill"
          @click="playWordAudio(props.word.word, 'uk')"
        >
          <span class="phonetic-flag">UK</span>
          <span class="phonetic-text">{{ props.word.definition.phonetic.uk }}</span>
        </span>
      </div>
      <div v-else class="loading-inline">
        <div class="loading-spinner"></div>
      </div>
    </div>

    <!-- 释义区 -->
    <div class="section">
      <label class="section-label">释义</label>
      <div v-if="hasDefinition" class="definitions-list">
        <div
          v-for="(definition, index) in props.word?.definition.definitions"
          :key="`${props.word?.id}-def-${index}-${definition}`"
          class="definition-item"
        >
          <span class="def-index">{{ index + 1 }}</span>
          <span class="def-text">{{ definition }}</span>
        </div>
      </div>
      <div v-else class="loading-container">
        <div class="loading-spinner"></div>
        <p>加载中...</p>
      </div>
    </div>

    <!-- 例句区 -->
    <div class="section">
      <label class="section-label">例句</label>
      <div v-if="hasDefinition" class="examples-list">
        <div
          v-for="(example, index) in props.word?.definition.examples"
          :key="`${props.word?.id}-ex-${index}-${example.en}`"
          class="example-item"
        >
          <div class="example-en" v-html="example.en"></div>
          <div class="example-zh">{{ example.zh }}</div>
        </div>
      </div>
      <div v-else class="loading-container">
        <div class="loading-spinner"></div>
        <p>加载中...</p>
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
/* ═══════════════════════════════════════════════════════════════════════════
   WordDetailsDisplay - Editorial Study 学术词条展示
   ═══════════════════════════════════════════════════════════════════════════ */

.content-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  width: 100%;
  box-sizing: border-box;
}

/* ── Word Hero ── */
.word-hero {
  text-align: center;
  padding-bottom: var(--space-5);
  border-bottom: 1px solid var(--color-border-light);
}

.word-display {
  margin: 0;
  font-family: var(--font-serif);
  font-size: clamp(2rem, 5vw, 2.75rem);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  line-height: 1.15;
  word-break: break-word;
  letter-spacing: -0.02em;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.phonetic-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  margin-top: var(--space-3);
  flex-wrap: wrap;
}

.phonetic-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-light);
  cursor: pointer;
  transition: all var(--transition-fast);
  user-select: none;
}

.phonetic-pill:hover {
  background: var(--color-primary-light);
  border-color: var(--color-brand-primary);
}

.phonetic-pill:active {
  transform: scale(0.97);
}

.phonetic-flag {
  font-family: var(--font-sans);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.phonetic-text {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  color: var(--color-brand-primary);
  font-weight: var(--font-weight-medium);
  -webkit-font-smoothing: antialiased;
}

.loading-inline {
  display: flex;
  justify-content: center;
  margin-top: var(--space-3);
}

/* ── Section ── */
.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.section-label {
  font-family: var(--font-sans);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

/* ── Definitions ── */
.definitions-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.definition-item {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-secondary);
  border-radius: var(--radius-default);
  border-left: 3px solid var(--color-brand-primary);
}

.def-index {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-brand-primary);
  min-width: 16px;
  text-align: center;
  flex-shrink: 0;
  line-height: 1.6;
}

.def-text {
  font-family: var(--font-serif);
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  line-height: 1.6;
}

/* ── Examples ── */
.examples-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.example-item {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-default);
  background: var(--color-bg-secondary);
  border-left: 3px solid var(--color-state-success);
  transition: background var(--transition-fast);
}

.example-en {
  font-family: var(--font-serif);
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
  line-height: 1.55;
  margin-bottom: var(--space-1);
}

.example-zh {
  font-family: var(--font-serif);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.5;
  font-style: italic;
}

/* ── Loading ── */
.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-8) 0;
  gap: var(--space-3);
  color: var(--color-text-tertiary);
  font-family: var(--font-sans);
  font-size: var(--font-size-sm);
}

.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-border-light);
  border-top-color: var(--color-brand-primary);
  border-radius: var(--radius-full);
  animation: spin 0.8s linear infinite;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Mobile
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .content-wrapper {
    gap: var(--space-5);
  }

  .word-hero {
    padding-bottom: var(--space-4);
  }

  .word-display {
    font-size: clamp(1.5rem, 8vw, 2rem);
  }

  .phonetic-row {
    gap: var(--space-2);
  }

  .phonetic-pill {
    padding: 3px var(--space-2);
  }

  .phonetic-flag {
    font-size: 9px;
  }

  .phonetic-text {
    font-size: 11px;
  }

  .section-label {
    font-size: 10px;
  }

  .definition-item {
    padding: var(--space-2) var(--space-3);
  }

  .def-text {
    font-size: var(--font-size-sm);
  }

  .example-item {
    padding: var(--space-2) var(--space-3);
  }

  .example-en {
    font-size: var(--font-size-sm);
  }

  .example-zh {
    font-size: var(--font-size-xs);
  }
}

/* ── Landscape ── */
@media (max-height: 600px) and (orientation: landscape) {
  .word-display {
    font-size: 1.5rem;
  }

  .definition-item,
  .example-item {
    padding: var(--space-2) var(--space-3);
  }
}
</style>