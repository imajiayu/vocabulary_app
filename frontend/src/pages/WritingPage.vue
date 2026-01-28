<template>
  <div class="writing-studio" :class="{ 'has-prompt': selectedPrompt != null }">
    <!-- 欢迎页面 - 深色主题 -->
    <div v-if="selectedPrompt == null" class="welcome-stage">
      <div class="welcome-content">
        <!-- 装饰性钢笔图标 -->
        <div class="pen-visual">
          <div class="pen-glow"></div>
          <svg class="pen-icon" viewBox="0 0 24 24" fill="none">
            <path d="M12 19L19 12L22 15L15 22L12 19Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
            <path d="M18 13L16.5 5.5L2 2L5.5 16.5L13 18L18 13Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
            <path d="M2 2L9.586 9.586" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <circle cx="11" cy="11" r="2" stroke="currentColor" stroke-width="1.5"/>
          </svg>
        </div>

        <!-- 标题组 -->
        <div class="title-group">
          <h1 class="welcome-title">写作练习</h1>
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

    <!-- 写作工作区 -->
    <WritingWorkspace
      v-else
      :prompt="selectedPrompt"
    />
  </div>
</template>

<script setup lang="ts">
import type { WritingPrompt } from '@/shared/types/writing'
import { PropType } from 'vue'
import WritingWorkspace from '@/features/writing/components/WritingWorkspace.vue'

const subtitle = '选择一个题目开始你的写作练习'
const subtitleChars = subtitle.split('')

defineProps({
  selectedPrompt: {
    type: Object as PropType<WritingPrompt | null>,
    required: false,
    default: null
  }
})
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   Writing Studio - 深色工作室主题
   ═══════════════════════════════════════════════════════════════════════════ */

.writing-studio {
  width: 100%;
  height: 100%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 深邃蓝色背景 - 如同午夜写作台 */
  background:
    /* 微妙的对角线纹理 */
    repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 1px,
      rgba(59, 130, 246, 0.015) 1px,
      rgba(59, 130, 246, 0.015) 2px
    ),
    /* 主渐变：深蓝墨水色调 */
    linear-gradient(
      155deg,
      #0f172a 0%,
      #1e293b 30%,
      #1e3a5f 60%,
      #0f172a 100%
    );
  position: relative;
  overflow: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.writing-studio::-webkit-scrollbar {
  display: none;
}

/* 选中题目后，取消居中，让内容铺满 */
.writing-studio.has-prompt {
  align-items: stretch;
  justify-content: flex-start;
}

/* 移动端：用负边距覆盖 main-container 的底部 padding，确保深色背景延伸到底部 */
@media (max-width: 768px) {
  .writing-studio {
    margin-bottom: calc(-88px - env(safe-area-inset-bottom));
    padding-bottom: calc(88px + env(safe-area-inset-bottom));
  }

  .writing-studio.has-prompt {
    overflow-y: auto;
    height: auto;
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

/* ── 钢笔视觉 ── */
.pen-visual {
  position: relative;
  margin-bottom: 40px;
}

.pen-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 160px;
  height: 160px;
  background: radial-gradient(
    circle,
    rgba(59, 130, 246, 0.15) 0%,
    rgba(59, 130, 246, 0.05) 40%,
    transparent 70%
  );
  border-radius: 50%;
  animation: glowPulse 3s ease-in-out infinite;
}

@keyframes glowPulse {
  0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.8; }
  50% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
}

.pen-icon {
  position: relative;
  width: 80px;
  height: 80px;
  color: var(--primitive-azure-400);
  filter: drop-shadow(0 4px 20px rgba(59, 130, 246, 0.3));
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
    var(--primitive-azure-400) 0%,
    var(--primitive-azure-500) 50%,
    var(--primitive-azure-600) 100%
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: 0 4px 30px rgba(59, 130, 246, 0.2);
}

.title-accent {
  width: 60px;
  height: 3px;
  margin-top: 16px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--primitive-azure-500) 50%,
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
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
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
  color: var(--primitive-azure-500);
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
  color: var(--primitive-azure-400);
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
  border: 1px solid rgba(59, 130, 246, 0.08);
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

  .pen-visual {
    margin-bottom: 32px;
  }

  .pen-glow {
    width: 120px;
    height: 120px;
  }

  .pen-icon {
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

@media (max-width: 480px) {
  .welcome-stage {
    padding: 20px;
  }

  .pen-visual {
    margin-bottom: 24px;
  }

  .pen-glow {
    width: 100px;
    height: 100px;
  }

  .pen-icon {
    width: 48px;
    height: 48px;
  }

  .welcome-title {
    font-size: 32px;
  }

  .title-accent {
    width: 40px;
    height: 2px;
  }

  .welcome-subtitle {
    font-size: 14px;
    margin-bottom: 20px;
    padding: 0 12px;
  }

  .char {
    animation-duration: 0.3s;
  }

  .welcome-hint {
    padding: 8px 14px;
  }

  .hint-icon {
    width: 14px;
    height: 14px;
  }

  .welcome-hint span {
    font-size: 11px;
  }
}

/* 横屏适配 */
@media (max-height: 500px) and (orientation: landscape) {
  .welcome-stage {
    padding: 16px;
  }

  .pen-visual {
    margin-bottom: 16px;
  }

  .pen-glow {
    width: 80px;
    height: 80px;
  }

  .pen-icon {
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
