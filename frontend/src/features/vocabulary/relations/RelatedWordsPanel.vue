<template>
  <div v-if="relatedWords && relatedWords.length" class="related-words-panel">
    <div class="panel-header">
      <span class="header-label">相关词汇</span>
      <span class="header-count">{{ relatedWords.length }}</span>
    </div>

    <div class="relation-grid">
      <div
        v-for="type in activeTypes"
        :key="type"
        class="relation-group"
      >
        <div class="group-label" :class="type">
          <span class="label-icon">{{ typeIcons[type] }}</span>
          <span class="label-text">{{ typeLabels[type] }}</span>
        </div>
        <div class="word-list">
          <button
            v-for="rel in groupedWords[type]"
            :key="rel.id"
            class="word-chip"
            @click="handleClickWord(rel.id)"
          >
            {{ rel.word }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal -->
    <teleport to="body">
      <div v-if="wordEditorStore.isOpen" class="modal-wrapper">
        <div class="modal-overlay" @click="wordEditorStore.close()"></div>
        <WordEditorModal />
      </div>
    </teleport>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { RelatedWord } from '@/shared/types'
import WordEditorModal from '@/features/vocabulary/editor/WordEditorModal.vue'
import { api } from '@/shared/api'
import { useTimerPause } from '@/shared/composables/useTimerPause'
import { useWordEditorStore } from '@/features/vocabulary/stores/wordEditor'
import { logger } from '@/shared/utils/logger'

const log = logger.create('RelatedWords')

interface Props {
  relatedWords?: RelatedWord[]
}

const props = defineProps<Props>()

const relationTypes = ['synonym', 'antonym', 'root', 'confused', 'topic'] as const
const typeLabels: Record<string, string> = {
  synonym: '同义',
  antonym: '反义',
  root: '词根',
  confused: '易混',
  topic: '主题',
}
const typeIcons: Record<string, string> = {
  synonym: '≈',
  antonym: '≠',
  root: '√',
  confused: '⚡',
  topic: '§',
}

const groupedWords = computed(() => {
  const map: Record<string, RelatedWord[]> = {}
  relationTypes.forEach((t) => (map[t] = []))
  props.relatedWords?.forEach((w) => {
    if (map[w.relation_type]) map[w.relation_type].push(w)
  })
  return map
})

const activeTypes = computed(() => {
  return relationTypes.filter(type => groupedWords.value[type].length > 0)
})

const wordEditorStore = useWordEditorStore()
const { requestPause, releasePause } = useTimerPause()

const handleClickWord = async (wordId: number) => {
  requestPause()

  try {
    const data = await api.words.getWordDirect(wordId)
    if (!data) {
      log.error('Word not found:', wordId)
      releasePause()
      return
    }
    wordEditorStore.open(data)
    wordEditorStore.onClose(() => {
      releasePause()
    })
  } catch (err) {
    log.error(err)
    releasePause()
  }
}
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   Related Words Panel - Neo-Editorial 风格
   ═══════════════════════════════════════════════════════════════════════════ */

.related-words-panel {
  padding: 1.25rem 0;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.header-label {
  font-family: var(--font-ui);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.header-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.375rem;
  font-family: var(--font-data);
  font-size: 0.65rem;
  font-weight: 600;
  color: white;
  background: var(--color-primary);
  border-radius: var(--radius-full);
}

/* ── 关系分组网格 ── */
.relation-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}

.relation-group {
  flex: 1;
  min-width: 120px;
  max-width: 200px;
}

.group-label {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.625rem;
  margin-bottom: 0.5rem;
  font-family: var(--font-ui);
  font-size: 0.7rem;
  font-weight: 600;
  border-radius: var(--radius-full);
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
}

.group-label.synonym {
  background: var(--color-success-light);
  color: var(--color-success);
}

.group-label.antonym {
  background: var(--color-danger-light);
  color: var(--color-danger);
}

.group-label.root {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.group-label.confused {
  background: var(--color-warning-light);
  color: var(--color-warning);
}

.group-label.topic {
  background: var(--color-secondary-light);
  color: var(--color-secondary);
}

.label-icon {
  font-size: 0.8rem;
  line-height: 1;
}

.label-text {
  letter-spacing: 0.02em;
}

/* ── 单词列表 ── */
.word-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
}

.word-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.375rem 0.625rem;
  font-family: var(--font-serif);
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s ease;
}

.word-chip:hover {
  background: var(--color-bg-secondary);
  border-color: var(--color-primary);
  color: var(--color-primary);
  transform: translateY(-1px);
}

.word-chip:active {
  transform: translateY(0);
}

/* ── Modal ── */
.modal-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.modal-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

/* ══════════════════════════════════════════════════════════════════════════
   移动端适配
   ══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 480px) {
  .related-words-panel {
    padding: 1rem 0;
  }

  .panel-header {
    margin-bottom: 0.75rem;
  }

  .relation-grid {
    gap: 0.75rem;
  }

  .relation-group {
    min-width: 100px;
    max-width: none;
    flex: 1 1 calc(50% - 0.375rem);
  }

  .group-label {
    padding: 0.2rem 0.5rem;
    font-size: 0.65rem;
  }

  .word-list {
    gap: 0.25rem;
  }

  .word-chip {
    padding: 0.3rem 0.5rem;
    font-size: 0.8rem;
  }
}

@media (max-width: 360px) {
  .relation-group {
    flex: 1 1 100%;
    max-width: none;
  }

  .word-chip {
    padding: 0.25rem 0.4rem;
    font-size: 0.75rem;
  }
}
</style>
