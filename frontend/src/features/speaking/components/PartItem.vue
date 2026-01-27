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
        <h3 class="part-title">Part {{ part.number }}</h3>
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
      :style="{ '--estimated-height': estimatedMaxHeight }"
    >
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
</template>

<script setup lang="ts">
import { ref, nextTick, watch, computed, onUnmounted } from 'vue'
import AppIcon from '@/shared/components/controls/Icons.vue'
import TopicItem from './TopicItem.vue'
import type { PartGroup } from '@/shared/types'
import { useSpeakingContext } from '../composables'

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

// Estimate max height for animation
const estimatedMaxHeight = computed(() => {
  if (!props.part.topics || props.part.topics.length === 0) return '200px'

  const topicCount = props.part.topics.length

  if (topicCount > 20) {
    return '10000px'
  }

  let totalHeight = 0
  props.part.topics.forEach(topic => {
    totalHeight += 90
    if (topic.questions && topic.questions.length > 0) {
      totalHeight += topic.questions.length * 55
    }
  })

  const finalHeight = Math.max(200, totalHeight)
  return `${finalHeight}px`
})

// ResizeObserver for dynamic height
let resizeObserver: ResizeObserver | null = null
if (typeof window !== 'undefined') {
  resizeObserver = new ResizeObserver(() => {
    estimatedMaxHeight.value
  })

  nextTick(() => {
    if (resizeObserver) {
      resizeObserver.observe(document.body)
    }
  })
}

// Auto focus input
watch(showAddTopicInput, val => {
  if (val) nextTick(() => addInputRef.value?.focus())
})

// Cleanup
const cleanup = () => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
}

onUnmounted(cleanup)
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   Part Section - Book Chapter Style
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

  background: linear-gradient(
    135deg,
    var(--primitive-paper-50) 0%,
    var(--primitive-paper-100) 100%
  );
  border: 1px solid var(--primitive-paper-400);
  border-radius: 12px;

  cursor: pointer;
  user-select: none;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);

  /* Subtle inner shadow for depth */
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.6);
}

.part-header:hover {
  background: linear-gradient(
    135deg,
    var(--primitive-paper-100) 0%,
    var(--primitive-paper-200) 100%
  );
  border-color: var(--primitive-copper-200);
  box-shadow:
    0 4px 16px rgba(139, 105, 20, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.7);
  transform: translateY(-1px);
}

.part-header:active {
  transform: translateY(0) scale(0.99);
}

.part-header.is-expanded {
  background: linear-gradient(
    135deg,
    rgba(139, 105, 20, 0.08) 0%,
    rgba(184, 134, 11, 0.06) 100%
  );
  border-color: var(--primitive-copper-300);
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
    var(--primitive-copper-500),
    var(--primitive-gold-600)
  );
  border-radius: 10px;

  box-shadow:
    0 2px 8px rgba(139, 105, 20, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.marker-number {
  font-family: var(--font-serif);
  font-size: 16px;
  font-weight: 700;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
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
  color: var(--primitive-ink-800);
  letter-spacing: 0.01em;
}

.part-count {
  font-size: 12px;
  color: var(--primitive-ink-400);
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

  background: transparent;
  border: 1px solid var(--primitive-paper-400);
  border-radius: 8px;
  color: var(--primitive-copper-500);

  cursor: pointer;
  opacity: 0;
  transform: translateX(8px);
  transition: all 0.2s ease;
}

.part-header:hover .part-action-btn {
  opacity: 1;
  transform: translateX(0);
}

.part-action-btn:hover {
  background: var(--primitive-copper-50);
  border-color: var(--primitive-copper-200);
  color: var(--primitive-copper-600);
}

.expand-chevron {
  width: 18px;
  height: 18px;
  color: var(--primitive-ink-400);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.expand-chevron.is-rotated {
  transform: rotate(90deg);
  color: var(--primitive-copper-500);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Add Topic Form
   ═══════════════════════════════════════════════════════════════════════════ */

.add-topic-form {
  padding: 12px 16px;
  margin-top: 8px;
  background: var(--primitive-paper-50);
  border: 1px solid var(--primitive-copper-200);
  border-radius: 10px;
  box-shadow: 0 4px 12px rgba(139, 105, 20, 0.08);
}

.topic-input {
  width: 100%;
  padding: 10px 12px;

  font-family: var(--font-sans);
  font-size: 14px;
  color: var(--primitive-ink-800);

  background: white;
  border: 2px solid var(--primitive-paper-400);
  border-radius: 8px;

  transition: all 0.2s ease;
  box-sizing: border-box;
}

.topic-input:focus {
  outline: none;
  border-color: var(--primitive-copper-500);
  box-shadow: 0 0 0 3px rgba(139, 105, 20, 0.12);
}

.topic-input::placeholder {
  color: var(--primitive-ink-300);
}

.input-hint {
  margin-top: 8px;
  font-size: 11px;
  color: var(--primitive-ink-400);
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
  display: flex;
  flex-direction: column;
  gap: 8px;

  max-height: 0;
  overflow: hidden;
  opacity: 0;
  padding-left: 24px;
  margin-top: 0;

  transform: translateY(-8px);
  transition:
    max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    margin-top 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    opacity 0.3s ease,
    transform 0.3s ease;

  will-change: max-height, margin-top, opacity, transform;
}

.topics-list.is-expanded {
  max-height: var(--estimated-height, 10000px);
  margin-top: 12px;
  opacity: 1;
  transform: translateY(0);
}

/* Staggered animation for topics */
.topics-list.is-expanded > :deep(*) {
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

/* Left border decoration */
.topics-list::before {
  content: '';
  position: absolute;
  left: 18px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: linear-gradient(
    180deg,
    var(--primitive-copper-200) 0%,
    transparent 100%
  );
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
  color: var(--primitive-ink-400);
}

.empty-dash {
  font-size: 14px;
  opacity: 0.5;
}

.empty-text {
  font-size: 13px;
  font-style: italic;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Mobile Adjustments
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 480px) {
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
      var(--primitive-paper-50) 0%,
      var(--primitive-paper-100) 100%
    );
    border-color: var(--primitive-paper-400);
    box-shadow:
      0 2px 8px rgba(0, 0, 0, 0.04),
      inset 0 1px 0 rgba(255, 255, 255, 0.6);
    transform: none;
  }

  .part-header:active {
    background: var(--primitive-paper-200);
    transform: scale(0.98);
  }

  .topics-list {
    padding-left: 20px;
  }

  .topics-list::before {
    left: 14px;
  }
}
</style>
