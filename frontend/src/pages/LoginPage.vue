<template>
  <div class="login-page">
    <!-- 装饰性背景元素 -->
    <div class="bg-ornaments">
      <div class="ornament ornament--top-left"></div>
      <div class="ornament ornament--top-right"></div>
      <div class="ornament ornament--bottom-left"></div>
      <div class="ornament ornament--bottom-right"></div>
    </div>

    <!-- 书籍封面式登录卡片 -->
    <div class="book-cover" :class="{ 'is-loading': loading }">
      <!-- 封面装饰边框 -->
      <div class="cover-frame">
        <div class="frame-corner frame-corner--tl"></div>
        <div class="frame-corner frame-corner--tr"></div>
        <div class="frame-corner frame-corner--bl"></div>
        <div class="frame-corner frame-corner--br"></div>
      </div>

      <!-- 封面内容 -->
      <div class="cover-content">
        <!-- 顶部装饰线 -->
        <div class="decorative-rule decorative-rule--top">
          <span class="rule-flourish"><AppIcon name="flourish" /></span>
        </div>

        <!-- 品牌标题 -->
        <div class="brand">
          <div class="brand-emblem">
            <svg class="emblem-icon" viewBox="0 0 24 24" fill="none">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" stroke-width="1.5"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" stroke-width="1.5"/>
              <path d="M8 7h8M8 11h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </div>
          <h1 class="brand-title">IELTS</h1>
          <div class="brand-divider">
            <span class="divider-line"></span>
            <span class="divider-dot"></span>
            <span class="divider-line"></span>
          </div>
          <p class="brand-subtitle">备考</p>
        </div>

        <!-- 副标题 -->
        <p class="tagline">AI 驱动的雅思备考系统</p>

        <!-- 分隔装饰 -->
        <div class="section-divider">
          <span class="divider-ornament"><AppIcon name="sparkle" /></span>
        </div>

        <!-- Google 登录按钮 -->
        <button
          class="sign-in-btn"
          :class="{ 'is-loading': loading === 'google' }"
          :disabled="loading !== null"
          @click="handleGoogleLogin"
        >
          <span class="btn-content">
            <!-- 加载指示器 -->
            <span v-if="loading === 'google'" class="loading-spinner">
              <svg class="spinner-svg" viewBox="0 0 24 24" width="18" height="18">
                <circle class="spinner-track" cx="12" cy="12" r="10" fill="none" stroke-width="2"/>
                <circle class="spinner-head" cx="12" cy="12" r="10" fill="none" stroke-width="2"/>
              </svg>
            </span>
            <!-- Google 图标 -->
            <svg v-else class="google-icon" viewBox="0 0 24 24" width="18" height="18">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span class="btn-text">{{ loading === 'google' ? '登录中...' : '使用 Google 账号登录' }}</span>
          </span>
          <span class="btn-shimmer"></span>
        </button>

        <!-- 分隔线 -->
        <div class="auth-divider">
          <span class="auth-divider-line"></span>
          <span class="auth-divider-text">或</span>
          <span class="auth-divider-line"></span>
        </div>

        <!-- GitHub 登录按钮 -->
        <button
          class="sign-in-btn"
          :class="{ 'is-loading': loading === 'github' }"
          :disabled="loading !== null"
          @click="handleGitHubLogin"
        >
          <span class="btn-content">
            <!-- 加载指示器 -->
            <span v-if="loading === 'github'" class="loading-spinner">
              <svg class="spinner-svg" viewBox="0 0 24 24" width="18" height="18">
                <circle class="spinner-track" cx="12" cy="12" r="10" fill="none" stroke-width="2"/>
                <circle class="spinner-head" cx="12" cy="12" r="10" fill="none" stroke-width="2"/>
              </svg>
            </span>
            <!-- GitHub 图标 -->
            <svg v-else class="github-icon" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            <span class="btn-text">{{ loading === 'github' ? '登录中...' : '使用 GitHub 账号登录' }}</span>
          </span>
          <span class="btn-shimmer"></span>
        </button>

        <!-- 错误消息 -->
        <Transition name="error-fade">
          <p v-if="errorMsg" class="error-msg">
            <svg class="error-icon" viewBox="0 0 20 20" fill="currentColor" width="14" height="14">
              <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
            </svg>
            {{ errorMsg }}
          </p>
        </Transition>

        <!-- 底部装饰线 -->
        <div class="decorative-rule decorative-rule--bottom">
          <span class="rule-flourish"><AppIcon name="flourish" /></span>
        </div>
      </div>

      <!-- 书脊效果 -->
      <div class="book-spine"></div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuth } from '@/shared/composables/useAuth'
import AppIcon from '@/shared/components/controls/Icons.vue'

const { signInWithGoogle, signInWithGitHub } = useAuth()

const loading = ref<'google' | 'github' | null>(null)
const errorMsg = ref('')

async function handleGoogleLogin() {
  loading.value = 'google'
  errorMsg.value = ''
  try {
    await signInWithGoogle()
  } catch (e: unknown) {
    errorMsg.value = e instanceof Error ? e.message : '登录失败，请重试'
    loading.value = null
  }
}

async function handleGitHubLogin() {
  loading.value = 'github'
  errorMsg.value = ''
  try {
    await signInWithGitHub()
  } catch (e: unknown) {
    errorMsg.value = e instanceof Error ? e.message : '登录失败，请重试'
    loading.value = null
  }
}
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   登录页 - 书籍封面风格
   灵感：精装书封面、古典藏书票、学术期刊扉页
   ═══════════════════════════════════════════════════════════════════════════ */

.login-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;
  position: relative;
  overflow: hidden;

  /* 纸张纹理背景 */
  background:
    /* 细微噪点 */
    url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E"),
    /* 渐变底色 */
    radial-gradient(ellipse at 30% 20%, rgba(255, 253, 247, 0.9) 0%, transparent 50%),
    radial-gradient(ellipse at 70% 80%, rgba(245, 230, 211, 0.6) 0%, transparent 50%),
    var(--primitive-paper-200);
  background-blend-mode: soft-light, normal, normal, normal;
}

/* ── 背景装饰元素 ── */
.bg-ornaments {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.ornament {
  position: absolute;
  width: 120px;
  height: 120px;
  opacity: 0.04;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cpath d='M50 5 L95 50 L50 95 L5 50 Z' fill='none' stroke='%23996B3D' stroke-width='1'/%3E%3Ccircle cx='50' cy='50' r='20' fill='none' stroke='%23996B3D' stroke-width='1'/%3E%3C/svg%3E");
  background-size: contain;
  animation: float 20s ease-in-out infinite;
}

.ornament--top-left {
  top: 5%;
  left: 5%;
  animation-delay: 0s;
}

.ornament--top-right {
  top: 10%;
  right: 8%;
  width: 80px;
  height: 80px;
  animation-delay: -5s;
}

.ornament--bottom-left {
  bottom: 15%;
  left: 10%;
  width: 60px;
  height: 60px;
  animation-delay: -10s;
}

.ornament--bottom-right {
  bottom: 8%;
  right: 5%;
  animation-delay: -15s;
}

@keyframes float {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  50% { transform: translateY(-10px) rotate(3deg); }
}

/* ═══════════════════════════════════════════════════════════════════════════
   书籍封面卡片
   ═══════════════════════════════════════════════════════════════════════════ */

.book-cover {
  position: relative;
  width: 100%;
  max-width: 380px;
  background:
    linear-gradient(135deg, rgba(255, 253, 247, 0.95) 0%, rgba(250, 247, 242, 0.98) 100%);
  border-radius: 4px 12px 12px 4px;
  box-shadow:
    /* 页面阴影 */
    -3px 0 0 var(--primitive-paper-300),
    -6px 0 0 var(--primitive-paper-400),
    /* 主阴影 */
    0 8px 32px rgba(139, 105, 20, 0.12),
    0 2px 8px rgba(0, 0, 0, 0.06),
    /* 内阴影（凹陷感） */
    inset 0 0 60px rgba(139, 105, 20, 0.03);
  padding: 48px 40px;
  text-align: center;
  transform-origin: left center;
  transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1;
}

.book-cover:hover {
  transform: perspective(1000px) rotateY(-2deg);
}

.book-cover.is-loading {
  pointer-events: none;
}

/* ── 书脊效果 ── */
.book-spine {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 8px;
  background:
    linear-gradient(90deg,
      var(--primitive-copper-400) 0%,
      var(--primitive-copper-300) 30%,
      var(--primitive-gold-400) 50%,
      var(--primitive-copper-300) 70%,
      var(--primitive-copper-400) 100%
    );
  border-radius: 4px 0 0 4px;
  box-shadow:
    inset -2px 0 4px rgba(0, 0, 0, 0.15),
    2px 0 8px rgba(139, 105, 20, 0.1);
}

/* ── 封面装饰边框 ── */
.cover-frame {
  position: absolute;
  inset: 16px;
  border: 1px solid var(--primitive-copper-200);
  border-radius: 2px;
  pointer-events: none;
}

.frame-corner {
  position: absolute;
  width: 24px;
  height: 24px;
  border-color: var(--primitive-copper-400);
  border-style: solid;
  border-width: 0;
}

.frame-corner--tl {
  top: -1px;
  left: -1px;
  border-top-width: 2px;
  border-left-width: 2px;
}

.frame-corner--tr {
  top: -1px;
  right: -1px;
  border-top-width: 2px;
  border-right-width: 2px;
}

.frame-corner--bl {
  bottom: -1px;
  left: -1px;
  border-bottom-width: 2px;
  border-left-width: 2px;
}

.frame-corner--br {
  bottom: -1px;
  right: -1px;
  border-bottom-width: 2px;
  border-right-width: 2px;
}

/* ═══════════════════════════════════════════════════════════════════════════
   封面内容
   ═══════════════════════════════════════════════════════════════════════════ */

.cover-content {
  position: relative;
  z-index: 1;
}

/* ── 装饰线条 ── */
.decorative-rule {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
  color: var(--primitive-copper-400);
}

.decorative-rule--top {
  margin-bottom: 24px;
}

.decorative-rule--bottom {
  margin-top: 24px;
}

.rule-flourish {
  display: inline-flex;
  align-items: center;
  opacity: 0.6;
  transform: scaleX(-1);
}

.rule-flourish .icon {
  width: 14px;
  height: 14px;
}

.decorative-rule--bottom .rule-flourish {
  transform: scaleX(1);
}

/* ── 品牌区域 ── */
.brand {
  margin-bottom: 16px;
}

.brand-emblem {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin-bottom: 16px;
  color: var(--primitive-copper-500);
  opacity: 0.7;
}

.emblem-icon {
  width: 100%;
  height: 100%;
}

.brand-title {
  font-family: 'Crimson Pro', Georgia, serif;
  font-size: 56px;
  font-weight: 700;
  color: var(--primitive-copper-600);
  letter-spacing: 0.12em;
  line-height: 1;
  margin: 0;
  text-shadow: 0 2px 4px rgba(139, 105, 20, 0.08);
}

.brand-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 12px 0;
}

.divider-line {
  width: 40px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--primitive-copper-400), transparent);
}

.divider-dot {
  width: 4px;
  height: 4px;
  background: var(--primitive-copper-400);
  border-radius: 50%;
}

.brand-subtitle {
  font-family: var(--font-ui);
  font-size: 18px;
  font-weight: 500;
  color: var(--primitive-ink-500);
  letter-spacing: 0.1em;
  margin: 0;
}

/* ── 标语 ── */
.tagline {
  font-family: var(--font-ui);
  font-size: 12px;
  font-weight: 400;
  color: var(--primitive-ink-400);
  letter-spacing: 0.05em;
  margin: 0;
}

/* ── 分隔装饰 ── */
.section-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 28px 0;
}

.divider-ornament {
  display: inline-flex;
  align-items: center;
  color: var(--primitive-copper-400);
  opacity: 0.5;
}

.divider-ornament .icon {
  width: 10px;
  height: 10px;
}

/* ═══════════════════════════════════════════════════════════════════════════
   登录按钮
   ═══════════════════════════════════════════════════════════════════════════ */

.sign-in-btn {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px 24px;
  border: 1px solid var(--primitive-copper-300);
  border-radius: var(--radius-default);
  background:
    linear-gradient(135deg, var(--primitive-paper-50) 0%, var(--primitive-paper-100) 100%);
  cursor: pointer;
  overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.sign-in-btn:hover:not(:disabled) {
  border-color: var(--primitive-copper-400);
  background: var(--primitive-paper-50);
  box-shadow:
    0 4px 12px rgba(139, 105, 20, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  transform: translateY(-1px);
}

.sign-in-btn:active:not(:disabled) {
  transform: translateY(0) scale(0.99);
  box-shadow: 0 2px 4px rgba(139, 105, 20, 0.08);
}

.sign-in-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.sign-in-btn.is-loading {
  border-color: var(--primitive-copper-400);
  background: var(--primitive-paper-50);
}

.btn-content {
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
  z-index: 1;
}

.google-icon {
  flex-shrink: 0;
}

/* 加载指示器 */
.loading-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
}

.spinner-svg {
  animation: spinner-rotate 1.2s linear infinite;
}

.spinner-track {
  stroke: var(--primitive-paper-400);
}

.spinner-head {
  stroke: var(--primitive-copper-500);
  stroke-linecap: round;
  stroke-dasharray: 60, 200;
  stroke-dashoffset: 0;
  animation: spinner-dash 1.2s ease-in-out infinite;
}

@keyframes spinner-rotate {
  100% { transform: rotate(360deg); }
}

@keyframes spinner-dash {
  0% {
    stroke-dasharray: 1, 200;
    stroke-dashoffset: 0;
  }
  50% {
    stroke-dasharray: 45, 200;
    stroke-dashoffset: -15;
  }
  100% {
    stroke-dasharray: 45, 200;
    stroke-dashoffset: -60;
  }
}

.btn-text {
  font-family: var(--font-ui);
  font-size: 14px;
  font-weight: 500;
  color: var(--primitive-ink-700);
  letter-spacing: 0.02em;
  transition: opacity 0.2s ease;
}

.sign-in-btn.is-loading .btn-text {
  color: var(--primitive-ink-500);
}

/* 微光效果 */
.btn-shimmer {
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.4) 50%,
    transparent 100%
  );
  transition: left 0.6s ease;
}

.sign-in-btn:hover:not(:disabled) .btn-shimmer {
  left: 100%;
}

/* ── GitHub 图标 ── */
.github-icon {
  flex-shrink: 0;
  color: var(--primitive-ink-700);
}

/* ═══════════════════════════════════════════════════════════════════════════
   分隔线
   ═══════════════════════════════════════════════════════════════════════════ */

.auth-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 0;
}

.auth-divider-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--primitive-paper-400), transparent);
}

.auth-divider-text {
  font-family: var(--font-ui);
  font-size: 12px;
  color: var(--primitive-ink-400);
  letter-spacing: 0.05em;
}

/* ═══════════════════════════════════════════════════════════════════════════
   错误消息
   ═══════════════════════════════════════════════════════════════════════════ */

.error-msg {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 16px;
  padding: 10px 16px;
  background: rgba(155, 59, 59, 0.06);
  border: 1px solid rgba(155, 59, 59, 0.15);
  border-radius: var(--radius-sm);
  font-family: var(--font-ui);
  font-size: 13px;
  color: var(--primitive-brick-600);
}

.error-icon {
  flex-shrink: 0;
  opacity: 0.8;
}

.error-fade-enter-active {
  animation: error-shake 0.4s ease;
}

.error-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.error-fade-enter-from,
.error-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@keyframes error-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-4px); }
  40% { transform: translateX(4px); }
  60% { transform: translateX(-2px); }
  80% { transform: translateX(2px); }
}

/* ═══════════════════════════════════════════════════════════════════════════
   响应式 - 平板
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .login-page {
    padding: 20px;
  }

  .book-cover {
    max-width: 340px;
    padding: 40px 32px;
  }

  .book-cover:hover {
    transform: none;
  }

  .brand-title {
    font-size: 48px;
  }

  .brand-subtitle {
    font-size: 18px;
  }

  .ornament {
    display: none;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   横屏适配
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-height: 600px) and (orientation: landscape) {
  .login-page {
    padding: 16px;
  }

  .book-cover {
    padding: 24px 32px;
  }

  .brand-emblem {
    display: none;
  }

  .decorative-rule--top,
  .decorative-rule--bottom {
    display: none;
  }

  .section-divider {
    margin: 16px 0;
  }

  .footer-credit {
    margin-top: 16px;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   减少动画偏好
   ═══════════════════════════════════════════════════════════════════════════ */

@media (prefers-reduced-motion: reduce) {
  .ornament {
    animation: none;
  }

  .book-cover {
    transition: none;
  }

  .book-cover:hover {
    transform: none;
  }

  .sign-in-btn,
  .btn-shimmer {
    transition: none;
  }

  .sign-in-btn:hover:not(:disabled) .btn-shimmer {
    left: -100%;
  }

  .error-fade-enter-active {
    animation: none;
  }
}
</style>
