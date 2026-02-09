<template>
  <!-- 桌面端：浮动卡片 Tooltip -->
  <Teleport to="body">
    <Transition name="tooltip-fade">
      <div
        v-if="visible && !isMobileMode"
        ref="tooltipRef"
        class="word-tooltip-desktop"
        :style="tooltipStyle"
      >
        <!-- 装饰性墨迹角 -->
        <div class="ink-corner ink-corner-tl"></div>
        <div class="ink-corner ink-corner-br"></div>

        <!-- 单词头部 -->
        <div class="tooltip-header">
          <span class="tooltip-word">{{ word.word }}</span>
          <div v-if="hasPhonetic" class="tooltip-phonetic">
            <span v-if="word.definition.phonetic?.us" class="phonetic-item">
              <span class="phonetic-label">US</span>
              <span class="phonetic-text">/{{ word.definition.phonetic.us }}/</span>
            </span>
            <span v-if="word.definition.phonetic?.uk" class="phonetic-item">
              <span class="phonetic-label">UK</span>
              <span class="phonetic-text">/{{ word.definition.phonetic.uk }}/</span>
            </span>
          </div>
        </div>

        <!-- 释义列表 -->
        <div v-if="definitions.length" class="tooltip-definitions">
          <div
            v-for="(def, index) in definitions.slice(0, 3)"
            :key="index"
            class="definition-item"
          >
            <span class="definition-bullet">{{ index + 1 }}</span>
            <span class="definition-text">{{ def }}</span>
          </div>
          <div v-if="definitions.length > 3" class="definition-more">
            +{{ definitions.length - 3 }} 更多释义
          </div>
        </div>

        <!-- 例句（最多显示1条） -->
        <div v-if="examples.length" class="tooltip-example">
          <div class="example-label">例句</div>
          <div class="example-en" v-html="examples[0].en"></div>
          <div class="example-zh">{{ examples[0].zh }}</div>
        </div>
      </div>
    </Transition>

    <!-- 移动端：底部抽屉 -->
    <Transition name="drawer-slide">
      <div
        v-if="visible && isMobileMode"
        class="word-tooltip-mobile-overlay"
        @click.self="handleClose"
      >
        <div class="word-tooltip-mobile" ref="mobileTooltipRef">
          <!-- 拖拽指示器 -->
          <div class="drawer-handle">
            <div class="handle-bar"></div>
          </div>

          <!-- 单词头部 -->
          <div class="mobile-header">
            <div class="header-main">
              <span class="mobile-word">{{ word.word }}</span>
              <button class="close-btn" @click="handleClose" aria-label="关闭">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div v-if="hasPhonetic" class="mobile-phonetic">
              <span v-if="word.definition.phonetic?.us" class="phonetic-tag">
                US /{{ word.definition.phonetic.us }}/
              </span>
              <span v-if="word.definition.phonetic?.uk" class="phonetic-tag">
                UK /{{ word.definition.phonetic.uk }}/
              </span>
            </div>
          </div>

          <!-- 释义列表 -->
          <div v-if="definitions.length" class="mobile-definitions">
            <div class="section-title">释义</div>
            <div class="definitions-list">
              <div
                v-for="(def, index) in definitions"
                :key="index"
                class="mobile-definition-item"
              >
                <span class="def-number">{{ index + 1 }}</span>
                <span class="def-text">{{ def }}</span>
              </div>
            </div>
          </div>

          <!-- 例句 -->
          <div v-if="examples.length" class="mobile-examples">
            <div class="section-title">例句</div>
            <div class="examples-list">
              <div
                v-for="(ex, index) in examples.slice(0, 2)"
                :key="index"
                class="mobile-example-item"
              >
                <div class="example-english" v-html="ex.en"></div>
                <div class="example-chinese">{{ ex.zh }}</div>
              </div>
            </div>
          </div>

          <!-- 底部安全区域 -->
          <div class="mobile-safe-area"></div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, watch, nextTick, onUnmounted } from 'vue'
import type { Word } from '@/shared/types'

interface Position {
  x: number
  y: number
}

interface Props {
  word: Word
  visible: boolean
  position: Position
  isMobile?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isMobile: false
})

const emit = defineEmits<{
  close: []
}>()

// Refs
const tooltipRef = ref<HTMLDivElement | null>(null)
const mobileTooltipRef = ref<HTMLDivElement | null>(null)

// State
const isMobileMode = computed(() => props.isMobile)

// Computed
const hasPhonetic = computed(() => {
  return props.word.definition.phonetic?.us || props.word.definition.phonetic?.uk
})

const definitions = computed(() => {
  return props.word.definition.definitions || []
})

const examples = computed(() => {
  return props.word.definition.examples || []
})

// 测量实际高度，用于精确的视口边界检测
const measuredHeight = ref(0)

// immediate: true 确保组件首次挂载时也触发测量
// （父组件 v-if="tooltipWord" 每次 hover 都会重建组件实例）
watch([() => props.visible, () => props.word], async () => {
  if (props.visible && !isMobileMode.value) {
    await nextTick()
    if (tooltipRef.value) {
      measuredHeight.value = tooltipRef.value.offsetHeight
    }
  }
}, { immediate: true })

// 计算 tooltip 位置，确保不超出视口
// 不使用 CSS translateY(-50%)，直接计算 top 边缘位置
const tooltipStyle = computed(() => {
  const { x, y } = props.position
  const padding = 16
  const tooltipWidth = 320
  const height = measuredHeight.value || 300
  const vh = window.innerHeight

  let left = x + 15

  // 检查右边界
  if (left + tooltipWidth > window.innerWidth - padding) {
    left = x - tooltipWidth - 15
  }

  // 尝试垂直居中于鼠标位置
  let top = y - height / 2

  // 下边界：确保底部不超出视口
  if (top + height > vh - padding) {
    top = vh - height - padding
  }

  // 上边界：确保顶部不超出视口
  if (top < padding) {
    top = padding
  }

  return {
    left: `${left}px`,
    top: `${top}px`,
    maxHeight: `${vh - padding * 2}px`
  }
})

// Methods
const handleClose = () => {
  emit('close')
}

// 移动端阻止背景滚动
watch(() => props.visible && props.isMobile, (shouldLock) => {
  if (shouldLock) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})

onUnmounted(() => {
  document.body.style.overflow = ''
})
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   Word Tooltip - Ink Card Design
   墨迹卡片设计 - 优雅的浮动释义展示
   ═══════════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════
   桌面端：浮动卡片
   ═══════════════════════════════════════════════════════════════════════════ */

.word-tooltip-desktop {
  position: fixed;
  z-index: 9999;
  width: 320px;
  max-width: calc(100vw - 32px);
  padding: 1rem 1.25rem;
  background: var(--primitive-paper-100);
  border: 1px solid var(--primitive-paper-400);
  border-radius: var(--radius-lg);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.12),
    0 4px 12px rgba(0, 0, 0, 0.06);
  pointer-events: none;

  /* 纸张纹理 */
  background-image:
    radial-gradient(
      ellipse at 30% 20%,
      rgba(153, 107, 61, 0.03) 0%,
      transparent 50%
    );
}

/* 装饰性墨迹角 */
.ink-corner {
  position: absolute;
  width: 24px;
  height: 24px;
  pointer-events: none;
  opacity: 0.15;
}

.ink-corner-tl {
  top: -1px;
  left: -1px;
  border-top: 2px solid var(--primitive-copper-500);
  border-left: 2px solid var(--primitive-copper-500);
  border-radius: var(--radius-lg) 0 0 0;
}

.ink-corner-br {
  bottom: -1px;
  right: -1px;
  border-bottom: 2px solid var(--primitive-copper-500);
  border-right: 2px solid var(--primitive-copper-500);
  border-radius: 0 0 var(--radius-lg) 0;
}

/* 头部 */
.tooltip-header {
  margin-bottom: 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px dashed var(--primitive-paper-400);
}

.tooltip-word {
  font-family: var(--font-serif);
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--primitive-ink-800);
  letter-spacing: -0.01em;
}

.tooltip-phonetic {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.375rem;
}

.phonetic-item {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.phonetic-label {
  font-family: var(--font-ui);
  font-size: 0.6rem;
  font-weight: 700;
  color: var(--primitive-copper-500);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.phonetic-text {
  font-family: var(--font-serif);
  font-size: 0.8rem;
  color: var(--primitive-ink-500);
  font-style: italic;
}

/* 释义 */
.tooltip-definitions {
  margin-bottom: 0.75rem;
}

.definition-item {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.375rem;
}

.definition-item:last-child {
  margin-bottom: 0;
}

.definition-bullet {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-data);
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--primitive-paper-100);
  background: var(--primitive-copper-400);
  border-radius: var(--radius-full);
  margin-top: 2px;
}

.definition-text {
  font-family: var(--font-serif);
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--primitive-ink-700);
}

.definition-more {
  font-family: var(--font-ui);
  font-size: 0.75rem;
  color: var(--primitive-ink-400);
  margin-top: 0.25rem;
  padding-left: 1.5rem;
}

/* 例句 */
.tooltip-example {
  padding-top: 0.625rem;
  border-top: 1px solid var(--primitive-paper-300);
}

.example-label {
  font-family: var(--font-ui);
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--primitive-olive-600);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 0.375rem;
}

.example-en {
  font-family: var(--font-serif);
  font-size: 0.8rem;
  font-style: italic;
  color: var(--primitive-ink-600);
  line-height: 1.5;
  margin-bottom: 0.25rem;
}

.example-en :deep(strong) {
  font-weight: 700;
  font-style: normal;
}

.example-zh {
  font-family: var(--font-body);
  font-size: 0.75rem;
  color: var(--primitive-ink-400);
  line-height: 1.5;
}

/* 桌面端动画 */
.tooltip-fade-enter-active {
  animation: tooltip-in 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}

.tooltip-fade-leave-active {
  animation: tooltip-out 0.15s ease-out forwards;
}

@keyframes tooltip-in {
  from {
    opacity: 0;
    transform: translateX(-8px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

@keyframes tooltip-out {
  to {
    opacity: 0;
    transform: scale(0.96);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   移动端：底部抽屉
   ═══════════════════════════════════════════════════════════════════════════ */

.word-tooltip-mobile-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  display: flex;
  align-items: flex-end;
}

.word-tooltip-mobile {
  width: 100%;
  max-height: 70vh;
  background: var(--primitive-paper-100);
  border-radius: var(--radius-2xl) var(--radius-2xl) 0 0;
  box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.15);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;

  /* 纸张纹理 */
  background-image:
    linear-gradient(
      to bottom,
      rgba(153, 107, 61, 0.02) 0%,
      transparent 30%
    );
}

/* 拖拽指示器 */
.drawer-handle {
  display: flex;
  justify-content: center;
  padding: 0.75rem 0;
  position: sticky;
  top: 0;
  background: var(--primitive-paper-100);
  z-index: 1;
}

.handle-bar {
  width: 36px;
  height: 4px;
  background: var(--primitive-paper-500);
  border-radius: var(--radius-full);
}

/* 移动端头部 */
.mobile-header {
  padding: 0 1.25rem 1rem;
  border-bottom: 1px solid var(--primitive-paper-400);
}

.header-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.mobile-word {
  font-family: var(--font-serif);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--primitive-ink-800);
}

.close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--primitive-paper-300);
  border: none;
  border-radius: var(--radius-full);
  color: var(--primitive-ink-500);
  cursor: pointer;
  transition: all 0.2s;

  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.close-btn:active {
  transform: scale(0.9);
  background: var(--primitive-paper-400);
}

.close-btn svg {
  width: 18px;
  height: 18px;
}

.mobile-phonetic {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.phonetic-tag {
  font-family: var(--font-serif);
  font-size: 0.85rem;
  color: var(--primitive-ink-500);
  background: var(--primitive-paper-300);
  padding: 0.25rem 0.625rem;
  border-radius: var(--radius-full);
}

/* 移动端通用标题 */
.section-title {
  font-family: var(--font-ui);
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--primitive-copper-500);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 0.625rem;
}

/* 移动端释义 */
.mobile-definitions {
  padding: 1rem 1.25rem;
}

.definitions-list {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
}

.mobile-definition-item {
  display: flex;
  gap: 0.625rem;
}

.def-number {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-data);
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--primitive-paper-100);
  background: linear-gradient(135deg, var(--primitive-copper-400), var(--primitive-copper-500));
  border-radius: var(--radius-full);
}

.def-text {
  font-family: var(--font-serif);
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--primitive-ink-700);
}

/* 移动端例句 */
.mobile-examples {
  padding: 1rem 1.25rem;
  padding-top: 0;
}

.examples-list {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.mobile-example-item {
  padding: 0.75rem;
  background: var(--primitive-paper-200);
  border-radius: var(--radius-md);
  border-left: 3px solid var(--primitive-olive-400);
}

.example-english {
  font-family: var(--font-serif);
  font-size: 0.9rem;
  font-style: italic;
  color: var(--primitive-ink-600);
  line-height: 1.6;
  margin-bottom: 0.375rem;
}

.example-english :deep(strong) {
  font-weight: 700;
  font-style: normal;
}

.example-chinese {
  font-family: var(--font-body);
  font-size: 0.8rem;
  color: var(--primitive-ink-400);
  line-height: 1.5;
}

/* 底部安全区域 */
.mobile-safe-area {
  height: calc(env(safe-area-inset-bottom) + 1rem);
}

/* 移动端抽屉动画 */
.drawer-slide-enter-active {
  animation: drawer-in 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}

.drawer-slide-leave-active {
  animation: drawer-out 0.25s ease-out forwards;
}

.drawer-slide-enter-active .word-tooltip-mobile {
  animation: drawer-content-in 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}

.drawer-slide-leave-active .word-tooltip-mobile {
  animation: drawer-content-out 0.25s ease-out forwards;
}

@keyframes drawer-in {
  from {
    background: rgba(0, 0, 0, 0);
  }
  to {
    background: rgba(0, 0, 0, 0.4);
  }
}

@keyframes drawer-out {
  to {
    background: rgba(0, 0, 0, 0);
  }
}

@keyframes drawer-content-in {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

@keyframes drawer-content-out {
  to {
    transform: translateY(100%);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   响应式
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .word-tooltip-mobile {
    max-height: 75vh;
  }

  .mobile-word {
    font-size: 1.375rem;
  }

  .def-text {
    font-size: 0.9rem;
  }
}

/* 横屏手机 */
@media (max-height: 500px) and (orientation: landscape) {
  .word-tooltip-mobile {
    max-height: 85vh;
  }

  .mobile-header {
    padding: 0 1rem 0.75rem;
  }

  .mobile-word {
    font-size: 1.25rem;
  }

  .mobile-definitions,
  .mobile-examples {
    padding: 0.75rem 1rem;
  }

  .section-title {
    margin-bottom: 0.5rem;
  }

  .definitions-list,
  .examples-list {
    gap: 0.5rem;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   减少动画（辅助功能）
   ═══════════════════════════════════════════════════════════════════════════ */

@media (prefers-reduced-motion: reduce) {
  .tooltip-fade-enter-active,
  .tooltip-fade-leave-active,
  .drawer-slide-enter-active,
  .drawer-slide-leave-active,
  .drawer-slide-enter-active .word-tooltip-mobile,
  .drawer-slide-leave-active .word-tooltip-mobile {
    animation: none;
    transition: opacity 0.15s ease;
  }
}
</style>
