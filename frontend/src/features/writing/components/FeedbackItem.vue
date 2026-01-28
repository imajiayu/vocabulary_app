<template>
  <div
    class="feedback-item"
    :class="{
      'is-major': issue.severity === 'major',
      'has-suggestion': !!issue.suggestion
    }"
    @click="handleClick"
  >
    <!-- Severity indicator -->
    <div class="severity-dot" :title="issue.severity === 'major' ? '严重问题' : '轻微问题'"></div>

    <!-- Issue content -->
    <div class="issue-content">
      <p class="issue-description">{{ issue.description }}</p>

      <!-- Suggestion (if available) -->
      <div v-if="issue.suggestion" class="issue-suggestion">
        <div class="suggestion-content" v-html="formattedSuggestion"></div>
      </div>

      <!-- Get suggestion button -->
      <button
        v-else
        class="suggestion-btn"
        :disabled="isLoadingSuggestion"
        @click.stop="handleRequestSuggestion"
      >
        {{ isLoadingSuggestion ? '获取中...' : '获取建议' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { WritingIssue } from '@/shared/types/writing'

const props = defineProps<{
  issue: WritingIssue
}>()

const emit = defineEmits<{
  (e: 'click'): void
  (e: 'request-suggestion'): void
}>()

const isLoadingSuggestion = ref(false)

const formattedSuggestion = computed(() => {
  if (!props.issue.suggestion) return ''

  // Convert markdown-like formatting to HTML
  return props.issue.suggestion
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
})

function handleClick() {
  emit('click')
}

async function handleRequestSuggestion() {
  if (isLoadingSuggestion.value) return

  isLoadingSuggestion.value = true
  emit('request-suggestion')

  // Reset loading after a timeout (actual loading is handled by parent)
  setTimeout(() => {
    isLoadingSuggestion.value = false
  }, 5000)
}
</script>

<style scoped>
.feedback-item {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(250, 247, 242, 0.02);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s ease;
}

.feedback-item:hover {
  background: rgba(250, 247, 242, 0.05);
}

/* ── Severity Dot ── */
.severity-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  margin-top: 6px;
  border-radius: 50%;
  background: var(--primitive-ink-400);
}

.feedback-item.is-major .severity-dot {
  background: #ef4444;
  box-shadow: 0 0 6px rgba(239, 68, 68, 0.5);
}

/* ── Issue Content ── */
.issue-content {
  flex: 1;
  min-width: 0;
}

.issue-description {
  margin: 0 0 8px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--primitive-paper-300);
}

/* ── Suggestion ── */
.issue-suggestion {
  padding: 10px 12px;
  background: rgba(59, 130, 246, 0.08);
  border-radius: var(--radius-sm);
  border-left: 2px solid var(--primitive-azure-500);
}

.suggestion-content {
  font-size: 13px;
  line-height: 1.6;
  color: var(--primitive-paper-300);
}

.suggestion-content :deep(strong) {
  color: var(--primitive-paper-200);
  font-weight: 600;
}

/* ── Suggestion Button ── */
.suggestion-btn {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 500;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: var(--radius-sm);
  color: var(--primitive-azure-400);
  cursor: pointer;
  transition: all 0.2s ease;
}

.suggestion-btn:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.3);
}

.suggestion-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
