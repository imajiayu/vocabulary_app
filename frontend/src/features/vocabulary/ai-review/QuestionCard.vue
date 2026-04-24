<template>
  <article
    class="q-card"
    :class="[`q-type-${question.type}`, { 'q-open': showAnswer }]"
  >
    <header class="q-head">
      <span class="q-index">{{ String(index + 1).padStart(2, '0') }}</span>
      <span class="q-type">{{ typeLabel }}</span>
    </header>

    <div class="q-prompt" v-html="highlightedPrompt" />

    <textarea
      class="q-input"
      rows="3"
      :placeholder="placeholder"
      v-model="userInput"
    />

    <div class="q-actions">
      <button
        class="q-toggle"
        type="button"
        :aria-expanded="showAnswer"
        @click="showAnswer = !showAnswer"
      >
        <svg
          class="toggle-icon"
          :class="{ rotate: showAnswer }"
          viewBox="0 0 12 12"
          width="11"
          height="11"
          aria-hidden="true"
        >
          <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span>{{ showAnswer ? '收起答案' : '查看答案' }}</span>
      </button>
    </div>

    <Transition name="answer">
      <div v-if="showAnswer" class="q-answer">
        <div class="answer-body">{{ question.answer }}</div>
        <div v-if="question.target_words.length" class="target-words">
          <span class="target-label">目标词</span>
          <span class="target-pills">
            <span
              v-for="w in question.target_words"
              :key="w"
              class="target-pill"
            >{{ w }}</span>
          </span>
        </div>
      </div>
    </Transition>
  </article>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { AiReviewQuestion } from '@/shared/api/aiReview'

interface Props {
  question: AiReviewQuestion
  index: number
}

const props = defineProps<Props>()

const userInput = ref('')
const showAnswer = ref(false)

const typeLabel = computed(() => (props.question.type === 'zh_to_en' ? '中译英' : '英译中'))
const placeholder = computed(() =>
  props.question.type === 'zh_to_en' ? '在此输入英文译文……' : '在此输入中文译文……',
)

const highlightedPrompt = computed(() => {
  const escaped = escapeHtml(props.question.prompt)
  return escaped.replace(/\[\[([^\]]+)\]\]/g, '<mark class="q-target">$1</mark>')
})

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
</script>

<style scoped>
.q-card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.125rem 1.25rem 1rem;
  background: var(--primitive-paper-100);
  border: 1px solid var(--primitive-paper-400);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.q-card:hover {
  border-color: var(--primitive-paper-500);
}
.q-card.q-open { box-shadow: var(--shadow-md); }

/* ——— Head ——— */
.q-head {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}
.q-index {
  font-family: var(--font-mono);
  font-weight: 700;
  color: var(--primitive-copper-600);
  font-size: 0.875rem;
  letter-spacing: 0.04em;
  font-variant-numeric: tabular-nums;
}
.q-type {
  font-family: var(--font-sans);
  font-size: 0.75rem;
  color: var(--primitive-ink-500);
}

/* ——— Prompt ——— */
.q-prompt {
  font-family: var(--font-serif);
  font-size: 1.0625rem;
  line-height: 1.75;
  color: var(--primitive-ink-800);
}
.q-prompt :deep(.q-target) {
  background: rgba(153, 107, 61, 0.12);
  padding: 0 2px;
  color: var(--primitive-copper-700);
  font-weight: 600;
  border-radius: 2px;
}

/* ——— Input ——— */
.q-input {
  width: 100%;
  padding: 0.625rem 0.75rem;
  background: var(--primitive-paper-50);
  border: 1px solid var(--primitive-paper-400);
  border-radius: var(--radius-md);
  font-family: var(--font-serif);
  font-size: 0.9375rem;
  line-height: 1.6;
  color: var(--primitive-ink-800);
  resize: vertical;
  min-height: 72px;
  outline: none;
  transition: border-color 0.18s ease, box-shadow 0.18s ease;
}
.q-input::placeholder {
  color: var(--primitive-ink-400);
}
.q-input:focus {
  border-color: var(--primitive-copper-400);
  box-shadow: 0 0 0 3px rgba(153, 107, 61, 0.12);
}

/* ——— Actions ——— */
.q-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.q-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.3125rem 0.75rem;
  border: 1px solid var(--primitive-paper-400);
  background: transparent;
  border-radius: var(--radius-full);
  color: var(--primitive-ink-600);
  font-family: var(--font-sans);
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: color 0.18s ease, border-color 0.18s ease,
    background-color 0.18s ease;
}
.q-toggle:hover {
  background: var(--primitive-paper-200);
  color: var(--primitive-copper-600);
  border-color: var(--primitive-copper-300);
}
.q-toggle .toggle-icon {
  transition: transform 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.q-toggle .toggle-icon.rotate {
  transform: rotate(-180deg);
}

/* ——— Answer ——— */
.q-answer {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem 0.875rem;
  background: var(--primitive-paper-200);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.answer-body {
  font-family: var(--font-serif);
  font-size: 0.9375rem;
  line-height: 1.7;
  color: var(--primitive-ink-800);
}

.target-words {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem 0.5rem;
  padding-top: 0.375rem;
  border-top: 1px dashed var(--primitive-paper-500);
}
.target-label {
  font-family: var(--font-mono);
  font-size: 0.625rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--primitive-ink-500);
}
.target-pills {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px 5px;
}
.target-pill {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  padding: 2px 9px;
  border-radius: var(--radius-full);
  background: var(--primitive-paper-100);
  color: var(--primitive-copper-600);
  border: 1px solid var(--primitive-paper-400);
}

/* ——— Transitions ——— */
.answer-enter-active,
.answer-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease,
    max-height 0.32s cubic-bezier(0.2, 0.8, 0.2, 1);
  overflow: hidden;
  max-height: 460px;
}
.answer-enter-from,
.answer-leave-to {
  opacity: 0;
  max-height: 0;
  transform: translateY(-4px);
}
.answer-enter-to,
.answer-leave-from {
  opacity: 1;
  max-height: 460px;
}

@media (max-width: 768px) {
  .q-card { padding: 1rem; }
  .q-prompt { font-size: 1rem; line-height: 1.7; }
}
</style>
