<template>
  <!-- Desktop: inline collapsible -->
  <Transition name="panel-slide">
    <div v-if="expanded && !isMobile" class="advanced-panel">
      <div class="adv-grid">
        <div class="adv-section">
          <span class="adv-label">标记</span>
          <div class="adv-chips">
            <FilterChip :model-value="lapseOnly" label="遗忘标记" :count="lapseCounts"
              @update:model-value="$emit('update:lapseOnly', $event)" />
            <FilterChip :model-value="overdueOnly" label="已逾期" :count="overdueCounts"
              @update:model-value="$emit('update:overdueOnly', $event)" />
          </div>
        </div>

        <div class="adv-section">
          <span class="adv-label">难度</span>
          <div class="adv-chips">
            <button v-for="o in easeOptions" :key="o.value" class="adv-chip"
              :class="{ active: easePreset === o.value }" @click="toggleEase(o.value)">{{ o.label }}</button>
          </div>
        </div>

        <div class="adv-section">
          <span class="adv-label">添加</span>
          <div class="adv-chips">
            <button v-for="o in dateOptions" :key="o.value" class="adv-chip"
              :class="{ active: dateAddedPreset === o.value }" @click="toggleDate(o.value)">{{ o.label }}</button>
            <button class="adv-chip" :class="{ active: dateAddedCustom !== null && dateAddedPreset === null }"
              @click="toggleCustomDate">自定义</button>
          </div>
          <div v-if="dateAddedCustom !== null" class="custom-dates">
            <input type="date" class="date-input" :value="dateAddedCustom[0]"
              @input="$emit('update:dateAddedCustom', [($event.target as HTMLInputElement).value, dateAddedCustom![1]])" />
            <span class="date-sep">–</span>
            <input type="date" class="date-input" :value="dateAddedCustom[1]"
              @input="$emit('update:dateAddedCustom', [dateAddedCustom![0], ($event.target as HTMLInputElement).value])" />
          </div>
        </div>

        <div class="adv-section">
          <span class="adv-label">复习</span>
          <div class="adv-chips">
            <button v-for="o in reviewOptions" :key="o.value" class="adv-chip"
              :class="{ active: lastReviewPreset === o.value }" @click="toggleReview(o.value)">{{ o.label }}</button>
          </div>
        </div>
      </div>

      <button v-if="hasActiveAdvancedFilters" class="reset-link" @click="$emit('resetAdvanced')">
        清除高级筛选
      </button>
    </div>
  </Transition>

  <!-- Mobile: bottom sheet -->
  <Teleport to="body">
    <Transition name="sheet-fade">
      <div v-if="expanded && isMobile" class="sheet-backdrop" @click.self="$emit('close')">
        <Transition name="sheet-slide">
          <div v-if="expanded" class="sheet-panel">
            <div class="sheet-bar" />
            <div class="sheet-body">
              <div class="adv-grid">
                <div class="adv-section">
                  <span class="adv-label">标记</span>
                  <div class="adv-chips">
                    <FilterChip :model-value="lapseOnly" label="遗忘标记" :count="lapseCounts"
                      @update:model-value="$emit('update:lapseOnly', $event)" />
                    <FilterChip :model-value="overdueOnly" label="已逾期" :count="overdueCounts"
                      @update:model-value="$emit('update:overdueOnly', $event)" />
                  </div>
                </div>
                <div class="adv-section">
                  <span class="adv-label">难度</span>
                  <div class="adv-chips">
                    <button v-for="o in easeOptions" :key="o.value" class="adv-chip"
                      :class="{ active: easePreset === o.value }" @click="toggleEase(o.value)">{{ o.label }}</button>
                  </div>
                </div>
                <div class="adv-section">
                  <span class="adv-label">添加</span>
                  <div class="adv-chips">
                    <button v-for="o in dateOptions" :key="o.value" class="adv-chip"
                      :class="{ active: dateAddedPreset === o.value }" @click="toggleDate(o.value)">{{ o.label }}</button>
                    <button class="adv-chip" :class="{ active: dateAddedCustom !== null && dateAddedPreset === null }"
                      @click="toggleCustomDate">自定义</button>
                  </div>
                  <div v-if="dateAddedCustom !== null" class="custom-dates">
                    <input type="date" class="date-input" :value="dateAddedCustom[0]"
                      @input="$emit('update:dateAddedCustom', [($event.target as HTMLInputElement).value, dateAddedCustom![1]])" />
                    <span class="date-sep">–</span>
                    <input type="date" class="date-input" :value="dateAddedCustom[1]"
                      @input="$emit('update:dateAddedCustom', [dateAddedCustom![0], ($event.target as HTMLInputElement).value])" />
                  </div>
                </div>
                <div class="adv-section">
                  <span class="adv-label">复习</span>
                  <div class="adv-chips">
                    <button v-for="o in reviewOptions" :key="o.value" class="adv-chip"
                      :class="{ active: lastReviewPreset === o.value }" @click="toggleReview(o.value)">{{ o.label }}</button>
                  </div>
                </div>
              </div>
              <div class="sheet-actions">
                <button v-if="hasActiveAdvancedFilters" class="reset-link" @click="$emit('resetAdvanced')">清除高级筛选</button>
                <button class="sheet-done" @click="$emit('close')">完成</button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { useBreakpoint } from '@/shared/composables/useBreakpoint'
import FilterChip from '@/shared/components/controls/FilterChip.vue'
import type { EasePreset, DateAddedPreset, LastReviewPreset } from './useWordFilters'

interface Props {
  expanded: boolean
  lapseOnly: boolean
  overdueOnly: boolean
  lapseCounts: number
  overdueCounts: number
  easePreset: EasePreset
  dateAddedPreset: DateAddedPreset
  dateAddedCustom: [string, string] | null
  lastReviewPreset: LastReviewPreset
  hasActiveAdvancedFilters: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:lapseOnly': [value: boolean]
  'update:overdueOnly': [value: boolean]
  'update:easePreset': [value: EasePreset]
  'update:dateAddedPreset': [value: DateAddedPreset]
  'update:dateAddedCustom': [value: [string, string] | null]
  'update:lastReviewPreset': [value: LastReviewPreset]
  resetAdvanced: []
  close: []
}>()

const { isMobile } = useBreakpoint()

const easeOptions = [
  { value: 'hard', label: '困难' },
  { value: 'medium', label: '中等' },
  { value: 'easy', label: '简单' },
]

const dateOptions = [
  { value: 'today', label: '今天' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
]

const reviewOptions = [
  { value: 'never', label: '从未' },
  { value: '7d', label: '>7天' },
  { value: '30d', label: '>30天' },
  { value: '90d', label: '>90天' },
]

function toggleEase(v: string) {
  emit('update:easePreset', props.easePreset === v ? null : v as EasePreset)
}
function toggleDate(v: string) {
  emit('update:dateAddedCustom', null)
  emit('update:dateAddedPreset', props.dateAddedPreset === v ? null : v as DateAddedPreset)
}
function toggleReview(v: string) {
  emit('update:lastReviewPreset', props.lastReviewPreset === v ? null : v as LastReviewPreset)
}
function toggleCustomDate() {
  if (props.dateAddedCustom !== null) {
    emit('update:dateAddedCustom', null)
  } else {
    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0]
    emit('update:dateAddedPreset', null)
    emit('update:dateAddedCustom', [weekAgo, today])
  }
}
</script>

<style scoped>
/* ── Shared grid layout ───────────────────────────────── */
.adv-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.adv-section {
  display: flex;
  align-items: baseline;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.adv-label {
  font-family: var(--font-ui);
  font-size: 11px;
  font-weight: 600;
  color: var(--color-text-muted);
  min-width: 2em;
  text-align: right;
  flex-shrink: 0;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.adv-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.adv-chip {
  padding: 4px 10px;
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--color-text-secondary);
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
  outline: none;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  user-select: none;
  line-height: 1.4;
}

.adv-chip:hover:not(.active) {
  border-color: var(--color-border-strong);
  color: var(--color-text-primary);
}

.adv-chip.active {
  background: var(--primitive-copper-100, rgba(153, 107, 61, 0.1));
  border-color: var(--primitive-copper-400, rgba(153, 107, 61, 0.4));
  color: var(--primitive-copper-700, #7a5427);
}

.adv-chip.active:hover {
  background: var(--primitive-copper-200, rgba(153, 107, 61, 0.18));
}

/* Custom date inputs */
.custom-dates {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding-left: calc(2em + var(--space-3));
}

.date-input {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid var(--color-border-medium);
  border-radius: var(--radius-sm);
  background: var(--color-surface-card);
  color: var(--color-text-primary);
  font-family: var(--font-ui);
  font-size: 12px;
  outline: none;
  transition: border-color var(--transition-fast);
  max-width: 140px;
}

.date-input:focus {
  border-color: var(--color-brand-primary);
  box-shadow: 0 0 0 2px rgba(153, 107, 61, 0.1);
}

.date-sep {
  color: var(--color-text-muted);
  font-size: 12px;
  flex-shrink: 0;
}

/* Reset link */
.reset-link {
  display: inline-block;
  margin-top: 6px;
  padding: 0;
  border: none;
  background: none;
  color: var(--color-text-muted);
  font-family: var(--font-ui);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  text-decoration: underline;
  text-decoration-color: transparent;
  text-underline-offset: 2px;
  transition: all var(--transition-fast);
  outline: none;
  -webkit-tap-highlight-color: transparent;
  float: right;
}

.reset-link:hover {
  color: var(--color-text-secondary);
  text-decoration-color: currentColor;
}

/* ── Desktop inline panel ─────────────────────────────── */
.advanced-panel {
  margin-top: var(--space-4);
  padding: var(--space-5);
  background: var(--color-surface-card);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  border: 1px solid var(--color-border-light);
}

.panel-slide-enter-active,
.panel-slide-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  max-height: 400px;
}

.panel-slide-enter-from,
.panel-slide-leave-to {
  opacity: 0;
  max-height: 0;
  padding-top: 0;
  padding-bottom: 0;
  margin-top: 0;
}

/* ── Mobile bottom sheet ──────────────────────────────── */
.sheet-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
}

.sheet-panel {
  width: 100%;
  max-height: 60vh;
  background: var(--color-surface-card);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.sheet-bar {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: var(--color-border-medium);
  margin: var(--space-3) auto var(--space-1);
}

.sheet-body {
  padding: var(--space-4) var(--space-5) var(--space-6);
}

.sheet-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: var(--space-5);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border-light);
}

.sheet-done {
  padding: 8px 20px;
  border: none;
  border-radius: var(--radius-default);
  background: var(--gradient-primary);
  color: white;
  font-family: var(--font-ui);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  margin-left: auto;
}

/* Sheet transitions */
.sheet-fade-enter-active,
.sheet-fade-leave-active {
  transition: opacity 0.2s ease;
}

.sheet-fade-enter-from,
.sheet-fade-leave-to {
  opacity: 0;
}

.sheet-slide-enter-active,
.sheet-slide-leave-active {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.sheet-slide-enter-from,
.sheet-slide-leave-to {
  transform: translateY(100%);
}

/* ── Mobile overrides ─────────────────────────────────── */
@media (max-width: 768px) {
  .adv-label {
    font-size: 12px;
  }

  .adv-chip {
    padding: 7px 14px;
    font-size: 13px;
  }

  .date-input {
    padding: 8px 10px;
    font-size: 14px;
    max-width: none;
  }

  .reset-link {
    font-size: 13px;
  }
}
</style>
