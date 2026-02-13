<template>
  <div
    :class="['word-sidebar', { 'is-mobile': isMobile, 'is-collapsed': isCollapsed, 'is-spelling': isSpellingMode }]"
    @mouseenter="handleSidebarEnter"
    @mouseleave="handleSidebarLeave"
  >
    <!-- 桌面端：墨迹瀑布流 -->
    <div v-if="!isMobile" class="desktop-sidebar">
      <!-- 装饰性墨迹滴落效果 -->
      <div class="ink-drip-decoration">
        <div class="drip drip-1"></div>
        <div class="drip drip-2"></div>
        <div class="drip drip-3"></div>
      </div>

      <!-- 标题区域 -->
      <div class="sidebar-header">
        <div class="header-line"></div>
        <span class="header-title">{{ isLapseMode ? '复习队列' : '复习轨迹' }}</span>
        <span class="word-count">{{ displayedWords.length }}</span>
      </div>

      <!-- 单词列表 -->
      <div class="word-stream" ref="wordListRef">
        <div class="stream-inner scrollbar-ink" ref="wordListInnerRef">
          <component :is="useTransition ? TransitionGroup : 'div'" v-bind="useTransition ? { name: 'ink-flow', tag: 'div' } : {}" class="word-flow">
            <div
              v-for="w in displayedWords"
              :key="w.id"
              :class="['word-drop', getWordStatus(w.id)]"
              @click="() => openModal(w)"
              @mouseenter="(e) => handleMouseEnter(e, w)"
              @mouseleave="handleMouseLeave"
            >
              <span class="word-text">{{ w.word }}</span>
              <span class="word-indicator"></span>
            </div>
          </component>
        </div>
      </div>
    </div>

    <!-- 移动端：浮动气泡列表 -->
    <div v-else class="mobile-sidebar">
      <!-- 展开/收起按钮 -->
      <button
        class="mobile-toggle"
        @click="toggleCollapse"
        :aria-label="isCollapsed ? '展开单词列表' : '收起单词列表'"
      >
        <span class="toggle-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path v-if="isCollapsed" d="M4 6h16M4 12h16M4 18h16" />
            <path v-else d="M6 18L18 6M6 6l12 12" />
          </svg>
        </span>
        <span class="toggle-count">{{ displayedWords.length }}</span>
      </button>

      <!-- 单词列表面板 -->
      <Transition name="slide-up">
        <div v-show="!isCollapsed" class="mobile-panel">
          <div class="panel-header">
            <span class="panel-title">{{ isLapseMode ? '复习队列' : '复习轨迹' }}</span>
            <div class="panel-stats">
              <span class="stat remembered">{{ rememberedCount }}</span>
              <span class="stat-divider">/</span>
              <span class="stat forgot">{{ forgotCount }}</span>
            </div>
          </div>

          <div class="word-chips" ref="mobileWordListRef">
            <component :is="useTransition ? TransitionGroup : 'div'" v-bind="useTransition ? { name: 'chip-pop', tag: 'div' } : {}" class="chips-container">
              <button
                v-for="w in displayedWords"
                :key="w.id"
                :class="['word-chip', getWordStatus(w.id)]"
                @click="() => openModal(w)"
              >
                {{ w.word }}
              </button>
            </component>
          </div>
        </div>
      </Transition>
    </div>

    <!-- Tooltip - 桌面端 hover -->
    <WordTooltip
      v-if="tooltipWord"
      :word="tooltipWord"
      :visible="showTooltip"
      :position="tooltipPosition"
      :is-mobile="isMobile"
      @close="handleTooltipClose"
    />

    <!-- Modal -->
    <Teleport to="body">
      <WordEditorModal />
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, TransitionGroup } from 'vue'
import { useBreakpoint } from '@/shared/composables/useBreakpoint'
import type { Word } from '@/shared/types'
import WordEditorModal from '@/features/vocabulary/editor/WordEditorModal.vue'
import WordTooltip from '@/features/vocabulary/grid/WordTooltip.vue'
import { useTimerPause } from '@/shared/composables/useTimerPause'
import { useWordEditorStore } from '@/features/vocabulary/stores/wordEditor'

interface Props {
  words: Word[]
  rememberHistory: Map<number, boolean>
  mode?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  sidebarWordChange: [finalWord: Word]
  wordDeleted: [wordId: number]
  wordForgot: [wordId: number, updatedWord: Word, scheduledDay: number]
  wordMastered: [wordId: number]
}>()

// Refs
const wordListRef = ref<HTMLDivElement | null>(null)
const wordListInnerRef = ref<HTMLDivElement | null>(null)
const mobileWordListRef = ref<HTMLDivElement | null>(null)

// State
const { isMobile } = useBreakpoint()
const isCollapsed = ref(true)
const showTooltip = ref(false)
const tooltipPosition = ref({ x: 0, y: 0 })
const tooltipWord = ref<Word | undefined>(undefined)
const isHovering = ref(false)


// Store
const wordEditorStore = useWordEditorStore()
const { requestPause, releasePause } = useTimerPause()

// Computed
const isLapseMode = computed(() => props.mode === 'mode_lapse')
const isSpellingMode = computed(() => props.mode === 'mode_spelling')
const useTransition = computed(() => displayedWords.value.length <= 50)

const displayedWords = computed(() => {
  if (isLapseMode.value) {
    return props.words  // Lapse 模式：直接展示全部队列
  }
  return props.words.filter(word => props.rememberHistory.has(word.id))
})

const rememberedCount = computed(() => {
  return displayedWords.value.filter(w => props.rememberHistory.get(w.id) === true).length
})

const forgotCount = computed(() => {
  return displayedWords.value.filter(w => props.rememberHistory.get(w.id) === false).length
})

// Methods
const getWordStatus = (wordId: number): string => {
  // Lapse 模式：队首为当前正在复习的单词
  if (isLapseMode.value && props.words.length > 0 && props.words[0].id === wordId) {
    return 'current'
  }
  const remembered = props.rememberHistory.get(wordId)
  return remembered === true ? 'remembered' : remembered === false ? 'forgot' : ''
}


const toggleCollapse = async () => {
  isCollapsed.value = !isCollapsed.value
  // 展开时滚动到底部
  if (!isCollapsed.value) {
    await nextTick()
    scrollToBottom()
  }
}

const handleSidebarEnter = () => {
  if (!isMobile.value) {
    isHovering.value = true
  }
}

const handleSidebarLeave = () => {
  if (!isMobile.value) {
    isHovering.value = false
    showTooltip.value = false
    tooltipWord.value = undefined
  }
}

const handleMouseEnter = (e: MouseEvent, word: Word) => {
  if (isMobile.value) return
  tooltipWord.value = word
  tooltipPosition.value = { x: e.clientX, y: e.clientY }
  showTooltip.value = true
}

const handleMouseLeave = () => {
  showTooltip.value = false
  tooltipWord.value = undefined
}

const handleTooltipClose = () => {
  showTooltip.value = false
  tooltipWord.value = undefined
}

const openModal = (word: Word) => {
  requestPause()
  wordEditorStore.open(word, false, props.mode || '')

  wordEditorStore.onClose((finalWord: Word | undefined) => {
    if (finalWord) {
      emit('sidebarWordChange', finalWord)
    }
    releasePause()
  })

  wordEditorStore.onWordDeleted((wordId: number) => {
    emit('wordDeleted', wordId)
  })

  wordEditorStore.onWordForgot((wordId: number, updatedWord: Word, scheduledDay: number) => {
    emit('wordForgot', wordId, updatedWord, scheduledDay)
  })

  wordEditorStore.onWordMastered((wordId: number) => {
    emit('wordMastered', wordId)
  })
}

const scrollToBottom = async () => {
  await nextTick()
  const el = isMobile.value ? mobileWordListRef.value : wordListInnerRef.value
  if (el) {
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }
}

const scrollToTop = async () => {
  await nextTick()
  const el = isMobile.value ? mobileWordListRef.value : wordListInnerRef.value
  if (el) {
    el.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

// Watchers
watch(
  displayedWords,
  async (newWords, oldWords) => {
    if (isLapseMode.value) {
      // Lapse 模式：每次队列变化都回到顶部（当前词始终在队首）
      await scrollToTop()
    } else if (newWords.length > (oldWords?.length || 0)) {
      await scrollToBottom()
    }
  },
  { flush: 'post' }
)

watch(
  () => props.rememberHistory,
  async (newHistory, oldHistory) => {
    if (isLapseMode.value) return  // Lapse 模式由 displayedWords watcher 处理
    if (newHistory.size > (oldHistory?.size || 0)) {
      setTimeout(() => scrollToBottom(), 50)
    }
  },
  { deep: true, flush: 'post' }
)

// Lifecycle
onMounted(() => {
  setTimeout(() => isLapseMode.value ? scrollToTop() : scrollToBottom(), 100)
})
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   Word Sidebar - Ink Flow Design
   墨迹流动设计 - 灵感来自古典书法与墨水渗透
   ═══════════════════════════════════════════════════════════════════════════ */

.word-sidebar {
  --sidebar-width: 180px;
  --ink-primary: var(--primitive-ink-700);
  --ink-secondary: var(--primitive-ink-500);
  --ink-muted: var(--primitive-ink-300);
  --paper-warm: var(--primitive-paper-100);
  --success-ink: var(--primitive-olive-600);
  --danger-ink: var(--primitive-brick-500);
}

/* ═══════════════════════════════════════════════════════════════════════════
   桌面端：墨迹瀑布流
   ═══════════════════════════════════════════════════════════════════════════ */

.desktop-sidebar {
  position: fixed;
  top: var(--topbar-height);
  left: 0;
  width: var(--sidebar-width);
  height: calc(100vh - var(--topbar-height));
  display: flex;
  flex-direction: column;
  z-index: 150;
  padding: 1rem 0.75rem;

  /* 纸张纹理背景 */
  background:
    linear-gradient(180deg,
      rgba(255, 253, 247, 0.95) 0%,
      rgba(250, 247, 242, 0.85) 100%
    );

  /* 右侧墨迹边缘 */
  border-right: 1px solid var(--primitive-paper-400);
  box-shadow:
    2px 0 20px rgba(0, 0, 0, 0.03),
    inset -1px 0 0 rgba(255, 255, 255, 0.5);
}

/* 墨迹滴落装饰 */
.ink-drip-decoration {
  position: absolute;
  top: 0;
  right: -1px;
  width: 4px;
  height: 100%;
  pointer-events: none;
  overflow: hidden;
}

.drip {
  position: absolute;
  right: 0;
  width: 3px;
  background: linear-gradient(180deg,
    var(--primitive-copper-400) 0%,
    transparent 100%
  );
  border-radius: 0 0 2px 2px;
  opacity: 0.3;
  animation: drip-flow 8s ease-in-out infinite;
}

.drip-1 {
  top: 10%;
  height: 40px;
  animation-delay: 0s;
}

.drip-2 {
  top: 35%;
  height: 25px;
  animation-delay: 2.5s;
}

.drip-3 {
  top: 60%;
  height: 55px;
  animation-delay: 5s;
}

@keyframes drip-flow {
  0%, 100% {
    opacity: 0.2;
    transform: translateY(0) scaleY(1);
  }
  50% {
    opacity: 0.5;
    transform: translateY(20px) scaleY(1.2);
  }
}

/* 头部区域 */
.sidebar-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-bottom: 0.75rem;
  margin-bottom: 0.5rem;
  border-bottom: 1px solid var(--primitive-paper-400);
  flex-shrink: 0;
}

.header-line {
  width: 3px;
  height: 14px;
  background: var(--gradient-primary);
  border-radius: 2px;
}

.header-title {
  font-family: var(--font-serif);
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ink-secondary);
  letter-spacing: 0.05em;
}

.word-count {
  margin-left: auto;
  font-family: var(--font-data);
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--primitive-copper-500);
  background: var(--primitive-copper-100);
  padding: 0.15rem 0.4rem;
  border-radius: var(--radius-full);
}

/* 单词流容器 */
.word-stream {
  flex: 1;
  position: relative;
  overflow: hidden;
  min-height: 0;
}

.stream-inner {
  height: 100%;
  overflow-y: auto;
  padding-right: 0.5rem;
}

/* 自定义滚动条 - 墨迹风格 */
.scrollbar-ink::-webkit-scrollbar {
  width: 4px;
}

.scrollbar-ink::-webkit-scrollbar-track {
  background: transparent;
}

.scrollbar-ink::-webkit-scrollbar-thumb {
  background: var(--primitive-copper-300);
  border-radius: 2px;
}

.scrollbar-ink::-webkit-scrollbar-thumb:hover {
  background: var(--primitive-copper-400);
}

.word-flow {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.5rem 0;
}

/* 单词条目 - 墨滴效果 */
.word-drop {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.625rem;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}

.word-drop:hover {
  transform: translateX(4px);
  background: rgba(153, 107, 61, 0.08);
}

.word-text {
  font-family: var(--font-serif);
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--ink-primary);
  transition: color 0.2s;
}

.word-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-left: auto;
  flex-shrink: 0;
  transition: all 0.2s;
}

/* 记忆状态样式 */
.word-drop.remembered .word-text {
  color: var(--success-ink);
}

.word-drop.remembered .word-indicator {
  background: var(--success-ink);
  box-shadow: 0 0 8px rgba(93, 122, 93, 0.4);
}

.word-drop.forgot .word-text {
  color: var(--danger-ink);
}

.word-drop.forgot .word-indicator {
  background: var(--danger-ink);
  box-shadow: 0 0 8px rgba(155, 59, 59, 0.4);
}

/* Lapse 模式：当前正在复习的单词 */
.word-drop.current {
  background: rgba(153, 107, 61, 0.1);
}

.word-drop.current .word-text {
  color: var(--primitive-copper-700);
  font-weight: 600;
}

.word-drop.current .word-indicator {
  background: var(--primitive-copper-500);
  box-shadow: 0 0 8px rgba(153, 107, 61, 0.4);
}

/* 列表过渡动画 */
.ink-flow-enter-active {
  animation: ink-drop-in 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}

.ink-flow-leave-active {
  animation: ink-fade-out 0.3s ease-out forwards;
}

.ink-flow-move {
  transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes ink-drop-in {
  from {
    opacity: 0;
    transform: translateY(-15px);
    filter: blur(2px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
    filter: blur(0);
  }
}

@keyframes ink-fade-out {
  to {
    opacity: 0;
    transform: translateX(-20px) scale(0.8);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   移动端：浮动气泡列表
   ═══════════════════════════════════════════════════════════════════════════ */

.mobile-sidebar {
  position: fixed;
  /* 定位在按钮栏上方 */
  bottom: calc(var(--button-bar-height-mobile) + env(safe-area-inset-bottom) + 12px);
  right: 12px;
  z-index: 150;
}

/* 拼写模式：定位在虚拟键盘上方 */
.word-sidebar.is-spelling .mobile-sidebar {
  bottom: calc(var(--spelling-keyboard-height, 260px) + 12px);
}

/* 切换按钮 */
.mobile-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  width: auto;
  min-width: 48px;
  height: 48px;
  padding: 0 1rem;
  background: var(--paper-warm);
  border: 1px solid var(--primitive-paper-400);
  border-radius: var(--radius-full);
  box-shadow:
    0 4px 20px rgba(0, 0, 0, 0.08),
    0 2px 8px rgba(0, 0, 0, 0.04);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);

  /* 触摸优化 */
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.mobile-toggle:active {
  transform: scale(0.95);
}

.toggle-icon {
  width: 20px;
  height: 20px;
  color: var(--ink-secondary);
}

.toggle-icon svg {
  width: 100%;
  height: 100%;
}

.toggle-count {
  font-family: var(--font-data);
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--primitive-copper-600);
}

/* 收起状态时只显示数字 */
.is-collapsed .mobile-toggle {
  padding: 0 0.875rem;
}

/* 面板 */
.mobile-panel {
  position: absolute;
  bottom: 60px;
  right: 0;
  width: min(85vw, 320px);
  max-height: 50vh;
  background: var(--paper-warm);
  border: 1px solid var(--primitive-paper-400);
  border-radius: var(--radius-xl);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.12),
    0 4px 12px rgba(0, 0, 0, 0.06);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* 面板头部 */
.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--primitive-paper-400);
  flex-shrink: 0;
}

.panel-title {
  font-family: var(--font-serif);
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--ink-primary);
}


.panel-stats {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-family: var(--font-data);
  font-size: 0.8rem;
}

.stat {
  font-weight: 700;
}

.stat.remembered {
  color: var(--success-ink);
}

.stat.forgot {
  color: var(--danger-ink);
}

.stat-divider {
  color: var(--ink-muted);
}

/* 单词气泡区域 */
.word-chips {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
  -webkit-overflow-scrolling: touch;
}

.chips-container {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

/* 单词气泡 */
.word-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.5rem 0.875rem;
  font-family: var(--font-serif);
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--ink-primary);
  background: var(--primitive-paper-200);
  border: 1px solid var(--primitive-paper-400);
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: all 0.2s ease;

  /* 触摸优化 */
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}


.word-chip:active {
  transform: scale(0.95);
}

.word-chip.remembered {
  color: var(--success-ink);
  background: var(--primitive-olive-50);
  border-color: var(--primitive-olive-200);
}

.word-chip.forgot {
  color: var(--danger-ink);
  background: var(--primitive-brick-50);
  border-color: var(--primitive-brick-200);
}

/* Lapse 模式：当前正在复习的单词 */
.word-chip.current {
  color: var(--primitive-copper-700);
  background: var(--primitive-copper-100);
  border-color: var(--primitive-copper-300);
  font-weight: 600;
}

/* 气泡过渡动画 */
.chip-pop-enter-active {
  animation: chip-pop-in 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}

.chip-pop-leave-active {
  animation: chip-pop-out 0.25s ease-out forwards;
}

.chip-pop-move {
  transition: transform 0.3s ease;
}

@keyframes chip-pop-in {
  from {
    opacity: 0;
    transform: scale(0) rotate(-10deg);
  }
  50% {
    transform: scale(1.1) rotate(2deg);
  }
  to {
    opacity: 1;
    transform: scale(1) rotate(0);
  }
}

@keyframes chip-pop-out {
  to {
    opacity: 0;
    transform: scale(0.5);
  }
}

/* 面板滑入动画 */
.slide-up-enter-active {
  animation: slide-up-in 0.35s cubic-bezier(0.22, 1, 0.36, 1);
}

.slide-up-leave-active {
  animation: slide-up-out 0.25s ease-out forwards;
}

@keyframes slide-up-in {
  from {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes slide-up-out {
  to {
    opacity: 0;
    transform: translateY(10px) scale(0.95);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   响应式调整
   ═══════════════════════════════════════════════════════════════════════════ */

/* 大屏桌面 */
@media (min-width: 1400px) {
  .word-sidebar {
    --sidebar-width: 200px;
  }

  .word-text {
    font-size: 0.95rem;
  }
}

/* 平板 */
@media (max-width: 1024px) and (min-width: 769px) {
  .word-sidebar {
    --sidebar-width: 160px;
  }

  .word-text {
    font-size: 0.85rem;
  }
}

/* 横屏手机 */
@media (max-height: 500px) and (orientation: landscape) {
  .mobile-panel {
    max-height: 60vh;
    width: min(50vw, 280px);
  }

  .panel-header {
    padding: 0.625rem 0.875rem;
  }

  .word-chips {
    padding: 0.5rem;
  }

  .word-chip {
    padding: 0.35rem 0.625rem;
    font-size: 0.75rem;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   减少动画（辅助功能）
   ═══════════════════════════════════════════════════════════════════════════ */

@media (prefers-reduced-motion: reduce) {
  .drip {
    animation: none;
  }

  .word-drop,
  .word-chip {
    animation: none;
  }

  .ink-flow-enter-active,
  .ink-flow-leave-active,
  .chip-pop-enter-active,
  .chip-pop-leave-active,
  .slide-up-enter-active,
  .slide-up-leave-active {
    animation: none;
    transition: opacity 0.15s ease;
  }
}
</style>
