<script setup lang="ts">
/**
 * PageLayout - 统一的页面布局组件
 *
 * 封装了 TopBar + 主内容区域 + 可选底部栏的布局模式，
 * 减少页面级组件的重复布局代码。
 *
 * 使用示例：
 * ```vue
 * <PageLayout show-top-bar flex-layout>
 *   <template #topbar-center>
 *     <span>页面标题</span>
 *   </template>
 *
 *   <YourContent />
 *
 *   <template #footer>
 *     <ButtonBar />
 *   </template>
 * </PageLayout>
 * ```
 */
import TopBar from './TopBar.vue'

interface Props {
  // 布局模式
  flexLayout?: boolean      // 使用 flex 布局（TopBar 固定 + 内容可滚动）
  withTopbar?: boolean      // 使用 padding-top 布局（内容自然流动）

  // TopBar 配置
  showTopBar?: boolean
  showHomeButton?: boolean
  showManagementButton?: boolean
  showStatsButton?: boolean
  homeButtonText?: string
  topBarBackground?: string

  // 内容区域配置
  contentClass?: string
  maxWidth?: string         // 内容最大宽度，默认 72rem
}

const props = withDefaults(defineProps<Props>(), {
  flexLayout: false,
  withTopbar: true,
  showTopBar: true,
  showHomeButton: false,
  showManagementButton: false,
  showStatsButton: false,
  homeButtonText: '返回首页',
  topBarBackground: '#fff',
  contentClass: '',
  maxWidth: '72rem'
})

// 计算容器类
const containerClass = computed(() => ({
  'app-container': true,
  'flex-layout': props.flexLayout,
  'with-topbar': props.withTopbar && !props.flexLayout
}))

import { computed, useSlots } from 'vue'

const slots = useSlots()
const hasFooter = computed(() => !!slots.footer)
</script>

<template>
  <div :class="containerClass">
    <!-- TopBar -->
    <TopBar
      v-if="showTopBar"
      :show-home-button="showHomeButton"
      :show-management-button="showManagementButton"
      :show-stats-button="showStatsButton"
      :home-button-text="homeButtonText"
      :background="topBarBackground"
    >
      <template #left>
        <slot name="topbar-left" />
      </template>
      <template #center>
        <slot name="topbar-center" />
      </template>
      <template #right>
        <slot name="topbar-right" />
      </template>
    </TopBar>

    <!-- 主内容区域 -->
    <main
      class="main-content"
      :class="contentClass"
      :style="{ maxWidth }"
    >
      <slot />
    </main>

    <!-- 底部区域（可选） -->
    <footer v-if="hasFooter" class="page-footer">
      <slot name="footer" />
    </footer>
  </div>
</template>

<style scoped>
/* 主内容区域基础样式 */
.main-content {
  width: 100%;
  margin-left: auto;
  margin-right: auto;
  padding: 1.5rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  background: transparent;
  /* 确保内容区域至少填满视口减去 TopBar 高度 */
  min-height: calc(100vh - var(--topbar-height, 48px) - 3rem);
  min-height: calc(100dvh - var(--topbar-height, 48px) - 3rem);
  box-sizing: border-box;
}

/* 移动端内容区域 */
@media (max-width: 768px) {
  .main-content {
    padding: 1rem 0.75rem;
    min-height: calc(100vh - var(--topbar-height-mobile, 44px) - 2rem);
    min-height: calc(100dvh - var(--topbar-height-mobile, 44px) - 2rem);
  }
}

/* 底部区域 */
.page-footer {
  flex-shrink: 0;
}
</style>
