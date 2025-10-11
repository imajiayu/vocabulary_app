<template>
  <Transition name="slide-down">
    <div v-if="show" class="notification-container">
      <div class="notification-content">
        <div class="word-display">{{ word }}</div>
        <div class="param-info">
          <span class="param-label">{{ paramLabel }}</span>
          <span class="param-change" :class="changeClass">
            {{ formattedChange }}
          </span>
        </div>
        <div class="param-value-info">
          新值: {{ newParamValue.toFixed(2) }}
        </div>
        <div class="next-review">
          下次复习: {{ formattedDate }}
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  word: string
  paramType: 'ease_factor' | 'spell_strength'
  paramChange: number
  newParamValue: number
  nextReviewDate: string
  show?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  show: true
})

const paramLabel = computed(() => {
  return props.paramType === 'ease_factor' ? '难度系数' : '拼写强度'
})

const formattedChange = computed(() => {
  const sign = props.paramChange > 0 ? '+' : ''
  return `${sign}${props.paramChange.toFixed(2)}`
})

const changeClass = computed(() => {
  return props.paramChange > 0 ? 'positive' : 'negative'
})

const formattedDate = computed(() => {
  try {
    const date = new Date(props.nextReviewDate)
    return date.toLocaleDateString('zh-CN', {
      month: 'numeric',
      day: 'numeric'
    })
  } catch {
    return props.nextReviewDate
  }
})
</script>

<style scoped>
.notification-container {
  position: fixed;
  top: 60px;
  right: 20px;
  z-index: 9999;
  pointer-events: none;
}

.notification-content {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 12px 24px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 200px;
}

.word-display {
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.param-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.param-label {
  opacity: 0.9;
}

.param-change {
  font-weight: 700;
  font-size: 20px;
}

.param-change.positive {
  color: #52c41a;
}

.param-change.negative {
  color: #ff4d4f;
}

.param-value-info {
  font-size: 12px;
  opacity: 0.85;
}

.next-review {
  font-size: 12px;
  opacity: 0.85;
}

/* 过渡动画 */
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-down-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}

.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

/* 移动端适配 */
@media (max-width: 768px) {
  .notification-container {
    top: 52px;
  }

  .notification-content {
    padding: 10px 20px;
    min-width: auto;
    max-width: 90vw;
  }

  .word-display {
    font-size: 16px;
  }

  .param-info {
    font-size: 13px;
  }

  .param-change {
    font-size: 14px;
  }

  .next-review {
    font-size: 11px;
  }
}
</style>
