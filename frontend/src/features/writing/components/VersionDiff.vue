<template>
  <div class="version-diff">
    <div class="diff-content" v-html="diffHtml"></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  oldText: string
  newText: string
}>()

// Simple word-level diff algorithm
const diffHtml = computed(() => {
  const oldWords = props.oldText.split(/(\s+)/)
  const newWords = props.newText.split(/(\s+)/)

  // Build a simple LCS-based diff
  const diff = computeDiff(oldWords, newWords)

  return diff
    .map(part => {
      const text = escapeHtml(part.value)
      if (part.type === 'add') {
        return `<ins class="diff-add">${text}</ins>`
      } else if (part.type === 'remove') {
        return `<del class="diff-remove">${text}</del>`
      }
      return text
    })
    .join('')
})

interface DiffPart {
  type: 'add' | 'remove' | 'same'
  value: string
}

function computeDiff(oldArr: string[], newArr: string[]): DiffPart[] {
  const result: DiffPart[] = []

  // Simple O(n*m) diff - good enough for essay lengths
  let oldIdx = 0
  let newIdx = 0

  while (oldIdx < oldArr.length || newIdx < newArr.length) {
    if (oldIdx >= oldArr.length) {
      // Remaining new words are additions
      result.push({ type: 'add', value: newArr[newIdx] })
      newIdx++
    } else if (newIdx >= newArr.length) {
      // Remaining old words are removals
      result.push({ type: 'remove', value: oldArr[oldIdx] })
      oldIdx++
    } else if (oldArr[oldIdx] === newArr[newIdx]) {
      // Words match
      result.push({ type: 'same', value: oldArr[oldIdx] })
      oldIdx++
      newIdx++
    } else {
      // Look ahead to find best match
      const lookAhead = 5
      let foundInNew = -1
      let foundInOld = -1

      for (let i = 1; i <= lookAhead && newIdx + i < newArr.length; i++) {
        if (newArr[newIdx + i] === oldArr[oldIdx]) {
          foundInNew = i
          break
        }
      }

      for (let i = 1; i <= lookAhead && oldIdx + i < oldArr.length; i++) {
        if (oldArr[oldIdx + i] === newArr[newIdx]) {
          foundInOld = i
          break
        }
      }

      if (foundInNew > 0 && (foundInOld < 0 || foundInNew <= foundInOld)) {
        // Additions before match
        for (let i = 0; i < foundInNew; i++) {
          result.push({ type: 'add', value: newArr[newIdx + i] })
        }
        newIdx += foundInNew
      } else if (foundInOld > 0) {
        // Removals before match
        for (let i = 0; i < foundInOld; i++) {
          result.push({ type: 'remove', value: oldArr[oldIdx + i] })
        }
        oldIdx += foundInOld
      } else {
        // No match found, treat as removal + addition
        result.push({ type: 'remove', value: oldArr[oldIdx] })
        result.push({ type: 'add', value: newArr[newIdx] })
        oldIdx++
        newIdx++
      }
    }
  }

  // Merge consecutive same-type parts
  const merged: DiffPart[] = []
  for (const part of result) {
    if (merged.length > 0 && merged[merged.length - 1].type === part.type) {
      merged[merged.length - 1].value += part.value
    } else {
      merged.push({ ...part })
    }
  }

  return merged
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
}
</script>

<style scoped>
.version-diff {
  margin-top: 12px;
  padding: 16px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: var(--radius-md);
  max-height: 400px;
  overflow-y: auto;
}

.diff-content {
  font-size: 14px;
  line-height: 1.8;
  color: var(--primitive-paper-300);
  white-space: pre-wrap;
  word-wrap: break-word;
}

:deep(.diff-add) {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
  text-decoration: none;
  padding: 1px 2px;
  border-radius: 2px;
}

:deep(.diff-remove) {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
  text-decoration: line-through;
  padding: 1px 2px;
  border-radius: 2px;
}
</style>
