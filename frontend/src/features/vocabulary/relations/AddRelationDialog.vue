<template>
  <BaseModal
    v-model="internalShow"
    title=""
    size="md"
    :close-on-overlay="true"
    :closable="false"
    @close="emit('cancel')"
  >
    <template #header>
      <h3 class="dialog-title">为「{{ sourceNode?.word }}」添加关系</h3>
    </template>

    <div class="dialog-content">
      <div class="dialog-field">
        <label class="field-label">目标单词：</label>
        <div class="autocomplete-wrapper">
          <BaseInput
            v-model="targetWord"
            placeholder="输入单词名称"
            size="md"
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

      <div class="dialog-field">
        <label class="field-label">关系类型：</label>
        <CustomSelect
          v-model="relationType"
          :options="relationTypeOptions"
        />
      </div>
    </div>

    <template #footer>
      <BaseButton variant="ghost" @click="emit('cancel')">取消</BaseButton>
      <BaseButton variant="primary" @click="handleConfirm">确认</BaseButton>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { GraphNode } from '@/shared/api'
import { BaseModal, BaseButton, BaseInput } from '@/shared/components/base'
import CustomSelect from '@/shared/components/CustomSelect.vue'
import { relationTypeOptions } from './useRelationGraph'

interface Props {
  show: boolean
  sourceNode: GraphNode | null
  allNodes: GraphNode[]
}

interface Emits {
  (e: 'cancel'): void
  (e: 'confirm', data: { targetWord: string; relationType: string }): void
  (e: 'update:show', value: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 双向绑定 show
const internalShow = computed({
  get: () => props.show,
  set: (value) => {
    if (!value) {
      emit('cancel')
    }
  }
})

const targetWord = ref('')
const relationType = ref('synonym')
const candidates = ref<GraphNode[]>([])
const selectedIndex = ref(-1)

// Reset form when dialog opens
watch(
  () => props.show,
  (newShow) => {
    if (newShow) {
      targetWord.value = ''
      relationType.value = 'synonym'
      candidates.value = []
      selectedIndex.value = -1
    }
  }
)

// 监听 targetWord 变化更新候选词
watch(targetWord, () => {
  updateCandidates()
})

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
  const input = targetWord.value.trim().toLowerCase()
  if (!input) {
    candidates.value = []
    selectedIndex.value = -1
    return
  }

  const sourceId = props.sourceNode?.id
  const availableNodes = props.allNodes.filter(node => node.id !== sourceId)

  const prefixMatches: GraphNode[] = []
  const subsequenceMatches: GraphNode[] = []

  availableNodes.forEach(node => {
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
  } else if (event.key === 'Enter' && selectedIndex.value >= 0) {
    event.preventDefault()
    selectCandidate(candidates.value[selectedIndex.value])
  }
}

function selectCandidate(node: GraphNode) {
  targetWord.value = node.word
  candidates.value = []
  selectedIndex.value = -1
}

function handleConfirm() {
  emit('confirm', {
    targetWord: targetWord.value.trim().toLowerCase(),
    relationType: relationType.value
  })
}
</script>

<style scoped>
.dialog-title {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.dialog-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.dialog-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

/* Autocomplete */
.autocomplete-wrapper {
  position: relative;
  width: 100%;
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
  padding: var(--space-3);
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
  font-size: var(--font-size-base);
}

.candidate-definition {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
