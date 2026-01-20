<template>
  <div class="loading-container">
    <div class="text-center">
      <div class="loading-spinner" style="width: 3rem; height: 3rem; margin: 0 auto 1rem;"></div>
      <p class="text-secondary">{{ text }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  text?: string
}

const props = withDefaults(defineProps<Props>(), {
  text: '加载中...'
})
</script>

<style scoped>
.loading-container {
  /* 填充父容器的可用空间 */
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 回退：当父容器没有 flex 布局时，使用最小高度 */
  min-height: 200px;
}
</style>
