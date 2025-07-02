<template>
  <div class="prompt-bar" :class="{ compact }">
    <div class="prompt-row">
      <span class="task-type" :class="{ 't1': prompt.task_type === 1, 't2': prompt.task_type === 2 }">
        Task {{ prompt.task_type }}
      </span>
      <span class="time-limit">{{ prompt.task_type === 1 ? '20' : '40' }}min</span>
      <button
        v-if="showImage && prompt.image_url"
        class="image-trigger"
        @click="emit('showImage')"
      >
        <svg viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.5"/>
          <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
          <path d="M21 15L16 10L5 21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>{{ compact ? '图表' : '查看图表' }}</span>
      </button>
      <!-- Trailing slot for compact mode (timer, word count) -->
      <template v-if="compact">
        <div class="topbar-spacer"></div>
        <slot name="trailing" />
      </template>
    </div>
    <p class="prompt-text">{{ prompt.prompt_text }}</p>
  </div>
</template>

<script setup lang="ts">
import type { WritingPrompt } from '@/shared/types/writing'

withDefaults(defineProps<{
  prompt: WritingPrompt
  compact?: boolean
  showImage?: boolean
}>(), {
  compact: false,
  showImage: true
})

const emit = defineEmits<{
  (e: 'showImage'): void
}>()
</script>

<style scoped>
.prompt-bar {
  flex-shrink: 0;
  padding: 14px 24px;
  background: rgba(0, 0, 0, 0.18);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.prompt-bar.compact {
  padding: 12px 20px;
  background: rgba(0, 0, 0, 0.22);
}

.prompt-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.task-type {
  padding: 3px 10px;
  font-family: var(--font-ui);
  font-size: 10px;
  font-weight: 700;
  border-radius: var(--radius-full);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.task-type.t1 {
  background: rgba(52, 211, 153, 0.12);
  color: #34d399;
  box-shadow: 0 0 0 1px rgba(52, 211, 153, 0.2);
}

.task-type.t2 {
  background: rgba(192, 132, 252, 0.1);
  color: #c084fc;
  box-shadow: 0 0 0 1px rgba(192, 132, 252, 0.18);
}

.time-limit {
  font-family: var(--font-mono);
  font-size: 10px;
  color: rgba(250, 247, 242, 0.35);
  font-weight: 500;
  letter-spacing: 0.02em;
}

.image-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-full);
  color: rgba(250, 247, 242, 0.5);
  font-family: var(--font-ui);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.image-trigger svg {
  width: 13px;
  height: 13px;
}

.image-trigger:hover {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(250, 247, 242, 0.8);
  border-color: rgba(255, 255, 255, 0.15);
}

.compact .image-trigger {
  padding: 4px 12px;
  gap: 5px;
}

.compact .image-trigger svg {
  width: 12px;
  height: 12px;
}

.topbar-spacer {
  flex: 1;
}

.prompt-text {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 14px;
  line-height: 1.7;
  color: rgba(250, 247, 242, 0.7);
  white-space: pre-line;
}

/* Full mode: clamp to 3 lines */
.prompt-bar:not(.compact) .prompt-text {
  max-height: 4.8em;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

/* Compact mode: scrollable */
.compact .prompt-text {
  font-size: 13px;
  line-height: 1.8;
  color: rgba(250, 247, 242, 0.65);
  max-height: 7.2em;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.1) transparent;
}

.compact .prompt-text::-webkit-scrollbar {
  width: 3px;
}

.compact .prompt-text::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 3px;
}

/* ── Mobile ── */
@media (max-width: 768px) {
  .prompt-bar:not(.compact) {
    flex-direction: column;
    gap: 10px;
    padding: 12px 16px;
  }

  .prompt-bar:not(.compact) .prompt-row {
    flex-wrap: wrap;
  }

  .prompt-bar:not(.compact) .prompt-text {
    max-height: none;
    -webkit-line-clamp: unset;
    display: block;
    font-size: 13px;
  }

  .compact {
    padding: 10px 16px;
  }

  .compact .prompt-text {
    font-size: 12px;
    max-height: none;
  }
}
</style>
