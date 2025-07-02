<template>
  <div
    :class="['skeleton', `skeleton--${variant}`]"
    :style="skeletonStyle"
    role="status"
    aria-busy="true"
    aria-label="加载中"
  >
    <span class="sr-only">加载中...</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  /** 形状变体 */
  variant?: 'text' | 'circular' | 'rectangular'
  /** 宽度（支持数字或字符串） */
  width?: string | number
  /** 高度（支持数字或字符串） */
  height?: string | number
  /** 自定义圆角 */
  borderRadius?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'text'
})

const skeletonStyle = computed(() => ({
  width: typeof props.width === 'number' ? `${props.width}px` : props.width,
  height: typeof props.height === 'number' ? `${props.height}px` : props.height,
  borderRadius: props.borderRadius
}))
</script>

<style scoped>
.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-bg-tertiary) 25%,
    var(--color-bg-secondary) 50%,
    var(--color-bg-tertiary) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.skeleton--text {
  height: 1em;
  border-radius: var(--radius-xs);
}

.skeleton--circular {
  border-radius: 50%;
}

.skeleton--rectangular {
  border-radius: var(--radius-default);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
</style>
