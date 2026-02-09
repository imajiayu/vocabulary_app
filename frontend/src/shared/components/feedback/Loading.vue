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

withDefaults(defineProps<Props>(), {
  text: '加载中...'
})
</script>

<style scoped>
.loading-container {
  /* 填满可用空间并居中 */
  width: 100%;
  /* 使用 flex: 1 填满父容器，配合 min-height 确保有足够高度 */
  flex: 1;
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
