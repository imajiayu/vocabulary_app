<template>
  <nav class="main-nav" :class="{ expanded: expanded }">
    <!-- 顶部区域：展开/收起按钮和Logo -->
    <div class="nav-header">
      <button class="nav-toggle" @click="toggleNav">
        <span class="toggle-icon" :class="{ rotated: expanded }">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </span>
      </button>

      <div class="logo-container">
        <transition name="logo-fade">
          <h1 v-show="expanded" class="app-title">IELTS</h1>
        </transition>
      </div>
    </div>

    <!-- Tab 按钮区域 -->
    <div class="nav-tabs">
      <button v-for="tab in tabs" :key="tab.id" :class="['nav-tab', { active: activeTab === tab.id }]"
        @click="switchTab(tab.id)">
        <span class="tab-icon">{{ tab.icon }}</span>
        <div class="label-container">
          <transition name="label-fade">
            <span v-show="expanded" class="tab-label">{{ tab.label }}</span>
          </transition>
        </div>
      </button>
    </div>

    <!-- 底部设置按钮 -->
    <div class="nav-footer">
      <button :class="['nav-tab', { active: activeTab === 'settings' }]" @click="switchTab('settings')">
        <span class="tab-icon">⚙️</span>
        <div class="label-container">
          <transition name="label-fade">
            <span v-show="expanded" class="tab-label">设置</span>
          </transition>
        </div>
      </button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Tab {
  id: string
  label: string
  icon: string
}

interface Props {
  activeTab: string
}

interface Emits {
  (e: 'tab-change', tabId: string): void
  (e: 'nav-toggle', expanded: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const tabs: Tab[] = [
  { id: 'words', label: '单词复习', icon: '📚' },
  { id: 'speaking', label: '口语练习', icon: '🎤' }
]

const expanded = ref(false)

const toggleNav = () => {
  expanded.value = !expanded.value
  emit('nav-toggle', expanded.value)
}

const switchTab = (tabId: string) => {
  if (props.activeTab !== tabId)
    emit('tab-change', tabId)
}
</script>

<style scoped>
.main-nav {
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  width: 48px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px);
  border-right: 1px solid rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  box-shadow: 2px 0 20px rgba(0, 0, 0, 0.05);
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 101;
  overflow: hidden;
}

.main-nav.expanded {
  width: 280px;
}

.nav-header {
  display: flex;
  align-items: center;
  height: 48px;
  padding: 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  position: relative;
}

.nav-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  min-width: 44px;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--color-text-secondary);
  transition: all 0.2s ease;
  flex-shrink: 0;
  /* 移动端触摸优化 */
  touch-action: manipulation;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.nav-toggle:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #334155;
}

.toggle-icon {
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.toggle-icon.rotated {
  transform: rotate(180deg);
}

.logo-container {
  position: relative;
  height: 48px;
  display: flex;
  align-items: center;
  overflow: hidden;
}

.main-nav.expanded .logo-container {
  flex: 1;
}

.app-title {
  font-size: 24px;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea, #764ba2);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0;
  white-space: nowrap;
  position: absolute;
  left: 16px;
}

.nav-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 20px 0;
}

.nav-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 48px;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  margin-top: auto;
}

.nav-tab {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0;
  border: none;
  background: transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 15px;
  font-weight: 500;
  color: var(--color-text-secondary);
  transition: all 0.2s ease;
  text-align: left;
  width: 100%;
  min-height: 48px;
  position: relative;
  margin: 0;
  overflow: hidden;
  justify-content: flex-start;
  /* 移动端触摸优化 */
  touch-action: manipulation;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.nav-tab:hover {
  background: rgba(102, 126, 234, 0.1);
}

/* 收起状态下的样式 */
.main-nav:not(.expanded) .nav-tab {
  width: 36px;
  /* 缩小按钮宽度 */
  height: 36px;
  /* 缩小按钮高度 */
  min-height: 36px;
  margin: 0 6px;
  /* 左右居中 */
  justify-content: center;
  border-radius: var(--radius-default);
}

.main-nav:not(.expanded) .nav-tab:hover {
  transform: none;
  /* 收起状态不要左右移动效果 */
}

.main-nav:not(.expanded) .nav-tab.active {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
  width: 36px;
  /* 保持较小宽度 */
  height: 36px;
  border-radius: var(--radius-default);
}

/* 展开状态下的样式 */
.main-nav.expanded .nav-tab {
  width: calc(100% - 16px);
  margin: 0 8px;
  justify-content: flex-start;
  min-height: 36px;
  height: 36px;
}

.main-nav.expanded .nav-tab:hover {
  transform: translateX(2px);
}

.main-nav.expanded .nav-tab.active {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
  border-radius: 22px;
}

.main-nav.expanded .nav-tab.active::before {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: var(--radius-2xl);
  background: linear-gradient(135deg, #667eea, #764ba2);
  z-index: -1;
  opacity: 0.1;
}

.tab-icon {
  font-size: 18px;
  width: 36px;
  /* 统一图标容器宽度 */
  min-width: 36px;
  height: 36px;
  /* 统一图标容器高度 */
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  text-align: center;
}

/* 展开状态下图标容器调整 */
.main-nav.expanded .tab-icon {
  width: 36px;
  min-width: 36px;
  height: 36px;
}

.label-container {
  position: relative;
  height: 44px;
  display: flex;
  align-items: center;
  overflow: hidden;
  flex: 1;
}

.tab-label {
  white-space: nowrap;
  position: absolute;
  left: 12px;
}

.logo-fade-enter-active {
  transition: opacity 0.25s ease 0.1s, transform 0.25s ease 0.1s;
}

.logo-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.logo-fade-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.logo-fade-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

.label-fade-enter-active {
  transition: opacity 0.25s ease 0.1s, transform 0.25s ease 0.1s;
}

.label-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.label-fade-enter-from {
  opacity: 0;
  transform: translateX(-20px);
}

.label-fade-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

/* 移动端响应式适配 */
@media (max-width: 480px) {
  .main-nav {
    width: 44px;
  }

  .main-nav.expanded {
    width: 240px;
  }

  .nav-header {
    height: 44px;
  }

  .nav-toggle {
    width: 44px;
    height: 44px;
    min-width: 44px;
  }

  /* 移动端禁用hover效果，使用active替代 */
  .nav-toggle:hover {
    background: transparent;
  }

  .nav-toggle:active {
    background: rgba(0, 0, 0, 0.1);
    transform: scale(0.95);
  }

  .nav-tab:hover {
    background: transparent;
    transform: none;
  }

  .nav-tab:active {
    background: rgba(102, 126, 234, 0.15);
    transform: scale(0.98);
  }

  .main-nav:not(.expanded) .nav-tab {
    width: 32px;
    height: 32px;
    min-height: 32px;
    margin: 0 6px;
  }

  .main-nav:not(.expanded) .nav-tab.active {
    width: 32px;
    height: 32px;
  }

  .main-nav:not(.expanded) .tab-icon {
    width: 32px;
    min-width: 32px;
    height: 32px;
    font-size: 16px;
  }

  .main-nav.expanded .tab-icon {
    width: 44px;
    min-width: 44px;
    height: 44px;
  }

  .main-nav.expanded .nav-tab:hover {
    transform: none;
  }

  .app-title {
    font-size: 20px;
    left: 12px;
  }

  .nav-tabs {
    padding: 16px 0;
    gap: 6px;
  }

  .main-nav.expanded .nav-tab {
    min-height: 40px;
    height: 40px;
  }

  .tab-label {
    font-size: 14px;
  }
}

/* 小屏手机进一步优化 */
@media (max-width: 480px) {
  .main-nav {
    width: 40px;
  }

  .main-nav.expanded {
    width: 220px;
  }

  .nav-header {
    height: 40px;
  }

  .nav-toggle {
    width: 40px;
    height: 40px;
    min-width: 40px;
  }

  .main-nav:not(.expanded) .nav-tab {
    width: 28px;
    height: 28px;
    min-height: 28px;
    margin: 0 6px;
    border-radius: var(--radius-sm);
  }

  .main-nav:not(.expanded) .nav-tab.active {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
  }

  .main-nav:not(.expanded) .tab-icon {
    width: 28px;
    min-width: 28px;
    height: 28px;
    font-size: 14px;
  }

  .main-nav.expanded .tab-icon {
    width: 36px;
    min-width: 36px;
    height: 36px;
  }

  .main-nav.expanded .nav-tab {
    min-height: 36px;
    height: 36px;
    border-radius: 18px;
  }

  .app-title {
    font-size: 18px;
    left: 10px;
  }

  .nav-tabs {
    padding: 12px 0;
    gap: 4px;
  }

  .tab-label {
    font-size: 13px;
    left: 8px;
  }
}

/* 横屏适配 */
@media (max-height: 500px) and (orientation: landscape) {
  .nav-tabs {
    padding: 8px 0;
    gap: 4px;
  }

  .main-nav.expanded .nav-tab {
    min-height: 32px;
    height: 32px;
  }

  .main-nav:not(.expanded) .nav-tab {
    height: 28px;
    min-height: 28px;
  }

  .app-title {
    font-size: 18px;
  }
}
</style>