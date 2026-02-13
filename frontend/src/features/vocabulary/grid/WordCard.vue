<template>
  <div>
    <div
      class="word-card"
      :class="{
        'remembered': isRemembered,
        'hovered': isHovered,
        'selection-mode': isSelectionMode,
        'selected': isSelected
      }"
      :style="{
        backgroundColor: isRemembered ? 'var(--color-success)' : backgroundColor,
        color: isRemembered ? '#fff' : undefined,
      }"
      @mouseenter="handleMouseEnter"
      @mouseleave="handleMouseLeave"
      @mousemove="handleMouseMove"
      @click="handleClick"
    >
      <span class="word-text">{{ word.word }}</span>
      <span
        class="spell-bar"
        :class="{ 'spell-bar-locked': !spellEligible }"
        :style="spellBarStyle"
      />
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
import { ref, computed } from 'vue';
import { useBreakpoint } from '@/shared/composables/useBreakpoint';
import WordTooltip from './WordTooltip.vue';
import type { Word } from '@/shared/types';

interface Props {
  word: Word;
  isSelectionMode?: boolean;
  isSelected?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  isSelectionMode: false,
  isSelected: false
});

const emit = defineEmits<{
  showDetail: [word: Word];
  toggleSelection: [id: number];
}>();

const isHovered = ref(false);
const showTooltip = ref(false);
const tooltipPosition = ref({ x: 0, y: 0 });
const { isMobile } = useBreakpoint();

const isRemembered = computed(() => props.word.stop_review);
const isSpellStopped = computed(() => props.word.stop_spell === 1);

const spellEligible = computed(() => {
  const w = props.word;
  return (w.repetition || 0) >= 3 || w.spell_strength !== null;
});

// 底部条 inline style（不可拼写时由 CSS 类控制，无需 inline）
const spellBarStyle = computed(() => {
  if (!spellEligible.value) return {};

  // 已停止：满宽深铜，一眼"封印"
  if (isSpellStopped.value) {
    return { width: '100%', backgroundColor: 'var(--primitive-copper-500)' };
  }

  // 进行中：copper-200 (#E8CBA8) → copper-400 (#B8834A)，宽度随 strength
  const strength = props.word.spell_strength ?? 0;
  const pct = Math.max(10, (strength / 5.0) * 100);
  const t = Math.min(strength / 5.0, 1);
  const r = Math.round(232 + (184 - 232) * t);
  const g = Math.round(203 + (131 - 203) * t);
  const b = Math.round(168 + (74 - 168) * t);
  return { width: `${pct}%`, backgroundColor: `rgb(${r}, ${g}, ${b})` };
});

const backgroundColor = computed(() => {
  const ef = props.word.ease_factor;

  // 使用设计系统的 brick/olive 浅色调，保证深色文字可读性
  // brick-200 rgb(232,184,184) → 白色 → olive-200 rgb(200,212,200)
  if (ef <= 1.3) return 'var(--primitive-brick-200)';
  if (ef >= 3.0) return 'var(--primitive-olive-200)';

  if (ef < 2.5) {
    // brick-200 → 白色
    const t = (ef - 1.3) / (2.5 - 1.3);
    const r = Math.round(232 + (255 - 232) * t);
    const g = Math.round(184 + (255 - 184) * t);
    const b = Math.round(184 + (255 - 184) * t);
    return `rgb(${r}, ${g}, ${b})`;
  }

  // 白色 → olive-200
  const t = (ef - 2.5) / (3.0 - 2.5);
  const r = Math.round(255 + (200 - 255) * t);
  const g = Math.round(255 + (212 - 255) * t);
  const b = Math.round(255 + (200 - 255) * t);
  return `rgb(${r}, ${g}, ${b})`;
});

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

// 处理点击事件
const handleClick = () => {
  if (props.isSelectionMode) {
    // 在多选模式下，点击卡片也会切换选择状态
    handleToggleSelection();
  } else {
    // 正常模式下显示详情
    emit('showDetail', props.word);
  }
};

// 切换选择状态
const handleToggleSelection = () => {
  emit('toggleSelection', props.word.id);
};

</script>

<style scoped>
.word-card {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  border: 2px solid var(--color-border-medium);
  cursor: pointer;
  transition: all 0.3s ease-out;
  position: relative;
  overflow: hidden;
}

.word-card.remembered {
  border-color: var(--color-border-medium);
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

/* 多选模式样式 */
.word-card.selection-mode {
  cursor: pointer;
  position: relative;
}

.word-card.selection-mode:not(.selected) {
  border-color: var(--color-border-medium);
  border-width: 2px;
  border-style: dashed;
}

.word-card.selected {
  border-color: var(--color-delete);
  border-width: 2px;
  border-style: solid;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.2);
}

/* 多选模式下hover效果 */
.word-card.selection-mode:hover:not(.selected) {
  border-color: var(--color-text-tertiary);
  border-width: 2px;
}

/* ── 拼写强度底部墨线 ── */
.spell-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 3px;
  transition: width 0.3s ease, background-color 0.3s ease;
}

/* 不可拼写：全宽虚线，淡灰色 */
.spell-bar-locked {
  width: 100%;
  height: 0;
  border-top: 2px dashed var(--primitive-ink-200);
  background: none;
}
</style>
