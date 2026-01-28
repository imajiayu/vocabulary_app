<template>
  <div class="essay-editor" :class="{ 'is-disabled': disabled }">
    <div class="editor-container">
      <!-- Highlighted overlay (for showing issues) -->
      <div
        ref="highlightOverlay"
        class="highlight-overlay"
        v-html="highlightedHtml"
      ></div>

      <!-- Actual textarea -->
      <textarea
        ref="textareaRef"
        :value="modelValue"
        :disabled="disabled"
        class="editor-textarea"
        placeholder="在这里输入你的作文..."
        @input="handleInput"
        @scroll="syncScroll"
      ></textarea>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import type { HighlightRegion } from '@/shared/types/writing'

const props = withDefaults(defineProps<{
  modelValue: string
  disabled?: boolean
  highlights?: HighlightRegion[]
}>(), {
  disabled: false,
  highlights: () => []
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'word-count', count: number): void
  (e: 'highlight-click', issueId: string): void
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const highlightOverlay = ref<HTMLDivElement | null>(null)

// Compute highlighted HTML
const highlightedHtml = computed(() => {
  if (!props.highlights.length) {
    return escapeHtml(props.modelValue) + '\n'
  }

  const text = props.modelValue
  const sortedHighlights = [...props.highlights].sort((a, b) => a.start - b.start)

  let result = ''
  let lastIndex = 0

  for (const highlight of sortedHighlights) {
    // Add text before highlight
    if (highlight.start > lastIndex) {
      result += escapeHtml(text.substring(lastIndex, highlight.start))
    }

    // Add highlighted text
    const highlightedText = text.substring(highlight.start, highlight.end)
    const colorClass = getHighlightClass(highlight.type)
    result += `<mark class="${colorClass}" data-issue-id="${highlight.issueId}">${escapeHtml(highlightedText)}</mark>`

    lastIndex = highlight.end
  }

  // Add remaining text
  if (lastIndex < text.length) {
    result += escapeHtml(text.substring(lastIndex))
  }

  // Add extra newline for proper scrolling
  return result + '\n'
})

function getHighlightClass(type: string): string {
  switch (type) {
    case 'grammar': return 'highlight-grammar'
    case 'vocabulary': return 'highlight-vocabulary'
    case 'coherence': return 'highlight-coherence'
    case 'task': return 'highlight-task'
    default: return 'highlight-default'
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
}

function handleInput(event: Event) {
  const target = event.target as HTMLTextAreaElement
  emit('update:modelValue', target.value)

  // Count words
  const wordCount = target.value.trim().split(/\s+/).filter(w => w.length > 0).length
  emit('word-count', wordCount)
}

function syncScroll() {
  if (textareaRef.value && highlightOverlay.value) {
    highlightOverlay.value.scrollTop = textareaRef.value.scrollTop
    highlightOverlay.value.scrollLeft = textareaRef.value.scrollLeft
  }
}

// Watch for external value changes
watch(() => props.modelValue, () => {
  nextTick(() => {
    const wordCount = props.modelValue.trim().split(/\s+/).filter(w => w.length > 0).length
    emit('word-count', wordCount)
  })
}, { immediate: true })

// Expose focus method
defineExpose({
  focus: () => textareaRef.value?.focus()
})
</script>

<style scoped>
.essay-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.editor-container {
  flex: 1;
  position: relative;
  margin: 16px;
  border-radius: var(--radius-md);
  background: rgba(250, 247, 242, 0.03);
  border: 1px solid rgba(250, 247, 242, 0.1);
  overflow: hidden;
  min-height: 0; /* 允许收缩以适应父容器 */
}

/* Shared styles for overlay and textarea */
.highlight-overlay,
.editor-textarea {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 20px;
  font-family: var(--font-serif);
  font-size: 16px;
  line-height: 1.8;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow: auto;
}

.highlight-overlay {
  pointer-events: none;
  color: transparent;
  z-index: 1;
}

.editor-textarea {
  background: transparent;
  border: none;
  color: var(--primitive-paper-200);
  resize: none;
  z-index: 2;
}

.editor-textarea:focus {
  outline: none;
}

.editor-textarea::placeholder {
  color: var(--primitive-ink-400);
}

.is-disabled .editor-textarea {
  cursor: default;
  color: var(--primitive-paper-300);
}

/* Highlight colors */
:deep(.highlight-grammar) {
  background: rgba(239, 68, 68, 0.25);
  border-bottom: 2px solid #ef4444;
  border-radius: 2px;
  padding: 0 2px;
  margin: 0 -2px;
  color: inherit;
}

:deep(.highlight-vocabulary) {
  background: rgba(245, 158, 11, 0.25);
  border-bottom: 2px solid #f59e0b;
  border-radius: 2px;
  padding: 0 2px;
  margin: 0 -2px;
  color: inherit;
}

:deep(.highlight-coherence) {
  background: rgba(59, 130, 246, 0.25);
  border-bottom: 2px solid #3b82f6;
  border-radius: 2px;
  padding: 0 2px;
  margin: 0 -2px;
  color: inherit;
}

:deep(.highlight-task) {
  background: rgba(168, 85, 247, 0.25);
  border-bottom: 2px solid #a855f7;
  border-radius: 2px;
  padding: 0 2px;
  margin: 0 -2px;
  color: inherit;
}

/* Scrollbar */
.editor-textarea::-webkit-scrollbar,
.highlight-overlay::-webkit-scrollbar {
  width: 8px;
}

.editor-textarea::-webkit-scrollbar-track,
.highlight-overlay::-webkit-scrollbar-track {
  background: transparent;
}

.editor-textarea::-webkit-scrollbar-thumb {
  background: rgba(250, 247, 242, 0.15);
  border-radius: 4px;
}

.editor-textarea::-webkit-scrollbar-thumb:hover {
  background: rgba(250, 247, 242, 0.25);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Mobile
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .essay-editor {
    flex: none;
    min-height: 300px;
  }

  .editor-container {
    margin: 12px;
    /* 移动端给编辑器一个固定最小高度 */
    min-height: 280px;
  }

  .highlight-overlay,
  .editor-textarea {
    padding: 16px;
    font-size: 15px;
    line-height: 1.7;
  }
}
</style>
