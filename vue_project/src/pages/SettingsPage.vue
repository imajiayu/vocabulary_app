<template>
  <div class="settings-page" :class="{ 'nav-expanded': navExpanded }">
    <!-- 侧边栏 - 移动端隐藏 -->
    <aside class="settings-sidebar desktop-only">
      <div class="sidebar-header">
        <h2>设置</h2>
      </div>
      <nav class="sidebar-nav">
        <button
          v-for="section in sections"
          :key="section.id"
          :class="['nav-item', { active: activeSection === section.id }]"
          @click="scrollToSection(section.id)"
        >
          <span class="nav-icon">{{ section.icon }}</span>
          <div class="nav-content">
            <span class="nav-title">{{ section.title }}</span>
            <span class="nav-subtitle">{{ section.subtitle }}</span>
          </div>
        </button>
      </nav>
    </aside>

    <!-- 主内容区 -->
    <main class="settings-content" @scroll="handleScroll">
      <div class="content-inner">
        <!-- 学习设置 -->
        <LearningSettings
          id="learning"
          v-model="settings.learning"
          @save-success="handleSaveSuccess"
        />

        <!-- 错题集设置 -->
        <LapseSettings
          id="lapse"
          v-model="settings.learning"
          @save-success="handleSaveSuccess"
        />

        <!-- 单词管理设置 -->
        <ManagementSettings
          id="management"
          v-model="settings.management"
          @save-success="handleSaveSuccess"
        />

        <!-- 音频设置 -->
        <AudioSettings
          id="audio"
          v-model="settings.audio"
          @save-success="handleSaveSuccess"
        />

        <!-- 快捷键设置 - 移动端隐藏 -->
        <HotkeySettings
          v-model="settings.hotkeys"
          @save-success="handleSaveSuccess"
        />

        <!-- 单词关联设置 -->
        <RelationSettings />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import LearningSettings from './settings/LearningSettings.vue'
import LapseSettings from './settings/LapseSettings.vue'
import ManagementSettings from './settings/ManagementSettings.vue'
import AudioSettings from './settings/AudioSettings.vue'
import HotkeySettings from './settings/HotkeySettings.vue'
import RelationSettings from './settings/RelationSettings.vue'
import { useSettings } from '@/shared/composables/useSettings'
import type { UserSettings } from '@/shared/types'

interface SettingsSection {
  id: string
  title: string
  subtitle: string
  icon: string
}

interface Props {
  navExpanded?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  navExpanded: false
})

const sections: SettingsSection[] = [
  { id: 'learning', title: '学习设置', subtitle: '复习与拼写配置', icon: '📚' },
  { id: 'lapse', title: '错题集设置', subtitle: '错题复习策略与退出', icon: '❌' },
  { id: 'management', title: '单词管理', subtitle: '批量导入与释义获取', icon: '📝' },
  { id: 'audio', title: '音频设置', subtitle: '发音口音选择', icon: '🔊' },
  { id: 'hotkeys', title: '快捷键设置', subtitle: '自定义键盘快捷键', icon: '⌨️' },
  { id: 'relations', title: '单词关联', subtitle: '管理单词关系网络', icon: '🕸️' },
]

const activeSection = ref('learning')
const isScrollingProgrammatically = ref(false)
let scrollTimeout: ReturnType<typeof setTimeout> | null = null

// 使用全局设置管理
const { settings: globalSettings, loadSettings: loadGlobalSettings } = useSettings()

// 创建一个带默认值的 computed，确保在加载前有合理的默认值
const settings = computed<UserSettings>(() => globalSettings.value || {
  learning: {
    dailyReviewLimit: 300,
    dailySpellLimit: 200,
    maxPrepDays: 45,
    lapseQueueSize: 25,
    lapseMaxValue: 4,
    lapseInitialValue: 3,
    lapseFastExitEnabled: true,
    lapseConsecutiveThreshold: 2,
    defaultShuffle: false,
    lowEfExtraCount: 50
  },
  management: {
    wordsLoadBatchSize: 200,
    definitionFetchThreads: 3
  },
  audio: {
    accent: 'us',
    autoPlayOnWordChange: true,
    autoPlayAfterAnswer: true
  },
  hotkeys: {
    reviewInitial: {
      remembered: 'ArrowLeft',
      notRemembered: 'ArrowRight',
      stopReview: 'ArrowDown'
    },
    reviewAfter: {
      wrong: 'ArrowLeft',
      next: 'ArrowRight'
    },
    spelling: {
      playAudio: 'ArrowLeft',
      forgot: 'ArrowRight',
      next: 'Enter'
    }
  }
})

const scrollToSection = (sectionId: string) => {
  const element = document.getElementById(sectionId)
  if (element) {
    console.log('[ScrollToSection] 开始滚动到:', sectionId)

    // 清除之前的超时
    if (scrollTimeout) {
      clearTimeout(scrollTimeout)
    }

    // 立即标记开始程序化滚动（在设置 activeSection 之前）
    isScrollingProgrammatically.value = true
    console.log('[ScrollToSection] isScrollingProgrammatically 设置为 true')

    // 立即更新 activeSection
    activeSection.value = sectionId
    console.log('[ScrollToSection] activeSection 已设置为:', sectionId)

    // 触发滚动
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })

    // 滚动结束后清除标记
    scrollTimeout = setTimeout(() => {
      isScrollingProgrammatically.value = false
      console.log('[ScrollToSection] 程序化滚动标记已清除')
      scrollTimeout = null
    }, 2000)
  }
}

const handleScroll = (event: Event) => {
  // 如果正在程序化滚动，忽略滚动事件
  if (isScrollingProgrammatically.value) {
    return
  }

  const target = event.target as HTMLElement
  const containerRect = target.getBoundingClientRect()

  // 检查是否滚动到顶部
  const isAtTop = target.scrollTop < 10

  if (isAtTop) {
    const firstSection = sections[0].id
    if (activeSection.value !== firstSection) {
      activeSection.value = firstSection
    }
    return
  }

  // 检查是否滚动到底部
  const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 10

  if (isAtBottom) {
    const lastSection = sections[sections.length - 1].id
    if (activeSection.value !== lastSection) {
      activeSection.value = lastSection
    }
    return
  }

  // 找到当前视口中最靠近顶部的 section
  let closestSection = null
  let closestDistance = Infinity

  sections.forEach((section) => {
    const element = document.getElementById(section.id)
    if (element) {
      const rect = element.getBoundingClientRect()
      const distance = Math.abs(rect.top - containerRect.top)

      if (rect.top <= containerRect.top + 150 && rect.bottom >= containerRect.top && distance < closestDistance) {
        closestDistance = distance
        closestSection = section.id
      }
    }
  })

  if (closestSection && closestSection !== activeSection.value) {
    activeSection.value = closestSection
  }
}

const handleSaveSuccess = () => {
  console.log('[SettingsPage] 设置保存成功')
}

onMounted(async () => {
  // 使用全局设置加载器（带缓存）
  await loadGlobalSettings()
})
</script>

<style scoped>
.settings-page {
  display: flex;
  width: 100%;
  min-height: 100vh;
  position: relative;
}

/* ===== 侧边栏 ===== */
.settings-sidebar {
  position: sticky;
  left: 0;
  top: 0;
  width: 280px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  border-right: 1px solid rgba(0, 0, 0, 0.08);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.sidebar-header {
  display: flex;
  align-items: center;
  height: 48px;
  padding: 0 20px;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.sidebar-header h2 {
  font-size: 20px;
  font-weight: 600;
  color: #0f172a;
  margin: 0;
}

.sidebar-nav {
  flex: 1;
  padding: 20px 12px;
  overflow-y: auto;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 12px;
  margin-bottom: 4px;
  border: none;
  background: transparent;
  border-radius: 10px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;
}

.nav-item:hover {
  background: #f1f5f9;
}

.nav-item.active {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

.nav-icon {
  font-size: 20px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.nav-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-title {
  font-size: 14px;
  font-weight: 500;
  color: inherit;
}

.nav-item.active .nav-title {
  color: white;
}

.nav-subtitle {
  font-size: 12px;
  color: #64748b;
}

.nav-item.active .nav-subtitle {
  color: rgba(255, 255, 255, 0.8);
}

/* ===== 主内容区 ===== */
.settings-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  justify-content: flex-start;
  align-items: flex-start;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  max-height: 100vh;
  box-sizing: border-box;
}

.content-inner {
  max-width: 900px;
  width: 100%;
  padding: 48px 32px;
  padding-bottom: 120px;
}

/* 移动端隐藏侧边栏和快捷键设置 */
.desktop-only {
  display: block;
}

@media (max-width: 768px) {
  .desktop-only {
    display: none !important;
  }

  .settings-page {
    display: block;
  }

  .settings-sidebar {
    width: 260px;
  }

  .settings-content {
    max-height: none;
  }

  .content-inner {
    padding: 32px 20px;
  }
}
</style>
