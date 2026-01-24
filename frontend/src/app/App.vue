<template>
  <div id="app">
    <!-- 路由出口：路由匹配到的组件将渲染在这里 -->
    <RouterView />
  </div>
</template>

<script setup lang="ts">
// 如果需要全局逻辑可以在这里添加
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
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  /* 让内容自然撑开 */
  min-height: 100vh;
  min-height: 100dvh;
  position: relative;
}
</style>