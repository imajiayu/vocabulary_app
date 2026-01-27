<template>
  <div class="speaking-index" :class="{ 'has-question': selectQuestion != null }">
    <!-- 欢迎页面 -->
    <div v-if="selectQuestion == null" class="welcome-message">
      <h1 class="title">你好！</h1>
      <h2 class="subtitle">
        <span
          v-for="(char, index) in subtitleChars"
          :key="index"
          class="char"
          :style="{ animationDelay: `${index * 0.08}s` }"
        >
          {{ char }}
        </span>
      </h2>
    </div>

    <!-- 练习页面 -->
    <QuestionPractice v-else :select-question="selectQuestion" />
  </div>
</template>

<script setup lang="ts">
import { Question } from '@/shared/types'
import { PropType } from 'vue'
import QuestionPractice from '@/features/speaking/components/QuestionPractice.vue'

const subtitle = '选择题目开始练习。'
const subtitleChars = subtitle.split('')

defineProps({
  selectQuestion: {
    type: Object as PropType<Question | null>,
    required: false
  }
})
</script>

<style scoped>
.speaking-index {
  width: 100%;
  max-width: 1200px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 1rem;
  box-sizing: border-box;
}

/* 选中题目后，取消居中，让内容铺满 */
.speaking-index.has-question {
  max-width: none;
  align-items: stretch;
  justify-content: flex-start;
  padding: 0;
}

.welcome-message {
  text-align: center;
}

.title {
  font-size: 50px;
  font-weight: 700;
  margin-bottom: 20px;
  color: var(--color-primary);
  letter-spacing: -0.02em;
}

.subtitle {
  font-size: 20px;
  font-weight: 500;
  white-space: nowrap;
  display: inline-block;
}

.char {
  display: inline-block;
  opacity: 0;
  animation: fadeInUp 0.4s forwards;
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* fadeIn animation defined in animations.css */

/* 移动端响应式适配 */
@media (max-width: 768px) {
  .speaking-index {
    padding: 0 1rem;
    align-items: center;
    justify-content: center;
  }

  .welcome-message {
    width: 100%;
    max-width: 400px;
  }

  .title {
    font-size: 2.5rem;
    margin-bottom: 1rem;
  }

  .subtitle {
    font-size: 1.125rem;
    white-space: normal;
    line-height: 1.5;
  }
}

/* 小屏手机进一步优化 */
@media (max-width: 480px) {
  .speaking-index {
    padding: 0 0.75rem;
  }

  .welcome-message {
    max-width: 320px;
  }

  .title {
    font-size: 2rem;
    margin-bottom: 0.875rem;
  }

  .subtitle {
    font-size: 1rem;
  }

  .char {
    /* 小屏幕上减少动画复杂度 */
    animation-duration: 0.3s;
  }
}

/* 横屏适配 */
@media (max-height: 500px) and (orientation: landscape) {
  .speaking-index {
    align-items: center;
    padding-top: 0;
  }

  .title {
    font-size: 2rem;
    margin-bottom: 0.5rem;
  }

  .subtitle {
    font-size: 0.875rem;
  }
}

/* 超宽屏适配 */
@media (min-width: 1440px) {
  .speaking-index {
    max-width: 1400px;
  }

  .title {
    font-size: 4rem;
    margin-bottom: 2rem;
  }

  .subtitle {
    font-size: 1.5rem;
  }
}
</style>