<template>
  <section
    class="chart-card"
    :class="chart.heightClass"
    :style="cardStyle"
  >
    <div class="chart-card-header">
      <h2>{{ chart.title }}</h2>
      <slot name="title-extra" />
    </div>
    <div class="chart-card-body">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ChartDefinition } from '../types'

const props = defineProps<{
  chart: ChartDefinition
  index: number
}>()

const cardStyle = computed(() => ({
  'grid-column': `span ${props.chart.span}`,
  '--accent': props.chart.accent || 'var(--color-brand-primary)',
  '--stagger': `${props.index * 60}ms`,
}))
</script>

<style scoped>
.chart-card {
  background: var(--color-surface-card);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--color-border-light);
  padding: var(--space-5);
  padding-left: calc(var(--space-5) + 3px);
  display: flex;
  flex-direction: column;
  overflow: visible;
  min-height: 280px;
  position: relative;

  /* Accent stripe */
  border-left: 3px solid var(--accent);

  /* Staggered entrance */
  animation: cardReveal 0.5s cubic-bezier(0.25, 1, 0.5, 1) both;
  animation-delay: var(--stagger);
}

@keyframes cardReveal {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.chart-card:hover {
  box-shadow: var(--shadow-md);
}

/* Height variants */
.chart-card.h-compact {
  min-height: 200px;
}

.chart-card.h-tall {
  min-height: 400px;
}

/* Header */
.chart-card-header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
  margin-bottom: var(--space-3);
}

.chart-card-header h2 {
  font-family: var(--font-serif);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  letter-spacing: -0.01em;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Body fills remaining space */
.chart-card-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* Ensure chart content fills body */
.chart-card-body > :deep(*) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* ECharts container sizing */
.chart-card-body :deep(.echart) {
  flex: 1 !important;
  width: 100% !important;
  height: 100% !important;
  min-height: 200px !important;
  position: relative;
}

/* Mobile: all cards go full width */
@media (max-width: 768px) {
  .chart-card {
    padding: var(--space-4);
    padding-left: calc(var(--space-4) + 3px);
    grid-column: span 1 !important;
  }

  .chart-card-header h2 {
    font-size: var(--font-size-sm);
  }
}
</style>
