<template>
  <div
    class="timer-display"
    :class="{ 'is-overtime': timer.isOvertime.value }"
  >
    <svg class="timer-icon" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
      <path d="M12 6V12L16 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
    <span class="timer-value">{{ timer.formattedElapsed.value }}</span>
  </div>
</template>

<script setup lang="ts">
import type { useWritingTimer } from '../composables'

defineProps<{
  timer: ReturnType<typeof useWritingTimer>
}>()
</script>

<style scoped>
.timer-display {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: var(--radius-full);
  transition: all 0.3s ease;
}

.timer-icon {
  width: 15px;
  height: 15px;
  color: rgba(250, 247, 242, 0.4);
  transition: color 0.3s ease;
}

.timer-value {
  font-family: var(--font-data);
  font-size: 14px;
  font-weight: 600;
  color: rgba(250, 247, 242, 0.8);
  letter-spacing: 0.06em;
  font-variant-numeric: tabular-nums;
  transition: color 0.3s ease;
}

/* Overtime state（超过题型时间限制后变红） */
.timer-display.is-overtime {
  background: rgba(239, 68, 68, 0.08);
  border-color: rgba(239, 68, 68, 0.25);
}

.timer-display.is-overtime .timer-icon {
  color: #f87171;
}

.timer-display.is-overtime .timer-value {
  color: #f87171;
}
</style>
