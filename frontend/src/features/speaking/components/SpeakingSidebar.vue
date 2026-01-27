<template>
  <div class="speaking-sidebar-wrapper">
    <!-- Mobile overlay backdrop -->
    <Transition name="backdrop">
      <div
        v-if="props.expanded && isMobile"
        class="sidebar-backdrop"
        @click="toggleSidebar"
      />
    </Transition>

    <!-- Mobile floating trigger - Elegant book tab design -->
    <Transition name="trigger">
      <button
        v-if="isMobile && !props.expanded"
        class="mobile-trigger"
        @click="toggleSidebar"
        aria-label="打开题目目录"
      >
        <span class="trigger-spine"></span>
        <span class="trigger-label">目录</span>
        <AppIcon name="expand" class="trigger-icon" />
      </button>
    </Transition>

    <!-- Main Sidebar Panel -->
    <aside
      class="sidebar-panel"
      :class="{
        'is-expanded': props.expanded,
        'is-nav-expanded': props.navExpanded,
        'is-mobile': isMobile
      }"
    >
      <!-- Desktop pull tab -->
      <button
        v-if="!isMobile"
        class="desktop-tab"
        :class="{ 'is-open': props.expanded }"
        @click="toggleSidebar"
        aria-label="切换侧边栏"
      >
        <span class="tab-ornament"></span>
        <AppIcon
          :name="props.expanded ? 'close' : 'menu'"
          class="tab-icon"
        />
        <span class="tab-text">{{ props.expanded ? '' : '目录' }}</span>
      </button>

      <!-- Header with refined styling -->
      <header class="sidebar-header">
        <div class="header-title-group">
          <span class="header-ornament">❧</span>
          <h2 class="header-title">题目目录</h2>
        </div>
        <div class="header-actions">
          <button
            class="header-btn header-btn--danger"
            @click="handleClearQuestions"
            :disabled="data.loading.value"
            title="清除全部"
          >
            <AppIcon name="trash" />
          </button>
          <button
            class="header-btn header-btn--primary"
            @click="importHandler.toggleImportMenu"
            :disabled="data.loading.value"
            title="导入题目"
          >
            <AppIcon name="upload" />
          </button>
          <SpeakingImportMenu
            :show="importHandler.showImportMenu.value"
            @import="handleImportPart"
          />
          <input
            ref="fileInputRef"
            type="file"
            accept=".txt"
            style="display: none"
            @change="handleFileSelected"
          />
        </div>
      </header>

      <!-- Content area with custom scrollbar -->
      <div class="sidebar-body scrollbar-elegant">
        <Loading v-if="data.loading.value" />
        <nav v-else class="topic-nav" aria-label="题目导航">
          <PartItem
            v-for="(part, index) in data.partGroups.value"
            :key="`part-${part.number}`"
            :part="part"
            :style="{ '--part-index': index }"
          />

          <!-- Empty state -->
          <div v-if="data.partGroups.value.length === 0" class="empty-state">
            <AppIcon name="book-open" class="empty-icon-svg" />
            <p class="empty-text">还没有题目</p>
            <p class="empty-hint">点击上方导入按钮添加</p>
          </div>
        </nav>
      </div>

      <!-- Mobile close handle -->
      <button
        v-if="isMobile"
        class="mobile-close-handle"
        @click="toggleSidebar"
        aria-label="关闭目录"
      >
        <span class="handle-bar"></span>
      </button>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import AppIcon from '@/shared/components/controls/Icons.vue'
import Loading from '@/shared/components/feedback/Loading.vue'
import PartItem from './PartItem.vue'
import SpeakingImportMenu from './SpeakingImportMenu.vue'
import type { Question } from '@/shared/types'
import { createSpeakingContext, useSpeakingImport } from '../composables'

const props = defineProps<{
  selectQuestionId: number | undefined
  expanded: boolean
  navExpanded: boolean
}>()

const emit = defineEmits<{
  (e: 'question-selected', question: Question | null): void
  (e: 'sidebar-expanded', expanded: boolean): void
}>()

// Speaking Context for child components
const { data } = createSpeakingContext({
  onQuestionSelected: (question) => emit('question-selected', question)
})
const importHandler = useSpeakingImport()

// Local state
const isMobile = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

// Sidebar toggle
function toggleSidebar() {
  const newExpandedState = !props.expanded

  if (newExpandedState) {
    data.loadTopics()
    emit('sidebar-expanded', newExpandedState)
  } else {
    data.clearData()
    setTimeout(() => {
      emit('sidebar-expanded', newExpandedState)
    }, 50)
  }
}

async function handleClearQuestions() {
  if (!confirm('确定要清除所有题目、主题和记录吗？此操作不可恢复！')) return
  try {
    await data.clearAllQuestions()
    emit('question-selected', null)
    alert('所有题目已清除')
  } catch {
    alert('清除题目失败，请稍后重试')
  }
}

// Import handlers
function handleImportPart(part: 1 | 2) {
  importHandler.triggerFileInput(part)
  fileInputRef.value?.click()
}

async function handleFileSelected(event: Event) {
  const result = await importHandler.handleFileSelected(event, async () => {
    await data.loadTopics()
  })
  alert(result.message)
}

// Scroll to question
function scrollToQuestion(questionId: number) {
  nextTick(() => {
    const questionElement = document.querySelector(`[data-question-id="${questionId}"]`)
    if (questionElement) {
      questionElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
}

// Expand to show selected question
function expandToSelectedQuestion(questionId: number | undefined) {
  if (!questionId || data.topics.value.length === 0) return
  const topic = data.expandToQuestion(questionId)
  if (topic) {
    nextTick(() => scrollToQuestion(questionId))
  }
}

// Mobile detection
function checkMobile() {
  isMobile.value = window.innerWidth <= 768
}

// Click outside handler
function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (importHandler.showImportMenu.value && !target.closest('.header-actions')) {
    importHandler.closeImportMenu()
  }
}

// Watchers
watch(() => props.selectQuestionId, (newQuestionId) => {
  if (newQuestionId && data.topics.value.length > 0) {
    expandToSelectedQuestion(newQuestionId)
  }
}, { immediate: true })

watch(data.topics, (newTopics) => {
  if (newTopics.length > 0 && props.selectQuestionId) {
    nextTick(() => expandToSelectedQuestion(props.selectQuestionId))
  }
}, { immediate: true })

watch(() => props.expanded, (newExpanded, oldExpanded) => {
  if (newExpanded !== oldExpanded) {
    if (newExpanded) {
      data.loadTopics()
    } else {
      setTimeout(() => data.clearData(), 10)
    }
  }
})

// Lifecycle
onMounted(async () => {
  await nextTick()
  checkMobile()
  window.addEventListener('resize', checkMobile)
  document.addEventListener('click', handleClickOutside)

  if (props.expanded) {
    setTimeout(() => data.loadTopics(), 400)
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
  document.removeEventListener('click', handleClickOutside)
})

// Expose methods
defineExpose({
  loadTopics: data.loadTopics,
  toggleSidebar,
  selectQuestion: (question: Question) => {
    data.selectQuestion(question)
    emit('question-selected', question)
  },
  clearSelection: () => {
    data.selectQuestion(null)
    emit('question-selected', null)
  }
})
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   Elegant Study Sidebar - Desktop & Mobile
   Typography: Refined serif headings with clean UI elements
   Colors: Warm copper/gold accents on paper texture
   ═══════════════════════════════════════════════════════════════════════════ */

.speaking-sidebar-wrapper {
  position: relative;
  z-index: 100;
}

/* ── Backdrop Overlay ── */
.sidebar-backdrop {
  position: fixed;
  inset: 0;
  background: linear-gradient(
    135deg,
    rgba(45, 35, 25, 0.65),
    rgba(30, 25, 20, 0.75)
  );
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 140;
}

.backdrop-enter-active,
.backdrop-leave-active {
  transition: opacity 0.35s cubic-bezier(0.4, 0, 0.2, 1);
}

.backdrop-enter-from,
.backdrop-leave-to {
  opacity: 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main Sidebar Panel
   ═══════════════════════════════════════════════════════════════════════════ */

.sidebar-panel {
  position: fixed;
  top: 0;
  left: 48px;
  width: 340px;
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;

  /* Paper texture background */
  background:
    linear-gradient(180deg,
      var(--primitive-paper-100) 0%,
      var(--primitive-paper-200) 100%
    );

  /* Subtle paper grain texture using CSS */
  background-image:
    linear-gradient(180deg, var(--primitive-paper-100) 0%, var(--primitive-paper-200) 100%),
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(139, 105, 20, 0.02) 2px,
      rgba(139, 105, 20, 0.02) 4px
    );

  /* Elegant border treatment */
  border-right: 1px solid var(--primitive-paper-400);
  box-shadow:
    4px 0 24px rgba(30, 20, 10, 0.08),
    1px 0 0 rgba(255, 255, 255, 0.5) inset;

  /* Animation */
  transform: translateX(-100%);
  transition:
    transform 0.4s cubic-bezier(0.22, 1, 0.36, 1),
    left 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 100;
}

.sidebar-panel.is-expanded {
  transform: translateX(0);
}

.sidebar-panel.is-nav-expanded {
  left: 280px;
}

/* ── Desktop Pull Tab ── */
.desktop-tab {
  position: absolute;
  top: 50%;
  right: -44px;
  transform: translateY(-50%);

  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;

  width: 44px;
  height: 100px;
  padding: 12px 8px;

  background: linear-gradient(
    135deg,
    var(--primitive-copper-500),
    var(--primitive-gold-600)
  );
  border: none;
  border-radius: 0 12px 12px 0;
  box-shadow:
    4px 4px 16px rgba(139, 105, 20, 0.25),
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    inset 0 -1px 0 rgba(0, 0, 0, 0.1);

  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 101;
}

.desktop-tab:hover {
  transform: translateY(-50%) translateX(4px);
  box-shadow:
    6px 6px 24px rgba(139, 105, 20, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.25),
    inset 0 -1px 0 rgba(0, 0, 0, 0.1);
}

.desktop-tab:active {
  transform: translateY(-50%) scale(0.96);
}

.desktop-tab.is-open {
  background: var(--primitive-paper-100);
  box-shadow:
    4px 4px 16px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

.desktop-tab.is-open:hover {
  background: var(--primitive-paper-200);
}

.tab-ornament {
  display: block;
  width: 20px;
  height: 2px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 1px;
  transition: background 0.3s ease;
}

.desktop-tab.is-open .tab-ornament {
  background: var(--primitive-copper-300);
}

.tab-icon {
  width: 20px;
  height: 20px;
  color: white;
  transition: all 0.3s ease;
}

.desktop-tab.is-open .tab-icon {
  color: var(--primitive-ink-600);
}

.tab-text {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 2px;
  color: white;
  opacity: 0.9;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Header Section
   ═══════════════════════════════════════════════════════════════════════════ */

.sidebar-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;

  background: linear-gradient(
    180deg,
    rgba(139, 105, 20, 0.08) 0%,
    rgba(139, 105, 20, 0.04) 100%
  );
  border-bottom: 1px solid var(--primitive-paper-400);

  /* Decorative double line */
  box-shadow: inset 0 -3px 0 -2px var(--primitive-paper-500);
}

.header-title-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-ornament {
  font-size: 18px;
  color: var(--primitive-gold-500);
  opacity: 0.8;
}

.header-title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 18px;
  font-weight: 600;
  color: var(--primitive-ink-800);
  letter-spacing: 0.02em;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  position: relative;
}

.header-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid var(--primitive-paper-400);
  border-radius: 10px;
  background: var(--primitive-paper-50);
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
}

.header-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.header-btn:active:not(:disabled) {
  transform: translateY(0);
}

.header-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.header-btn--primary {
  color: var(--primitive-copper-500);
}

.header-btn--primary:hover:not(:disabled) {
  background: var(--primitive-copper-50);
  border-color: var(--primitive-copper-200);
  color: var(--primitive-copper-600);
}

.header-btn--danger {
  color: var(--primitive-brick-400);
}

.header-btn--danger:hover:not(:disabled) {
  background: var(--primitive-brick-50);
  border-color: var(--primitive-brick-200);
  color: var(--primitive-brick-500);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Body / Content Area
   ═══════════════════════════════════════════════════════════════════════════ */

.sidebar-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 12px;
}

.topic-nav {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Staggered animation for parts */
.topic-nav > :deep(*) {
  animation: slideInPart 0.4s cubic-bezier(0.22, 1, 0.36, 1) backwards;
  animation-delay: calc(var(--part-index, 0) * 0.1s);
}

@keyframes slideInPart {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* ── Empty State ── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
}

.empty-icon-svg {
  width: 48px;
  height: 48px;
  margin-bottom: 16px;
  opacity: 0.6;
  fill: var(--primitive-copper-400);
}

.empty-text {
  margin: 0 0 8px;
  font-family: var(--font-serif);
  font-size: 16px;
  font-weight: 500;
  color: var(--primitive-ink-500);
}

.empty-hint {
  margin: 0;
  font-size: 13px;
  color: var(--primitive-ink-400);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Custom Scrollbar
   ═══════════════════════════════════════════════════════════════════════════ */

.scrollbar-elegant {
  scrollbar-width: thin;
  scrollbar-color: var(--primitive-paper-500) transparent;
}

.scrollbar-elegant::-webkit-scrollbar {
  width: 8px;
}

.scrollbar-elegant::-webkit-scrollbar-track {
  background: transparent;
  margin: 8px 0;
}

.scrollbar-elegant::-webkit-scrollbar-thumb {
  background: linear-gradient(
    180deg,
    var(--primitive-paper-500),
    var(--primitive-paper-600)
  );
  border-radius: 4px;
  border: 2px solid transparent;
  background-clip: padding-box;
}

.scrollbar-elegant::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(
    180deg,
    var(--primitive-paper-600),
    var(--primitive-paper-700)
  );
  background-clip: padding-box;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Mobile Styles
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .sidebar-panel {
    left: auto;
    right: 0;
    top: auto;
    bottom: 0;
    width: 100%;
    height: 75vh;
    height: 75dvh;
    max-height: calc(100vh - 60px);
    max-height: calc(100dvh - 60px);

    border-radius: 24px 24px 0 0;
    border-right: none;
    border-top: 1px solid var(--primitive-paper-400);

    transform: translateY(100%);
    transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1);

    padding-bottom: calc(env(safe-area-inset-bottom) + 8px);
    z-index: 150;
  }

  .sidebar-panel.is-expanded {
    transform: translateY(0);
  }

  .sidebar-panel.is-nav-expanded {
    left: auto;
  }

  /* Header adjustments for mobile */
  .sidebar-header {
    padding: 12px 16px;
    padding-top: 8px;
  }

  .header-title {
    font-size: 16px;
  }

  .header-ornament {
    font-size: 16px;
  }

  .header-btn {
    width: 34px;
    height: 34px;
    border-radius: 8px;
  }

  /* Body adjustments */
  .sidebar-body {
    padding: 12px 12px 80px;
  }
}

/* ── Mobile Floating Trigger ── */
.mobile-trigger {
  display: none;
}

@media (max-width: 768px) {
  .mobile-trigger {
    position: fixed;
    bottom: calc(88px + env(safe-area-inset-bottom));
    right: 16px;

    display: flex;
    align-items: center;
    gap: 8px;

    padding: 12px 16px;

    background: linear-gradient(
      135deg,
      var(--primitive-copper-500),
      var(--primitive-gold-600)
    );
    border: none;
    border-radius: 24px;
    box-shadow:
      0 4px 20px rgba(139, 105, 20, 0.35),
      0 8px 32px rgba(0, 0, 0, 0.15),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);

    cursor: pointer;
    z-index: 149;

    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    -webkit-tap-highlight-color: transparent;
  }

  .mobile-trigger:active {
    transform: scale(0.95);
    box-shadow:
      0 2px 12px rgba(139, 105, 20, 0.3),
      0 4px 16px rgba(0, 0, 0, 0.1);
  }

  .trigger-spine {
    width: 3px;
    height: 20px;
    background: rgba(255, 255, 255, 0.4);
    border-radius: 2px;
  }

  .trigger-label {
    font-size: 14px;
    font-weight: 600;
    color: white;
    letter-spacing: 0.5px;
  }

  .trigger-icon {
    width: 18px;
    height: 18px;
    color: white;
    opacity: 0.9;
    transform: rotate(90deg);
  }

  .trigger-enter-active,
  .trigger-leave-active {
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .trigger-enter-from,
  .trigger-leave-to {
    opacity: 0;
    transform: translateY(20px) scale(0.8);
  }
}

/* ── Mobile Close Handle ── */
.mobile-close-handle {
  display: none;
}

@media (max-width: 768px) {
  .mobile-close-handle {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);

    display: flex;
    align-items: center;
    justify-content: center;

    width: 100px;
    height: 28px;
    padding: 0;

    background: transparent;
    border: none;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
  }

  .handle-bar {
    width: 40px;
    height: 4px;
    background: var(--primitive-paper-500);
    border-radius: 2px;
    transition: all 0.2s ease;
  }

  .mobile-close-handle:active .handle-bar {
    width: 32px;
    background: var(--primitive-paper-600);
  }
}

/* ── Smaller Mobile (480px) ── */
@media (max-width: 480px) {
  .sidebar-panel {
    height: 80vh;
    height: 80dvh;
  }

  .mobile-trigger {
    bottom: calc(84px + env(safe-area-inset-bottom));
    right: 12px;
    padding: 10px 14px;
  }

  .trigger-label {
    font-size: 13px;
  }

  .trigger-icon {
    width: 16px;
    height: 16px;
  }

  .header-title {
    font-size: 15px;
  }

  .header-btn {
    width: 32px;
    height: 32px;
  }
}

/* ── Landscape Mode ── */
@media (max-width: 768px) and (max-height: 500px) and (orientation: landscape) {
  .sidebar-panel {
    height: 90vh;
    height: 90dvh;
    border-radius: 16px 16px 0 0;
  }

  .mobile-trigger {
    bottom: calc(64px + env(safe-area-inset-bottom));
    padding: 8px 12px;
  }

  .sidebar-body {
    padding-bottom: 60px;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   Desktop Tab Hidden on Mobile
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .desktop-tab {
    display: none;
  }
}
</style>
