<template>
  <div>
    <div
      class="word-card"
      :class="{
        'remembered': isRemembered,
        'hovered': isHovered
      }"
      :style="{ 
        backgroundColor: isRemembered ? '#10b981' : backgroundColor,
        color: '#374151'
      }"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
      @mousemove="handleMouseMove"
      @click="$emit('showDetail', word)"
    >
      <span class="word-text">{{ word.word }}</span>
    </div>
    
    <WordTooltip
      v-if="!isMobile"
      :word="word"
      :visible="showTooltip"
      :position="tooltipPosition"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import WordTooltip from './WordTooltip.vue';
import type { Word } from '@/shared/types';

interface Props {
  word: Word;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  toggleReview: [id: number, status: boolean];
  reset: [id: number];
  showDetail: [word: Word];
}>();

const isHovered = ref(false);
const showTooltip = ref(false);
const tooltipPosition = ref({ x: 0, y: 0 });
const isMobile = ref(false);

const isRemembered = computed(() => props.word.stop_review);

const backgroundColor = computed(() => {
  const ef = props.word.ease_factor;
  if (ef <= 1.3) return 'rgb(239, 68, 68)'; // red-500
  if (ef >= 3.0) return 'rgb(59, 130, 246)'; // blue-500
  
  if (ef < 2.5) {
    const t = (ef - 1.3) / (2.5 - 1.3);
    const r = Math.round(239 + (255 - 239) * t);
    const g = Math.round(68 + (255 - 68) * t);
    const b = Math.round(68 + (255 - 68) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }
  
  const t = (ef - 2.5) / (3.0 - 2.5);
  const r = Math.round(255 + (59 - 255) * t);
  const g = Math.round(255 + (130 - 255) * t);
  const b = Math.round(255 + (246 - 255) * t);
  return `rgb(${r}, ${g}, ${b})`;
});

// 检测是否为移动端
const checkMobile = () => {
  // 使用 hover 媒体查询检测是否支持 hover
  isMobile.value = !window.matchMedia('(hover: hover) and (pointer: fine)').matches;
};

const handleMouseEnter = (e: MouseEvent) => {
  // 在移动端不显示 tooltip
  if (isMobile.value) return;

  isHovered.value = true;
  tooltipPosition.value = { x: e.clientX, y: e.clientY };
  showTooltip.value = true;
};

const handleMouseLeave = () => {
  isHovered.value = false;
  showTooltip.value = false;
};

const handleMouseMove = (e: MouseEvent) => {
  // 在移动端不更新 tooltip 位置
  if (isMobile.value) return;

  tooltipPosition.value = { x: e.clientX, y: e.clientY };
};

onMounted(() => {
  checkMobile();
  window.addEventListener('resize', checkMobile);
});

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile);
});
</script>

<style scoped>
.word-card {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  border: 2px solid #e5e7eb;
  cursor: pointer;
  transition: all 0.3s ease-out;
  position: relative;
}

.word-card.remembered {
  border-color: #93c5fd;
}

/* hover 效果已移至媒体查询中 */

.word-text {
  font-weight: 600;
  font-size: 0.875rem;
  white-space: nowrap;
  user-select: none;
}

.word-card.hovered {
  opacity: 1;
}

/* 移动端触摸优化 */
@media (hover: none) and (pointer: coarse) {
  .word-card {
    -webkit-tap-highlight-color: transparent;
    user-select: none;
    touch-action: manipulation;
  }

  .word-card:hover {
    transform: none; /* 移动端禁用 hover 缩放效果 */
    box-shadow: none;
  }

  .word-card:active {
    transform: scale(0.98); /* 点击时的轻微缩放反馈 */
    transition: transform 0.1s ease;
  }
}

/* 桌面端保持 hover 效果 */
@media (hover: hover) and (pointer: fine) {
  .word-card:hover {
    transform: scale(1.05);
    box-shadow: 0 10px 25px -3px rgba(0, 0, 0, 0.1);
  }
}
</style>