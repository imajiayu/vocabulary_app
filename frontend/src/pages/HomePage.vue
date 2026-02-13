<template>
  <div
    class="app-container"
    :class="{
      'nav-expanded': navExpanded && !isMobile,
      'sidebar-expanded': ((sidebarExpanded && activeTab === 'speaking') || (writingSidebarExpanded && activeTab === 'writing')) && !isMobile,
      'is-mobile': isMobile,
      'is-speaking': activeTab === 'speaking',
      'is-writing': activeTab === 'writing',
      'is-settings': activeTab === 'settings'
    }"
  >
    <!-- 桌面端主导航栏 -->
    <MainNavigation
      v-if="!isMobile"
      :active-tab="activeTab"
      :theme-class="navThemeClass"
      @tab-change="handleTabChange"
      @nav-toggle="handleNavToggle"
    />

    <!-- 移动端底部浮动导航 -->
    <nav v-if="isMobile" class="mobile-bottom-nav">
      <div :class="['mobile-nav-container', navThemeClass]">
        <!-- 用户头像 -->
        <div class="mobile-user-selector">
          <UserProfile :expanded="true" />
        </div>

        <!-- 导航按钮 -->
        <button
          v-for="tab in tabs"
          :key="tab.value"
          :class="['mobile-nav-item', { active: activeTab === tab.value }]"
          @click="handleTabChange(tab.value)"
        >
          <AppIcon :name="tab.icon" class="nav-icon-svg" />
          <span class="nav-label">{{ tab.label }}</span>
          <span v-if="activeTab === tab.value" class="nav-indicator"></span>
        </button>
      </div>
    </nav>

    <!-- 口语侧边栏 -->
    <transition name="sidebar-slide" mode="out-in">
      <SpeakingSidebar
        v-if="activeTab === 'speaking'"
        @question-selected="onQuestionSelected"
        :expanded="sidebarExpanded"
        :nav-expanded="navExpanded"
        :select-question-id="selectedQuestion?.id"
        :is-disappearing="sidebarDisappearing"
        @sidebar-expanded="handleSidebarToggle"
      />
    </transition>

    <!-- 写作侧边栏 -->
    <transition name="sidebar-slide" mode="out-in">
      <WritingSidebar
        v-if="activeTab === 'writing'"
        ref="writingSidebarRef"
        :expanded="writingSidebarExpanded"
        :nav-expanded="navExpanded"
        @prompt-selected="onPromptSelected"
        @sidebar-expanded="handleWritingSidebarToggle"
      />
    </transition>

    <!-- 主内容区域 -->
    <main class="main-container">
      <!-- 内容切换动画 -->
      <transition name="fade-slide" mode="out-in">
        <WordIndex v-if="activeTab === 'words'" key="words" />
        <SpeakingIndex
          v-else-if="activeTab === 'speaking'"
          key="speaking"
          class="speaking-index"
          :select-question="selectedQuestion"
          @sidebar-toggle="handleSidebarToggle"
        />
        <WritingIndex
          v-else-if="activeTab === 'writing'"
          key="writing"
          class="writing-index"
          :selected-prompt="selectedPrompt"
        />
        <SettingsPage
          v-else-if="activeTab === 'settings'"
          key="settings"
          class="settings-page"
          :nav-expanded="navExpanded"
        />
      </transition>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import { useBreakpoint } from '@/shared/composables/useBreakpoint'
import WordIndex from '@/features/vocabulary/index/WordIndex.vue'
import SpeakingIndex from '@/pages/SpeakingPage.vue'
import WritingIndex from '@/pages/WritingPage.vue'
import SettingsPage from '@/pages/SettingsPage.vue'
import SpeakingSidebar from '@/features/speaking/components/SpeakingSidebar.vue'
import WritingSidebar from '@/features/writing/components/WritingSidebar.vue'
import MainNavigation from '@/shared/components/layout/MainNavigation.vue'
import UserProfile from '@/shared/components/layout/UserProfile.vue'
import AppIcon from '@/shared/components/controls/Icons.vue'
import { Question } from '@/shared/types'
import type { WritingPrompt } from '@/shared/types/writing'
import { createWritingContext } from '@/features/writing/composables'
import { api } from '@/shared/api'
import { logger } from '@/shared/utils/logger'

const activeTab = ref(localStorage.getItem('activeTab') || 'words')

// 根据当前 tab 计算导航主题色类名
const navThemeClass = computed(() => `theme-${activeTab.value}`)
const sidebarExpanded = ref(localStorage.getItem('sidebarExpanded') === "true")
const writingSidebarExpanded = ref(localStorage.getItem('writingSidebarExpanded') === "true")
const selectedQuestion = ref<Question | null>(null)
const selectedPrompt = ref<WritingPrompt | null>(null)
const navExpanded = ref(false)
const { isMobile } = useBreakpoint()
const writingSidebarRef = ref<InstanceType<typeof WritingSidebar> | null>(null)

// Tab 数据
const tabs: Array<{ value: string, label: string, icon: 'book' | 'mic' | 'writing' | 'settings' }> = [
  { value: 'words', label: '单词', icon: 'book' },
  { value: 'speaking', label: '口语', icon: 'mic' },
  { value: 'writing', label: '写作', icon: 'writing' },
  { value: 'settings', label: '设置', icon: 'settings' }
]

// localStorage键名
const SELECTED_QUESTION_KEY = 'selectedQuestion'

// 从localStorage恢复selectedQuestion
const restoreSelectedQuestion = async () => {
  const savedQuestionId = localStorage.getItem(SELECTED_QUESTION_KEY)
  if (savedQuestionId && activeTab.value === 'speaking') {
    try {
      // 获取所有topics来查找对应的question（使用 Supabase 直接查询）
      const topics = await api.speaking.getTopicsDirect()

      // 在所有topic中查找对应的question
      for (const topic of topics) {
        const question = topic.questions?.find(q => q.id === parseInt(savedQuestionId))
        if (question) {
          selectedQuestion.value = question
          return
        }
      }

      // 如果没找到对应的question，清除localStorage中的无效数据
      clearSelectedQuestion()
    } catch (error) {
      logger.error('Failed to restore selected question:', error)
      clearSelectedQuestion()
    }
  }
}

// 保存selectedQuestion到localStorage
const saveSelectedQuestion = (question: Question | null) => {
  if (question) {
    localStorage.setItem(SELECTED_QUESTION_KEY, question.id.toString())
  } else {
    localStorage.removeItem(SELECTED_QUESTION_KEY)
  }
}

// 清空selectedQuestion
const clearSelectedQuestion = () => {
  selectedQuestion.value = null
  localStorage.removeItem(SELECTED_QUESTION_KEY)
}

// 边距计算已移至 CSS（使用 .nav-expanded 和 .sidebar-expanded 类控制）

// 添加一个标志来跟踪是否正在延迟切换
const isDelayingSwitchToWords = ref(false)
// 添加一个标志来跟踪侧边栏是否正在消失
const sidebarDisappearing = ref(false)

const handleTabChange = (tabId: string) => {
  // 如果正在延迟切换到单词模式，忽略其他切换请求
  if (isDelayingSwitchToWords.value) {
    return
  }

  // 延迟切换的情况会在 activeTab watcher 中处理
  // 这里只处理立即切换的情况
  activeTab.value = tabId
  localStorage.setItem('activeTab', tabId)

  if (tabId === 'speaking') {
    // 进入口语练习时，重置侧边栏状态，但保持selectedQuestion用于恢复
    sidebarExpanded.value = false
    localStorage.setItem('sidebarExpanded', "false")
    // 尝试恢复之前选中的问题
    nextTick(() => {
      restoreSelectedQuestion()
    })
  } else if (tabId === 'writing') {
    // 进入写作练习时，重置侧边栏状态
    writingSidebarExpanded.value = false
    localStorage.setItem('writingSidebarExpanded', "false")
  } else if (tabId === 'words') {
    // 切换到单词模式时清空选中的问题（非延迟情况）
    if (!sidebarExpanded.value) {
      clearSelectedQuestion()
    }
  }
}

const handleNavToggle = (expanded: boolean) => {
  navExpanded.value = expanded
}

const handleSidebarToggle = (expanded: boolean) => {
  sidebarExpanded.value = expanded
  localStorage.setItem('sidebarExpanded', expanded ? "true" : "false")
}

const handleWritingSidebarToggle = (expanded: boolean) => {
  writingSidebarExpanded.value = expanded
  localStorage.setItem('writingSidebarExpanded', expanded ? "true" : "false")
}

// Writing Context - 在 HomePage 层级创建，供 WritingSidebar 和 WritingWorkspace 共享
createWritingContext({
  onPromptSelected: (prompt) => {
    selectedPrompt.value = prompt
  }
})

const onPromptSelected = (prompt: WritingPrompt | null) => {
  selectedPrompt.value = prompt
}

const onQuestionSelected = (question: Question | null) => {
  if (question === null) {
    clearSelectedQuestion()
  } else if (selectedQuestion.value?.id === question.id) {
    // 用户点击已选中的问题，取消选择
    clearSelectedQuestion()
  } else {
    // 选择新问题
    selectedQuestion.value = question
    saveSelectedQuestion(question)
  }
}

// 监听selectedQuestion变化，同步到localStorage
watch(selectedQuestion, (newQuestion) => {
  saveSelectedQuestion(newQuestion)
}, { deep: true })

// 监听 activeTab 变化，拦截需要延迟的切换
watch(activeTab, (newTab, oldTab) => {
  // 从口语模式切换到单词模式时的延迟处理
  if (newTab === 'words' && oldTab === 'speaking' && sidebarExpanded.value && !isDelayingSwitchToWords.value) {
    // 需要延迟切换的情况：立即恢复到之前的状态
    activeTab.value = oldTab

    // 标记正在延迟切换和消失
    isDelayingSwitchToWords.value = true
    sidebarDisappearing.value = true

    // 切换到单词时，先收起 sidebar 并清空选中的问题
    sidebarExpanded.value = false
    localStorage.setItem('sidebarExpanded', "false")
    clearSelectedQuestion() // 切换到单词模式时清空选中的问题

    // 等收起动画结束后再切换 tab（与sidebar动画时间匹配）
    // 移动端动画是300ms，桌面端是400ms
    const animationDelay = window.innerWidth <= 768 ? 300 : 400
    setTimeout(() => {
      activeTab.value = 'words'
      localStorage.setItem('activeTab', 'words')
      isDelayingSwitchToWords.value = false // 清除延迟标志
      sidebarDisappearing.value = false // 清除消失标志
    }, animationDelay)
  }

  // 从写作模式切换时，清理选中的题目
  if (oldTab === 'writing') {
    selectedPrompt.value = null
    writingSidebarExpanded.value = false
    localStorage.setItem('writingSidebarExpanded', "false")
  }
})

// 组件挂载时恢复状态
onMounted(() => {
  // 如果当前是speaking模式，尝试恢复选中的问题
  if (activeTab.value === 'speaking') {
    nextTick(() => {
      restoreSelectedQuestion()
    })
  }
})
</script>

<style scoped>
/* ══════════════════════════════════════════════════════════════════════════════
   布局容器 - 使用 CSS 变量控制边距
   ══════════════════════════════════════════════════════════════════════════════ */

.app-container {
  /* 定义当前边距变量，通过类选择器切换 */
  --current-nav-width: var(--nav-width);
  --current-sidebar-width: 0px;

  display: flex;
  width: 100vw;
  min-height: 100vh;
  min-height: 100dvh;
  position: relative;
}

/* 桌面端 Speaking 模式深色背景 - 温暖琥珀色调录音棚风格 */
.app-container.is-speaking:not(.is-mobile) {
  background: linear-gradient(
    145deg,
    #1a1510 0%,
    #1f1a14 25%,
    #2a2218 50%,
    #1a1510 100%
  );
}

/* 桌面端 Writing 模式深色背景 - 深邃蓝色午夜写作台风格 */
.app-container.is-writing:not(.is-mobile) {
  background: linear-gradient(
    155deg,
    #0f172a 0%,
    #1e293b 30%,
    #1e3a5f 60%,
    #0f172a 100%
  );
}

/* 导航栏展开时 */
.app-container.nav-expanded {
  --current-nav-width: var(--nav-width-expanded);
}

/* 侧边栏展开时 */
.app-container.sidebar-expanded {
  --current-sidebar-width: var(--speaking-sidebar-width);
}

/* 移动端：无左侧导航边距 */
.app-container.is-mobile {
  --current-nav-width: 0px;
  --current-sidebar-width: 0px;
  /* 底部导航高度变量，供子页面使用 */
  --mobile-nav-height: calc(88px + env(safe-area-inset-bottom));
  min-height: 100vh;
  min-height: 100dvh;
  /* 移动端背景色 - 默认米色（单词模块） */
  background-color: var(--primitive-paper-200);
  /* 背景色过渡，避免 tab 切换时闪烁 */
  transition: background-color 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 移动端各模块背景色 - 使用纯色以支持 transition */
.app-container.is-mobile.is-speaking {
  /* 口语模块 - 深琥珀色（SpeakingPage gradient 的主色） */
  background-color: #1f1a14;
}

.app-container.is-mobile.is-writing {
  /* 写作模块 - 深蓝色（WritingPage gradient 的主色） */
  background-color: #1a1f2e;
}

.app-container.is-mobile.is-settings {
  /* 设置模块 - 灰色（与 SettingsPage 相同） */
  background-color: #F0F1F4;
}

/* ══════════════════════════════════════════════════════════════════════════════
   移动端底部浮动导航
   ══════════════════════════════════════════════════════════════════════════════ */

.mobile-bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  padding: 0 16px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
  pointer-events: none;
}

.mobile-nav-container {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  background-color: var(--primitive-paper-50);
  border-radius: 16px;
  padding: 6px 10px;
  box-shadow:
    0 -2px 20px rgba(0, 0, 0, 0.08),
    0 4px 24px rgba(0, 0, 0, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  border: 1px solid var(--primitive-paper-300);
  pointer-events: auto;
  margin: 0 auto;
  transition:
    background-color 0.6s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.6s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 移动端导航主题色 */
.mobile-nav-container.theme-words {
  background-color: var(--primitive-paper-50);
  border-color: var(--primitive-paper-300);
}

.mobile-nav-container.theme-speaking {
  background-color: #FFFBF0;
  border-color: var(--primitive-gold-200);
  box-shadow:
    0 -2px 20px rgba(184, 134, 11, 0.06),
    0 4px 24px rgba(184, 134, 11, 0.1),
    inset 0 1px 0 rgba(255, 251, 240, 0.9);
}

.mobile-nav-container.theme-writing {
  background-color: #F5F8FF;
  border-color: var(--primitive-azure-200);
  box-shadow:
    0 -2px 20px rgba(59, 130, 246, 0.06),
    0 4px 24px rgba(59, 130, 246, 0.1),
    inset 0 1px 0 rgba(245, 248, 255, 0.9);
}

.mobile-nav-container.theme-settings {
  background-color: #F4F5F7;
  border-color: var(--primitive-ink-200);
  box-shadow:
    0 -2px 20px rgba(90, 101, 120, 0.06),
    0 4px 24px rgba(90, 101, 120, 0.1),
    inset 0 1px 0 rgba(244, 245, 247, 0.9);
}

.mobile-nav-item {
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 12px;
  border: none;
  background: transparent;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
  user-select: none;
  outline: none;
  white-space: nowrap;
}

.mobile-nav-item .nav-icon-svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.mobile-nav-item .nav-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--primitive-ink-500);
  letter-spacing: -0.01em;
  transition: all 0.25s ease;
}

/* Active state */
.mobile-nav-item.active {
  background: var(--gradient-primary);
  box-shadow: 0 2px 8px rgba(153, 107, 61, 0.25);
  transition:
    background 0.5s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.mobile-nav-item.active .nav-icon-svg {
  transform: scale(1.05);
}

.mobile-nav-item.active .nav-label {
  color: var(--primitive-paper-50);
  font-weight: 700;
}

/* 口语模块 - 金色激活态 */
.mobile-nav-container.theme-speaking .mobile-nav-item.active {
  background: linear-gradient(135deg, var(--primitive-gold-500), var(--primitive-gold-400));
  box-shadow: 0 2px 8px rgba(184, 134, 11, 0.3);
}

/* 写作模块 - 蓝色激活态 */
.mobile-nav-container.theme-writing .mobile-nav-item.active {
  background: linear-gradient(135deg, var(--primitive-azure-500), var(--primitive-azure-400));
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

/* 设置模块 - 墨灰激活态 */
.mobile-nav-container.theme-settings .mobile-nav-item.active {
  background: linear-gradient(135deg, var(--primitive-ink-500), var(--primitive-ink-400));
  box-shadow: 0 2px 8px rgba(90, 101, 120, 0.3);
}

/* Indicator dot - 移到标签下方小圆点 */
.nav-indicator {
  position: absolute;
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
  width: 3px;
  height: 3px;
  background: var(--primitive-paper-50);
  border-radius: 50%;
  opacity: 0.7;
}

/* Press effect */
.mobile-nav-item:active {
  transform: scale(0.96);
}

.mobile-nav-item.active:active {
  transform: scale(0.98);
}

/* ── 移动端用户选择器（印章） ── */
.mobile-user-selector {
  display: flex;
  align-items: center;
  padding-right: 6px;
  margin-right: 2px;
  border-right: 1px solid var(--primitive-paper-300);
}

/* 调整 UserProfile 在移动端底部导航中的样式 */
.mobile-user-selector :deep(.user-profile) {
  padding: 4px 0;
}

.mobile-user-selector :deep(.stamp-seal) {
  width: 28px;
  height: 28px;
}

.mobile-user-selector :deep(.seal-character) {
  font-size: 15px;
}

.mobile-user-selector :deep(.seal-border) {
  border-width: 1.5px;
}

/* ══════════════════════════════════════════════════════════════════════════════
   主内容区域 - 边距由 CSS 变量控制
   ══════════════════════════════════════════════════════════════════════════════ */

.main-container {
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0;
  /* 边距由 CSS 变量控制 */
  margin-left: calc(var(--current-nav-width) + var(--current-sidebar-width));
  transition: margin-left var(--transition-slow);
  position: relative;
  box-sizing: border-box;
  /* 防止页面切换动画期间内容溢出导致滚动条闪烁 */
  overflow: hidden;
}

/* 移动端主内容区域 - 统一 padding 为 0，由各页面组件自己处理内边距 */
.app-container.is-mobile .main-container {
  margin-left: 0;
  padding: 0;
  padding-bottom: var(--mobile-nav-height);
  /* 不设置 min-height，让子页面决定高度 */
  min-height: auto;
  align-items: stretch;
  justify-content: flex-start;
}

/* ══════════════════════════════════════════════════════════════════════════════
   页面切换动画
   ══════════════════════════════════════════════════════════════════════════════ */

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all var(--transition-slow);
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

/* 侧边栏出现/消失动画 */
.sidebar-slide-enter-active,
.sidebar-slide-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar-slide-enter-from {
  opacity: 0;
  transform: translateX(-100%);
}

.sidebar-slide-leave-to {
  opacity: 0;
  transform: translateX(-100%);
}

/* 移动端：侧边栏从右侧滑入，使用opacity动画避免与内部动画冲突 */
@media (max-width: 768px) {
  .sidebar-slide-enter-active,
  .sidebar-slide-leave-active {
    transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .sidebar-slide-enter-from,
  .sidebar-slide-leave-to {
    opacity: 0;
    transform: none;
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   响应式适配
   ══════════════════════════════════════════════════════════════════════════════ */

/* 横屏手机适配 */
@media (max-height: 500px) and (orientation: landscape) {
  .app-container.is-mobile .main-container {
    padding: 0.5rem;
    padding-bottom: calc(64px + env(safe-area-inset-bottom) + 0.5rem);
    align-items: center;
  }

  .mobile-bottom-nav {
    padding: 0 24px;
    padding-bottom: calc(8px + env(safe-area-inset-bottom));
  }

  .mobile-nav-container {
    padding: 4px 8px;
    border-radius: 14px;
    gap: 2px;
  }

  .mobile-nav-item {
    padding: 6px 10px;
    gap: 3px;
  }

  .mobile-nav-item .nav-icon-svg {
    width: 16px;
    height: 16px;
  }

  .mobile-nav-item .nav-label {
    font-size: 11px;
  }

  .mobile-user-selector {
    padding-right: 4px;
    margin-right: 2px;
  }

  .mobile-user-selector :deep(.stamp-seal) {
    width: 24px;
    height: 24px;
  }

  .mobile-user-selector :deep(.seal-character) {
    font-size: 13px;
  }

  .fade-slide-enter-active,
  .fade-slide-leave-active {
    transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .sidebar-slide-enter-active,
  .sidebar-slide-leave-active {
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }
}
</style>