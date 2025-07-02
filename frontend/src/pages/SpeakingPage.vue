<template>
  <div class="speaking-studio" :class="{ 'has-question': selectQuestion != null }">
    <!-- 欢迎页面 - 深色主题 -->
    <div v-if="selectQuestion == null" class="welcome-stage">
      <div class="welcome-content">
        <!-- 装饰性麦克风图标 -->
        <div class="mic-visual">
          <div class="mic-glow"></div>
          <svg class="mic-icon" viewBox="0 0 24 24" fill="none">
            <rect x="9" y="2" width="6" height="12" rx="3" stroke="currentColor" stroke-width="1.5"/>
            <path d="M5 10V11C5 14.866 8.13401 18 12 18C15.866 18 19 14.866 19 11V10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M12 18V22" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <path d="M8 22H16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>

        <!-- 标题组 -->
        <div class="title-group">
          <h1 class="welcome-title">口语练习</h1>
          <div class="title-accent"></div>
        </div>

        <!-- 副标题 -->
        <p class="welcome-subtitle">
          <span
            v-for="(char, index) in subtitleChars"
            :key="index"
            class="char"
            :style="{ animationDelay: `${0.3 + index * 0.04}s` }"
          >{{ char === ' ' ? '\u00A0' : char }}</span>
        </p>

        <!-- 提示信息 -->
        <div class="welcome-hint">
          <svg class="hint-icon" viewBox="0 0 24 24" fill="none">
            <path d="M9 18L15 12L9 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>打开侧边栏选择题目</span>
        </div>
      </div>

      <!-- 背景装饰 -->
      <div class="welcome-decoration">
        <div class="deco-ring ring-1"></div>
        <div class="deco-ring ring-2"></div>
        <div class="deco-ring ring-3"></div>
      </div>
    </div>

    <!-- 练习页面 -->
    <QuestionPractice v-else :select-question="selectQuestion" />
  </div>
</template>

<script setup lang="ts">
import { Question } from '@/shared/types'
import { PropType } from 'vue'
import QuestionPractice from '@/features/speaking/components/QuestionPractice.vue'

const subtitle = '选择一个话题开始你的练习'
const subtitleChars = subtitle.split('')

defineProps({
  selectQuestion: {
    type: Object as PropType<Question | null>,
    required: false
  }
})
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   Speaking Studio - 深色工作室主题
   ═══════════════════════════════════════════════════════════════════════════ */

.speaking-studio {
  width: 100%;
  height: 100%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 温暖深色背景 - 如同专业录音棚 */
  background:
    /* 微妙的水平线纹理（声波效果） */
    repeating-linear-gradient(
      0deg,
      transparent,
      transparent 3px,
      rgba(184, 134, 11, 0.012) 3px,
      rgba(184, 134, 11, 0.012) 4px
    ),
    /* 主渐变：深琥珀/金色调 */
    linear-gradient(
      145deg,
      #1a1510 0%,
      #1f1a14 25%,
      #2a2218 50%,
      #1a1510 100%
    );
  position: relative;
  overflow: hidden;
  /* 隐藏滚动条 */
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.speaking-studio::-webkit-scrollbar {
  display: none;
}

/* 选中题目后，取消居中，让内容铺满 */
.speaking-studio.has-question {
  align-items: stretch;
  justify-content: flex-start;
}

/* 移动端：用负边距覆盖 main-container 的底部 padding，确保深色背景延伸到底部 */
@media (max-width: 768px) {
  .speaking-studio {
    /* 减去底部导航高度，避免与父容器 padding-bottom 叠加导致多余滚动 */
    min-height: calc(100dvh - var(--mobile-nav-height, 88px));
  }

  .speaking-studio.has-question {
    overflow-y: auto;
    height: calc(100dvh - var(--mobile-nav-height, 88px));
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   欢迎舞台
   ═══════════════════════════════════════════════════════════════════════════ */

.welcome-stage {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 40px;
}

.welcome-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 600px;
}

/* ── 麦克风视觉 ── */
.mic-visual {
  position: relative;
  margin-bottom: 40px;
}

.mic-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 160px;
  height: 160px;
  background: radial-gradient(
    circle,
    rgba(184, 134, 11, 0.15) 0%,
    rgba(184, 134, 11, 0.05) 40%,
    transparent 70%
  );
  border-radius: 50%;
  animation: glowPulse 3s ease-in-out infinite;
}

@keyframes glowPulse {
  0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
  50% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
}

.mic-icon {
  position: relative;
  width: 80px;
  height: 80px;
  color: var(--primitive-gold-400);
  filter: drop-shadow(0 4px 20px rgba(184, 134, 11, 0.3));
}

/* ── 标题组 ── */
.title-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 20px;
}

.welcome-title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 56px;
  font-weight: 600;
  letter-spacing: -0.02em;
  background: linear-gradient(
    135deg,
    var(--primitive-gold-400) 0%,
    var(--primitive-copper-400) 50%,
    var(--primitive-gold-500) 100%
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: 0 4px 30px rgba(184, 134, 11, 0.2);
}

.title-accent {
  width: 60px;
  height: 3px;
  margin-top: 16px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--primitive-gold-500) 50%,
    transparent 100%
  );
  border-radius: 2px;
}

/* ── 副标题 ── */
.welcome-subtitle {
  margin: 0 0 32px;
  font-family: var(--font-serif);
  font-size: 20px;
  font-weight: 400;
  color: var(--primitive-paper-400);
  letter-spacing: 0.02em;
}

.char {
  display: inline-block;
  opacity: 0;
  animation: charFadeIn 0.4s ease-out forwards;
}

@keyframes charFadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ── 提示信息 ── */
.welcome-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: rgba(184, 134, 11, 0.1);
  border: 1px solid rgba(184, 134, 11, 0.2);
  border-radius: var(--radius-full);
  animation: hintFadeIn 0.6s ease-out 1.5s forwards;
  opacity: 0;
}

@keyframes hintFadeIn {
  to { opacity: 1; }
}

.hint-icon {
  width: 16px;
  height: 16px;
  color: var(--primitive-gold-500);
  animation: hintArrow 1.5s ease-in-out infinite;
}

@keyframes hintArrow {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(4px); }
}

.welcome-hint span {
  font-family: var(--font-ui);
  font-size: 13px;
  font-weight: 500;
  color: var(--primitive-gold-400);
  letter-spacing: 0.02em;
}

/* ── 背景装饰 ── */
.welcome-decoration {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.deco-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  border: 1px solid rgba(184, 134, 11, 0.08);
  border-radius: 50%;
}

.ring-1 {
  width: 300px;
  height: 300px;
  animation: ringExpand 4s ease-in-out infinite;
}

.ring-2 {
  width: 450px;
  height: 450px;
  animation: ringExpand 4s ease-in-out infinite 1s;
}

.ring-3 {
  width: 600px;
  height: 600px;
  animation: ringExpand 4s ease-in-out infinite 2s;
}

@keyframes ringExpand {
  0%, 100% { opacity: 0.3; transform: translate(-50%, -50%) scale(1); }
  50% { opacity: 0.6; transform: translate(-50%, -50%) scale(1.05); }
}

/* ═══════════════════════════════════════════════════════════════════════════
   响应式适配
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .welcome-stage {
    padding: 24px;
  }

  .mic-visual {
    margin-bottom: 32px;
  }

  .mic-glow {
    width: 120px;
    height: 120px;
  }

  .mic-icon {
    width: 60px;
    height: 60px;
  }

  .welcome-title {
    font-size: 40px;
  }

  .title-accent {
    width: 48px;
    margin-top: 12px;
  }

  .welcome-subtitle {
    font-size: 16px;
    margin-bottom: 24px;
  }

  .welcome-hint {
    padding: 10px 16px;
  }

  .welcome-hint span {
    font-size: 12px;
  }

  .ring-1 { width: 200px; height: 200px; }
  .ring-2 { width: 300px; height: 300px; }
  .ring-3 { width: 400px; height: 400px; }
}

/* 横屏适配 */
@media (max-height: 500px) and (orientation: landscape) {
  .welcome-stage {
    padding: 16px;
  }

  .mic-visual {
    margin-bottom: 16px;
  }

  .mic-glow {
    width: 80px;
    height: 80px;
  }

  .mic-icon {
    width: 40px;
    height: 40px;
  }

  .welcome-title {
    font-size: 28px;
  }

  .title-accent {
    margin-top: 8px;
  }

  .welcome-subtitle {
    font-size: 14px;
    margin-bottom: 16px;
  }

  .welcome-decoration {
    display: none;
  }
}
</style>
