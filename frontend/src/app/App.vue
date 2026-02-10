<template>
  <div id="app">
    <!-- 路由出口：带页面过渡动画和懒加载骨架屏 -->
    <RouterView v-slot="{ Component, route }">
      <template v-if="Component">
        <Transition :name="transitionName" mode="out-in">
          <Suspense>
            <template #default>
              <component :is="Component" :key="route.path" />
            </template>
            <template #fallback>
              <div class="page-loading">
                <div class="page-loading-content">
                  <BaseSkeleton width="200px" height="32px" />
                  <BaseSkeleton width="100%" height="120px" />
                  <BaseSkeleton width="80%" height="20px" />
                  <BaseSkeleton width="60%" height="20px" />
                </div>
              </div>
            </template>
          </Suspense>
        </Transition>
      </template>
    </RouterView>

    <!-- 全局 Toast 通知容器 -->
    <ToastContainer ref="toastRef" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ToastContainer, BaseSkeleton } from '@/shared/components/base'

const toastRef = ref<InstanceType<typeof ToastContainer> | null>(null)

// 页面过渡动画
const router = useRouter()
const transitionName = ref('page-fade')

// 根据路由深度决定动画方向
router.beforeEach((to, from) => {
  const toDepth = (to.meta.depth as number) ?? to.path.split('/').length
  const fromDepth = (from.meta.depth as number) ?? from.path.split('/').length

  if (toDepth > fromDepth) {
    // 进入更深层级 - 向左滑动
    transitionName.value = 'page-slide-left'
  } else if (toDepth < fromDepth) {
    // 返回上一层级 - 向右滑动
    transitionName.value = 'page-slide-right'
  } else {
    // 同级切换 - 淡入淡出
    transitionName.value = 'page-fade'
  }
})
</script>

<style>
/* 基础样式 - 允许页面自然滚动 */
html, body {
  height: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  /* 允许页面自然滚动，滚动条在最右边 */
  overflow-x: hidden;
  overflow-y: auto;
}

body {
  /* 禁止过度滚动的弹性效果，但不禁止正常滚动 */
  overscroll-behavior-y: contain;
}

#app {
  font-family: var(--font-serif);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  /* 让内容自然撑开 */
  min-height: 100vh;
  min-height: 100dvh;
  position: relative;
}

/* 页面加载骨架屏 */
.page-loading {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: var(--space-8, 32px);
  background: var(--color-bg-primary);
}

.page-loading-content {
  width: 100%;
  max-width: 800px;
  display: flex;
  flex-direction: column;
  gap: var(--space-4, 16px);
  padding-top: var(--space-16, 64px);
}
</style>
