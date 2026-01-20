<template>
  <div class="control-group">
    <label>搜索单词:</label>
    <div class="search-autocomplete-wrapper">
      <input
        v-model="localSearchWord"
        type="text"
        placeholder="输入单词查看其关系网络..."
        @input="updateCandidates"
        @keydown="handleKeydown"
        class="search-input"
        autocomplete="off"
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
  color: #0f172a;
  white-space: nowrap;
  font-size: 14px;
}

.search-autocomplete-wrapper {
  position: relative;
  display: inline-block;
}

.search-input {
  padding: 8px 14px;
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-default);
  min-width: 240px;
  font-size: 14px;
  color: #0f172a;
  transition: all 0.2s;
  background: white;
}

.search-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.search-input::placeholder {
  color: #94a3b8;
}

.candidates-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid var(--color-border-medium);
  border-top: none;
  border-radius: 0 0 8px 8px;
  max-height: 240px;
  overflow-y: auto;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  margin-top: -1px;
  min-width: 240px;
}

.candidate-item {
  padding: 8px 14px;
  cursor: pointer;
  transition: background-color 0.15s;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.candidate-item:last-child {
  border-bottom: none;
}

.candidate-item:hover,
.candidate-item.selected {
  background: var(--color-bg-secondary);
}

.candidate-word {
  font-weight: 600;
  color: #0f172a;
  font-size: 13px;
}

.candidate-definition {
  font-size: 11px;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
