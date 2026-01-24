# IELTS词汇学习应用 - 前端设计优化与重构方案

> 基于现有"Editorial Study"设计体系的深度分析与优化建议

---

## 目录

1. [现状分析摘要](#1-现状分析摘要)
2. [样式系统优化](#2-样式系统优化)
3. [UI组件重构](#3-ui组件重构)
4. [交互体验升级](#4-交互体验升级)
5. [响应式设计改进](#5-响应式设计改进)
6. [性能优化](#6-性能优化)
7. [可访问性增强](#7-可访问性增强)
8. [实施优先级与路线图](#8-实施优先级与路线图)

---

## 1. 现状分析摘要

### 1.1 设计体系评估

**优势**
- ✅ 独特的"学术编辑"风格（铜棕+橄榄绿配色）
- ✅ CSS变量覆盖率高（~95%）
- ✅ 衬线字体选择契合学习场景
- ✅ 暖色调纸张质感背景

**待改进**
- ⚠️ 部分组件硬编码颜色值
- ⚠️ 动画缺乏统一的编排系统

### 1.2 组件架构评估

| 层级 | 现状 | 建议 |
|------|------|------|
| 基础组件 | 分散在各features中 | 统一到shared/components |
| 布局组件 | 结构清晰 | 增加更多Layout变体 |
| 业务组件 | 功能完善 | 提取可复用部分 |

### 1.3 交互评估

| 维度 | 评分 | 说明 |
|------|------|------|
| 反馈及时性 | ⭐⭐⭐⭐ | 按钮hover效果好 |
| 加载体验 | ⭐⭐⭐ | 缺少骨架屏 |
| 动效流畅度 | ⭐⭐⭐⭐ | 过渡动画自然 |
| 手势支持 | ⭐⭐ | 仅基础tap支持 |

---

## 2. 样式系统优化

### 2.1 设计令牌重构

#### 问题
当前 `tokens.css` 混合了语义化令牌和原始值，建议分层：

#### 优化方案

```css
/* === 第一层：原始值（Primitives） === */
:root {
  /* 色板 */
  --primitive-copper-50: #FDF8F3;
  --primitive-copper-100: #F5E6D3;
  --primitive-copper-200: #E8CBA8;
  --primitive-copper-300: #D4A574;
  --primitive-copper-400: #B8834A;
  --primitive-copper-500: #996B3D;  /* 主色 */
  --primitive-copper-600: #7A5631;
  --primitive-copper-700: #5C4125;
  --primitive-copper-800: #3D2B19;
  --primitive-copper-900: #1F160D;

  --primitive-olive-500: #5D7A5D;
  --primitive-brick-500: #9B3B3B;
  --primitive-gold-500: #B8860B;

  /* 间距基数 */
  --primitive-space-unit: 4px;
}

/* === 第二层：语义化令牌（Semantic Tokens） === */
:root {
  /* 品牌色 */
  --color-brand-primary: var(--primitive-copper-500);
  --color-brand-primary-hover: var(--primitive-copper-400);
  --color-brand-secondary: var(--primitive-olive-500);

  /* 状态色 */
  --color-state-success: var(--primitive-olive-500);
  --color-state-warning: var(--primitive-gold-500);
  --color-state-error: var(--primitive-brick-500);

  /* 表面色 */
  --color-surface-page: #FAF7F2;
  --color-surface-card: #FFFDF7;
  --color-surface-elevated: #FFFFFF;

  /* 交互色 */
  --color-interactive-default: var(--color-brand-primary);
  --color-interactive-hover: var(--color-brand-primary-hover);
  --color-interactive-active: var(--primitive-copper-600);
  --color-interactive-disabled: var(--primitive-copper-200);
}

/* === 第三层：组件令牌（Component Tokens） === */
:root {
  /* 按钮 */
  --button-primary-bg: var(--color-interactive-default);
  --button-primary-bg-hover: var(--color-interactive-hover);
  --button-primary-text: var(--color-text-inverse);

  /* 卡片 */
  --card-bg: var(--color-surface-card);
  --card-border: var(--color-border-light);
  --card-shadow: var(--shadow-md);
}
```

### 2.2 字体系统增强

#### 问题
- 当前只有一套衬线字体
- 缺少等宽字体用于代码/数字展示
- 字重变化单一

#### 优化方案

```css
:root {
  /* 字体栈 */
  --font-serif: 'Crimson Pro', 'Noto Serif SC', Georgia, serif;
  --font-sans: 'Inter', 'Noto Sans SC', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* 语义化字体 */
  --font-body: var(--font-serif);
  --font-heading: var(--font-serif);
  --font-ui: var(--font-sans);        /* 按钮、标签 */
  --font-data: var(--font-mono);      /* 数字、统计 */

  /* 字体大小流体缩放 */
  --font-size-base: clamp(14px, 1.5vw, 16px);
  --font-size-lg: clamp(16px, 2vw, 18px);
  --font-size-xl: clamp(18px, 2.5vw, 22px);
  --font-size-2xl: clamp(22px, 3vw, 28px);
  --font-size-3xl: clamp(28px, 4vw, 36px);
}

/* 数字展示 */
.stat-number {
  font-family: var(--font-data);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}
```

### 2.3 间距系统优化

#### 引入8px网格系统

```css
:root {
  --space-0: 0;
  --space-1: 4px;    /* 0.5 单位 */
  --space-2: 8px;    /* 1 单位 */
  --space-3: 12px;   /* 1.5 单位 */
  --space-4: 16px;   /* 2 单位 */
  --space-5: 20px;   /* 2.5 单位 */
  --space-6: 24px;   /* 3 单位 */
  --space-8: 32px;   /* 4 单位 */
  --space-10: 40px;  /* 5 单位 */
  --space-12: 48px;  /* 6 单位 */
  --space-16: 64px;  /* 8 单位 */
}

/* 组件间距语义化 */
:root {
  --gap-inline-xs: var(--space-1);
  --gap-inline-sm: var(--space-2);
  --gap-inline-md: var(--space-3);
  --gap-inline-lg: var(--space-4);

  --gap-stack-xs: var(--space-2);
  --gap-stack-sm: var(--space-3);
  --gap-stack-md: var(--space-4);
  --gap-stack-lg: var(--space-6);
  --gap-stack-xl: var(--space-8);
}
```

---

## 3. UI组件重构

### 3.1 按钮系统重构

#### 问题
- 按钮样式分散在多个文件
- 变体不统一（primary, secondary, ghost等定义不一致）
- 尺寸变体缺失

#### 新的按钮系统

```vue
<!-- BaseButton.vue -->
<template>
  <button
    :class="[
      'btn',
      `btn--${variant}`,
      `btn--${size}`,
      { 'btn--loading': loading, 'btn--icon-only': iconOnly }
    ]"
    :disabled="disabled || loading"
    v-bind="$attrs"
  >
    <span v-if="loading" class="btn__spinner" />
    <span v-if="$slots.icon" class="btn__icon">
      <slot name="icon" />
    </span>
    <span v-if="!iconOnly" class="btn__text">
      <slot />
    </span>
  </button>
</template>

<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  disabled?: boolean
  iconOnly?: boolean
}

withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  loading: false,
  disabled: false,
  iconOnly: false
})
</script>

<style scoped>
.btn {
  /* 基础样式 */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  font-family: var(--font-ui);
  font-weight: 500;
  border-radius: var(--radius-default);
  cursor: pointer;
  transition:
    background-color var(--transition-fast),
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

/* 尺寸变体 */
.btn--sm {
  height: 32px;
  padding: 0 var(--space-3);
  font-size: var(--font-size-sm);
}

.btn--md {
  height: 40px;
  padding: 0 var(--space-4);
  font-size: var(--font-size-base);
}

.btn--lg {
  height: 48px;
  padding: 0 var(--space-6);
  font-size: var(--font-size-lg);
}

/* 颜色变体 */
.btn--primary {
  background: var(--button-primary-bg);
  color: var(--button-primary-text);
  border: none;
}

.btn--primary:hover:not(:disabled) {
  background: var(--button-primary-bg-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(153, 107, 61, 0.25);
}

.btn--secondary {
  background: transparent;
  color: var(--color-brand-primary);
  border: 1.5px solid var(--color-brand-primary);
}

.btn--ghost {
  background: transparent;
  color: var(--color-text-secondary);
  border: none;
}

.btn--ghost:hover:not(:disabled) {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

/* 加载状态 */
.btn--loading {
  pointer-events: none;
  opacity: 0.7;
}

.btn__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* 图标按钮 */
.btn--icon-only {
  padding: 0;
  aspect-ratio: 1;
}

.btn--icon-only.btn--sm { width: 32px; }
.btn--icon-only.btn--md { width: 40px; }
.btn--icon-only.btn--lg { width: 48px; }

/* 移动端适配 */
@media (hover: none) and (pointer: coarse) {
  .btn:hover:not(:disabled) {
    transform: none;
  }

  .btn:active:not(:disabled) {
    transform: scale(0.97);
  }
}
</style>
```

### 3.2 卡片组件统一

#### 问题
- WordCard、ReviewCard、SpeakingCard样式不统一
- 阴影、圆角、内边距各异

#### 统一的卡片基础组件

```vue
<!-- BaseCard.vue -->
<template>
  <div
    :class="[
      'card',
      `card--${elevation}`,
      { 'card--interactive': interactive, 'card--selected': selected }
    ]"
    v-bind="$attrs"
  >
    <div v-if="$slots.header" class="card__header">
      <slot name="header" />
    </div>
    <div class="card__body">
      <slot />
    </div>
    <div v-if="$slots.footer" class="card__footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  elevation?: 'flat' | 'raised' | 'floating'
  interactive?: boolean
  selected?: boolean
}

withDefaults(defineProps<Props>(), {
  elevation: 'raised',
  interactive: false,
  selected: false
})
</script>

<style scoped>
.card {
  background: var(--card-bg);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.card--flat {
  border: 1px solid var(--card-border);
}

.card--raised {
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--card-border);
}

.card--floating {
  box-shadow: var(--shadow-lg);
}

.card--interactive {
  cursor: pointer;
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}

.card--interactive:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.card--selected {
  outline: 2px solid var(--color-brand-primary);
  outline-offset: -2px;
}

.card__header {
  padding: var(--space-4);
  border-bottom: 1px solid var(--color-border-light);
}

.card__body {
  padding: var(--space-4);
}

.card__footer {
  padding: var(--space-3) var(--space-4);
  border-top: 1px solid var(--color-border-light);
  background: var(--color-bg-secondary);
}
</style>
```

### 3.3 输入框组件标准化

```vue
<!-- BaseInput.vue -->
<template>
  <div
    :class="[
      'input-wrapper',
      `input-wrapper--${size}`,
      {
        'input-wrapper--error': error,
        'input-wrapper--disabled': disabled,
        'input-wrapper--focused': isFocused
      }
    ]"
  >
    <label v-if="label" :for="inputId" class="input-label">
      {{ label }}
      <span v-if="required" class="input-required">*</span>
    </label>

    <div class="input-container">
      <span v-if="$slots.prefix" class="input-prefix">
        <slot name="prefix" />
      </span>

      <input
        :id="inputId"
        ref="inputRef"
        class="input-field"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        v-bind="$attrs"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @focus="isFocused = true"
        @blur="isFocused = false"
      />

      <span v-if="$slots.suffix" class="input-suffix">
        <slot name="suffix" />
      </span>
    </div>

    <p v-if="error" class="input-error">{{ error }}</p>
    <p v-else-if="hint" class="input-hint">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
interface Props {
  modelValue?: string
  label?: string
  placeholder?: string
  type?: string
  size?: 'sm' | 'md' | 'lg'
  error?: string
  hint?: string
  required?: boolean
  disabled?: boolean
  readonly?: boolean
}

withDefaults(defineProps<Props>(), {
  type: 'text',
  size: 'md'
})

defineEmits<{
  'update:modelValue': [value: string]
}>()

const inputId = `input-${Math.random().toString(36).slice(2, 9)}`
const isFocused = ref(false)
</script>

<style scoped>
.input-wrapper {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.input-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-secondary);
}

.input-required {
  color: var(--color-state-error);
}

.input-container {
  display: flex;
  align-items: center;
  background: var(--color-surface-card);
  border: 1.5px solid var(--color-border-medium);
  border-radius: var(--radius-default);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.input-wrapper--focused .input-container {
  border-color: var(--color-brand-primary);
  box-shadow: 0 0 0 3px rgba(153, 107, 61, 0.12);
}

.input-wrapper--error .input-container {
  border-color: var(--color-state-error);
}

.input-field {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--color-text-primary);
  font-family: var(--font-body);
  outline: none;
}

/* 尺寸变体 */
.input-wrapper--sm .input-container { height: 32px; }
.input-wrapper--sm .input-field {
  padding: 0 var(--space-2);
  font-size: var(--font-size-sm);
}

.input-wrapper--md .input-container { height: 40px; }
.input-wrapper--md .input-field {
  padding: 0 var(--space-3);
  font-size: var(--font-size-base);
}

.input-wrapper--lg .input-container { height: 48px; }
.input-wrapper--lg .input-field {
  padding: 0 var(--space-4);
  font-size: var(--font-size-lg);
}

.input-prefix,
.input-suffix {
  display: flex;
  align-items: center;
  padding: 0 var(--space-2);
  color: var(--color-text-tertiary);
}

.input-error {
  font-size: var(--font-size-xs);
  color: var(--color-state-error);
  margin: 0;
}

.input-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  margin: 0;
}
</style>
```

### 3.4 图标系统升级

#### 问题
- 部分使用Lucide，部分使用emoji
- 图标大小不一致
- 缺少图标按钮统一封装

#### 优化方案

```vue
<!-- BaseIcon.vue -->
<template>
  <component
    :is="iconComponent"
    :size="sizeMap[size]"
    :stroke-width="strokeWidth"
    :class="['icon', `icon--${size}`, colorClass]"
    :aria-hidden="!ariaLabel"
    :aria-label="ariaLabel"
  />
</template>

<script setup lang="ts">
import * as LucideIcons from 'lucide-vue-next'

interface Props {
  name: keyof typeof LucideIcons
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'muted'
  strokeWidth?: number
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  strokeWidth: 2
})

const sizeMap = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32
}

const iconComponent = computed(() => LucideIcons[props.name])

const colorClass = computed(() => props.color ? `icon--${props.color}` : '')
</script>

<style scoped>
.icon {
  flex-shrink: 0;
}

.icon--primary { color: var(--color-brand-primary); }
.icon--secondary { color: var(--color-brand-secondary); }
.icon--success { color: var(--color-state-success); }
.icon--warning { color: var(--color-state-warning); }
.icon--danger { color: var(--color-state-error); }
.icon--muted { color: var(--color-text-muted); }
</style>
```

### 3.5 模态框/对话框重构

```vue
<!-- BaseModal.vue -->
<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="modal-overlay"
        @click.self="closeOnOverlay && close()"
      >
        <div
          ref="modalRef"
          :class="['modal', `modal--${size}`]"
          role="dialog"
          :aria-modal="true"
          :aria-labelledby="titleId"
        >
          <!-- 头部 -->
          <header v-if="$slots.header || title" class="modal__header">
            <slot name="header">
              <h2 :id="titleId" class="modal__title">{{ title }}</h2>
            </slot>
            <button
              v-if="closable"
              class="modal__close"
              aria-label="关闭"
              @click="close"
            >
              <BaseIcon name="X" size="sm" />
            </button>
          </header>

          <!-- 内容 -->
          <div class="modal__body">
            <slot />
          </div>

          <!-- 底部 -->
          <footer v-if="$slots.footer" class="modal__footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
interface Props {
  modelValue: boolean
  title?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  closable?: boolean
  closeOnOverlay?: boolean
  closeOnEsc?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  closable: true,
  closeOnOverlay: true,
  closeOnEsc: true
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'close': []
}>()

const titleId = `modal-title-${Math.random().toString(36).slice(2, 9)}`
const modalRef = ref<HTMLElement>()

const close = () => {
  emit('update:modelValue', false)
  emit('close')
}

// 锁定滚动
watch(() => props.modelValue, (open) => {
  if (open) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})

// ESC关闭
onMounted(() => {
  const handleEsc = (e: KeyboardEvent) => {
    if (props.closeOnEsc && e.key === 'Escape' && props.modelValue) {
      close()
    }
  }
  document.addEventListener('keydown', handleEsc)
  onUnmounted(() => document.removeEventListener('keydown', handleEsc))
})
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  position: relative;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - var(--space-8));
  background: var(--color-surface-card);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  overflow: hidden;
}

/* 尺寸变体 */
.modal--sm { width: 100%; max-width: 360px; }
.modal--md { width: 100%; max-width: 480px; }
.modal--lg { width: 100%; max-width: 640px; }
.modal--xl { width: 100%; max-width: 800px; }
.modal--full {
  width: calc(100vw - var(--space-8));
  height: calc(100vh - var(--space-8));
  max-width: none;
}

.modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-6);
  border-bottom: 1px solid var(--color-border-light);
}

.modal__title {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--color-text-primary);
}

.modal__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: var(--radius-full);
  color: var(--color-text-tertiary);
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.modal__close:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.modal__body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-6);
}

.modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-6);
  border-top: 1px solid var(--color-border-light);
  background: var(--color-bg-secondary);
}

/* 过渡动画 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}

.modal-enter-active .modal,
.modal-leave-active .modal {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal {
  transform: scale(0.95) translateY(10px);
}

.modal-leave-to .modal {
  transform: scale(0.95) translateY(-10px);
}
</style>
```

---

## 4. 交互体验升级

### 4.1 动效系统重构

#### 建立动效规范

```css
/* animations-system.css */

/* === 时间曲线 === */
:root {
  /* 标准缓动 */
  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);

  /* 弹性缓动 */
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-elastic: cubic-bezier(0.68, -0.55, 0.265, 1.55);

  /* 强调缓动 */
  --ease-emphasis: cubic-bezier(0.2, 0, 0, 1);
}

/* === 持续时间 === */
:root {
  --duration-instant: 100ms;    /* 即时反馈 */
  --duration-fast: 150ms;       /* 快速交互 */
  --duration-normal: 250ms;     /* 标准过渡 */
  --duration-slow: 400ms;       /* 复杂动画 */
  --duration-slower: 600ms;     /* 页面过渡 */
}

/* === 预设动画 === */

/* 入场动画 */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideInDown {
  from {
    opacity: 0;
    transform: translateY(-16px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* 退场动画 */
@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes slideOutUp {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(-16px);
  }
}

/* 强调动画 */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

/* === 工具类 === */

.animate-fade-in {
  animation: fadeIn var(--duration-normal) var(--ease-out);
}

.animate-slide-in-up {
  animation: slideInUp var(--duration-normal) var(--ease-out);
}

.animate-scale-in {
  animation: scaleIn var(--duration-normal) var(--ease-bounce);
}

.animate-shake {
  animation: shake 0.4s var(--ease-default);
}

/* 交错动画 */
.stagger-children > * {
  animation: slideInUp var(--duration-normal) var(--ease-out) both;
}

.stagger-children > *:nth-child(1) { animation-delay: 0ms; }
.stagger-children > *:nth-child(2) { animation-delay: 50ms; }
.stagger-children > *:nth-child(3) { animation-delay: 100ms; }
.stagger-children > *:nth-child(4) { animation-delay: 150ms; }
.stagger-children > *:nth-child(5) { animation-delay: 200ms; }

/* 减少动效 */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 4.2 页面过渡动画

```vue
<!-- 在 App.vue 中 -->
<template>
  <RouterView v-slot="{ Component, route }">
    <Transition :name="transitionName" mode="out-in">
      <component :is="Component" :key="route.path" />
    </Transition>
  </RouterView>
</template>

<script setup lang="ts">
const router = useRouter()
const transitionName = ref('page-slide')

router.beforeEach((to, from) => {
  // 根据路由深度决定动画方向
  const toDepth = to.path.split('/').length
  const fromDepth = from.path.split('/').length
  transitionName.value = toDepth >= fromDepth ? 'page-slide-left' : 'page-slide-right'
})
</script>

<style>
/* 页面过渡 */
.page-slide-left-enter-active,
.page-slide-left-leave-active,
.page-slide-right-enter-active,
.page-slide-right-leave-active {
  transition: all var(--duration-slow) var(--ease-default);
}

.page-slide-left-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.page-slide-left-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

.page-slide-right-enter-from {
  opacity: 0;
  transform: translateX(-30px);
}

.page-slide-right-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
</style>
```

### 4.3 骨架屏加载

```vue
<!-- BaseSkeleton.vue -->
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
interface Props {
  variant?: 'text' | 'circular' | 'rectangular'
  width?: string | number
  height?: string | number
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

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
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
```

#### 使用示例：WordCard骨架屏

```vue
<!-- WordCardSkeleton.vue -->
<template>
  <div class="word-card-skeleton">
    <BaseSkeleton width="60%" height="20px" />
    <BaseSkeleton width="80%" height="14px" />
    <BaseSkeleton width="40%" height="14px" />
  </div>
</template>

<style scoped>
.word-card-skeleton {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4);
  background: var(--color-surface-card);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border-light);
}
</style>
```

### 4.4 Toast通知系统

```vue
<!-- ToastContainer.vue -->
<template>
  <Teleport to="body">
    <div class="toast-container" aria-live="polite">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          :class="['toast', `toast--${toast.type}`]"
          role="alert"
        >
          <BaseIcon :name="iconMap[toast.type]" size="sm" />
          <span class="toast__message">{{ toast.message }}</span>
          <button
            v-if="toast.dismissible"
            class="toast__close"
            @click="remove(toast.id)"
          >
            <BaseIcon name="X" size="xs" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
interface Toast {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  message: string
  dismissible: boolean
  duration: number
}

const toasts = ref<Toast[]>([])

const iconMap = {
  success: 'CheckCircle',
  error: 'XCircle',
  warning: 'AlertTriangle',
  info: 'Info'
}

const add = (toast: Omit<Toast, 'id'>) => {
  const id = Math.random().toString(36).slice(2)
  toasts.value.push({ ...toast, id })

  if (toast.duration > 0) {
    setTimeout(() => remove(id), toast.duration)
  }
}

const remove = (id: string) => {
  const index = toasts.value.findIndex(t => t.id === id)
  if (index > -1) toasts.value.splice(index, 1)
}

// 全局暴露
provide('toast', { add, remove })
</script>

<style scoped>
.toast-container {
  position: fixed;
  bottom: var(--space-6);
  right: var(--space-6);
  z-index: 2000;
  display: flex;
  flex-direction: column-reverse;
  gap: var(--space-3);
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface-elevated);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  pointer-events: auto;
  min-width: 280px;
  max-width: 400px;
}

.toast--success { border-left: 3px solid var(--color-state-success); }
.toast--error { border-left: 3px solid var(--color-state-error); }
.toast--warning { border-left: 3px solid var(--color-state-warning); }
.toast--info { border-left: 3px solid var(--color-brand-primary); }

.toast__message {
  flex: 1;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
}

.toast__close {
  display: flex;
  padding: var(--space-1);
  background: none;
  border: none;
  color: var(--color-text-tertiary);
  cursor: pointer;
  border-radius: var(--radius-xs);
}

.toast__close:hover {
  background: var(--color-bg-tertiary);
}

/* 过渡 */
.toast-enter-active {
  transition: all var(--duration-normal) var(--ease-bounce);
}

.toast-leave-active {
  transition: all var(--duration-fast) var(--ease-in);
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

/* 移动端适配 */
@media (max-width: 480px) {
  .toast-container {
    left: var(--space-4);
    right: var(--space-4);
    bottom: var(--space-4);
  }

  .toast {
    min-width: auto;
    max-width: none;
  }
}
</style>
```

### 4.5 手势支持增强

```typescript
// composables/useSwipe.ts
import { ref, onMounted, onUnmounted } from 'vue'

interface SwipeOptions {
  threshold?: number
  timeout?: number
}

export function useSwipe(
  elementRef: Ref<HTMLElement | null>,
  options: SwipeOptions = {}
) {
  const { threshold = 50, timeout = 300 } = options

  const direction = ref<'left' | 'right' | 'up' | 'down' | null>(null)
  const isSwiping = ref(false)

  let startX = 0
  let startY = 0
  let startTime = 0

  const onTouchStart = (e: TouchEvent) => {
    startX = e.touches[0].clientX
    startY = e.touches[0].clientY
    startTime = Date.now()
    isSwiping.value = true
  }

  const onTouchEnd = (e: TouchEvent) => {
    if (!isSwiping.value) return

    const endX = e.changedTouches[0].clientX
    const endY = e.changedTouches[0].clientY
    const elapsed = Date.now() - startTime

    if (elapsed > timeout) {
      isSwiping.value = false
      return
    }

    const deltaX = endX - startX
    const deltaY = endY - startY

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // 水平滑动
      if (Math.abs(deltaX) > threshold) {
        direction.value = deltaX > 0 ? 'right' : 'left'
      }
    } else {
      // 垂直滑动
      if (Math.abs(deltaY) > threshold) {
        direction.value = deltaY > 0 ? 'down' : 'up'
      }
    }

    isSwiping.value = false
  }

  onMounted(() => {
    const el = elementRef.value
    if (!el) return

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
  })

  onUnmounted(() => {
    const el = elementRef.value
    if (!el) return

    el.removeEventListener('touchstart', onTouchStart)
    el.removeEventListener('touchend', onTouchEnd)
  })

  return {
    direction,
    isSwiping
  }
}
```

---

## 5. 响应式设计改进

> 注：项目采用 480px 单断点策略（移动端/桌面端两态设计），已满足需求。

### 5.1 容器查询应用

```css
/* 卡片组件使用容器查询 */
.word-grid {
  container-type: inline-size;
  container-name: word-grid;
}

@container word-grid (min-width: 400px) {
  .word-card {
    flex-direction: row;
  }
}

@container word-grid (min-width: 600px) {
  .word-card {
    padding: var(--space-6);
  }

  .word-card__title {
    font-size: var(--font-size-xl);
  }
}
```

### 5.2 流体排版

```css
/* typography-fluid.css */

:root {
  /* 流体字体大小 */
  --font-size-fluid-sm: clamp(12px, 1vw + 10px, 14px);
  --font-size-fluid-base: clamp(14px, 1.2vw + 10px, 16px);
  --font-size-fluid-lg: clamp(16px, 1.5vw + 10px, 20px);
  --font-size-fluid-xl: clamp(20px, 2vw + 12px, 28px);
  --font-size-fluid-2xl: clamp(28px, 3vw + 14px, 40px);
  --font-size-fluid-3xl: clamp(36px, 4vw + 16px, 56px);
}

/* 应用到标题 */
.page-title {
  font-size: var(--font-size-fluid-2xl);
  line-height: 1.2;
}

.section-title {
  font-size: var(--font-size-fluid-xl);
  line-height: 1.3;
}
```

### 5.3 响应式组件变体

```vue
<!-- 响应式WordGrid -->
<template>
  <div :class="['word-grid', `word-grid--${viewMode}`]">
    <WordCard
      v-for="word in words"
      :key="word.id"
      :word="word"
      :compact="isMobile"
    />
  </div>
</template>

<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'

const isMobile = useMediaQuery('(max-width: 480px)')

const viewMode = computed(() => {
  return isMobile.value ? 'list' : 'grid'
})
</script>

<style scoped>
.word-grid {
  display: grid;
  gap: var(--space-4);
}

.word-grid--list {
  grid-template-columns: 1fr;
}

.word-grid--grid {
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
}
</style>
```

---

## 6. 性能优化

### 6.1 CSS优化

#### 减少重绘/重排

```css
/* 使用transform和opacity做动画 */
.card-enter {
  /* 避免 */
  /* top: 10px; left: 10px; */

  /* 推荐 */
  transform: translate(10px, 10px);
}

/* 使用will-change提示 */
.animated-element {
  will-change: transform, opacity;
}

/* 动画结束后移除will-change */
.animated-element.animation-done {
  will-change: auto;
}
```

#### 关键CSS内联

```html
<!-- index.html -->
<head>
  <style>
    /* 关键渲染路径CSS */
    :root {
      --color-bg-page: #FAF7F2;
      --color-text-primary: #2D3748;
    }

    body {
      margin: 0;
      background: var(--color-bg-page);
      color: var(--color-text-primary);
      font-family: 'Crimson Pro', Georgia, serif;
    }

    /* 首屏骨架 */
    .app-shell {
      min-height: 100vh;
    }
  </style>
  <link rel="preload" href="/styles/main.css" as="style">
</head>
```

### 6.2 组件懒加载

```typescript
// router/index.ts
const routes = [
  {
    path: '/',
    component: () => import('@/pages/HomePage.vue')
  },
  {
    path: '/review',
    component: () => import('@/pages/ReviewPage.vue')
  },
  {
    path: '/statistics',
    component: () => import('@/pages/StatisticsPage.vue')
  },
  // 预加载可能访问的页面
  {
    path: '/vocabulary',
    component: () => import(
      /* webpackPrefetch: true */
      '@/pages/VocabularyManagementPage.vue'
    )
  }
]
```

### 6.3 虚拟列表

```vue
<!-- VirtualWordList.vue -->
<template>
  <div
    ref="containerRef"
    class="virtual-list"
    @scroll="onScroll"
  >
    <div :style="{ height: `${totalHeight}px` }">
      <div
        :style="{ transform: `translateY(${offsetY}px)` }"
      >
        <WordCard
          v-for="item in visibleItems"
          :key="item.id"
          :word="item"
          :style="{ height: `${itemHeight}px` }"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  items: Word[]
  itemHeight: number
  buffer?: number
}

const props = withDefaults(defineProps<Props>(), {
  buffer: 5
})

const containerRef = ref<HTMLElement>()
const scrollTop = ref(0)
const containerHeight = ref(0)

const totalHeight = computed(() => props.items.length * props.itemHeight)

const startIndex = computed(() => {
  return Math.max(0, Math.floor(scrollTop.value / props.itemHeight) - props.buffer)
})

const endIndex = computed(() => {
  const visibleCount = Math.ceil(containerHeight.value / props.itemHeight)
  return Math.min(props.items.length, startIndex.value + visibleCount + props.buffer * 2)
})

const visibleItems = computed(() => {
  return props.items.slice(startIndex.value, endIndex.value)
})

const offsetY = computed(() => startIndex.value * props.itemHeight)

const onScroll = () => {
  if (containerRef.value) {
    scrollTop.value = containerRef.value.scrollTop
  }
}

onMounted(() => {
  if (containerRef.value) {
    containerHeight.value = containerRef.value.clientHeight

    const observer = new ResizeObserver(entries => {
      containerHeight.value = entries[0].contentRect.height
    })
    observer.observe(containerRef.value)
  }
})
</script>
```

### 6.4 图片优化

```vue
<!-- OptimizedImage.vue -->
<template>
  <picture>
    <source
      v-if="webpSrc"
      :srcset="webpSrc"
      type="image/webp"
    >
    <img
      :src="src"
      :alt="alt"
      :loading="lazy ? 'lazy' : 'eager'"
      :decoding="lazy ? 'async' : 'sync'"
      :width="width"
      :height="height"
      @load="onLoad"
      @error="onError"
    >
  </picture>
</template>

<script setup lang="ts">
interface Props {
  src: string
  alt: string
  width?: number
  height?: number
  lazy?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  lazy: true
})

const webpSrc = computed(() => {
  if (props.src.endsWith('.webp')) return null
  return props.src.replace(/\.(jpg|jpeg|png)$/, '.webp')
})
</script>
```

---

## 7. 可访问性增强

### 7.1 焦点管理

```css
/* focus-visible样式 */
:focus-visible {
  outline: 2px solid var(--color-brand-primary);
  outline-offset: 2px;
}

:focus:not(:focus-visible) {
  outline: none;
}

/* 跳过链接 */
.skip-link {
  position: absolute;
  top: -100%;
  left: 50%;
  transform: translateX(-50%);
  padding: var(--space-3) var(--space-4);
  background: var(--color-brand-primary);
  color: var(--color-text-inverse);
  border-radius: var(--radius-default);
  z-index: 9999;
  transition: top var(--duration-fast);
}

.skip-link:focus {
  top: var(--space-4);
}
```

### 7.2 屏幕阅读器支持

```vue
<!-- 在关键区域添加ARIA标签 -->
<template>
  <main id="main-content" role="main" aria-label="主要内容">
    <!-- 页面内容 -->
  </main>

  <nav aria-label="主导航">
    <ul role="menubar">
      <li role="none">
        <a role="menuitem" href="/">首页</a>
      </li>
    </ul>
  </nav>

  <!-- 实时区域 -->
  <div
    aria-live="polite"
    aria-atomic="true"
    class="sr-only"
  >
    {{ announcement }}
  </div>
</template>

<script setup>
const announcement = ref('')

// 通知屏幕阅读器
const announce = (message: string) => {
  announcement.value = ''
  nextTick(() => {
    announcement.value = message
  })
}
</script>
```

### 7.3 键盘导航增强

```typescript
// composables/useKeyboardNavigation.ts
export function useKeyboardNavigation(
  items: Ref<HTMLElement[]>,
  options: {
    orientation?: 'horizontal' | 'vertical' | 'both'
    loop?: boolean
  } = {}
) {
  const { orientation = 'vertical', loop = true } = options
  const currentIndex = ref(0)

  const handleKeydown = (e: KeyboardEvent) => {
    const isVertical = orientation === 'vertical' || orientation === 'both'
    const isHorizontal = orientation === 'horizontal' || orientation === 'both'

    let newIndex = currentIndex.value

    if (isVertical && e.key === 'ArrowDown') {
      e.preventDefault()
      newIndex = currentIndex.value + 1
    } else if (isVertical && e.key === 'ArrowUp') {
      e.preventDefault()
      newIndex = currentIndex.value - 1
    } else if (isHorizontal && e.key === 'ArrowRight') {
      e.preventDefault()
      newIndex = currentIndex.value + 1
    } else if (isHorizontal && e.key === 'ArrowLeft') {
      e.preventDefault()
      newIndex = currentIndex.value - 1
    } else if (e.key === 'Home') {
      e.preventDefault()
      newIndex = 0
    } else if (e.key === 'End') {
      e.preventDefault()
      newIndex = items.value.length - 1
    }

    // 处理循环
    if (loop) {
      if (newIndex < 0) newIndex = items.value.length - 1
      if (newIndex >= items.value.length) newIndex = 0
    } else {
      newIndex = Math.max(0, Math.min(newIndex, items.value.length - 1))
    }

    currentIndex.value = newIndex
    items.value[newIndex]?.focus()
  }

  return {
    currentIndex,
    handleKeydown
  }
}
```

### 7.4 颜色对比度检查

```typescript
// utils/a11y.ts
export function getContrastRatio(color1: string, color2: string): number {
  const lum1 = getLuminance(color1)
  const lum2 = getLuminance(color2)
  const lighter = Math.max(lum1, lum2)
  const darker = Math.min(lum1, lum2)
  return (lighter + 0.05) / (darker + 0.05)
}

export function meetsWCAG(
  foreground: string,
  background: string,
  level: 'AA' | 'AAA' = 'AA',
  isLargeText = false
): boolean {
  const ratio = getContrastRatio(foreground, background)

  if (level === 'AAA') {
    return isLargeText ? ratio >= 4.5 : ratio >= 7
  }
  return isLargeText ? ratio >= 3 : ratio >= 4.5
}

// 开发时检查
if (import.meta.env.DEV) {
  const checkContrast = () => {
    const styles = getComputedStyle(document.documentElement)
    const textPrimary = styles.getPropertyValue('--color-text-primary').trim()
    const bgPrimary = styles.getPropertyValue('--color-bg-primary').trim()

    if (!meetsWCAG(textPrimary, bgPrimary)) {
      console.warn('⚠️ Text contrast does not meet WCAG AA standards')
    }
  }

  window.addEventListener('load', checkContrast)
}
```

---

## 8. 实施优先级与路线图

### 8.1 优先级矩阵

| 改进项 | 影响 | 工作量 | 优先级 | 状态 |
|--------|------|--------|--------|------|
| 骨架屏加载 | 高 | 低 | P0 | ✅ 完成 |
| 按钮系统重构 | 中 | 中 | P1 | ✅ 完成 |
| 动效系统规范 | 中 | 低 | P1 | ✅ 完成 |
| Toast通知 | 中 | 低 | P1 | ✅ 完成 |
| 输入框标准化 | 中 | 中 | P1 | ✅ 完成 |
| 虚拟列表 | 高 | 高 | P2 | ✅ 完成 |
| 手势支持 | 低 | 中 | P3 | ✅ 完成 |
| 容器查询 | 低 | 低 | P3 | ✅ 完成 |
| 可访问性增强 | 中 | 中 | P3 | ✅ 完成 |

### 8.2 实施路线图

```
Phase 1 (1-2周) - 基础设施
├── ✅ 设计令牌分层重构 (tokens.css)
├── ✅ 动效系统规范 (animations.css)
└── ✅ 骨架屏组件 (BaseSkeleton.vue)

Phase 2 (2-3周) - 组件库
├── ✅ BaseButton 重构
├── ✅ BaseCard 统一
├── ✅ BaseInput 标准化
├── ✅ BaseModal 重构
├── ✅ BaseIcon 图标系统
└── ✅ Toast 通知系统

Phase 3 (2-3周) - 体验优化
├── ✅ 页面过渡动画 (App.vue + animations.css)
├── ✅ 路由懒加载 (router/index.ts)
├── ✅ Vendor 分包优化 (vite.config.ts)
├── ✅ 页面加载骨架屏 (App.vue Suspense)
└── 图片优化 (按需实施)

Phase 4 (持续) - 高级特性
├── ✅ 虚拟列表 (VirtualList.vue)
├── ✅ 手势支持 (useSwipe.ts)
├── ✅ 容器查询 (container-queries.css)
├── ✅ 可访问性增强 (accessibility.css, a11y.ts)
└── ✅ 键盘导航 (useKeyboardNavigation.ts)
```

### 8.3 迁移策略

1. **渐进式迁移**
   - 新组件使用新系统
   - 逐步替换旧组件
   - 保持向后兼容

2. **特性开关**
   ```typescript
   // config/features.ts
   export const features = {
     newButtons: true,
     virtualList: false,
     gestureSupport: false
   }
   ```

3. **A/B测试**
   - 对关键改动进行用户测试
   - 收集反馈迭代

---

## 附录

### A. 设计令牌完整清单

参见 `tokens.css` 重构方案

### B. 组件API规范

参见各组件的 Props/Emits 定义

### C. 图标使用指南

| 场景 | 图标 | 尺寸 |
|------|------|------|
| 导航 | Home, BookOpen, Mic, Settings | md (20px) |
| 操作 | Plus, Edit, Trash, Check | sm (16px) |
| 状态 | CheckCircle, XCircle, AlertTriangle | lg (24px) |
| 装饰 | Star, Heart, Award | xl (32px) |

### D. 快捷键规范

| 功能 | 快捷键 |
|------|--------|
| 下一个单词 | Space / Enter |
| 记住 | 1 |
| 没记住 | 2 |
| 显示释义 | S |
| 播放发音 | P |
| 返回 | Escape |

---

---

## 实施记录

### 已创建/更新的文件

**样式系统：**
- `shared/styles/tokens.css` - 三层架构设计令牌（Primitives → Semantic → Component）
- `shared/styles/animations.css` - 增强动效系统（缓动曲线、持续时间、交错动画、减少动效支持）
- `shared/styles/accessibility.css` - 可访问性样式（焦点管理、跳过链接、高对比度支持）
- `shared/styles/container-queries.css` - 容器查询样式（响应式组件布局）

**基础组件库 (`shared/components/base/`)：**
- `BaseButton.vue` - 统一按钮组件
- `BaseCard.vue` - 统一卡片组件
- `BaseIcon.vue` - 图标系统（封装 lucide-vue-next）
- `BaseInput.vue` - 标准化输入框
- `BaseModal.vue` - 模态框组件
- `BaseSkeleton.vue` - 骨架屏组件
- `ToastContainer.vue` - Toast 通知容器
- `VirtualList.vue` - 虚拟列表组件（大数据渲染优化）
- `index.ts` - 组件导出入口

**Composables：**
- `shared/composables/useToast.ts` - Toast 通知 hook
- `shared/composables/useSwipe.ts` - 手势滑动支持（四向检测）
- `shared/composables/useKeyboardNavigation.ts` - 键盘导航增强

**Utils：**
- `shared/utils/a11y.ts` - 可访问性工具（对比度检查、屏幕阅读器通知、焦点陷阱）

**应用集成：**
- `app/App.vue` - 集成 ToastContainer、页面过渡动画、Suspense 懒加载骨架屏
- `app/router/index.ts` - 路由懒加载，添加 SpeakingPage 和 SettingsPage 路由
- `vite.config.ts` - Vendor 分包优化（vue-vendor、echarts、lucide 独立打包）

### 已重构的业务组件

| 组件 | 使用的基础组件 |
|------|----------------|
| `features/vocabulary/relations/AddRelationDialog.vue` | BaseModal、BaseButton、BaseInput |
| `pages/settings/SourceSettings.vue` | BaseButton、BaseInput、BaseIcon |
| `pages/settings/LearningSettings.vue` | BaseButton、BaseIcon |
| `pages/settings/HotkeySettings.vue` | BaseButton、BaseIcon |
| `pages/settings/LapseSettings.vue` | BaseButton、BaseIcon |
| `features/vocabulary/relations/RelationGraphSearch.vue` | BaseInput |
| `features/vocabulary/grid/SearchFilter.vue` | BaseInput、BaseIcon |
| `features/vocabulary/relations/RelationGraphContextMenu.vue` | BaseIcon |
| `shared/components/RelationGraphModal.vue` | BaseButton、BaseIcon |

### 待重构的组件（需要更多设计工作）

以下组件有复杂的响应式布局和专门化行为，建议在未来迭代中逐步重构：

| 组件 | 原因 |
|------|------|
| WordCard | 专门化的 ease_factor 背景色逻辑 |
| ReviewCard | 复杂的按钮布局，emoji 图标，状态颜色 |
| WordEditorModal | 专门化的滚动锁定和键盘事件处理 |
| WordInsertForm | 加载状态、批量导入、自动补全功能 |

### 使用示例

```vue
<script setup>
import { BaseButton, BaseCard, BaseInput, BaseModal, BaseIcon, BaseSkeleton } from '@/shared/components/base'
import { useToast } from '@/shared/composables/useToast'

const toast = useToast()

const showSuccess = () => {
  toast.success('操作成功！')
}
</script>

<template>
  <BaseCard elevation="raised">
    <template #header>标题</template>

    <BaseInput
      v-model="text"
      label="输入框"
      placeholder="请输入..."
    />

    <template #footer>
      <BaseButton variant="ghost">取消</BaseButton>
      <BaseButton @click="showSuccess">确认</BaseButton>
    </template>
  </BaseCard>
</template>
```

---

> 文档版本: 1.4.0
> 最后更新: 2026-01-25
> 作者: Claude Code Frontend Analysis
>
> **版本历史:**
> - 1.4.0 - 完成 Phase 4 高级特性（VirtualList、useSwipe、容器查询、可访问性增强、键盘导航）
> - 1.3.0 - 完成 Phase 3 性能优化（路由懒加载、页面过渡动画、Vendor 分包、Suspense 骨架屏）
> - 1.2.0 - 完成 Phase 2 组件迁移（SourceSettings、SearchFilter、RelationGraph* 组件）
> - 1.1.0 - 基础组件库创建和 AddRelationDialog 迁移
> - 1.0.0 - 初始优化方案
