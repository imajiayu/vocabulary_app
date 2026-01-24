<template>
  <div class="control-group">
    <label>搜索单词:</label>
    <div class="search-autocomplete-wrapper">
      <BaseInput
        v-model="localSearchWord"
        placeholder="输入单词查看其关系网络..."
        size="sm"
        @input="updateCandidates"
        @keydown="handleKeydown"
      />
      <div v-if="candidates.length > 0" class="candidates-list">
        <div
          v-for="(candidate, index) in candidates"
          :key="candidate.id"
          class="candidate-item"
          :class="{ selected: index === selectedIndex }"
          @click="selectCandidate(candidate)"
          @mouseenter="selectedIndex = index"
        >
          <span class="candidate-word">{{ candidate.word }}</span>
          <span v-if="candidate.definition" class="candidate-definition">
            {{ candidate.definition.split('; ')[0] }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { GraphNode } from '@/shared/api'
import { BaseInput } from '@/shared/components/base'

interface Props {
  searchWord: string
  nodes: GraphNode[]
}

interface Emits {
  (e: 'select', node: GraphNode): void
  (e: 'update:searchWord', value: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const localSearchWord = ref(props.searchWord)
const candidates = ref<GraphNode[]>([])
const selectedIndex = ref(-1)

watch(
  () => props.searchWord,
  (newVal) => {
    localSearchWord.value = newVal
  }
)

function isSubsequenceMatch(pattern: string, text: string): boolean {
  let patternIndex = 0
  for (let i = 0; i < text.length && patternIndex < pattern.length; i++) {
    if (text[i] === pattern[patternIndex]) {
      patternIndex++
    }
  }
  return patternIndex === pattern.length
}

function updateCandidates() {
  emit('update:searchWord', localSearchWord.value)

  const input = localSearchWord.value.trim().toLowerCase()
  if (!input) {
    candidates.value = []
    selectedIndex.value = -1
    return
  }

  const prefixMatches: GraphNode[] = []
  const subsequenceMatches: GraphNode[] = []

  props.nodes.forEach(node => {
    const word = node.word.toLowerCase()
    if (word.startsWith(input)) {
      prefixMatches.push(node)
    } else if (isSubsequenceMatch(input, word)) {
      subsequenceMatches.push(node)
    }
  })

  prefixMatches.sort((a, b) => a.word.localeCompare(b.word))
  subsequenceMatches.sort((a, b) => a.word.localeCompare(b.word))

  candidates.value = [...prefixMatches, ...subsequenceMatches].slice(0, 10)
  selectedIndex.value = -1
}

function handleKeydown(event: KeyboardEvent) {
  if (candidates.value.length === 0) return

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    selectedIndex.value = Math.min(selectedIndex.value + 1, candidates.value.length - 1)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    selectedIndex.value = Math.max(selectedIndex.value - 1, -1)
  } else if (event.key === 'Enter') {
    event.preventDefault()
    if (selectedIndex.value >= 0) {
      selectCandidate(candidates.value[selectedIndex.value])
    }
  }
}

function selectCandidate(node: GraphNode) {
  localSearchWord.value = node.word
  emit('update:searchWord', node.word)
  candidates.value = []
  selectedIndex.value = -1
  emit('select', node)
}
</script>

<style scoped>
.control-group {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: white;
  border-radius: var(--radius-md);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.control-group label {
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
  font-size: 14px;
}

.search-autocomplete-wrapper {
  position: relative;
  display: inline-block;
  min-width: 240px;
}

.candidates-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--color-surface-elevated);
  border: 1px solid var(--color-border-medium);
  border-top: none;
  border-radius: 0 0 var(--radius-default) var(--radius-default);
  max-height: 240px;
  overflow-y: auto;
  box-shadow: var(--shadow-md);
  z-index: 1000;
  margin-top: -1px;
}

.candidate-item {
  padding: var(--space-2) var(--space-3);
  cursor: pointer;
  transition: background-color var(--transition-fast);
  border-bottom: 1px solid var(--color-border-light);
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.candidate-item:last-child {
  border-bottom: none;
}

.candidate-item:hover,
.candidate-item.selected {
  background: var(--color-bg-secondary);
}

.candidate-word {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
}

.candidate-definition {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
