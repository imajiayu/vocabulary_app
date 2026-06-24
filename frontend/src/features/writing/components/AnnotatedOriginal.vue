<script setup lang="ts">
/**
 * 原文 + 错误标注
 *
 * 把原文按 issues[].quote 切成连续片段：命中错误的片段加波浪下划线（悬停看 message），
 * 其余为普通文本。quote 必须是原文中逐字出现的子串；找不到或与已有标注重叠的 quote 直接忽略。
 *
 * class / data-para-* 等属性由父组件透传到根 <p>（单根自动 fallthrough），
 * 供 EssayEditor.handleFeedbackSelection 的 DOM 向上查找与共享反馈样式使用。
 */
import { computed } from 'vue'
import type { ParagraphIssue } from '@/shared/types/writing'

const props = withDefaults(defineProps<{
  text: string
  issues?: ParagraphIssue[] | null
}>(), {
  issues: null,
})

interface Segment {
  text: string
  message?: string
}

const segments = computed<Segment[]>(() => {
  const text = props.text ?? ''
  const issues = props.issues
  if (!text || !issues || issues.length === 0) return [{ text }]

  // 为每个 quote 找一个不与其他标注重叠的匹配区间
  const used = new Array<boolean>(text.length).fill(false)
  const marks: { start: number; end: number; message: string }[] = []

  for (const issue of issues) {
    const quote = issue?.quote
    const message = issue?.message
    if (typeof quote !== 'string' || !quote || typeof message !== 'string' || !message) continue

    let from = 0
    while (from <= text.length - quote.length) {
      const idx = text.indexOf(quote, from)
      if (idx === -1) break
      let overlap = false
      for (let i = idx; i < idx + quote.length; i++) {
        if (used[i]) { overlap = true; break }
      }
      if (!overlap) {
        for (let i = idx; i < idx + quote.length; i++) used[i] = true
        marks.push({ start: idx, end: idx + quote.length, message })
        break
      }
      from = idx + 1
    }
  }

  if (marks.length === 0) return [{ text }]

  marks.sort((a, b) => a.start - b.start)
  const segs: Segment[] = []
  let cursor = 0
  for (const m of marks) {
    if (m.start > cursor) segs.push({ text: text.slice(cursor, m.start) })
    segs.push({ text: text.slice(m.start, m.end), message: m.message })
    cursor = m.end
  }
  if (cursor < text.length) segs.push({ text: text.slice(cursor) })
  return segs
})
</script>

<template>
  <p class="annotated-original"><span
    v-for="(seg, i) in segments"
    :key="i"
    :class="{ 'issue-mark': seg.message }"
    :title="seg.message || undefined"
  >{{ seg.text }}</span></p>
</template>

<style scoped>
/* 版式（字体/行高/颜色/margin）由父组件透传的 .para-feedback-original 等类控制 */
.issue-mark {
  text-decoration: underline wavy rgba(248, 113, 113, 0.65);
  text-underline-offset: 3px;
  text-decoration-thickness: 1.5px;
  cursor: help;
  border-radius: var(--radius-xs);
  transition: background 0.15s ease;
}

.issue-mark:hover {
  background: rgba(248, 113, 113, 0.14);
}
</style>
