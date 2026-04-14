<template>
  <div class="filter-toggle-bar">
    <SwitchTab
      :model-value="mode"
      :tabs="modeTabs"
      container-class="small"
      @change="mode = $event as 'review' | 'spell'"
    />

    <SwitchTab
      v-if="mode === 'review'"
      :model-value="reviewStatus"
      :tabs="reviewTabs"
      container-class="filter-theme"
      :show-indicator="true"
      @change="$emit('update:reviewStatus', $event)"
    />
    <SwitchTab
      v-else
      :model-value="spellStatus"
      :tabs="spellTabs"
      container-class="spell-filter-theme"
      :show-indicator="true"
      @change="$emit('update:spellStatus', $event)"
    />

    <button
      class="adv-btn"
      :class="{ active: advancedExpanded, 'has-filters': advancedFilterCount > 0 }"
      @click="$emit('toggleAdvanced')"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="7" x2="20" y2="7"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="10" y1="17" x2="14" y2="17"/></svg>
      <span v-if="advancedFilterCount > 0" class="adv-badge">{{ advancedFilterCount }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import SwitchTab from '@/shared/components/controls/SwitchTab.vue'
import type { ReviewStatus, SpellStatus } from './useWordFilters'

interface Props {
  reviewStatus: ReviewStatus
  spellStatus: SpellStatus
  reviewCounts: { total: number; unremembered: number; remembered: number }
  spellCounts: { total: number; spelling: number; stopped: number }
  advancedFilterCount: number
  advancedExpanded: boolean
}

const props = defineProps<Props>()

defineEmits<{
  'update:reviewStatus': [value: string]
  'update:spellStatus': [value: string]
  toggleAdvanced: []
}>()

const mode = ref<'review' | 'spell'>('review')

const modeTabs = computed(() => {
  const reviewLabel = props.reviewStatus !== 'all' ? '复习 ●' : '复习'
  const spellLabel = props.spellStatus !== 'all' ? '拼写 ●' : '拼写'
  return [
    { value: 'review', label: mode.value === 'review' ? '复习' : reviewLabel },
    { value: 'spell', label: mode.value === 'spell' ? '拼写' : spellLabel },
  ]
})

const reviewTabs = computed(() => [
  { value: 'all', label: `全部 ${props.reviewCounts.total}` },
  { value: 'unremembered', label: `学习中 ${props.reviewCounts.unremembered}` },
  { value: 'remembered', label: `已掌握 ${props.reviewCounts.remembered}` },
])

const spellTabs = computed(() => [
  { value: 'all', label: `全部 ${props.spellCounts.total}` },
  { value: 'spelling', label: `拼写中 ${props.spellCounts.spelling}` },
  { value: 'stopped', label: `已停止 ${props.spellCounts.stopped}` },
])
</script>

<style scoped>
.filter-toggle-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.filter-toggle-bar > :deep(.switch-tab-container:first-child) {
  flex-shrink: 0;
}

.filter-toggle-bar > :deep(.switch-tab-container:nth-child(2)) {
  flex: 1;
  min-width: 0;
}

.adv-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 28px;
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
  outline: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  flex-shrink: 0;
  position: relative;
}

.adv-btn:hover {
  color: var(--color-text-secondary);
  border-color: var(--color-border-strong);
  background: var(--color-bg-secondary);
}

.adv-btn.active {
  color: var(--primitive-copper-600, #8a5e35);
  border-color: var(--primitive-copper-400, rgba(153, 107, 61, 0.4));
  background: var(--primitive-copper-100, rgba(153, 107, 61, 0.08));
}

.adv-btn.has-filters {
  color: var(--primitive-copper-600, #8a5e35);
  border-color: var(--primitive-copper-400, rgba(153, 107, 61, 0.4));
}

.adv-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  border-radius: var(--radius-full);
  background: var(--primitive-copper-500, #996b3d);
  color: white;
  font-family: var(--font-ui);
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

@media (max-width: 768px) {
  .adv-btn {
    width: 36px;
    height: 32px;
  }
}
</style>
