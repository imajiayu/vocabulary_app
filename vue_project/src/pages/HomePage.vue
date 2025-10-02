<template>
  <div class="app-container">
    <!-- 桌面端主导航栏 -->
    <MainNavigation
      v-if="!isMobile"
      :active-tab="activeTab"
      @tab-change="handleTabChange"
      @nav-toggle="handleNavToggle"
    />

    <!-- 移动端顶部Tab导航 -->
    <div v-if="isMobile" class="mobile-tab-nav">
      <div class="mobile-switch-wrapper">
        <SwitchTab
          v-model="activeTab"
          :tabs="tabs"
          container-class="mobile-theme"
          :show-indicator="true"
          @change="handleTabChange"
        />
      </div>
    </div>

    <!-- 侧边栏（在桌面端和移动端口语练习时都显示）-->
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

    <!-- 主内容区域 -->
    <main
      class="main-container"
      :style="{
        marginLeft: isMobile ? '0px' : (navMargin + sidebarMargin) + 'px',
        paddingTop: isMobile ? '80px' : '0px'
      }"
    >
      <!-- 内容切换动画 -->
      <transition name="fade-slide" mode="out-in">
        <WordIndex v-if="activeTab === 'words'" key="words" class="word-index" />
        <SpeakingIndex
          v-else-if="activeTab === 'speaking'"
          key="speaking"
          class="speaking-index"
          :select-question="selectedQuestion"
          @sidebar-toggle="handleSidebarToggle"
        />
      </transition>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick, onUnmounted } from 'vue'
import WordIndex from '@/features/vocabulary/components/WordIndex.vue'
import SpeakingIndex from '@/pages/SpeakingPage.vue'
import SpeakingSidebar from '@/features/speaking/components/SpeakingSidebar.vue'
import MainNavigation from '@/shared/components/layout/MainNavigation.vue'
import SwitchTab from '@/shared/components/ui/SwitchTab.vue'
import { Question } from '@/shared/types'
import { api } from '@/shared/api'

const activeTab = ref(localStorage.getItem('activeTab') || 'words')
const sidebarExpanded = ref(localStorage.getItem('sidebarExpanded') === "true")
const selectedQuestion = ref<Question | null>(null)
const navExpanded = ref(false)
const isMobile = ref(false)

// Tab 数据
const tabs = [
  { value: 'words', label: '单词', icon: '📚' },
  { value: 'speaking', label: '口语', icon: '🎤' }
]

// localStorage键名
const SELECTED_QUESTION_KEY = 'selectedQuestion'

// 从localStorage恢复selectedQuestion
const restoreSelectedQuestion = async () => {
  const savedQuestionId = localStorage.getItem(SELECTED_QUESTION_KEY)
  if (savedQuestionId && activeTab.value === 'speaking') {
    try {
      // 获取所有topics来查找对应的question
      const topics = await api.speaking.getTopics()

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
      console.error('Failed to restore selected question:', error)
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

// 计算左侧边距（导航栏）
const navMargin = computed(() => {
  const isMobile = window.innerWidth <= 768
  const isSmallMobile = window.innerWidth <= 480

  if (navExpanded.value) {
    return isSmallMobile ? 220 : (isMobile ? 240 : 280)
  } else {
    return isSmallMobile ? 40 : (isMobile ? 44 : 48)
  }
})

// 计算右侧边距（侧边栏）- 移动端不需要边距因为是底部抽屉
const sidebarMargin = computed(() => {
  if (activeTab.value !== 'speaking' || !sidebarExpanded.value) return 0

  // 移动端不需要边距，因为SpeakingSidebar是底部抽屉
  const isMobile = window.innerWidth <= 768
  if (isMobile) return 0

  const isSmallMobile = window.innerWidth <= 480
  return isSmallMobile ? 260 : (isMobile ? 280 : 320)
})

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

const onQuestionSelected = (question: Question) => {
  if (selectedQuestion.value?.id === question.id) {
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
})

// 检测移动端
const checkMobile = () => {
  isMobile.value = window.innerWidth <= 768
}

// 组件挂载时恢复状态
onMounted(() => {
  // 检测移动端
  checkMobile()
  window.addEventListener('resize', checkMobile)

  // 如果当前是speaking模式，尝试恢复选中的问题
  if (activeTab.value === 'speaking') {
    nextTick(() => {
      restoreSelectedQuestion()
    })
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMobile)
})
</script>

<style scoped>
.app-container {
  display: flex;
  width: 100vw;
  min-height: 100vh; /* 使用min-height而不是height */
  overflow: hidden;
  position: relative;
}

/* 移动端允许滚动 */
@media (max-width: 768px) {
  .app-container {
    overflow: visible; /* 移动端允许滚动 */
    height: auto; /* 高度由内容决定 */
  }
}

/* 移动端顶部Tab导航 - 刘海屏效果 */
.mobile-tab-nav {
  position: fixed;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  height: 64px;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 只让SwitchTab本身阻止点击穿透，周围区域可以点击 */
  pointer-events: none;
}

.mobile-switch-wrapper {
  /* 恢复点击事件，但只针对SwitchTab区域 */
  pointer-events: auto;
}

.main-container {
  width: 100%;
  min-height: 100vh; /* 使用min-height */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0; /* 桌面端去掉padding避免滚动条 */
  transition: margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: visible; /* 桌面端不需要内部滚动 */
  box-sizing: border-box;
}

/* 移动端优化 */
@media (max-width: 768px) {
  .main-container {
    height: auto; /* 高度由内容决定 */
    overflow: visible; /* 移动端不需要内部滚动 */
    /* 移动端触摸优化 */
    -webkit-overflow-scrolling: touch;
    touch-action: pan-y;
  }
}

/* 移除强制的子组件样式，让组件保持自己的布局 */

/* 页面切换动画 */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
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

/* 移动端全面适配 */
@media (max-width: 768px) {
  .main-container {
    padding: 1rem;
    padding-top: calc(80px + 1rem); /* 为顶部Tab导航留出空间 */
    padding-bottom: calc(env(safe-area-inset-bottom) + 1rem); /* 为Safari底部栏留出空间 */
    align-items: flex-start;
    min-height: calc(100vh - env(safe-area-inset-bottom)); /* 考虑安全区域 */
    height: auto; /* 高度由内容决定 */
  }

  .mobile-tab-nav {
    height: 60px;
  }


  /* 在移动端调整动画时长，减少延迟感 */
  .fade-slide-enter-active,
  .fade-slide-leave-active {
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .sidebar-slide-enter-active,
  .sidebar-slide-leave-active {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
}

/* 小屏手机进一步优化 */
@media (max-width: 480px) {
  .main-container {
    padding: 0.75rem;
    padding-top: calc(56px + 0.75rem); /* 为小屏顶部Tab导航留出空间 */
    padding-bottom: calc(env(safe-area-inset-bottom) + 0.75rem);
    min-height: calc(100vh - env(safe-area-inset-bottom));
    height: auto;
  }

  .mobile-tab-nav {
    height: 56px;
  }


  /* 小屏幕上减少动画效果，提升性能 */
  .fade-slide-enter-from,
  .fade-slide-leave-to {
    transform: translateY(10px);
  }
}

/* 横屏手机适配 */
@media (max-height: 500px) and (orientation: landscape) {
  .main-container {
    padding: 0.5rem;
    align-items: center;
  }

  .mobile-tab-nav {
    height: 48px;
    padding: 0 0.5rem;
  }

  /* 横屏时减少动画时间 */
  .fade-slide-enter-active,
  .fade-slide-leave-active {
    transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .sidebar-slide-enter-active,
  .sidebar-slide-leave-active {
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  }
}

/* 超宽屏适配 */
@media (min-width: 1440px) {
  .main-container {
    padding: 0; /* 超宽屏也去掉padding避免滚动条 */
  }
}
</style>