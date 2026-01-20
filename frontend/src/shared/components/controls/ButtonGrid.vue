<template>
  <div class="button-grid">
    <slot />
  </div>
</template>

<script setup lang="ts">
// 响应式网格组件，用于IndexButton布局
</script>

<style scoped>
.button-grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(4, 1fr);
}

/* 子元素布局控制 */
.button-grid :deep(.compact-buttons-container) {
  grid-column: span 2;
}

.button-grid :deep(.index-button--default) {
  grid-column: span 2;
}

/* 手机端适配 */
@media (max-width: 480px) {
  .button-grid {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .button-grid :deep(.compact-buttons-container),
  .button-grid :deep(.index-button--default) {
    grid-column: span 1;
  }
}

/* 横屏适配 */
@media (max-height: 500px) and (orientation: landscape) {
  .button-grid {
    gap: 0.75rem;
  }
}
</style>