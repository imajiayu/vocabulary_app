<template>
  <div
    class="chart-grid-masonry"
    :style="{ 
      '--min-chart-width': `${minChartWidth}px`,
      '--grid-gap': `${gap}px`
    }"
  >
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  // 每个图表的最小宽度
  minWidth?: number
  // 网格间隙
  gap?: number
}

const props = defineProps<Props>()

// 默认最小宽度为280px，间隙为16px
const minChartWidth = computed(() => props.minWidth ?? 280)
const gap = computed(() => props.gap ?? 16)
</script>

<style scoped>
.chart-grid-masonry {
  display: grid;
  gap: var(--grid-gap);
  width: 100%;

  /* 响应式列数配置 */
  grid-template-columns: repeat(auto-fit, minmax(var(--min-chart-width), 1fr));

  /* 移除 aspect-ratio 冲突，使用 min-height 替代 */
  grid-auto-rows: minmax(280px, auto);

  /* 启用密集打包算法，让项目尽可能填满空隙 */
  grid-auto-flow: row dense;

  /* 确保网格容器有足够高度 */
  align-items: stretch;
}

/* 为子元素提供长宽比和高度支持 */
.chart-grid-masonry > :deep(.chart-card) {
  /* 默认占用1列1行 */
  grid-column: span 1;
  grid-row: span 1;
  
  /* 移除 aspect-ratio，改用 min-height */
  min-height: 280px;
  height: auto;
  
  /* 确保内容能够正确填充 */
  display: flex;
  flex-direction: column;
  
  /* 让卡片内容完全填充 */
  overflow: hidden;
}

/* 正方形卡片 */
.chart-grid-masonry > :deep(.chart-card.square) {
  min-height: 320px;
}

/* 长方形卡片 - 横向 */
.chart-grid-masonry > :deep(.chart-card.landscape) {
  min-height: 240px;
}

/* 长方形卡片 - 竖向 */
.chart-grid-masonry > :deep(.chart-card.portrait) {
  min-height: 400px;
}

/* 超宽卡片 */
.chart-grid-masonry > :deep(.chart-card.ultra-wide) {
  min-height: 200px;
}

/* 自定义高度支持 */
.chart-grid-masonry > :deep(.chart-card[data-height="small"]) {
  min-height: 200px;
}

.chart-grid-masonry > :deep(.chart-card[data-height="medium"]) {
  min-height: 300px;
}

.chart-grid-masonry > :deep(.chart-card[data-height="large"]) {
  min-height: 400px;
}

.chart-grid-masonry > :deep(.chart-card[data-height="extra-large"]) {
  min-height: 500px;
}

.chart-grid-masonry > :deep(.chart-card[data-width="full"]) {
  grid-column: 1 / -1; /* 横跨所有列 */
  height: auto;        /* 自适应高度 */
  min-height: 0 !important;       /* 完全移除最小高度限制，使用!important提高优先级 */
  align-self: start;   /* 不拉伸以填充grid行，使用内容的实际高度 */
  display: flex;
  flex-direction: column;
  overflow: visible;   /* 确保内容不被裁剪 */
}

/* 响应式断点 - 中等屏幕 */
@media (min-width: 481px) {
  .chart-grid-masonry {
    /* 在中等屏幕上使用更灵活的网格 */
    grid-template-columns: repeat(auto-fit, minmax(calc(var(--min-chart-width) * 0.85), 1fr));
    grid-auto-rows: minmax(260px, auto);
  }
  
  /* 宽图表占用2列 */
  .chart-grid-masonry > :deep(.chart-card[data-width="wide"]) {
    grid-column: span 2;
    min-height: 260px;
  }
  
  /* 高图表占用更多高度 */
  .chart-grid-masonry > :deep(.chart-card[data-height="tall"]) {
    min-height: 380px;
  }
  
  /* 大图表占用2x2 */
  .chart-grid-masonry > :deep(.chart-card[data-size="large"]) {
    grid-column: span 2;
    min-height: 400px;
  }
}

/* 响应式断点 - 大屏幕 */
@media (min-width: 1200px) {
  .chart-grid-masonry {
    /* 超大屏幕允许更多列 */
    grid-template-columns: repeat(auto-fit, minmax(calc(var(--min-chart-width) * 0.75), 1fr));
    grid-auto-rows: minmax(240px, auto);
  }
  
  /* 在超大屏幕上，某些图表可以占用3列 */
  .chart-grid-masonry > :deep(.chart-card[data-width="extra-wide"]) {
    grid-column: span 3;
    min-height: 220px;
  }
  
  .chart-grid-masonry > :deep(.chart-card[data-size="large"]) {
    grid-column: span 2;
    min-height: 360px;
  }
}

/* 手机端优化 */
@media (max-width: 480px) {
  .chart-grid-masonry {
    grid-template-columns: 1fr;
    grid-auto-rows: minmax(300px, auto);
  }
  
  .chart-grid-masonry > :deep(.chart-card) {
    grid-column: span 1;
    min-height: 300px;
  }

  .chart-grid-masonry > :deep(.chart-card.portrait) {
    min-height: 350px;
  }

  /* 移动端热力图特殊处理 */
  .chart-grid-masonry > :deep(.chart-card[data-width="full"]) {
    min-height: 0 !important; /* 覆盖移动端的默认最小高度 */
    height: auto !important;
    overflow: visible !important; /* 确保内容不被裁剪 */
  }

  .chart-grid-masonry > :deep(.chart-card[data-width="full"]) .echart.heatmap {
    flex: none !important;
    /* 移除 height: auto，允许组件通过 inline style 设置高度 */
    min-height: 0 !important;
    overflow: visible !important;
  }
}

/* 确保图表内容正确缩放和填充 */
.chart-grid-masonry > :deep(.chart-card) > h2 {
  flex-shrink: 0;
  margin-bottom: 0.8em;
}

.chart-grid-masonry > :deep(.chart-card) > *:not(h2) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* 热力图容器不使用flex拉伸，使用自己的高度 */
.chart-grid-masonry > :deep(.chart-card[data-width="full"]) > *:not(h2) {
  flex: none;
  display: block; /* 不使用flex布局，避免干扰高度计算 */
  min-height: 0; /* 移除任何最小高度限制 */
}

/* 确保 ECharts 容器填充剩余空间 */
.chart-grid-masonry > :deep(.chart-card) .echart {
  flex: 1 !important;
  width: 100% !important;
  height: 100% !important;
  min-height: 200px !important;
  /* 确保 ECharts 实例能正确获取容器尺寸 */
  position: relative;
}

/* 热力图的echart容器需要排除通用最小高度限制 */
.chart-grid-masonry > :deep(.chart-card) .echart.heatmap {
  min-height: 0 !important; /* 覆盖通用echart的min-height */
  height: unset !important; /* 移除 height: 100% 限制，允许 inline style 生效 */
}

/* HeatMap 特殊处理：使用自定义高度 */
.chart-grid-masonry > :deep(.chart-card[data-width="full"]) .echart.heatmap {
  flex: none !important;  /* 不使用 flex 拉伸 */
  min-height: 0 !important; /* 移除最小高度限制 */
}

/* 特殊处理 LineChart 的响应式问题 */
.chart-grid-masonry > :deep(.chart-card.landscape) .echart,
.chart-grid-masonry > :deep(.chart-card.ultra-wide) .echart {
  /* 确保在小屏幕下不被截断 */
  max-width: 100%;
  overflow: visible;
}
</style>