<template>
  <div class="search-filter-container">
    <!-- Tier 1: Source tabs -->
    <SwitchTab
      :model-value="source"
      :tabs="sourceTabs"
      container-class="secondary-theme"
      :show-indicator="true"
      @change="$emit('update:source', $event)"
    />

    <!-- Tier 1: Search box -->
    <div class="search-box">
      <div class="input-with-clear">
        <input
          :value="search"
          @input="$emit('update:search', ($event.target as HTMLInputElement).value)"
          type="text"
          placeholder="输入单词或释义..."
          class="search-input"
        />
        <button
          v-if="search.trim()"
          @click="$emit('update:search', '')"
          class="clear-button"
          type="button"
        >
          ×
        </button>
      </div>
    </div>

    <!-- Tier 1.5: Toggle bar (review/spell status + advanced toggle) -->
    <FilterToggleBar
      :review-status="reviewStatus"
      :spell-status="spellStatus"
      :review-counts="reviewCounts"
      :spell-counts="spellCounts"
      :advanced-filter-count="advancedFilterCount"
      :advanced-expanded="advancedExpanded"
      @update:review-status="$emit('update:reviewStatus', $event)"
      @update:spell-status="$emit('update:spellStatus', $event)"
      @toggle-advanced="$emit('toggleAdvanced')"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import SwitchTab from '@/shared/components/controls/SwitchTab.vue'
import FilterToggleBar from './FilterToggleBar.vue'
import { useWordStats, type Word } from '@/shared/composables/useWordStats'
import { useSourceSelectionReadOnly } from '@/shared/composables/useSourceSelection'
import type { ReviewStatus, SpellStatus } from './useWordFilters'

interface Props {
  // Tier 1
  source: string
  search: string
  // Tier 1.5
  reviewStatus: ReviewStatus
  spellStatus: SpellStatus
  // Tier 1.5 counts
  reviewCounts: { total: number; unremembered: number; remembered: number }
  spellCounts: { total: number; spelling: number; stopped: number }
  // Advanced state
  advancedFilterCount: number
  advancedExpanded: boolean
  // All words for source tab counts
  allWords?: Array<{ source: string }>
}

const props = defineProps<Props>()

defineEmits<{
  'update:source': [value: string]
  'update:search': [value: string]
  'update:reviewStatus': [value: string]
  'update:spellStatus': [value: string]
  toggleAdvanced: []
}>()

// Source tabs
const { availableSources, initializeFromData } = useSourceSelectionReadOnly()

onMounted(async () => {
  await initializeFromData()
})

const wordsRef = computed(() => (props.allWords || []) as Word[])
const { allStats } = useWordStats(wordsRef)

const sourceTabs = computed(() => {
  const tabs = [{ value: 'all', label: `全部 ${allStats.value.total}` }]

  if (availableSources.value && availableSources.value.length > 0) {
    availableSources.value.forEach((source) => {
      const count = wordsRef.value.filter((w) => w.source === source).length
      tabs.push({ value: source, label: `${source} ${count}` })
    })
  }

  return tabs
})
</script>

<style scoped>
.search-filter-container {
  background: var(--color-surface-card);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  border: 1px solid var(--color-border-light);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--space-3);
  width: 100%;
}

.search-box {
  flex: 0;
}

.input-with-clear {
  position: relative;
  display: flex;
  align-items: center;
  height: 2.75rem;
}

.search-input {
  flex: 1;
  width: 100%;
  box-sizing: border-box;
  padding: 0.75rem 2.5rem 0.75rem 1rem;
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-default);
  transition: all var(--transition-fast);
  height: 100%;
  font-size: 16px;
  background: var(--color-surface-card);
  -webkit-appearance: none;
  appearance: none;
  -webkit-tap-highlight-color: transparent;
}

.search-input:focus {
  outline: none;
  border-color: var(--color-brand-primary);
  box-shadow: 0 0 0 3px rgba(153, 107, 61, 0.12);
}

.clear-button {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 1rem;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--transition-fast);
  line-height: 1;
  touch-action: manipulation;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.clear-button:hover {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
}

/* Mobile */
@media (max-width: 768px) {
  .search-filter-container {
    padding: var(--space-4);
    border-radius: var(--radius-md);
    gap: var(--space-3);
  }

  .input-with-clear {
    height: 48px;
  }

  .search-input {
    height: 48px;
    padding: 0.875rem 2.5rem 0.875rem 1rem;
  }

  .clear-button {
    right: 0.25rem;
    width: 2rem;
    height: 2rem;
    min-width: 44px;
    min-height: 44px;
  }
}

/* Landscape */
@media (max-height: 500px) and (orientation: landscape) {
  .search-filter-container {
    padding: var(--space-3);
    gap: var(--space-2);
  }

  .input-with-clear {
    height: 36px;
  }

  .search-input {
    height: 36px;
    padding: 0.5rem 2rem 0.5rem 0.75rem;
  }

  .clear-button {
    right: 0.25rem;
    width: 1.5rem;
    height: 1.5rem;
    min-width: 1.5rem;
    min-height: 1.5rem;
  }
}
</style>
