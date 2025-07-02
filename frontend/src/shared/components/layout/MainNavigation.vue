<template>
  <nav class="spine-nav" :class="[{ expanded: expanded }, themeClass]">
    <!-- 书脊顶部装饰 -->
    <div class="spine-cap spine-cap--top">
      <div class="cap-detail"></div>
    </div>

    <!-- 展开控制区 -->
    <div class="nav-header">
      <button class="nav-toggle" @click="toggleNav" :aria-label="expanded ? '收起导航' : '展开导航'">
        <span class="toggle-mark" :class="{ rotated: expanded }">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </span>
      </button>

      <!-- 展开时的标题 -->
      <transition name="title-reveal">
        <div v-show="expanded" class="brand-title">
          <span class="title-text">IELTS</span>
          <span class="title-accent">Study</span>
        </div>
      </transition>
    </div>

    <!-- 主导航区域 -->
    <div class="nav-chapters">
      <button
        v-for="(tab, index) in tabs"
        :key="tab.id"
        :class="['chapter-tab', { active: activeTab === tab.id }]"
        @click="switchTab(tab.id)"
        :style="{ '--tab-index': index }"
      >
        <!-- 章节标记/书签 -->
        <span class="chapter-mark">
          <component :is="tab.iconComponent" class="mark-icon" />
        </span>

        <!-- 章节标签 -->
        <transition name="label-slide">
          <span v-show="expanded" class="chapter-label">
            <span class="label-chinese">{{ tab.label }}</span>
            <span class="label-english">{{ tab.english }}</span>
          </span>
        </transition>

        <!-- 活动状态的书签丝带 -->
        <span v-if="activeTab === tab.id" class="ribbon-marker"></span>
      </button>
    </div>

    <!-- 用户选择（藏书票） -->
    <div class="nav-stamps">
      <UserProfile :expanded="expanded" />
    </div>

    <!-- 底部设置 -->
    <div class="nav-colophon">
      <button
        :class="['chapter-tab chapter-tab--settings', { active: activeTab === 'settings' }]"
        @click="switchTab('settings')"
      >
        <span class="chapter-mark">
          <svg class="mark-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        </span>
        <transition name="label-slide">
          <span v-show="expanded" class="chapter-label">
            <span class="label-chinese">设置</span>
            <span class="label-english">Settings</span>
          </span>
        </transition>
        <span v-if="activeTab === 'settings'" class="ribbon-marker"></span>
      </button>
    </div>

    <!-- 书脊底部装饰 -->
    <div class="spine-cap spine-cap--bottom">
      <div class="cap-detail"></div>
    </div>

    <!-- 书脊边缘装饰线 -->
    <div class="spine-edge"></div>
  </nav>
</template>

<script setup lang="ts">
import { ref, h, type FunctionalComponent } from 'vue'
import UserProfile from './UserProfile.vue'

interface Tab {
  id: string
  label: string
  english: string
  iconComponent: FunctionalComponent
}

interface Props {
  activeTab: string
  themeClass?: string
}

interface Emits {
  (e: 'tab-change', tabId: string): void
  (e: 'nav-toggle', expanded: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

// 自定义 SVG 图标组件
const BookIcon: FunctionalComponent = () => h('svg', {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '1.75'
}, [
  h('path', { d: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20' }),
  h('path', { d: 'M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z' }),
  h('path', { d: 'M8 7h8' }),
  h('path', { d: 'M8 11h5' })
])

const MicIcon: FunctionalComponent = () => h('svg', {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '1.75'
}, [
  h('rect', { x: '9', y: '2', width: '6', height: '11', rx: '3' }),
  h('path', { d: 'M5 10a7 7 0 0 0 14 0' }),
  h('line', { x1: '12', y1: '19', x2: '12', y2: '22' })
])

const PenIcon: FunctionalComponent = () => h('svg', {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  'stroke-width': '1.75'
}, [
  h('path', { d: 'M12 19L19 12L22 15L15 22L12 19Z', 'stroke-linejoin': 'round' }),
  h('path', { d: 'M18 13L16.5 5.5L2 2L5.5 16.5L13 18L18 13Z', 'stroke-linejoin': 'round' }),
  h('path', { d: 'M2 2L9.586 9.586', 'stroke-linecap': 'round' }),
  h('circle', { cx: '11', cy: '11', r: '2' })
])

const tabs: Tab[] = [
  { id: 'words', label: '单词复习', english: 'Vocabulary', iconComponent: BookIcon },
  { id: 'speaking', label: '口语练习', english: 'Speaking', iconComponent: MicIcon },
  { id: 'writing', label: '写作练习', english: 'Writing', iconComponent: PenIcon }
]

const expanded = ref(false)

const toggleNav = () => {
  expanded.value = !expanded.value
  emit('nav-toggle', expanded.value)
}

const switchTab = (tabId: string) => {
  if (props.activeTab !== tabId)
    emit('tab-change', tabId)
}
</script>

<style scoped>
/* ═══════════════════════════════════════════════════════════════════════════
   书脊式导航 - Editorial Study 风格
   灵感：精装书书脊、古典图书馆、手工装帧
   ═══════════════════════════════════════════════════════════════════════════ */

.spine-nav {
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  width: var(--nav-width);
  /* 书脊背景：纸纹理 + 可过渡的底色 */
  background-color: var(--primitive-paper-200);
  background-image:
    repeating-linear-gradient(
      90deg,
      transparent 0px,
      transparent 1px,
      rgba(139, 105, 20, 0.015) 1px,
      rgba(139, 105, 20, 0.015) 2px
    ),
    linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.3) 0%,
      transparent 60%,
      rgba(0, 0, 0, 0.03) 100%
    );
  display: flex;
  flex-direction: column;
  z-index: 101;
  overflow: hidden;
  transition:
    width 0.4s cubic-bezier(0.4, 0, 0.2, 1),
    background-color 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.spine-nav.expanded {
  width: var(--nav-width-expanded);
}

/* ── 书脊边缘装饰 ── */
.spine-edge {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 1px;
  background: linear-gradient(
    180deg,
    var(--primitive-copper-200) 0%,
    var(--primitive-copper-300) 20%,
    var(--primitive-paper-500) 50%,
    var(--primitive-copper-300) 80%,
    var(--primitive-copper-200) 100%
  );
  box-shadow:
    -1px 0 0 var(--primitive-paper-400),
    1px 0 3px rgba(139, 105, 20, 0.08);
}

/* ── 书脊顶部/底部装饰（头带/脚带） ── */
.spine-cap {
  height: 6px;
  background: linear-gradient(
    90deg,
    var(--primitive-copper-300) 0%,
    var(--primitive-copper-400) 30%,
    var(--primitive-gold-400) 50%,
    var(--primitive-copper-400) 70%,
    var(--primitive-copper-300) 100%
  );
  position: relative;
  z-index: 1;
  flex-shrink: 0;
}

.spine-cap--top {
  border-radius: 0 0 2px 2px;
  box-shadow: 0 2px 4px rgba(139, 105, 20, 0.1);
}

.spine-cap--bottom {
  border-radius: 2px 2px 0 0;
  box-shadow: 0 -2px 4px rgba(139, 105, 20, 0.1);
  margin-top: auto;
}

.cap-detail {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 60%;
  height: 2px;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.4),
    transparent
  );
}

.spine-cap--top .cap-detail {
  bottom: 1px;
}

.spine-cap--bottom .cap-detail {
  top: 1px;
}

/* ═══════════════════════════════════════════════════════════════════════════
   顶部区域
   ═══════════════════════════════════════════════════════════════════════════ */

.nav-header {
  display: flex;
  align-items: center;
  height: 56px;
  padding: 0;
  position: relative;
  border-bottom: 1px solid var(--primitive-paper-400);
}

.nav-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--nav-width);
  height: 56px;
  min-width: var(--nav-width);
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--primitive-copper-500);
  transition: all 0.25s ease;
  flex-shrink: 0;
  touch-action: manipulation;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.nav-toggle:hover {
  color: var(--primitive-copper-600);
}

.nav-toggle:hover .toggle-mark {
  background: var(--primitive-paper-300);
  border-color: var(--primitive-copper-300);
}

.toggle-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid var(--primitive-paper-500);
  background: var(--primitive-paper-50);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.toggle-mark.rotated {
  transform: rotate(180deg);
}

/* 品牌标题 */
.brand-title {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding-left: 4px;
  white-space: nowrap;
}

.title-text {
  font-family: var(--font-serif);
  font-size: 22px;
  font-weight: 700;
  color: var(--primitive-copper-600);
  letter-spacing: 0.08em;
  line-height: 1.1;
}

.title-accent {
  font-family: var(--font-serif);
  font-size: 11px;
  font-weight: 400;
  font-style: italic;
  color: var(--primitive-ink-400);
  letter-spacing: 0.15em;
  text-transform: uppercase;
}

/* ═══════════════════════════════════════════════════════════════════════════
   章节导航
   ═══════════════════════════════════════════════════════════════════════════ */

.nav-chapters {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px 0;
}

/* ── 用户选择区域（藏书票） ── */
.nav-stamps {
  padding: 12px 6px;
  border-top: 1px solid var(--primitive-paper-400);
  display: flex;
  justify-content: flex-start;
  flex-shrink: 0;
  transition: padding 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 展开时用户区域样式：保持与收起时相同的 padding，避免头像位移 */

.nav-colophon {
  padding: 8px 0 16px;
  border-top: 1px solid var(--primitive-paper-400);
}

.chapter-tab {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0;
  margin: 0 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 8px;
  overflow: visible;
  touch-action: manipulation;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.chapter-tab:hover {
  background: var(--primitive-paper-300);
}

/* ── 章节标记（图标容器） ── */
.chapter-mark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 40px;
  min-width: 36px;
  color: var(--primitive-ink-500);
  transition: all 0.25s ease;
  flex-shrink: 0;
}

.mark-icon {
  width: 20px;
  height: 20px;
  transition: transform 0.25s ease;
}

.chapter-tab:hover .mark-icon {
  transform: scale(1.05);
}

/* ── 章节标签 ── */
.chapter-label {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding-left: 4px;
  white-space: nowrap;
  min-width: 0;
}

.label-chinese {
  font-family: var(--font-ui);
  font-size: 14px;
  font-weight: 500;
  color: var(--primitive-ink-700);
  line-height: 1.2;
}

.label-english {
  font-family: var(--font-serif);
  font-size: 10px;
  font-weight: 400;
  font-style: italic;
  color: var(--primitive-ink-400);
  letter-spacing: 0.04em;
  line-height: 1.2;
}

/* ── 书签丝带效果 ── */
.ribbon-marker {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 24px;
  background: linear-gradient(
    180deg,
    var(--primitive-copper-400) 0%,
    var(--primitive-gold-500) 50%,
    var(--primitive-copper-400) 100%
  );
  border-radius: 0 2px 2px 0;
  box-shadow:
    1px 0 3px rgba(139, 105, 20, 0.2),
    inset 0 0 0 0.5px rgba(255, 255, 255, 0.3);
}

/* ═══════════════════════════════════════════════════════════════════════════
   活动状态
   ═══════════════════════════════════════════════════════════════════════════ */

.chapter-tab.active {
  background: linear-gradient(
    90deg,
    rgba(153, 107, 61, 0.08) 0%,
    rgba(153, 107, 61, 0.04) 100%
  );
}

.chapter-tab.active .chapter-mark {
  color: var(--primitive-copper-600);
}

.chapter-tab.active .label-chinese {
  color: var(--primitive-copper-700);
  font-weight: 600;
}

.chapter-tab.active .label-english {
  color: var(--primitive-copper-500);
}

/* 展开状态下的活动样式增强 */
.spine-nav.expanded .chapter-tab.active {
  background: linear-gradient(
    90deg,
    rgba(153, 107, 61, 0.1) 0%,
    rgba(153, 107, 61, 0.05) 70%,
    transparent 100%
  );
  border-radius: 0 20px 20px 0;
  margin-left: 0;
  padding-left: 6px;
}

.spine-nav.expanded.theme-speaking .chapter-tab.active {
  background: linear-gradient(
    90deg,
    rgba(184, 134, 11, 0.12) 0%,
    rgba(184, 134, 11, 0.05) 70%,
    transparent 100%
  );
}

.spine-nav.expanded.theme-writing .chapter-tab.active {
  background: linear-gradient(
    90deg,
    rgba(59, 130, 246, 0.12) 0%,
    rgba(59, 130, 246, 0.05) 70%,
    transparent 100%
  );
}

.spine-nav.expanded.theme-settings .chapter-tab.active {
  background: linear-gradient(
    90deg,
    rgba(90, 101, 120, 0.12) 0%,
    rgba(90, 101, 120, 0.05) 70%,
    transparent 100%
  );
}

.spine-nav.expanded .chapter-tab.active .ribbon-marker {
  height: 100%;
  border-radius: 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
   动画
   ═══════════════════════════════════════════════════════════════════════════ */

.title-reveal-enter-active {
  transition: opacity 0.35s ease 0.1s, transform 0.35s ease 0.1s;
}

.title-reveal-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.title-reveal-enter-from {
  opacity: 0;
  transform: translateX(-12px);
}

.title-reveal-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}

.label-slide-enter-active {
  transition: opacity 0.3s ease 0.05s, transform 0.3s ease 0.05s;
  transition-delay: calc(var(--tab-index, 0) * 0.03s + 0.05s);
}

.label-slide-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.label-slide-enter-from {
  opacity: 0;
  transform: translateX(-16px);
}

.label-slide-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}

/* ═══════════════════════════════════════════════════════════════════════════
   移动端响应式 (小屏幕)
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .spine-nav {
    width: var(--nav-width-small-mobile);
  }

  .spine-nav.expanded {
    width: var(--nav-width-expanded-small-mobile);
  }

  .nav-header {
    height: 48px;
  }

  .nav-toggle {
    width: var(--nav-width-small-mobile);
    height: 48px;
    min-width: var(--nav-width-small-mobile);
  }

  .toggle-mark {
    width: 24px;
    height: 24px;
    border-radius: 5px;
  }

  .toggle-mark svg {
    width: 12px;
    height: 12px;
  }

  .title-text {
    font-size: 18px;
  }

  .title-accent {
    font-size: 9px;
  }

  .chapter-mark {
    width: 28px;
    height: 34px;
    min-width: 28px;
  }

  .mark-icon {
    width: 16px;
    height: 16px;
  }

  .chapter-tab {
    margin: 0 6px;
    border-radius: 6px;
  }

  .ribbon-marker {
    width: 2px;
    height: 20px;
  }

  .label-chinese {
    font-size: 13px;
  }

  .label-english {
    font-size: 9px;
  }

  /* 移动端触摸反馈 */
  .chapter-tab:hover {
    background: transparent;
  }

  .chapter-tab:active {
    background: var(--primitive-paper-300);
    transform: scale(0.98);
  }

  .nav-toggle:hover .toggle-mark {
    background: var(--primitive-paper-50);
    border-color: var(--primitive-paper-500);
  }

  .nav-toggle:active .toggle-mark {
    background: var(--primitive-paper-300);
    transform: scale(0.95);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   横屏适配
   ═══════════════════════════════════════════════════════════════════════════ */

@media (max-height: 500px) and (orientation: landscape) {
  .spine-cap {
    height: 4px;
  }

  .nav-header {
    height: 44px;
  }

  .nav-toggle {
    height: 44px;
  }

  .nav-chapters {
    padding: 8px 0;
    gap: 2px;
  }

  .chapter-mark {
    height: 32px;
  }

  .nav-colophon {
    padding: 4px 0 8px;
  }

  .title-text {
    font-size: 18px;
  }

  .title-accent {
    font-size: 9px;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   减少动画偏好
   ═══════════════════════════════════════════════════════════════════════════ */

@media (prefers-reduced-motion: reduce) {
  .spine-nav,
  .toggle-mark,
  .chapter-tab,
  .mark-icon {
    transition: none;
  }

  .title-reveal-enter-active,
  .title-reveal-leave-active,
  .label-slide-enter-active,
  .label-slide-leave-active {
    transition: opacity 0.1s ease;
  }

  .title-reveal-enter-from,
  .title-reveal-leave-to,
  .label-slide-enter-from,
  .label-slide-leave-to {
    transform: none;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   高对比度模式
   ═══════════════════════════════════════════════════════════════════════════ */

@media (prefers-contrast: high) {
  .spine-edge {
    width: 2px;
    background: var(--primitive-copper-500);
  }

  .ribbon-marker {
    width: 4px;
    background: var(--primitive-copper-600);
  }

  .chapter-tab.active {
    background: rgba(153, 107, 61, 0.15);
  }

  .toggle-mark {
    border-width: 2px;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   主题色过渡 - 导航背景随当前模块变化
   ═══════════════════════════════════════════════════════════════════════════ */

/* 单词模块 - 温暖纸张/铜褐（默认） */
.spine-nav.theme-words {
  background-color: var(--primitive-paper-200);
}

.spine-nav.theme-words .spine-edge {
  background: linear-gradient(
    180deg,
    var(--primitive-copper-200) 0%,
    var(--primitive-copper-300) 20%,
    var(--primitive-paper-500) 50%,
    var(--primitive-copper-300) 80%,
    var(--primitive-copper-200) 100%
  );
}

.spine-nav.theme-words .spine-cap {
  background: linear-gradient(
    90deg,
    var(--primitive-copper-300) 0%,
    var(--primitive-copper-400) 30%,
    var(--primitive-gold-400) 50%,
    var(--primitive-copper-400) 70%,
    var(--primitive-copper-300) 100%
  );
}

/* 口语模块 - 深金/琥珀（录音棚暖光） */
.spine-nav.theme-speaking {
  background-color: #F5EDD8;
}

.spine-nav.theme-speaking .spine-edge {
  background: linear-gradient(
    180deg,
    var(--primitive-gold-200) 0%,
    var(--primitive-gold-300) 20%,
    var(--primitive-gold-400) 50%,
    var(--primitive-gold-300) 80%,
    var(--primitive-gold-200) 100%
  );
  transition: background 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.spine-nav.theme-speaking .spine-cap {
  background: linear-gradient(
    90deg,
    var(--primitive-gold-300) 0%,
    var(--primitive-gold-400) 30%,
    var(--primitive-gold-500) 50%,
    var(--primitive-gold-400) 70%,
    var(--primitive-gold-300) 100%
  );
  transition: background 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.spine-nav.theme-speaking .ribbon-marker {
  background: linear-gradient(
    180deg,
    var(--primitive-gold-400) 0%,
    var(--primitive-gold-500) 50%,
    var(--primitive-gold-400) 100%
  );
}

.spine-nav.theme-speaking .chapter-tab.active {
  background: linear-gradient(
    90deg,
    rgba(184, 134, 11, 0.1) 0%,
    rgba(184, 134, 11, 0.04) 100%
  );
}

.spine-nav.theme-speaking .chapter-tab.active .chapter-mark {
  color: var(--primitive-gold-600);
}

.spine-nav.theme-speaking .chapter-tab.active .label-chinese {
  color: var(--primitive-gold-700);
}

.spine-nav.theme-speaking .chapter-tab.active .label-english {
  color: var(--primitive-gold-500);
}

/* 写作模块 - 雾蓝/靛青（午夜书房） */
.spine-nav.theme-writing {
  background-color: #E8EEF5;
}

.spine-nav.theme-writing .spine-edge {
  background: linear-gradient(
    180deg,
    var(--primitive-azure-200) 0%,
    var(--primitive-azure-300) 20%,
    var(--primitive-azure-400) 50%,
    var(--primitive-azure-300) 80%,
    var(--primitive-azure-200) 100%
  );
  transition: background 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.spine-nav.theme-writing .spine-cap {
  background: linear-gradient(
    90deg,
    var(--primitive-azure-200) 0%,
    var(--primitive-azure-300) 30%,
    var(--primitive-azure-400) 50%,
    var(--primitive-azure-300) 70%,
    var(--primitive-azure-200) 100%
  );
  transition: background 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.spine-nav.theme-writing .ribbon-marker {
  background: linear-gradient(
    180deg,
    var(--primitive-azure-300) 0%,
    var(--primitive-azure-500) 50%,
    var(--primitive-azure-300) 100%
  );
}

.spine-nav.theme-writing .chapter-tab.active {
  background: linear-gradient(
    90deg,
    rgba(59, 130, 246, 0.1) 0%,
    rgba(59, 130, 246, 0.04) 100%
  );
}

.spine-nav.theme-writing .chapter-tab.active .chapter-mark {
  color: var(--primitive-azure-600);
}

.spine-nav.theme-writing .chapter-tab.active .label-chinese {
  color: var(--primitive-azure-700);
}

.spine-nav.theme-writing .chapter-tab.active .label-english {
  color: var(--primitive-azure-500);
}

/* 设置模块 - 中性灰/墨色（实用沉稳） */
.spine-nav.theme-settings {
  background-color: #EBEDF0;
}

.spine-nav.theme-settings .spine-edge {
  background: linear-gradient(
    180deg,
    var(--primitive-ink-200) 0%,
    var(--primitive-ink-300) 20%,
    var(--primitive-ink-400) 50%,
    var(--primitive-ink-300) 80%,
    var(--primitive-ink-200) 100%
  );
  transition: background 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.spine-nav.theme-settings .spine-cap {
  background: linear-gradient(
    90deg,
    var(--primitive-ink-200) 0%,
    var(--primitive-ink-300) 30%,
    var(--primitive-ink-400) 50%,
    var(--primitive-ink-300) 70%,
    var(--primitive-ink-200) 100%
  );
  transition: background 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.spine-nav.theme-settings .ribbon-marker {
  background: linear-gradient(
    180deg,
    var(--primitive-ink-300) 0%,
    var(--primitive-ink-500) 50%,
    var(--primitive-ink-300) 100%
  );
}

.spine-nav.theme-settings .chapter-tab.active {
  background: linear-gradient(
    90deg,
    rgba(90, 101, 120, 0.1) 0%,
    rgba(90, 101, 120, 0.04) 100%
  );
}

.spine-nav.theme-settings .chapter-tab.active .chapter-mark {
  color: var(--primitive-ink-600);
}

.spine-nav.theme-settings .chapter-tab.active .label-chinese {
  color: var(--primitive-ink-700);
}

.spine-nav.theme-settings .chapter-tab.active .label-english {
  color: var(--primitive-ink-500);
}

/* 装饰元素的过渡 */
.spine-edge,
.spine-cap,
.ribbon-marker {
  transition: background 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.chapter-tab.active,
.chapter-tab.active .chapter-mark,
.chapter-tab.active .label-chinese,
.chapter-tab.active .label-english {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
</style>
