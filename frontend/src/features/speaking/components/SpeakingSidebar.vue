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

    <!-- Mobile floating trigger -->
    <Transition name="trigger">
      <button
        v-if="isMobile && !props.expanded"
        class="mobile-trigger"
        @click="toggleSidebar"
        aria-label="打开题目目录"
      >
        <svg class="trigger-icon" viewBox="0 0 24 24" fill="none">
          <path d="M4 6H20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <path d="M4 12H20" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <path d="M4 18H14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <span class="trigger-label">题目</span>
      </button>
    </Transition>

    <!-- Desktop pull tab - Teleport 到 body，独立 stacking context -->
    <Teleport to="body">
      <button
        v-if="!isMobile"
        class="desktop-tab"
        :class="{
          'is-open': props.expanded,
          'is-nav-expanded': props.navExpanded
        }"
        @click="toggleSidebar"
        aria-label="切换侧边栏"
      >
        <svg v-if="!props.expanded" class="tab-icon" viewBox="0 0 24 24" fill="none">
          <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <svg v-else class="tab-icon" viewBox="0 0 24 24" fill="none">
          <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </Teleport>

    <!-- Main Sidebar Panel -->
    <aside
      class="sidebar-panel"
      :class="{
        'is-expanded': props.expanded,
        'is-nav-expanded': props.navExpanded,
        'is-mobile': isMobile
      }"
    >
      <!-- Header -->
      <header class="sidebar-header">
        <div class="header-title-group">
          <svg class="header-icon" viewBox="0 0 24 24" fill="none">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          <h2 class="header-title">题目</h2>
        </div>
        <div class="header-actions">
          <button
            class="header-btn header-btn--danger"
            @click="handleClearQuestions"
            :disabled="data.loading.value || importHandler.isImporting.value"
            title="清除全部"
          >
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M3 6H5H21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M8 6V4C8 3.44772 8.44772 3 9 3H15C15.5523 3 16 3.44772 16 4V6M19 6V20C19 20.5523 18.5523 21 18 21H6C5.44772 21 5 20.5523 5 20V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </button>
          <button
            class="header-btn header-btn--primary"
            @click="importHandler.toggleImportMenu"
            :disabled="data.loading.value || importHandler.isImporting.value"
            title="导入题目"
          >
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M17 8L12 3L7 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M12 3V15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
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

      <!-- Content area -->
      <div class="sidebar-body">
        <Loading v-if="data.loading.value || importHandler.isImporting.value" text="导入中..." />
        <nav v-else class="topic-nav" aria-label="题目导航">
          <PartItem
            v-for="(part, index) in data.partGroups.value"
            :key="`part-${part.number}`"
            :part="part"
            :style="{ '--part-index': index }"
          />

          <!-- Empty state -->
          <div v-if="data.partGroups.value.length === 0" class="empty-state">
            <div class="empty-visual">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 2L15.09 8.26L22 9L17 14L18.18 21L12 17.77L5.82 21L7 14L2 9L8.91 8.26L12 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
              </svg>
            </div>
            <p class="empty-text">暂无题目</p>
            <p class="empty-hint">导入题目开始练习</p>
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
import { useBreakpoint } from '@/shared/composables/useBreakpoint'
import Loading from '@/shared/components/feedback/Loading.vue'
import PartItem from './PartItem.vue'
import SpeakingImportMenu from './SpeakingImportMenu.vue'
import type { Question } from '@/shared/types'
import { createSpeakingContext } from '../composables/useSpeakingContext'
import { useSpeakingImport } from '../composables/useSpeakingImport'

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
const { isMobile } = useBreakpoint()
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
  document.addEventListener('click', handleClickOutside)

  if (props.expanded) {
    setTimeout(() => data.loadTopics(), 400)
  }
})

onUnmounted(() => {
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
   Dark Studio Sidebar
   ═══════════════════════════════════════════════════════════════════════════ */

.speaking-sidebar-wrapper {
  position: relative;
  z-index: 100;
}

/* ── Backdrop Overlay ── */
.sidebar-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
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
   Main Sidebar Panel - 深色主题
   ═══════════════════════════════════════════════════════════════════════════ */

.sidebar-panel {
  position: fixed;
  top: 0;
  left: 48px;
  width: 320px;
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;

  /* 深色背景 */
  background: linear-gradient(
    180deg,
    rgba(26, 31, 46, 0.98) 0%,
    rgba(20, 24, 36, 0.98) 100%
  );
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);

  /* 边框 */
  border-right: 1px solid rgba(184, 134, 11, 0.15);
  box-shadow:
    4px 0 24px rgba(0, 0, 0, 0.3),
    inset 1px 0 0 rgba(250, 247, 242, 0.05);

  /* Animation */
  transform: translateX(-100%);
  transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1),
              left 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 100;
}

.sidebar-panel.is-expanded {
  transform: translateX(0);
}

.sidebar-panel.is-nav-expanded {
  left: 280px;
}

/* ── Desktop Pull Tab - 独立定位，高 z-index ── */
.desktop-tab {
  position: fixed;
  top: 50%;
  /* 默认：nav收起(48px)，sidebar收起时，tab在sidebar右边缘 */
  left: calc(48px - 20px);
  transform: translateY(-50%);

  display: flex;
  align-items: center;
  justify-content: center;

  width: 40px;
  height: 40px;
  padding: 0;

  background: linear-gradient(
    135deg,
    var(--primitive-gold-500),
    var(--primitive-copper-500)
  );
  border: none;
  border-radius: 50%;
  box-shadow:
    0 4px 16px rgba(184, 134, 11, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);

  cursor: pointer;
  transition: left 0.4s cubic-bezier(0.22, 1, 0.36, 1),
              background 0.3s ease,
              box-shadow 0.3s ease,
              transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  z-index: 200;
}

/* Sidebar 展开时，tab 跟随到 sidebar 右边缘 */
.desktop-tab.is-open {
  left: calc(48px + 320px - 20px);
  background: rgba(250, 247, 242, 0.1);
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

/* Nav 展开时的位置调整 */
.desktop-tab.is-nav-expanded {
  left: calc(280px - 20px);
}

.desktop-tab.is-nav-expanded.is-open {
  left: calc(280px + 320px - 20px);
}

.desktop-tab:hover {
  transform: translateY(-50%) scale(1.08);
  box-shadow:
    0 6px 24px rgba(184, 134, 11, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.25);
}

.desktop-tab:active {
  transform: translateY(-50%) scale(0.96);
}

.desktop-tab.is-open:hover {
  background: rgba(250, 247, 242, 0.15);
}

.tab-icon {
  width: 18px;
  height: 18px;
  color: white;
  transition: all 0.3s ease;
}

.desktop-tab.is-open .tab-icon {
  color: var(--primitive-paper-300);
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

  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(184, 134, 11, 0.15);
}

.header-title-group {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-icon {
  width: 20px;
  height: 20px;
  color: var(--primitive-gold-400);
}

.header-title {
  margin: 0;
  font-family: var(--font-ui);
  font-size: 16px;
  font-weight: 600;
  color: var(--primitive-paper-200);
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
  width: 34px;
  height: 34px;
  border: 1px solid rgba(250, 247, 242, 0.1);
  border-radius: var(--radius-md);
  background: rgba(250, 247, 242, 0.05);
  cursor: pointer;
  transition: all 0.2s ease;
}

.header-btn svg {
  width: 16px;
  height: 16px;
}

.header-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  background: rgba(250, 247, 242, 0.1);
}

.header-btn:active:not(:disabled) {
  transform: translateY(0);
}

.header-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.header-btn--primary {
  color: var(--primitive-gold-400);
}

.header-btn--primary:hover:not(:disabled) {
  border-color: rgba(184, 134, 11, 0.3);
  background: rgba(184, 134, 11, 0.15);
}

.header-btn--danger {
  color: var(--primitive-brick-400);
}

.header-btn--danger:hover:not(:disabled) {
  border-color: rgba(155, 59, 59, 0.3);
  background: rgba(155, 59, 59, 0.15);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Body / Content Area
   ═══════════════════════════════════════════════════════════════════════════ */

.sidebar-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px 12px;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.sidebar-body::-webkit-scrollbar {
  display: none;
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

.empty-visual {
  width: 48px;
  height: 48px;
  margin-bottom: 16px;
  color: var(--primitive-gold-500);
  opacity: 0.5;
}

.empty-visual svg {
  width: 100%;
  height: 100%;
}

.empty-text {
  margin: 0 0 8px;
  font-family: var(--font-ui);
  font-size: 15px;
  font-weight: 500;
  color: var(--primitive-paper-400);
}

.empty-hint {
  margin: 0;
  font-size: 13px;
  color: var(--primitive-ink-400);
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
    border-top: 1px solid rgba(184, 134, 11, 0.2);

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
    font-size: 15px;
  }

  .header-btn {
    width: 32px;
    height: 32px;
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
      var(--primitive-gold-500),
      var(--primitive-copper-500)
    );
    border: none;
    border-radius: 24px;
    box-shadow:
      0 4px 20px rgba(184, 134, 11, 0.4),
      0 8px 32px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);

    cursor: pointer;
    z-index: 149;

    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    -webkit-tap-highlight-color: transparent;
  }

  .mobile-trigger:active {
    transform: scale(0.95);
  }

  .trigger-icon {
    width: 18px;
    height: 18px;
    color: white;
  }

  .trigger-label {
    font-family: var(--font-ui);
    font-size: 14px;
    font-weight: 600;
    color: white;
    letter-spacing: 0.02em;
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
    background: rgba(250, 247, 242, 0.3);
    border-radius: 2px;
    transition: all 0.2s ease;
  }

  .mobile-close-handle:active .handle-bar {
    width: 32px;
    background: rgba(250, 247, 242, 0.5);
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
