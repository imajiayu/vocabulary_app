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
  gap: 8px;
  padding: 8px 16px;
  background: rgba(250, 247, 242, 0.05);
  border: 1px solid rgba(250, 247, 242, 0.1);
  border-radius: var(--radius-full);
  transition: all 0.3s ease;
}

.timer-icon {
  width: 18px;
  height: 18px;
  color: var(--primitive-paper-400);
}

.timer-value {
  font-family: var(--font-mono, monospace);
  font-size: 16px;
  font-weight: 600;
  color: var(--primitive-paper-200);
  letter-spacing: 0.05em;
}

.timer-status {
  font-size: 12px;
  color: var(--primitive-ink-400);
}

/* Warning state (< 5 min) */
.timer-display.is-warning {
  background: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.3);
}

.timer-display.is-warning .timer-icon {
  color: var(--primitive-gold-500);
  animation: pulse 1s ease-in-out infinite;
}

.timer-display.is-warning .timer-value {
  color: var(--primitive-gold-400);
}

/* Overtime state */
.timer-display.is-overtime {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
}

.timer-display.is-overtime .timer-icon {
  color: var(--primitive-brick-400);
}

.timer-display.is-overtime .timer-value {
  color: var(--primitive-brick-400);
}

/* Paused state */
.timer-display.is-paused {
  opacity: 0.7;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
