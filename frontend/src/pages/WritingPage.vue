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
   Writing Studio — "Midnight Scholar"
   ═══════════════════════════════════════════════════════════════════════════ */

.writing-studio {
  width: 100%;
  height: 100%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.015'/%3E%3C/svg%3E"),
    linear-gradient(175deg, #151921 0%, #1a1f2e 40%, #1c2333 100%);
  position: relative;
  overflow: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.writing-studio::-webkit-scrollbar {
  display: none;
}

.writing-studio.has-prompt {
  align-items: stretch;
  justify-content: flex-start;
}

@media (max-width: 768px) {
  .writing-studio {
    /* 减去底部导航高度，避免与父容器 padding-bottom 叠加导致多余滚动 */
    min-height: calc(100dvh - var(--mobile-nav-height, 88px));
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
  max-width: 520px;
}

/* ── 钢笔视觉 ── */
.pen-visual {
  position: relative;
  margin-bottom: 36px;
}

.pen-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 140px;
  height: 140px;
  background: radial-gradient(
    circle,
    rgba(221, 165, 32, 0.1) 0%,
    rgba(221, 165, 32, 0.03) 40%,
    transparent 70%
  );
  border-radius: 50%;
  animation: glowPulse 4s ease-in-out infinite;
}

@keyframes glowPulse {
  0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
  50% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
}

.pen-icon {
  position: relative;
  width: 64px;
  height: 64px;
  color: var(--primitive-gold-400);
  filter: drop-shadow(0 4px 16px rgba(221, 165, 32, 0.2));
}

/* ── 标题组 ── */
.title-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 18px;
}

.welcome-title {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 48px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: rgba(250, 247, 242, 0.92);
}

.title-accent {
  width: 48px;
  height: 2px;
  margin-top: 14px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--primitive-gold-400) 50%,
    transparent 100%
  );
  border-radius: 1px;
}

/* ── 副标题 ── */
.welcome-subtitle {
  margin: 0 0 32px;
  font-family: var(--font-serif);
  font-size: 18px;
  font-weight: 400;
  color: rgba(250, 247, 242, 0.35);
  letter-spacing: 0.04em;
}

.char {
  display: inline-block;
  opacity: 0;
  animation: charFadeIn 0.4s ease-out forwards;
}

@keyframes charFadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
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
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-full);
  animation: hintFadeIn 0.6s ease-out 1.5s forwards;
  opacity: 0;
}

@keyframes hintFadeIn {
  to { opacity: 1; }
}

.hint-icon {
  width: 14px;
  height: 14px;
  color: rgba(250, 247, 242, 0.35);
  animation: hintArrow 2s ease-in-out infinite;
}

@keyframes hintArrow {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(3px); }
}

.welcome-hint span {
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 500;
  color: rgba(250, 247, 242, 0.4);
  letter-spacing: 0.03em;
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
  border: 1px solid rgba(255, 255, 255, 0.03);
  border-radius: 50%;
}

.ring-1 {
  width: 280px;
  height: 280px;
  animation: ringExpand 5s ease-in-out infinite;
}

.ring-2 {
  width: 420px;
  height: 420px;
  animation: ringExpand 5s ease-in-out infinite 1.2s;
}

.ring-3 {
  width: 560px;
  height: 560px;
  animation: ringExpand 5s ease-in-out infinite 2.4s;
}

@keyframes ringExpand {
  0%, 100% { opacity: 0.4; transform: translate(-50%, -50%) scale(1); }
  50% { opacity: 0.8; transform: translate(-50%, -50%) scale(1.04); }
}

/* ═══════════════════════════════════════════════════════════════════════════
   响应式适配
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .welcome-stage {
    padding: 24px;
  }

  .pen-visual {
    margin-bottom: 28px;
  }

  .pen-glow {
    width: 100px;
    height: 100px;
  }

  .pen-icon {
    width: 52px;
    height: 52px;
  }

  .welcome-title {
    font-size: 36px;
  }

  .title-accent {
    width: 40px;
    margin-top: 10px;
  }

  .welcome-subtitle {
    font-size: 15px;
    margin-bottom: 24px;
  }

  .welcome-hint {
    padding: 9px 16px;
  }

  .welcome-hint span {
    font-size: 11px;
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

  .pen-visual {
    margin-bottom: 14px;
  }

  .pen-glow {
    width: 72px;
    height: 72px;
  }

  .pen-icon {
    width: 36px;
    height: 36px;
  }

  .welcome-title {
    font-size: 26px;
  }

  .title-accent {
    margin-top: 8px;
  }

  .welcome-subtitle {
    font-size: 13px;
    margin-bottom: 14px;
  }

  .welcome-decoration {
    display: none;
  }
}
</style>
