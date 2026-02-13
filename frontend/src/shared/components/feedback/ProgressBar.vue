<template>
  <div 
    class="progress-bar-container"
    :style="containerStyle"
  >
    <div 
      class="progress-bar-fill"
      :style="fillStyle"
    ></div>
    <span 
      class="progress-text"
      :style="textStyle"
    >
      {{ displayText }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useBreakpoint } from '@/shared/composables/useBreakpoint'

interface Props {
  progress: number // 0-100
  width?: string | number
  height?: string | number
  backgroundColor?: string
  fillColor?: string
  textColor?: string
  showText?: boolean
  text?: string
  animated?: boolean
  borderRadius?: string
}

const props = withDefaults(defineProps<Props>(), {
  progress: 0,
  width: '160px',
  height: '20px',
  backgroundColor: 'var(--color-bg-tertiary)',
  fillColor: 'var(--color-primary)',
  textColor: 'var(--color-text-primary)',
  showText: true,
  animated: true,
  borderRadius: '10px'
})

const normalizedProgress = computed(() => {
  return Math.max(0, Math.min(100, props.progress))
})

const containerStyle = computed(() => {
  const width = typeof props.width === 'number' ? `${props.width}px` : props.width
  const height = typeof props.height === 'number' ? `${props.height}px` : props.height
  
  return {
    width,
    height,
    backgroundColor: props.backgroundColor,
    borderRadius: props.borderRadius
  }
})

const fillStyle = computed(() => {
  return {
    width: `${normalizedProgress.value}%`,
    backgroundColor: props.fillColor,
    borderRadius: props.borderRadius,
    transition: props.animated ? 'width 0.3s ease' : 'none'
  }
})

const { isMobile } = useBreakpoint()

const textStyle = computed(() => {
  const baseHeight = parseInt(props.height?.toString() || '20')
  let fontSize = Math.max(10, baseHeight * 0.6)

  // 移动端字体大小调整
  if (isMobile.value) {
    fontSize = Math.max(10, Math.min(fontSize, 12))
  }

  return {
    color: props.textColor,
    fontSize: `${fontSize}px`
  }
})

const displayText = computed(() => {
  if (!props.showText) return ''
  if (props.text) return props.text
  return `${Math.round(normalizedProgress.value)}%`
})
</script>

<style scoped>
.progress-bar-container {
  position: relative;
  overflow: hidden;
  display: inline-block;
  min-width: 80px; /* 确保最小宽度 */
}

.progress-bar-fill {
  height: 100%;
  min-width: 0;
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-weight: 600;
  white-space: nowrap;
  pointer-events: none;
  z-index: 1;
  text-align: center;
  line-height: 1;
  margin: 0;
  padding: 0;
}

/* 预设样式 */
.progress-bar-container.success .progress-bar-fill {
  background: var(--color-secondary);
}

.progress-bar-container.warning .progress-bar-fill {
  background: var(--color-warning);
}

.progress-bar-container.danger .progress-bar-fill {
  background: var(--color-danger);
}

.progress-bar-container.info .progress-bar-fill {
  background: var(--color-primary);
}

/* 条纹动画效果 */
.progress-bar-container.striped .progress-bar-fill {
  background-image: linear-gradient(
    45deg,
    rgba(255, 255, 255, 0.15) 25%,
    transparent 25%,
    transparent 50%,
    rgba(255, 255, 255, 0.15) 50%,
    rgba(255, 255, 255, 0.15) 75%,
    transparent 75%,
    transparent
  );
  background-size: 1rem 1rem;
}

.progress-bar-container.striped.animated .progress-bar-fill {
  animation: progress-bar-stripes 1s linear infinite;
}

@keyframes progress-bar-stripes {
  0% {
    background-position-x: 1rem;
  }
}

/* 脉冲效果 */
.progress-bar-container.pulse .progress-bar-fill {
  animation: progress-pulse 1.5s ease-in-out infinite;
}

@keyframes progress-pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
  100% {
    opacity: 1;
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .progress-bar-container {
    width: 120px !important;
    height: 18px !important;
    min-width: 120px;
  }

  .progress-text {
    font-size: 11px !important;
    /* 移动端确保完美居中 */
    top: 50% !important;
    left: 50% !important;
    transform: translate(-50%, -50%) !important;
    margin: 0 !important;
    padding: 0 !important;
    text-align: center !important;
    line-height: 1 !important;
    /* 清除可能的干扰样式 */
    width: auto !important;
    height: auto !important;
    display: inline !important;
  }
}

@media (max-width: 768px) {
  .progress-bar-container {
    width: 100px !important;
    height: 16px !important;
    min-width: 100px;
  }

  .progress-text {
    font-size: 10px !important;
    /* 小屏幕设备额外确保居中 */
    top: 50% !important;
    left: 50% !important;
    transform: translate(-50%, -50%) !important;
  }
}
</style>