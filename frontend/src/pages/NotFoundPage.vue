<template>
  <div class="not-found-page">
    <!-- 纸张纹理背景装饰 -->
    <div class="bg-stains">
      <div class="stain stain--1"></div>
      <div class="stain stain--2"></div>
      <div class="stain stain--3"></div>
    </div>

    <!-- 手稿页面 -->
    <div class="manuscript">
      <!-- 撕裂的顶部边缘 -->
      <div class="torn-edge torn-edge--top">
        <svg viewBox="0 0 400 12" preserveAspectRatio="none">
          <path d="M0,12 L8,4 L16,8 L28,2 L40,10 L52,3 L64,9 L78,1 L90,7 L104,4 L116,11 L130,2 L142,8 L156,5 L168,10 L182,1 L194,7 L208,3 L220,9 L234,6 L248,2 L260,8 L274,4 L286,11 L300,3 L314,7 L326,1 L340,9 L352,5 L366,10 L378,2 L392,8 L400,4 L400,12 Z" fill="currentColor"/>
        </svg>
      </div>

      <!-- 书签丝带 -->
      <div class="bookmark-ribbon"></div>

      <!-- 手稿内容 -->
      <div class="manuscript-content">
        <!-- 页码区域 -->
        <div class="page-number-area">
          <span class="page-label">— 第 —</span>
          <span class="page-num">404</span>
          <span class="page-label">— 页 —</span>
        </div>

        <!-- 装饰花纹分隔线 -->
        <div class="ornamental-rule">
          <span class="rule-wing rule-wing--left"></span>
          <span class="rule-diamond"></span>
          <span class="rule-wing rule-wing--right"></span>
        </div>

        <!-- 主标题 -->
        <h1 class="main-title">此页已佚</h1>

        <!-- 拉丁文装饰引用 -->
        <p class="latin-quote">Pagina non inventa</p>

        <!-- 说明文字 -->
        <div class="description">
          <p class="desc-line">您翻阅的这一页似乎已从书卷中遗失</p>
          <p class="desc-line desc-line--sub">或许是被时光磨蚀，或许从未被写下</p>
        </div>

        <!-- 墨水渍装饰 -->
        <div class="ink-blot">
          <svg viewBox="0 0 60 60" width="32" height="32">
            <circle cx="30" cy="30" r="4" fill="currentColor" opacity="0.15"/>
            <circle cx="24" cy="34" r="2" fill="currentColor" opacity="0.1"/>
            <circle cx="36" cy="28" r="1.5" fill="currentColor" opacity="0.08"/>
          </svg>
        </div>

        <!-- 返回按钮 - 目录索引风格 -->
        <button class="return-btn" @click="goHome">
          <span class="return-icon">
            <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M15 10H5M5 10L9 6M5 10L9 14" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </span>
          <span class="return-text">返回目录</span>
          <span class="return-dots"></span>
          <span class="return-page">首页</span>
        </button>

        <!-- 当前路径提示 -->
        <p class="current-path">
          <span class="path-label">请求路径</span>
          <code class="path-value">{{ currentPath }}</code>
        </p>
      </div>

      <!-- 撕裂的底部边缘 -->
      <div class="torn-edge torn-edge--bottom">
        <svg viewBox="0 0 400 12" preserveAspectRatio="none">
          <path d="M0,0 L8,8 L20,2 L32,6 L46,10 L58,3 L72,7 L84,1 L98,9 L110,4 L124,8 L136,2 L150,10 L162,5 L176,9 L188,1 L202,7 L214,3 L228,8 L240,2 L254,6 L266,10 L280,4 L292,9 L306,1 L318,7 L332,3 L344,8 L358,2 L370,10 L384,5 L400,8 L400,0 Z" fill="currentColor"/>
        </svg>
      </div>

      <!-- 纸张折角 -->
      <div class="page-fold"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

const route = useRoute()
const router = useRouter()

const currentPath = computed(() => route.fullPath)

function goHome() {
  router.push({ name: 'index' })
}
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   404 页面 - 遗失的书页
   灵感：古典手稿残页、图书馆藏书中缺失的一页、泛黄的信笺
   ═══════════════════════════════════════════════════════════════════════════ */

.not-found-page {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  position: relative;
  overflow: hidden;

  /* 纸质纹理背景 */
  background:
    url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E"),
    radial-gradient(ellipse at 60% 30%, rgba(245, 230, 211, 0.7) 0%, transparent 60%),
    radial-gradient(ellipse at 30% 70%, rgba(232, 203, 168, 0.4) 0%, transparent 50%),
    var(--primitive-paper-200);
  background-blend-mode: soft-light, normal, normal, normal;
}

/* ── 背景墨渍装饰 ── */
.bg-stains {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.stain {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(ellipse, rgba(153, 107, 61, 0.06) 0%, transparent 70%);
}

.stain--1 {
  width: 300px;
  height: 200px;
  top: 10%;
  right: -5%;
  transform: rotate(-15deg);
}

.stain--2 {
  width: 200px;
  height: 250px;
  bottom: 5%;
  left: -3%;
  transform: rotate(10deg);
}

.stain--3 {
  width: 150px;
  height: 150px;
  top: 60%;
  right: 20%;
  opacity: 0.6;
}

/* ═══════════════════════════════════════════════════════════════════════════
   手稿页面
   ═══════════════════════════════════════════════════════════════════════════ */

.manuscript {
  position: relative;
  width: 100%;
  max-width: 420px;
  background:
    /* 岁月泛黄渐变 */
    linear-gradient(
      170deg,
      rgba(255, 253, 247, 0.97) 0%,
      rgba(250, 247, 242, 0.99) 40%,
      rgba(245, 240, 230, 0.97) 100%
    );
  padding: 56px 48px;
  text-align: center;
  z-index: 1;

  /* 纸张阴影 */
  box-shadow:
    0 2px 4px rgba(139, 105, 20, 0.06),
    0 8px 24px rgba(139, 105, 20, 0.1),
    0 20px 48px rgba(0, 0, 0, 0.06),
    /* 纸张边缘微光 */
    inset 0 0 80px rgba(139, 105, 20, 0.02);

  /* 入场动画 */
  animation: manuscript-appear 0.8s cubic-bezier(0.23, 1, 0.32, 1) both;
}

@keyframes manuscript-appear {
  from {
    opacity: 0;
    transform: translateY(20px) rotate(-0.5deg);
  }
  to {
    opacity: 1;
    transform: translateY(0) rotate(0deg);
  }
}

/* ── 撕裂边缘 ── */
.torn-edge {
  position: absolute;
  left: 0;
  right: 0;
  color: var(--primitive-paper-200);
  line-height: 0;
  z-index: 2;
}

.torn-edge--top {
  top: -11px;
}

.torn-edge--bottom {
  bottom: -11px;
}

.torn-edge svg {
  width: 100%;
  height: 12px;
  display: block;
}

/* ── 书签丝带 ── */
.bookmark-ribbon {
  position: absolute;
  top: -8px;
  right: 48px;
  width: 22px;
  height: 64px;
  background: linear-gradient(
    180deg,
    var(--primitive-brick-400) 0%,
    var(--primitive-brick-500) 100%
  );
  z-index: 3;
  clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 82%, 0 100%);
  box-shadow: 1px 2px 4px rgba(155, 59, 59, 0.2);
  animation: ribbon-drop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both;
}

@keyframes ribbon-drop {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* ── 纸张折角 ── */
.page-fold {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 32px;
  height: 32px;
  background: linear-gradient(
    135deg,
    var(--primitive-paper-200) 0%,
    var(--primitive-paper-200) 50%,
    var(--primitive-paper-300) 50%,
    var(--primitive-paper-100) 100%
  );
  box-shadow: 2px -2px 4px rgba(0, 0, 0, 0.04);
  z-index: 4;
}

/* ═══════════════════════════════════════════════════════════════════════════
   手稿内容
   ═══════════════════════════════════════════════════════════════════════════ */

.manuscript-content {
  position: relative;
  z-index: 1;
}

/* ── 页码 ── */
.page-number-area {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 8px;
  margin-bottom: 24px;
  animation: fade-in-up 0.6s ease 0.2s both;
}

.page-label {
  font-family: var(--font-ui);
  font-size: 10px;
  color: var(--primitive-ink-300);
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

.page-num {
  font-family: var(--font-serif);
  font-size: 64px;
  font-weight: 700;
  color: var(--primitive-copper-500);
  line-height: 1;
  letter-spacing: 0.06em;
  text-shadow: 0 2px 8px rgba(153, 107, 61, 0.1);
}

/* ── 装饰花纹分隔线 ── */
.ornamental-rule {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 28px;
  animation: fade-in-up 0.6s ease 0.3s both;
}

.rule-wing {
  width: 48px;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--primitive-copper-300));
}

.rule-wing--right {
  background: linear-gradient(90deg, var(--primitive-copper-300), transparent);
}

.rule-diamond {
  width: 6px;
  height: 6px;
  background: var(--primitive-copper-400);
  transform: rotate(45deg);
  flex-shrink: 0;
}

/* ── 主标题 ── */
.main-title {
  font-family: var(--font-serif);
  font-size: 28px;
  font-weight: 700;
  color: var(--primitive-ink-800);
  letter-spacing: 0.15em;
  margin: 0 0 8px;
  animation: fade-in-up 0.6s ease 0.35s both;
}

/* ── 拉丁文引用 ── */
.latin-quote {
  font-family: var(--font-serif);
  font-size: 13px;
  font-style: italic;
  color: var(--primitive-ink-300);
  letter-spacing: 0.08em;
  margin: 0 0 28px;
  animation: fade-in-up 0.6s ease 0.4s both;
}

/* ── 说明文字 ── */
.description {
  margin-bottom: 32px;
  animation: fade-in-up 0.6s ease 0.45s both;
}

.desc-line {
  font-family: var(--font-ui);
  font-size: 14px;
  color: var(--primitive-ink-500);
  line-height: 1.7;
  margin: 0;
}

.desc-line--sub {
  font-size: 13px;
  color: var(--primitive-ink-400);
  margin-top: 4px;
}

/* ── 墨水渍 ── */
.ink-blot {
  display: flex;
  justify-content: center;
  margin-bottom: 28px;
  color: var(--primitive-copper-500);
  animation: fade-in-up 0.6s ease 0.5s both;
}

/* ── 返回按钮 — 目录索引风格 ── */
.return-btn {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 14px 20px;
  background: transparent;
  border: 1px solid var(--primitive-copper-200);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.25s ease;
  animation: fade-in-up 0.6s ease 0.55s both;
}

.return-btn:hover {
  background: rgba(153, 107, 61, 0.04);
  border-color: var(--primitive-copper-300);
  box-shadow: 0 2px 8px rgba(139, 105, 20, 0.08);
  transform: translateY(-1px);
}

.return-btn:active {
  transform: translateY(0);
  box-shadow: none;
}

.return-icon {
  display: flex;
  align-items: center;
  color: var(--primitive-copper-500);
  margin-right: 10px;
  transition: transform 0.25s ease;
}

.return-btn:hover .return-icon {
  transform: translateX(-3px);
}

.return-text {
  font-family: var(--font-ui);
  font-size: 14px;
  font-weight: 500;
  color: var(--primitive-ink-700);
  letter-spacing: 0.02em;
}

.return-dots {
  flex: 1;
  margin: 0 12px;
  height: 1px;
  border-bottom: 1px dotted var(--primitive-copper-200);
}

.return-page {
  font-family: var(--font-serif);
  font-size: 13px;
  font-style: italic;
  color: var(--primitive-copper-500);
}

/* ── 当前路径提示 ── */
.current-path {
  margin-top: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  animation: fade-in-up 0.6s ease 0.6s both;
}

.path-label {
  font-family: var(--font-ui);
  font-size: 10px;
  color: var(--primitive-ink-300);
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.path-value {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--primitive-ink-400);
  background: rgba(153, 107, 61, 0.05);
  padding: 2px 8px;
  border-radius: var(--radius-xs);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ═══════════════════════════════════════════════════════════════════════════
   共享动画
   ═══════════════════════════════════════════════════════════════════════════ */

@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   响应式 - 移动端
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .not-found-page {
    padding: 20px;
  }

  .manuscript {
    max-width: 360px;
    padding: 48px 32px;
  }

  .page-num {
    font-size: 52px;
  }

  .main-title {
    font-size: 24px;
  }

  .bookmark-ribbon {
    right: 36px;
  }

  .stain {
    display: none;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   横屏适配
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-height: 600px) and (orientation: landscape) {
  .not-found-page {
    padding: 16px;
  }

  .manuscript {
    padding: 32px;
  }

  .page-num {
    font-size: 44px;
  }

  .description {
    margin-bottom: 20px;
  }

  .ink-blot {
    display: none;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   减少动画偏好
   ═══════════════════════════════════════════════════════════════════════════ */

@media (prefers-reduced-motion: reduce) {
  .manuscript {
    animation: none;
  }

  .bookmark-ribbon {
    animation: none;
  }

  .page-number-area,
  .ornamental-rule,
  .main-title,
  .latin-quote,
  .description,
  .ink-blot,
  .return-btn,
  .current-path {
    animation: none;
  }

  .return-btn {
    transition: none;
  }

  .return-icon {
    transition: none;
  }
}
</style>
