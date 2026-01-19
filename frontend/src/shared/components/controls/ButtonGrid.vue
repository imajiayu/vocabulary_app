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
  /* 桌面端：2列网格，compact按钮占0.5列，默认按钮占1列 */
  grid-template-columns: repeat(4, 1fr);
}

/* 平板适配 */
@media (max-width: 1024px) {
  .button-grid {
    /* 平板：2列网格 */
    grid-template-columns: repeat(2, 1fr);
    gap: 0.875rem;
  }

  .button-grid :deep(.compact-buttons-container),
  .button-grid :deep(.index-button--default) {
    /* 平板：容器和按钮都占1列 */
    grid-column: span 1;
  }
}

/* 移动端适配 */
@media (max-width: 768px) {
  .button-grid {
    /* 移动端：2列网格，compact按钮各占1列共一行 */
    grid-template-columns: repeat(2, 1fr);
    gap: 0.875rem;
  }
}

/* 小屏手机适配 */
@media (max-width: 480px) {
  .button-grid {
    /* 小屏：单列布局 */
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
}

/* 横屏适配 */
@media (max-height: 500px) and (orientation: landscape) {
  .button-grid {
    gap: 0.75rem;
  }
}

/* 超宽屏适配 */
@media (min-width: 1440px) {
  .button-grid {
    gap: 1.5rem;
  }
}

/* 子元素布局控制 */
.button-grid :deep(.compact-buttons-container) {
  /* 桌面端：compact按钮容器占2列 */
  grid-column: span 2;
}

.button-grid :deep(.index-button--default) {
  /* 桌面端：默认按钮占2列 */
  grid-column: span 2;
}


/* 小屏手机重置 */
@media (max-width: 480px) {
  .button-grid :deep(.compact-buttons-container),
  .button-grid :deep(.index-button--default) {
    /* 小屏：容器和按钮都占满整列 */
    grid-column: span 1;
  }
}
</style>