<template>
  <div class="essay-editor" :class="{ 'is-disabled': disabled }">
    <!-- 普通编辑模式 -->
    <div v-if="!hasFeedback" class="editor-container">
      <textarea
        ref="textareaRef"
        :value="modelValue"
        :disabled="disabled"
        class="editor-textarea"
        placeholder="在这里输入你的作文..."
        @input="handleInput"
        @mouseup="handleTextareaSelection"
      ></textarea>
    </div>

    <!-- 反馈模式：原文段落 + 紧跟改进版 -->
    <div v-else class="editor-container feedback-mode">
      <div class="feedback-scroll" @mouseup="handleFeedbackSelection">
        <template v-for="(para, index) in paragraphs" :key="index">
          <!-- 原文段落 -->
          <p class="para-feedback-original para-original" :data-para-index="index" data-para-source="original">{{ para }}</p>

          <!-- AI 改进版（绿色左边框 + 高亮） -->
          <div v-if="feedback![index]" class="para-feedback-improved para-improved" :data-para-index="index" data-para-source="improved" v-html="renderImproved(index)"></div>

          <!-- AI 简评 -->
          <p v-if="feedback![index]" class="para-feedback-notes para-notes">{{ feedback![index].notes }}</p>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import type { ParagraphFeedback } from '@/shared/types/writing'
import { formatMarkdown } from '@/shared/utils/markdown'
import { countWords } from '@/shared/utils/text'

const props = withDefaults(defineProps<{
  modelValue: string
  disabled?: boolean
  feedback?: ParagraphFeedback[] | null
}>(), {
  disabled: false,
  feedback: null
})

export interface TextSelection {
  text: string
  paragraphIndex: number
  source: 'original' | 'improved' | 'textarea'
}

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'word-count', count: number): void
  (e: 'text-selected', selection: TextSelection): void
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)

const hasFeedback = computed(() => {
  return props.feedback && props.feedback.length > 0
})

const paragraphs = computed(() => {
  return props.modelValue.split('\n\n').filter(p => p.trim().length > 0)
})

function renderImproved(index: number): string {
  return formatMarkdown(props.feedback![index].improved)
}

function handleTextareaSelection() {
  const ta = textareaRef.value
  if (!ta) return
  const text = ta.value.substring(ta.selectionStart, ta.selectionEnd).trim()
  if (!text) return

  // Find which paragraph the selection starts in
  const before = ta.value.substring(0, ta.selectionStart)
  const paragraphIndex = before.split('\n\n').length - 1

  emit('text-selected', { text, paragraphIndex, source: 'textarea' })
}

function handleFeedbackSelection() {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed) return
  const text = sel.toString().trim()
  if (!text) return

  // Walk up from the anchor node to find [data-para-index]
  let node = sel.anchorNode as HTMLElement | null
  while (node && node !== document.body) {
    if (node instanceof HTMLElement && node.dataset.paraIndex !== undefined) {
      const paragraphIndex = parseInt(node.dataset.paraIndex, 10)
      const source = node.dataset.paraSource as 'original' | 'improved'
      emit('text-selected', { text, paragraphIndex, source })
      return
    }
    node = node.parentElement
  }
}

function handleInput(event: Event) {
  const target = event.target as HTMLTextAreaElement
  emit('update:modelValue', target.value)
  emit('word-count', countWords(target.value))
}

watch(() => props.modelValue, () => {
  nextTick(() => {
    emit('word-count', countWords(props.modelValue))
  })
}, { immediate: true })

defineExpose({
  focus: () => textareaRef.value?.focus()
})
</script>

<style src="@/shared/styles/markdown-content.css"></style>
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
  margin: 12px 16px;
  border-radius: var(--radius-default);
  background: rgba(255, 255, 255, 0.025);
  border: 1px solid rgba(255, 255, 255, 0.06);
  overflow: hidden;
  min-height: 0;
  transition: border-color 0.3s ease;
}

.editor-container:focus-within {
  border-color: rgba(59, 130, 246, 0.25);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.06);
}

/* ═══════════ 普通编辑模式 ═══════════ */

.editor-textarea {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 24px;
  font-family: var(--font-serif);
  font-size: 16px;
  line-height: 2;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow: auto;
  background: transparent;
  border: none;
  color: rgba(250, 247, 242, 0.88);
  resize: none;
  letter-spacing: 0.01em;
}

.editor-textarea:focus {
  outline: none;
}

.editor-textarea::placeholder {
  color: rgba(250, 247, 242, 0.25);
  font-style: italic;
}

.is-disabled .editor-textarea {
  cursor: default;
  color: rgba(250, 247, 242, 0.6);
}

/* ═══════════ 反馈模式 ═══════════ */

.feedback-mode {
  position: relative;
}

.feedback-scroll {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 24px;
  overflow-y: auto;
}

/* feedback styles: inherits from markdown-content.css (.para-feedback-*) */
/* EssayEditor uses larger font than the right-panel feedback tab */
.para-original,
.para-improved {
  font-size: 16px;
  line-height: 1.9;
}

.para-original {
  color: rgba(250, 247, 242, 0.55);
}

.para-improved {
  padding: 8px 0 8px 16px;
  color: rgba(250, 247, 242, 0.9);
}

.para-notes {
  font-size: 12px;
  margin-bottom: 32px;
  padding-left: 18px;
  color: rgba(56, 189, 248, 0.6);
}

.para-notes:last-child {
  margin-bottom: 0;
}

/* ═══════════ Scrollbar ═══════════ */

.editor-textarea::-webkit-scrollbar,
.feedback-scroll::-webkit-scrollbar {
  width: 6px;
}

.editor-textarea::-webkit-scrollbar-track,
.feedback-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.editor-textarea::-webkit-scrollbar-thumb,
.feedback-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3px;
}

.editor-textarea::-webkit-scrollbar-thumb:hover,
.feedback-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.15);
}

/* ═══════════ Mobile ═══════════ */

@media (max-width: 768px) {
  .essay-editor {
    flex: none;
    min-height: 300px;
  }

  .editor-container {
    margin: 10px 12px;
    min-height: 280px;
  }

  .editor-textarea,
  .feedback-scroll {
    padding: 16px;
    font-size: 15px;
    line-height: 1.8;
  }

  .para-original,
  .para-improved {
    font-size: 15px;
    line-height: 1.8;
  }
}
</style>
