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
/* iOS Safari 滚动条修复 */
html, body {
  height: 100%;
  overflow-x: hidden;
  /* iOS Safari 视口高度修复 */
  min-height: 100vh;
  min-height: -webkit-fill-available;
}

body {
  /* iOS Safari 弹性滚动和滚动条隐藏 */
  -webkit-overflow-scrolling: touch;
  overflow-scrolling: touch;
  overscroll-behavior-y: none;
}

#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  /* 容器高度修复 */
  min-height: 100vh;
  min-height: -webkit-fill-available;
  overflow-x: hidden;
  position: relative;
}

/* iOS Safari 特定修复 */
@supports (-webkit-touch-callout: none) {
  #app {
    height: -webkit-fill-available;
  }
}
</style>