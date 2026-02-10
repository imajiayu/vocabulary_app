<template>
  <div class="part-section">
    <!-- Part Header - Book chapter style -->
    <div
      class="part-header"
      :class="{ 'is-expanded': isExpanded }"
      @click="handleToggle"
    >
      <div class="part-marker">
        <span class="marker-number">{{ part.number }}</span>
      </div>

      <div class="part-content">
        <h3 class="part-title">{{ part.number === 2 ? 'Part 2 & 3' : `Part ${part.number}` }}</h3>
        <span class="part-count">{{ part.topics.length }} 个主题</span>
      </div>

      <div class="part-controls">
        <button
          class="part-action-btn"
          @click.stop="showAddTopicInput = true"
          title="添加主题"
        >
          <AppIcon name="plus" />
        </button>
        <AppIcon
          name="expand"
          class="expand-chevron"
          :class="{ 'is-rotated': isExpanded }"
        />
      </div>
    </div>

    <!-- Add Topic Input -->
    <Transition name="slide-down">
      <div v-if="showAddTopicInput" class="add-topic-form">
        <input
          v-model="newTopicTitle"
          ref="addInputRef"
          class="topic-input"
          placeholder="输入主题标题..."
          @keyup.enter="submitNewTopic"
          @keyup.escape="cancelAddTopic"
          @blur="cancelAddTopic"
        />
        <div class="input-hint">按 Enter 确认，Escape 取消</div>
      </div>
    </Transition>

    <!-- Topics List -->
    <div
      class="topics-list"
      :class="{ 'is-expanded': isExpanded }"
    >
      <div class="topics-inner">
        <TopicItem
          v-for="(topic, index) in part.topics"
          :key="`topic-${topic.id}`"
          :topic="topic"
          :style="{ '--topic-index': index }"
        />

        <div v-if="part.topics.length === 0 && isExpanded" class="topics-empty">
          <span class="empty-dash">—</span>
          <span class="empty-text">暂无主题</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch, computed } from 'vue'
import AppIcon from '@/shared/components/controls/Icons.vue'
import TopicItem from './TopicItem.vue'
import type { PartGroup } from '@/shared/types'
import { useSpeakingContext } from '../composables/useSpeakingContext'

const props = defineProps<{
  part: PartGroup
}>()

// Context state and methods
const { expandedParts, togglePart, addTopic } = useSpeakingContext()

// Computed expansion state
const isExpanded = computed(() => expandedParts.value.has(props.part.number))

const handleToggle = () => {
  togglePart(props.part.number)
}

// Add topic state
const showAddTopicInput = ref(false)
const newTopicTitle = ref('')
const addInputRef = ref<HTMLInputElement | null>(null)

const submitNewTopic = async () => {
  const title = newTopicTitle.value.trim()
  if (title) {
    await addTopic(props.part.number, title)
    newTopicTitle.value = ''
  }
  showAddTopicInput.value = false
}

const cancelAddTopic = () => {
  showAddTopicInput.value = false
  newTopicTitle.value = ''
}

// Auto focus input
watch(showAddTopicInput, val => {
  if (val) nextTick(() => addInputRef.value?.focus())
})

</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   Part Section - Dark Studio Console Style (Level 1)
   深色主题下的顶级分组 - 半透明金色边框玻璃态
   ═══════════════════════════════════════════════════════════════════════════ */

.part-section {
  position: relative;
}

/* ── Part Header ── */
.part-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;

  /* 深色玻璃态背景 */
  background: linear-gradient(
    135deg,
    rgba(45, 52, 70, 0.85) 0%,
    rgba(38, 44, 60, 0.9) 100%
  );
  border: 1px solid rgba(184, 134, 11, 0.25);
  border-radius: 12px;

  cursor: pointer;
  user-select: none;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  /* 微妙的内发光 */
  box-shadow:
    0 2px 12px rgba(0, 0, 0, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.part-header:hover {
  background: linear-gradient(
    135deg,
    rgba(55, 62, 82, 0.9) 0%,
    rgba(45, 52, 70, 0.95) 100%
  );
  border-color: rgba(184, 134, 11, 0.4);
  box-shadow:
    0 4px 20px rgba(184, 134, 11, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.08);
  transform: translateY(-1px);
}

.part-header:active {
  transform: translateY(0) scale(0.99);
}

.part-header.is-expanded {
  background: linear-gradient(
    135deg,
    rgba(184, 134, 11, 0.12) 0%,
    rgba(139, 105, 20, 0.08) 100%
  );
  border-color: rgba(184, 134, 11, 0.45);
  box-shadow:
    0 4px 16px rgba(184, 134, 11, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

/* ── Part Marker (Chapter number badge) ── */
.part-marker {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;

  background: linear-gradient(
    135deg,
    var(--primitive-gold-500),
    var(--primitive-copper-500)
  );
  border-radius: 10px;

  box-shadow:
    0 2px 10px rgba(184, 134, 11, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.25);
}

.marker-number {
  font-family: var(--font-serif);
  font-size: 16px;
  font-weight: 700;
  color: white;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

/* ── Part Content ── */
.part-content {
  flex: 1;
  min-width: 0;
}

.part-title {
  margin: 0 0 2px;
  font-family: var(--font-serif);
  font-size: 15px;
  font-weight: 600;
  color: var(--primitive-paper-200);
  letter-spacing: 0.01em;
}

.part-count {
  font-size: 12px;
  color: var(--primitive-paper-500);
}

/* ── Part Controls ── */
.part-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.part-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;

  background: rgba(184, 134, 11, 0.1);
  border: 1px solid rgba(184, 134, 11, 0.25);
  border-radius: 8px;
  color: var(--primitive-gold-400);

  cursor: pointer;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s ease;
}

.part-header:hover .part-action-btn {
  opacity: 1;
  pointer-events: auto;
}

.part-action-btn:hover {
  background: rgba(184, 134, 11, 0.2);
  border-color: rgba(184, 134, 11, 0.4);
  color: var(--primitive-gold-300);
}

.expand-chevron {
  width: 18px;
  height: 18px;
  color: var(--primitive-paper-500);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.expand-chevron.is-rotated {
  transform: rotate(90deg);
  color: var(--primitive-gold-400);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Add Topic Form - 深色主题
   ═══════════════════════════════════════════════════════════════════════════ */

.add-topic-form {
  padding: 12px 16px;
  margin-top: 8px;
  background: rgba(30, 35, 50, 0.95);
  border: 1px solid rgba(184, 134, 11, 0.3);
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.topic-input {
  width: 100%;
  padding: 10px 12px;

  font-family: var(--font-ui);
  font-size: 14px;
  color: var(--primitive-paper-200);

  background: rgba(20, 24, 36, 0.8);
  border: 1px solid rgba(250, 247, 242, 0.15);
  border-radius: 8px;

  transition: all 0.2s ease;
  box-sizing: border-box;
}

.topic-input:focus {
  outline: none;
  border-color: var(--primitive-gold-500);
  box-shadow: 0 0 0 3px rgba(184, 134, 11, 0.2);
  background: rgba(25, 30, 42, 0.9);
}

.topic-input::placeholder {
  color: var(--primitive-paper-600);
}

.input-hint {
  margin-top: 8px;
  font-size: 11px;
  color: var(--primitive-paper-600);
  text-align: right;
}

/* Slide down transition */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Topics List Container
   ═══════════════════════════════════════════════════════════════════════════ */

.topics-list {
  position: relative;
  display: grid;
  grid-template-rows: 0fr;
  padding-left: 20px;
  transition: grid-template-rows 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.topics-inner {
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.topics-list.is-expanded {
  grid-template-rows: 1fr;
  margin-top: 10px;
}

/* Staggered animation for topics */
.topics-list.is-expanded .topics-inner > :deep(*) {
  animation: topicSlideIn 0.35s cubic-bezier(0.22, 1, 0.36, 1) backwards;
  animation-delay: calc(var(--topic-index, 0) * 0.05s);
}

@keyframes topicSlideIn {
  from {
    opacity: 0;
    transform: translateX(-12px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* Left border decoration - 金色渐变线 */
.topics-list::before {
  content: '';
  position: absolute;
  left: -6px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: linear-gradient(
    180deg,
    rgba(184, 134, 11, 0.5) 0%,
    rgba(184, 134, 11, 0.1) 100%
  );
  border-radius: 1px;
  opacity: 0;
  transition: opacity 0.3s ease;
}

.topics-list.is-expanded::before {
  opacity: 1;
}

/* ── Empty State ── */
.topics-empty {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 12px;
  color: var(--primitive-paper-600);
}

.empty-dash {
  font-size: 14px;
  opacity: 0.5;
  color: var(--primitive-gold-500);
}

.empty-text {
  font-size: 13px;
  font-style: italic;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Mobile Adjustments
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .part-header {
    padding: 12px 14px;
    gap: 10px;
  }

  .part-marker {
    width: 32px;
    height: 32px;
    border-radius: 8px;
  }

  .marker-number {
    font-size: 14px;
  }

  .part-title {
    font-size: 14px;
  }

  .part-count {
    font-size: 11px;
  }

  /* Always show action button on mobile */
  .part-action-btn {
    opacity: 1;
    transform: translateX(0);
  }

  /* Disable hover effects on mobile */
  .part-header:hover {
    background: linear-gradient(
      135deg,
      rgba(45, 52, 70, 0.85) 0%,
      rgba(38, 44, 60, 0.9) 100%
    );
    border-color: rgba(184, 134, 11, 0.25);
    box-shadow:
      0 2px 12px rgba(0, 0, 0, 0.25),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
    transform: none;
  }

  .part-header:active {
    background: rgba(184, 134, 11, 0.15);
    transform: scale(0.98);
  }

  .topics-list {
    padding-left: 16px;
  }

  .topics-list::before {
    left: -6px;
  }
}
</style>
