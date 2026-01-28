<template>
  <div class="prompt-display">
    <!-- Task Type Badge -->
    <div class="prompt-header">
      <span class="task-badge" :class="taskBadgeClass">
        Task {{ prompt.task_type }}
      </span>
      <span class="time-hint">{{ prompt.task_type === 1 ? '20' : '40' }} 分钟</span>
    </div>

    <!-- Prompt Text -->
    <div class="prompt-text">
      {{ prompt.prompt_text }}
    </div>

    <!-- Image (Task 1 only) -->
    <div v-if="prompt.image_url" class="prompt-image">
      <img
        :src="prompt.image_url"
        alt="Task 1 Chart"
        @click="showImageModal = true"
      />
      <button class="expand-btn" @click="showImageModal = true">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M15 3H21V9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M9 21H3V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M21 3L14 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M3 21L10 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>

    <!-- Image Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showImageModal" class="image-modal" @click="showImageModal = false">
          <img :src="prompt.image_url || ''" alt="Task 1 Chart" @click.stop />
          <button class="close-modal" @click="showImageModal = false">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <path d="M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { WritingPrompt } from '@/shared/types/writing'

const props = defineProps<{
  prompt: WritingPrompt
}>()

const showImageModal = ref(false)

const taskBadgeClass = computed(() => ({
  'task-badge--t1': props.prompt.task_type === 1,
  'task-badge--t2': props.prompt.task_type === 2
}))
</script>

<style scoped>
.prompt-display {
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: rgba(0, 0, 0, 0.2);
}

/* ── Header ── */
.prompt-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.task-badge {
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 700;
  border-radius: 4px;
  text-transform: uppercase;
}

.task-badge--t1 {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.task-badge--t2 {
  background: rgba(168, 85, 247, 0.15);
  color: #a855f7;
}

.time-hint {
  font-size: 13px;
  color: var(--primitive-ink-400);
}

/* ── Prompt Text ── */
.prompt-text {
  flex: 1;
  font-size: 15px;
  line-height: 1.7;
  color: var(--primitive-paper-300);
  overflow-y: auto;
}

/* ── Prompt Image ── */
.prompt-image {
  position: relative;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: rgba(0, 0, 0, 0.3);
}

.prompt-image img {
  width: 100%;
  height: auto;
  max-height: 300px;
  object-fit: contain;
  cursor: pointer;
  transition: transform 0.2s ease;
}

.prompt-image:hover img {
  transform: scale(1.02);
}

.expand-btn {
  position: absolute;
  bottom: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(0, 0, 0, 0.6);
  border: none;
  border-radius: var(--radius-sm);
  color: white;
  cursor: pointer;
  opacity: 0;
  transition: all 0.2s ease;
}

.expand-btn svg {
  width: 16px;
  height: 16px;
}

.prompt-image:hover .expand-btn {
  opacity: 1;
}

.expand-btn:hover {
  background: rgba(59, 130, 246, 0.8);
}

/* ── Image Modal ── */
.image-modal {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.9);
  z-index: 300;
  padding: 40px;
}

.image-modal img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: var(--radius-md);
}

.close-modal {
  position: absolute;
  top: 20px;
  right: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: rgba(250, 247, 242, 0.1);
  border: none;
  border-radius: 50%;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-modal svg {
  width: 20px;
  height: 20px;
}

.close-modal:hover {
  background: rgba(250, 247, 242, 0.2);
}

/* Modal transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Mobile
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .prompt-display {
    padding: 16px;
  }

  .prompt-text {
    font-size: 14px;
  }

  .prompt-image img {
    max-height: 150px;
  }

  .image-modal {
    padding: 20px;
  }
}
</style>
