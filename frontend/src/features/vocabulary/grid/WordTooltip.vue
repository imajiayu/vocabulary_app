<template>
  <div
    v-if="visible"
    class="tooltip"
    :style="{ left: position.x + 10 + 'px', top: position.y + 'px' }"
  >
    <div class="tooltip-word">{{ word.word }}</div>
    <div class="tooltip-definition">{{ formattedDefinition }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Word } from '@/shared/types';

interface Position {
  x: number;
  y: number;
}

interface Props {
  word: Word;
  visible: boolean;
  position: Position;
}

const props = defineProps<Props>();

// 使用 formatDefinitions 处理 definition
const formattedDefinition = computed(() => props.word.definition.definitions?.join('\n'));
</script>

<style scoped>
.tooltip {
  position: fixed;
  z-index: 50;
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  padding: 0.5rem 0.75rem;
  max-width: 18rem;
  pointer-events: none;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
}

.tooltip-word {
  font-weight: 600;
  color: #111827;
}

.tooltip-definition {
  font-size: 0.875rem;
  color: #4b5563;
  white-space: pre-line; /* 保留换行显示 */
}
</style>
