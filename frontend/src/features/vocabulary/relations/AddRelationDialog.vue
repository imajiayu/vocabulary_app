<template>
  <Teleport to="body">
    <div v-if="show" class="dialog-overlay" @click="emit('cancel')">
      <div class="add-relation-dialog" @click.stop>
        <h3>为「{{ sourceNode?.word }}」添加关系</h3>

        <div class="dialog-field">
          <label>目标单词：</label>
          <div class="autocomplete-wrapper">
            <input
              v-model="targetWord"
              type="text"
              placeholder="输入单词名称"
              @input="updateCandidates"
              @keydown="handleKeydown"
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

        <div class="dialog-field">
          <label>关系类型：</label>
          <CustomSelect
            v-model="relationType"
            :options="relationTypeOptions"
          />
        </div>

        <div class="dialog-actions">
          <button class="btn-confirm" @click="handleConfirm">确认</button>
          <button class="btn-cancel" @click="emit('cancel')">取消</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { GraphNode } from '@/shared/api'
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
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

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
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.add-relation-dialog {
  background: white;
  border-radius: var(--radius-lg);
  padding: 24px;
  width: 90%;
  max-width: 480px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.add-relation-dialog h3 {
  margin: 0 0 20px 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.dialog-field {
  margin-bottom: 16px;
}

.dialog-field label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.dialog-field input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 14px;
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-default);
  font-size: 14px;
  color: var(--color-text-primary);
  transition: all 0.2s;
  background: white;
}

.dialog-field input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.dialog-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.btn-confirm,
.btn-cancel {
  flex: 1;
  padding: 10px 20px;
  border: none;
  border-radius: var(--radius-default);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-confirm {
  background: var(--gradient-primary);
  color: white;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.btn-confirm:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-cancel {
  background: white;
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border-medium);
}

.btn-cancel:hover {
  background: var(--color-bg-secondary);
  border-color: var(--color-border-medium);
}

/* Autocomplete */
.autocomplete-wrapper {
  position: relative;
  width: 100%;
  box-sizing: border-box;
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
}

.candidate-item {
  padding: 10px 14px;
  cursor: pointer;
  transition: background-color 0.15s;
  border-bottom: 1px solid var(--color-border-light);
  display: flex;
  flex-direction: column;
  gap: 4px;
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
  color: var(--color-text-primary);
  font-size: 14px;
}

.candidate-definition {
  font-size: 12px;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.autocomplete-wrapper input:focus {
  border-radius: var(--radius-default) 8px 0 0;
}
</style>
