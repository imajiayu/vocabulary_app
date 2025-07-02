<template>
  <div
    class="timer-display"
    :class="{
      'is-warning': timer.isWarning.value,
      'is-overtime': timer.isOvertime.value,
      'is-paused': timer.isPaused.value
    }"
  >
    <svg class="timer-icon" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
      <path d="M12 6V12L16 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
    <span class="timer-value">{{ timer.formattedTime.value }}</span>
    <span v-if="timer.isPaused.value" class="timer-status">已暂停</span>
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
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 600;
  color: rgba(250, 247, 242, 0.8);
  letter-spacing: 0.06em;
  font-variant-numeric: tabular-nums;
  transition: color 0.3s ease;
}

.timer-status {
  font-family: var(--font-ui);
  font-size: 10px;
  color: rgba(250, 247, 242, 0.3);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

/* Warning state (< 5 min) */
.timer-display.is-warning {
  background: rgba(221, 165, 32, 0.08);
  border-color: rgba(221, 165, 32, 0.25);
}

.timer-display.is-warning .timer-icon {
  color: var(--primitive-gold-400);
  animation: pulse 1.2s ease-in-out infinite;
}

.timer-display.is-warning .timer-value {
  color: var(--primitive-gold-300);
}

/* Overtime state */
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

/* Paused state */
.timer-display.is-paused {
  opacity: 0.6;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>
