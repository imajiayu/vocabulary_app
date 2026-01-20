<template>
  <div>
    <!-- Mobile overlay - click to collapse drawer -->
    <div
      v-if="props.expanded && isMobile"
      class="overlay"
      @click="toggleSidebar"
    />

    <div class="sidebar" :class="{
      expanded: props.expanded,
      'nav-expanded': props.navExpanded
    }">
      <!-- Toggle button -->
      <div class="sidebar-tab" :class="{ dragging: isDragging }" @click="toggleSidebar">
        <AppIcon
          :name="props.expanded ? 'close' : 'expand'"
          :class="props.expanded ? 'icon-dark' : 'icon-light'"
          class="sidebar-arrow"
        />
      </div>

      <!-- Header -->
      <header class="sidebar-header">
        <h2>题目目录</h2>
        <div class="header-actions">
          <button
            class="action-btn clear-btn"
            @click="handleClearQuestions"
            :disabled="data.loading.value">
            <AppIcon name="trash" class="btn-icon" />
            <span class="tooltip">清除全部</span>
          </button>
          <button
            class="action-btn import-btn"
            @click="importHandler.toggleImportMenu"
            :disabled="data.loading.value">
            <AppIcon name="upload" class="btn-icon" />
            <span class="tooltip">手动导入</span>
          </button>
          <SpeakingImportMenu
            :show="importHandler.showImportMenu.value"
            @import="handleImportPart"
          />
          <!-- Hidden file input -->
          <input
            ref="fileInputRef"
            type="file"
            accept=".txt"
            style="display: none"
            @change="handleFileSelected"
          />
        </div>
      </header>

      <!-- Content -->
      <div class="sidebar-content scrollbar-purple">
        <Loading v-if="data.loading.value" />
        <div v-else class="directory-tree">
          <PartItem
            v-for="part in data.partGroups.value"
            :key="`part-${part.number}`"
            :part="part"
          />
        </div>
      </div>
    </div>
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

// 创建并提供 Speaking Context
// 子组件 (PartItem, TopicItem, QuestionItem) 通过 useSpeakingContext 注入使用
const { data } = createSpeakingContext({
  onQuestionSelected: (question) => emit('question-selected', question)
})
const importHandler = useSpeakingImport()

// Local state
const isMobile = ref(false)
const isDragging = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)

// Sidebar toggle
function toggleSidebar() {
  if (isMobile.value && !props.expanded) {
    isDragging.value = true
    setTimeout(() => { isDragging.value = false }, 300)
  }

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
.sidebar {
  position: fixed;
  top: 0;
  left: 48px;
  width: 320px;
  height: 100vh;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-right: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 2px 0 20px rgba(0, 0, 0, 0.05);
  transform: translateX(-100%);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 100;
  display: flex;
  flex-direction: column;
}

.sidebar.expanded {
  transform: translateX(0);
}

.sidebar.nav-expanded {
  left: 280px;
}

.sidebar-tab {
  position: absolute;
  top: 50%;
  right: -32px;
  transform: translateY(-50%);
  width: 32px;
  height: 80px;
  background: var(--color-purple);
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: manipulation;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  cursor: pointer;
  border-radius: 0 8px 8px 0;
  box-shadow: 2px 0 6px rgba(0, 0, 0, 0.15);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 101;
}

.sidebar-tab:hover {
  background: white;
  transform: translateY(-50%) scale(1.05);
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.2);
}

.sidebar-tab.expanded {
  background: white;
}

.sidebar-tab.expanded:hover {
  background: var(--color-purple);
  transform: translateY(-50%) scale(1.05);
}

.sidebar-tab:hover .icon-light {
  color: var(--color-purple);
}

.sidebar-tab.expanded:hover .icon-dark {
  color: white;
}

.icon-light {
  color: white;
  transition: color 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.icon-dark {
  color: var(--color-text-primary);
  transition: color 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar-header {
  flex-shrink: 0;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  border-bottom: 1px solid var(--color-purple-light);
  background: var(--gradient-purple-subtle);
}

.sidebar-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-purple);
  letter-spacing: -0.025em;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  position: relative;
}

.action-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  background: transparent;
  position: relative;
}

.action-btn:hover:not(:disabled) {
  background: var(--color-purple-light);
  transform: scale(1.05);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn .tooltip {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%) translateY(4px);
  margin-top: 0.25rem;
  padding: 0.375rem 0.625rem;
  background: rgba(30, 41, 59, 0.95);
  color: white;
  font-size: 0.75rem;
  border-radius: 0.375rem;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease, transform 0.15s ease;
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.action-btn:hover:not(:disabled) .tooltip {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.clear-btn .btn-icon {
  color: var(--color-delete);
}

.import-btn .btn-icon {
  color: var(--color-purple);
}

.btn-icon {
  width: 1rem;
  height: 1rem;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 0;
  display: flex;
  flex-direction: column;
}

.directory-tree {
  padding: 0 16px;
  animation: fadeInUp 0.5s ease forwards;
}

/* fadeInUp animation defined in animations.css */

.overlay {
  display: none;
}

.sidebar-content :deep(.min-h-screen) {
  min-height: auto;
  height: auto;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

@media (min-width: 481px) {
  .sidebar-tab {
    opacity: 1 !important;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
}

/* Mobile responsive - bottom drawer design */
@media (max-width: 480px) {
  .sidebar {
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    height: 65vh;
    max-height: 65vh;
    transform: translateY(100%);
    border-radius: var(--radius-xl) 20px 0 0;
    border-right: none;
    border-top: 1px solid rgba(0, 0, 0, 0.1);
    box-shadow: 0 -10px 30px rgba(0, 0, 0, 0.15);
    -webkit-overflow-scrolling: touch;
    z-index: 100;
  }

  .sidebar.expanded {
    transform: translateY(0);
  }

  .sidebar.nav-expanded {
    left: 0;
  }

  .sidebar-tab {
    position: absolute;
    top: -40px;
    left: 50%;
    right: auto;
    transform: translateX(-50%);
    width: 80px;
    height: 40px;
    background: var(--color-purple);
    border-radius: var(--radius-xl) 20px 0 0;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 -5px 15px rgba(0, 0, 0, 0.1);
    min-width: 80px;
    min-height: 40px;
    z-index: 101;
    opacity: 0;
    transition: opacity 0.5s ease 0.3s;
  }

  .sidebar:not(.expanded) .sidebar-tab {
    opacity: 1;
  }

  .sidebar-tab.dragging {
    opacity: 0 !important;
    pointer-events: none;
    transition: opacity 0.1s ease;
  }

  .sidebar-tab .sidebar-arrow {
    transform: rotate(-90deg);
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .sidebar.expanded .sidebar-tab {
    opacity: 0;
    pointer-events: none;
    transform: translateX(-50%) translateY(-10px);
  }

  .sidebar.expanded .sidebar-tab .sidebar-arrow {
    transform: rotate(90deg);
  }

  .sidebar-tab:hover {
    background: var(--color-purple);
    transform: translateX(-50%);
    box-shadow: 0 -5px 15px rgba(0, 0, 0, 0.1);
  }

  .sidebar-tab:active {
    background: var(--color-purple-dark);
    transform: translateX(-50%) scale(0.95);
  }

  .sidebar-tab.expanded {
    background: white;
  }

  .sidebar-tab.expanded:hover {
    background: var(--color-purple);
    transform: translateX(-50%);
  }

  .sidebar-header {
    position: relative;
  }

  .sidebar-header::before {
    content: '';
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    width: 40px;
    height: 4px;
    background: var(--color-purple-border);
    border-radius: 2px;
  }

  .sidebar-header h2 {
    font-size: 16px;
    padding-top: 8px;
  }

  .header-actions {
    display: flex;
    gap: 0.25rem;
  }

  .action-btn {
    width: 28px;
    height: 28px;
  }

  .btn-icon {
    width: 0.875rem;
    height: 0.875rem;
  }

  .directory-tree {
    padding: 0 12px;
  }

  .sidebar-content :deep(.min-h-screen) {
    min-height: auto;
    height: auto;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  .overlay {
    display: block;
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: transparent;
    z-index: 99;
    pointer-events: auto;
  }
}

@media (max-width: 480px) {
  .sidebar {
    height: 70vh;
    max-height: 70vh;
  }

  .sidebar-tab {
    width: 70px;
    height: 35px;
    top: -35px;
  }

  .sidebar-header {
    height: 40px;
    padding: 0 16px;
  }

  .sidebar-header h2 {
    font-size: 14px;
  }

  .sidebar-content {
    padding: 12px 0;
  }

  .directory-tree {
    padding: 0 8px;
  }
}

@media (max-width: 360px) {
  .sidebar {
    height: 75vh;
    max-height: 75vh;
  }

  .sidebar-tab {
    width: 60px;
    height: 30px;
    top: -30px;
  }

  .sidebar-header {
    height: 44px;
    padding: 0 20px;
  }

  .sidebar-header h2 {
    font-size: 16px;
  }

  .directory-tree {
    padding: 0 16px;
  }
}

@media (max-width: 480px) and (max-height: 500px) and (orientation: landscape) {
  .sidebar {
    height: 60vh;
    max-height: 60vh;
  }

  .sidebar-tab {
    width: 60px;
    height: 25px;
    top: -25px;
  }

  .sidebar-header {
    height: 36px;
    padding: 0 12px;
  }

  .sidebar-header h2 {
    font-size: 14px;
  }

  .sidebar-content {
    padding: 8px 0;
  }

  .directory-tree {
    padding: 0 8px;
  }
}
</style>
