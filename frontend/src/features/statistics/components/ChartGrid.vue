<template>
  <div class="chart-grid">
    <slot />
  </div>
</template>

<style scoped>
.chart-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-5);
  width: 100%;
}

@media (max-width: 768px) {
  .chart-grid {
    grid-template-columns: 1fr;
    gap: var(--space-4);
  }
}
</style>
