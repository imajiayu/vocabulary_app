<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

interface Props {
  background?: string
  height?: string | number
  sticky?: boolean
  border?: string
  padding?: string
  showHomeButton?: boolean
  homeButtonText?: string
  homeButtonTo?: string
  showHomeLoading?: boolean
  showManagementButton?: boolean
  showStatsButton?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  background: '#fff',
  height: '48px',
  sticky: true,
  border: '1px solid #eee',
  padding: '0 16px',
  showHomeButton: false,
  homeButtonText: '返回首页',
  homeButtonTo: '/',
  showHomeLoading: true,
  showManagementButton: false,
  showStatsButton: false
})

const emit = defineEmits<{
  beforeNavigate: []
  afterNavigate: []
  navigationError: [error: Error]
}>()

const router = useRouter()
const isNavigating = ref(false)

const computedHeight = computed(() => {
  return typeof props.height === 'number' ? `${props.height}px` : props.height
})

// 导航方法
const goHome = async () => {
  if (isNavigating.value) return

  try {
    isNavigating.value = props.showHomeLoading
    emit('beforeNavigate')

    await router.push(props.homeButtonTo)

    emit('afterNavigate')
  } catch (error) {
    emit('navigationError', error as Error)

    // 备选方案：使用原生跳转
    window.location.href = props.homeButtonTo
  } finally {
    isNavigating.value = false
  }
}

// 导航到管理单词页面（新窗口）
const goManagement = () => {
  window.open('/management', '_blank')
}

// 导航到统计页面（新窗口）
const goStats = () => {
  window.open('/stats', '_blank')
}
</script>

<template>
  <header
    class="top-bar"
    :class="{ sticky: props.sticky }"
    :style="{
      background: props.background,
      height: computedHeight,
      borderBottom: props.border,
      padding: props.padding
    }"
  >
    <!-- 左侧区域 -->
    <div class="top-bar-section left">
      <!-- 内置返回首页按钮 -->
      <button
        v-if="props.showHomeButton"
        @click="goHome"
        class="home-button"
        :disabled="isNavigating"
      >
        <span v-if="!isNavigating">{{ props.homeButtonText }}</span>
        <span v-else class="loading-text">
          <span class="loading-dot"></span>
          返回中...
        </span>
      </button>

      <!-- 管理单词按钮 -->
      <button
        v-if="props.showManagementButton"
        @click="goManagement"
        class="icon-button"
        title="管理单词"
      >
        ➕
      </button>

      <!-- 查看统计按钮 -->
      <button
        v-if="props.showStatsButton"
        @click="goStats"
        class="icon-button"
        title="查看统计"
      >
        📈
      </button>

      <slot name="left" />
    </div>

    <!-- 中间区域 -->
    <div class="top-bar-section center">
      <slot name="center" />
      <slot v-if="!$slots.center" />
    </div>

    <!-- 右侧区域 -->
    <div class="top-bar-section right">
      <slot name="right" />
    </div>
  </header>
</template>

<style scoped>
.top-bar {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr; /* 三等分布局确保居中 */
  align-items: center;
  z-index: 10;
  width: 100%;
  box-sizing: border-box;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.top-bar.sticky {
  position: fixed;  /* 改为固定定位 */
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;   /* 提高层级确保在最上层 */
}

/* 左中右 */
.top-bar-section.left {
  justify-self: start;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0; /* 允许收缩 */
  overflow: visible; /* 允许内容溢出 */
}

.top-bar-section.center {
  justify-self: center;
  display: flex;
  align-items: center;
  justify-content: center; /* 确保内容居中 */
  gap: 8px;
  min-width: 0; /* 允许收缩 */
  overflow: hidden; /* 防止标题溢出 */
  text-overflow: ellipsis;
}

.top-bar-section.right {
  justify-self: end;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0; /* 允许收缩 */
  overflow: visible; /* 允许内容溢出 */
}

/* 内置返回首页按钮样式 */
.home-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  color: white;
  font: inherit;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: 6px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 76px;
  justify-content: center;
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
  /* 触摸优化 */
  touch-action: manipulation; /* 防止双击缩放 */
  user-select: none; /* 防止文本选择 */
  -webkit-tap-highlight-color: transparent; /* 移除点击高亮 */
}

/* 图标按钮样式 */
.icon-button {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(0, 0, 0, 0.1);
  color: #666;
  font-size: 16px;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 6px;
  transition: all 0.2s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  min-height: 32px;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  /* 触摸优化 */
  touch-action: manipulation;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.icon-button:hover {
  background: rgba(255, 255, 255, 1);
  border-color: rgba(102, 126, 234, 0.3);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.icon-button:active {
  transform: translateY(0);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.home-button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.4);
  background: linear-gradient(135deg, #7c8fef 0%, #8757a7 100%);
}

.home-button:active:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
}

.home-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

.loading-text {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.loading-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.5;
    transform: scale(0.8);
  }
}

/* 工具类样式（保持你的原样） */
:deep(.nav-link) {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #1677ff;
  text-decoration: none;
  font-size: 16px;
  font-weight: bold;
  transition: color 0.2s ease;
  /* 移动端文本优化 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

:deep(.nav-link:hover) {
  color: #4096ff;
}

:deep(.title) {
  font-weight: 600;
  font-size: 16px;
  color: #262626;
  /* 移动端文本优化 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%; /* 充分利用可用宽度 */
  text-align: center; /* 居中对齐 */
}

:deep(.subtitle) {
  font-size: 14px;
  color: #666;
  /* 移动端文本优化 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%; /* 充分利用可用宽度 */
  text-align: center; /* 居中对齐 */
}

:deep(.button) {
  padding: 4px 12px;
  border-radius: 6px;
  border: 1px solid #d9d9d9;
  background: #fff;
  color: #262626;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  /* 移动端按钮优化 */
  touch-action: manipulation;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}

:deep(.button:hover) {
  border-color: #4096ff;
  color: #4096ff;
}

:deep(.button.primary) {
  background: #1677ff;
  border-color: #1677ff;
  color: #fff;
}

:deep(.button.primary:hover) {
  background: #4096ff;
  border-color: #4096ff;
}

/* 移动端工具类样式适配 */
@media (max-width: 768px) {
  :deep(.nav-link) {
    font-size: 14px;
    gap: 3px;
  }

  :deep(.title) {
    font-size: 15px;
  }

  :deep(.subtitle) {
    font-size: 13px;
  }

  :deep(.button) {
    padding: 6px 10px;
    font-size: 13px;
    min-height: 36px;
  }

  /* 右侧进度文本优化 */
  :deep(.progress-text) {
    font-size: 12px;
    white-space: nowrap;
  }
}

@media (max-width: 480px) {
  :deep(.nav-link) {
    font-size: 13px;
    gap: 2px;
  }

  :deep(.title) {
    font-size: 14px;
  }

  :deep(.subtitle) {
    font-size: 12px;
  }

  :deep(.button) {
    padding: 6px 8px;
    font-size: 12px;
    min-height: 32px;
  }

  /* 小屏幕进度文本更紧凑 */
  :deep(.progress-text) {
    font-size: 11px;
  }
}

/* 深色主题适配 */
@media (prefers-color-scheme: dark) {
  .home-button {
    background: linear-gradient(135deg, #4c63d2 0%, #6b52a3 100%);
    box-shadow: 0 2px 8px rgba(76, 99, 210, 0.3);
  }

  .home-button:hover:not(:disabled) {
    background: linear-gradient(135deg, #5b72e0 0%, #7a61b2 100%);
    box-shadow: 0 4px 16px rgba(76, 99, 210, 0.4);
  }
}

/* 移动端适配 */
@media (max-width: 768px) {
  .top-bar {
    padding: 0 12px;
    height: auto !important;
    min-height: 44px; /* iOS 最小触摸目标 */
    grid-template-columns: 1fr 1fr 1fr; /* 保持三等分确保居中 */
  }

  .home-button {
    padding: 6px 10px;
    font-size: 12px;
    min-width: 68px;
    min-height: 32px; /* 确保触摸目标足够大 */
  }

  .icon-button {
    padding: 6px 8px;
    font-size: 15px;
    min-width: 32px;
    min-height: 32px;
  }

  /* 移动端特定的触摸反馈 */
  .home-button:active {
    background: linear-gradient(135deg, #5a6fd8 0%, #694b94 100%);
    transform: scale(0.98);
    box-shadow: 0 1px 4px rgba(102, 126, 234, 0.2);
  }

  .icon-button:active {
    transform: scale(0.95);
  }

  .top-bar-section.left,
  .top-bar-section.center,
  .top-bar-section.right {
    gap: 4px; /* 减少内部元素间距 */
  }

  /* 移动端各区域保持基本布局不变 */
  .top-bar-section.center {
    justify-content: center; /* 确保中间内容居中 */
  }
}

/* 小屏手机适配 */
@media (max-width: 480px) {
  .top-bar {
    padding: 0 8px;
    min-height: 48px; /* 更大的触摸目标 */
  }

  .home-button {
    padding: 6px 8px;
    font-size: 11px;
    min-width: 64px;
    min-height: 32px;
  }

  .icon-button {
    padding: 5px 7px;
    font-size: 14px;
    min-width: 30px;
    min-height: 30px;
  }

  .top-bar-section.left,
  .top-bar-section.center,
  .top-bar-section.right {
    gap: 4px;
  }

  /* 小屏幕上保持居中布局 */
  .top-bar-section.center {
    justify-content: center;
  }
}

/* 超小屏幕适配 */
@media (max-width: 360px) {
  .top-bar {
    padding: 0 6px;
  }

  .home-button {
    padding: 6px 10px;
    font-size: 11px;
    min-width: 64px;
  }

  .top-bar-section.left,
  .top-bar-section.center,
  .top-bar-section.right {
    gap: 2px;
  }
}

/* 平板适配 (769px - 1024px) */
@media (min-width: 769px) and (max-width: 1024px) {
  .top-bar {
    padding: 0 20px;
  }

  .home-button {
    padding: 6px 14px;
    font-size: 13px;
    min-width: 82px;
  }
}

/* 大屏幕适配 (1025px+) */
@media (min-width: 1025px) {
  .top-bar {
    padding: 0 24px;
  }

  .home-button {
    padding: 6px 12px;
    font-size: 13px;
    min-width: 80px;
  }
}

/* 横屏手机适配 */
@media (max-height: 500px) and (orientation: landscape) {
  .top-bar {
    min-height: 40px;
    padding: 0 16px;
  }

  .home-button {
    padding: 6px 14px;
    font-size: 13px;
    min-height: 28px;
  }

  .top-bar-section.left,
  .top-bar-section.center,
  .top-bar-section.right {
    gap: 6px;
  }
}

/* 无障碍支持 */
@media (prefers-reduced-motion: reduce) {
  .home-button {
    transition: none;
  }

  .home-button:hover:not(:disabled) {
    transform: none;
  }

  .loading-dot {
    animation: none;
  }

  .top-bar {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}

/* 高对比度模式支持 */
@media (prefers-contrast: high) {
  .home-button {
    background: #0066cc;
    border: 2px solid #ffffff;
  }

  .home-button:hover:not(:disabled) {
    background: #004499;
  }
}
</style>
