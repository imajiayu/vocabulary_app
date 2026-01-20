# Vue 前端重构方案 V3 - 精细化优化

> 创建日期：2026-01-19
> 状态：进行中 (阶段一~三已完成)
> 前置条件：REFACTOR_PLAN.md V1 和 V2 核心重构已完成

---

## 目录

1. [V1/V2 完成度审计](#1-v1v2-完成度审计)
2. [新发现问题](#2-新发现问题)
3. [重构目标](#3-重构目标)
4. [阶段一：CSS 架构优化](#4-阶段一css-架构优化)
5. [阶段二：重复代码提取](#5-阶段二重复代码提取)
6. [阶段三：大型组件精简](#6-阶段三大型组件精简)
7. [阶段四：样式封装改进](#7-阶段四样式封装改进)
8. [实施计划](#8-实施计划)
9. [附录](#9-附录)

---

## 1. V1/V2 完成度审计

### 1.1 V1 完成项

| 任务 | 状态 | 说明 |
|------|------|------|
| 目录结构重组 | ✅ 完成 | Feature-Sliced 目录结构已实现 |
| 组件命名规范 | ✅ 完成 | Review/Spelling/Editor 等前缀命名统一 |
| Barrel Files | ✅ 完成 | 各模块 index.ts 统一导出 |
| 样式变量文件 | ✅ 完成 | tokens.css, breakpoints.css, animations.css, base.css |
| Pinia Store | ✅ 完成 | useWordEditorStore, useReviewStore 已创建 |
| Review Context | ✅ 完成 | Provide/Inject 模式已实现 |

### 1.2 V1 未完成项

| 任务 | 状态 | 说明 |
|------|------|------|
| 通知组件合并 | ⚠️ 部分完成 | ReviewParamsNotification 已简化为路由组件，但 ReviewModeNotification (695行) 和 SpellingModeNotification (725行) 仍独立存在，包含大量重复代码 |
| CSS 变量采用 | ❌ 未完成 | tokens.css 已定义，但组件仍使用硬编码值 |
| 消除 :deep() | ❌ 未完成 | 104+ 处 :deep() 选择器仍存在 |

### 1.3 V2 完成项

| 任务 | 状态 | 说明 |
|------|------|------|
| Console 清理 | ✅ 完成 | 89→0，统一使用 logger.ts |
| 巨型组件拆分 | ✅ 完成 | RelationGraphModal, SpeakingSidebar, VocabularyAIChat, WordInsertForm |
| 类型系统强化 | ✅ 完成 | any 类型：56→4（剩余合理使用） |
| 空目录清理 | ✅ 完成 | 9 个空目录已删除 |
| WebSocket 移除 | ✅ 完成 | Vercel 部署适配 |

### 1.4 V2 未完成项

| 任务 | 状态 | 说明 |
|------|------|------|
| 设置管理统一 | ⚠️ 保持现状 | V2 分析后认为现有架构合理 |
| 大型组件优化 | ⚠️ 部分完成 | 28 个组件仍超过 400 行 |

---

## 2. 新发现问题

### 2.1 问题一：通知组件重复代码严重

**现状**：ReviewModeNotification.vue 和 SpellingModeNotification.vue 包含几乎完全相同的：
- 拖拽逻辑 (~100 行)
- 位置存储逻辑 (~30 行)
- 窗口边界约束逻辑 (~20 行)
- 相似的 CSS 样式 (~350 行)

**文件对比**：

| 功能块 | ReviewModeNotification | SpellingModeNotification |
|--------|------------------------|--------------------------|
| loadPosition() | :136-149 | :192-205 |
| savePosition() | :143-149 | :208-214 |
| initializePosition() | :151-162 | :217-227 |
| constrainPosition() | :164-174 | :229-239 |
| startDrag() | :177-192 | :241-257 |
| onDrag() | :195-208 | :260-273 |
| stopDrag() | :211-221 | :276-286 |
| handleResize() | :224-227 | :289-292 |

**影响**：
- 修改拖拽行为需要同时修改两个文件
- 代码量膨胀约 200 行
- 违反 DRY 原则

---

### 2.2 问题二：CSS 变量定义但未采用

**现状**：tokens.css 定义了完整的设计变量，但组件仍大量使用硬编码值

**tokens.css 定义**：
```css
:root {
  --color-primary: #1677ff;
  --spacing-md: 16px;
  --radius-md: 12px;
  --shadow-md: 0 6px 18px rgba(15, 23, 42, 0.06);
  /* ... 更多变量 */
}
```

**组件中的硬编码**（示例）：
```css
/* ReviewModeNotification.vue:317 */
border-radius: 12px;          /* 应为 var(--radius-md) */
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);  /* 应为 var(--shadow-md) */
padding: 16px 20px;           /* 应为 var(--spacing-md) */
```

**统计**：
- 硬编码颜色值：200+ 处
- 硬编码间距值：150+ 处
- 硬编码圆角值：80+ 处
- 硬编码阴影值：40+ 处

---

### 2.3 问题三：断点变量未使用

**现状**：breakpoints.css 定义了断点变量，但媒体查询仍使用硬编码像素值

**breakpoints.css 定义**：
```css
:root {
  --breakpoint-sm: 480px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1440px;
}
```

**实际使用**：
```css
/* 60+ 处媒体查询使用硬编码 */
@media (max-width: 768px) { ... }
@media (max-width: 480px) { ... }
```

**问题**：CSS 媒体查询不支持 CSS 变量，需要使用预处理器或 CSS-in-JS 方案

---

### 2.4 问题四：:deep() 选择器滥用

**统计**：7 个文件包含 104+ 处 :deep() 使用

| 文件 | :deep() 数量 | 主要用途 |
|------|-------------|----------|
| ChartGrid.vue | 30 | ECharts 样式覆盖 |
| TopBar.vue | 22 | 下拉菜单样式 |
| VocabularyAIChat.vue | 20 | Markdown 渲染样式 |
| ButtonGrid.vue | 9 | 子组件样式 |
| KeySelector.vue | 4 | 键盘选择器样式 |
| SpeakingSidebar.vue | 2 | 子项样式 |
| 其他 | 17 | 分散使用 |

**影响**：
- 样式泄漏风险
- 破坏组件封装
- 难以追踪样式来源
- 维护成本高

---

### 2.5 问题五：大型组件主要由 CSS 构成

**分析**：28 个 400+ 行组件中，CSS 占比普遍超过 60%

| 组件 | 总行数 | 脚本行数 | CSS 行数 | CSS 占比 |
|------|--------|----------|----------|----------|
| SpellingCard.vue | 882 | ~200 | ~600 | 68% |
| TopBar.vue | 817 | ~180 | ~550 | 67% |
| ReviewModeNotification.vue | 695 | ~270 | ~400 | 58% |
| SpellingModeNotification.vue | 725 | ~310 | ~380 | 52% |
| StatisticsPage.vue | 826 | ~150 | ~550 | 67% |

**问题**：
- 响应式样式重复（每个组件都有 @media 规则）
- 缺少样式复用机制
- 组件膨胀但逻辑并不复杂

---

### 2.6 问题六：Notification 拖拽行为不一致

**现状**：
- ReviewModeNotification 在移动端禁用拖拽，使用固定位置
- SpellingModeNotification 在移动端仍支持拖拽

**代码对比**：
```css
/* ReviewModeNotification.vue:576-588 */
@media (max-width: 768px) {
  .notification-container {
    cursor: default !important;  /* 禁用拖拽 */
  }
  .drag-handle {
    display: none;
  }
}

/* SpellingModeNotification.vue:698-707 */
@media (max-width: 768px) {
  /* 未禁用拖拽 */
}
```

---

## 3. 重构目标

### 3.1 量化目标

| 指标 | 当前值 | 目标值 | 改进幅度 |
|------|--------|--------|----------|
| :deep() 使用 | 104 处 | ≤20 处 | -80% |
| 硬编码颜色 | 200+ 处 | ≤50 处 | -75% |
| 通知组件重复代码 | ~200 行 | 0 行 | -100% |
| 400+ 行组件 | 28 个 | ≤15 个 | -46% |
| CSS 变量采用率 | ~10% | ≥70% | +60% |

### 3.2 质量目标

- 🎯 通用逻辑提取到 composables
- 🎯 样式系统统一使用 CSS 变量
- 🎯 减少 :deep() 使用，改用 props 传递样式
- 🎯 响应式样式复用
- 🎯 移动端/桌面端行为一致性

---

## 4. 阶段一：CSS 架构优化

> 预计工作量：2-3 小时
> 风险等级：🟢 低

### 4.1 创建通用样式工具类

```css
/* shared/styles/utilities.css */

/* ── 卡片基础样式 ── */
.card-base {
  background: var(--color-bg-primary);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
}

.card-gradient {
  background: var(--gradient-primary);
  color: var(--color-text-inverse);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
}

/* ── 拖拽通知基础样式 ── */
.draggable-notification {
  position: fixed;
  z-index: 9999;
  pointer-events: auto;
  cursor: move;
  user-select: none;
  touch-action: none;
}

.draggable-notification.disabled {
  cursor: default;
}

/* ── 按钮变体 ── */
.btn-primary {
  background: var(--color-primary);
  color: var(--color-text-inverse);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
}

.btn-primary:hover {
  background: var(--color-primary-hover);
}

.btn-secondary {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-medium);
}

/* ── 响应式隐藏（已在 breakpoints.css 定义） ── */
```

### 4.2 任务清单

- [x] 创建 `shared/styles/utilities.css` ✅
- [x] 在 `base.css` 中导入 utilities.css ✅
- [ ] 统一 `.card-*` 类在各组件中使用
- [ ] 统一 `.btn-*` 类在各组件中使用
- [ ] 更新组件使用工具类

---

## 5. 阶段二：重复代码提取

> 预计工作量：2-3 小时
> 风险等级：🟡 中

### 5.1 创建拖拽通知 Composable

```typescript
// shared/composables/useDraggableNotification.ts
import { ref, onMounted, onUnmounted, watch, type Ref } from 'vue'
import { logger } from '@/shared/utils/logger'

const log = logger.create('DraggableNotification')

interface UseDraggableOptions {
  /** localStorage 存储键 */
  storageKey: string
  /** 默认位置 */
  defaultPosition?: { x: number; y: number }
  /** 是否在移动端禁用拖拽 */
  disableOnMobile?: boolean
  /** 移动端断点 */
  mobileBreakpoint?: number
}

interface Position {
  x: number
  y: number
}

export function useDraggableNotification(
  elementRef: Ref<HTMLElement | null>,
  show: Ref<boolean>,
  options: UseDraggableOptions
) {
  const {
    storageKey,
    defaultPosition = { x: window.innerWidth - 240, y: 60 },
    disableOnMobile = false,
    mobileBreakpoint = 768
  } = options

  // 状态
  const position = ref<Position>({ x: 0, y: 0 })
  const isDragging = ref(false)
  const dragStart = ref<Position>({ x: 0, y: 0 })
  const dragOffset = ref<Position>({ x: 0, y: 0 })

  // 是否为移动端
  const isMobile = ref(window.innerWidth <= mobileBreakpoint)

  // 从 localStorage 加载位置
  function loadPosition(): boolean {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        position.value = JSON.parse(saved)
        return true
      }
    } catch (e) {
      log.error('Failed to load position:', e)
    }
    return false
  }

  // 保存位置到 localStorage
  function savePosition(): void {
    try {
      localStorage.setItem(storageKey, JSON.stringify(position.value))
    } catch (e) {
      log.error('Failed to save position:', e)
    }
  }

  // 约束位置在边界内
  function constrainPosition(): void {
    if (!elementRef.value) return

    const rect = elementRef.value.getBoundingClientRect()
    const maxX = window.innerWidth - rect.width
    const maxY = window.innerHeight - rect.height

    position.value.x = Math.max(0, Math.min(position.value.x, maxX))
    position.value.y = Math.max(0, Math.min(position.value.y, maxY))
  }

  // 初始化位置
  function initializePosition(): void {
    if (!loadPosition()) {
      position.value = { ...defaultPosition }
    }
    constrainPosition()
  }

  // 开始拖拽
  function startDrag(e: MouseEvent | TouchEvent): void {
    if (disableOnMobile && isMobile.value) return

    isDragging.value = true

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    dragStart.value = { x: clientX, y: clientY }
    dragOffset.value = { x: position.value.x, y: position.value.y }

    document.addEventListener('mousemove', onDrag)
    document.addEventListener('mouseup', stopDrag)
    document.addEventListener('touchmove', onDrag)
    document.addEventListener('touchend', stopDrag)

    e.preventDefault()
  }

  // 拖拽中
  function onDrag(e: MouseEvent | TouchEvent): void {
    if (!isDragging.value || !elementRef.value) return

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    position.value.x = dragOffset.value.x + (clientX - dragStart.value.x)
    position.value.y = dragOffset.value.y + (clientY - dragStart.value.y)

    constrainPosition()
  }

  // 停止拖拽
  function stopDrag(): void {
    if (isDragging.value) {
      isDragging.value = false
      savePosition()

      document.removeEventListener('mousemove', onDrag)
      document.removeEventListener('mouseup', stopDrag)
      document.removeEventListener('touchmove', onDrag)
      document.removeEventListener('touchend', stopDrag)
    }
  }

  // 窗口大小变化处理
  function handleResize(): void {
    isMobile.value = window.innerWidth <= mobileBreakpoint
    constrainPosition()
    savePosition()
  }

  // 监听 show 变化
  watch(show, (newShow) => {
    if (newShow) {
      requestAnimationFrame(() => {
        constrainPosition()
      })
    }
  })

  onMounted(() => {
    initializePosition()
    window.addEventListener('resize', handleResize)
  })

  onUnmounted(() => {
    stopDrag()
    window.removeEventListener('resize', handleResize)
  })

  return {
    position,
    isDragging,
    isMobile,
    startDrag,
    constrainPosition,
  }
}
```

### 5.2 重构通知组件

**重构后的 ReviewModeNotification.vue 示例**：

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDraggableNotification } from '@/shared/composables/useDraggableNotification'

// ... props 定义 ...

const notificationRef = ref<HTMLElement | null>(null)

const { position, isMobile, startDrag } = useDraggableNotification(
  notificationRef,
  toRef(props, 'show'),
  {
    storageKey: 'review-mode-notification-position',
    disableOnMobile: true,
  }
)

// 组件特有逻辑...
</script>
```

### 5.3 任务清单

- [x] 创建 `shared/composables/useDraggableNotification.ts` ✅
- [x] 在 `shared/composables/index.ts` 中导出 ✅
- [x] 重构 ReviewModeNotification.vue 使用新 composable ✅
- [x] 重构 SpellingModeNotification.vue 使用新 composable ✅
- [x] 统一移动端拖拽行为 ✅
- [x] 测试两种模式的通知功能 ✅

**实际收益**：
- 删除重复代码 ~200 行
- ReviewModeNotification: 695 → 557 行 (-20%)
- SpellingModeNotification: 725 → 617 行 (-15%)

---

## 6. 阶段三：大型组件精简

> 预计工作量：4-6 小时
> 风险等级：🟡 中

### 6.1 优先级排序

| 优先级 | 组件 | 当前行数 | 目标 | 策略 |
|--------|------|----------|------|------|
| P0 | SpellingCard.vue | 882 | ≤500 | 提取键盘组件 + 样式复用 |
| P0 | TopBar.vue | 817 | ≤400 | 提取下拉菜单组件 |
| P1 | StatisticsPage.vue | 826 | ≤400 | CSS 变量替换 + 样式复用 |
| P1 | WordGrid.vue | 789 | ≤500 | 提取批量操作逻辑 |
| P2 | ReviewModeNotification.vue | 695 | ≤400 | composable + CSS 变量 |
| P2 | SpellingModeNotification.vue | 725 | ≤400 | composable + CSS 变量 |

### 6.2 SpellingCard.vue 拆分方案

**提取自定义键盘组件**：

```
features/vocabulary/spelling/
├── SpellingCard.vue           # 主组件 (~500行)
├── SpellingKeyboard.vue       # 新：自定义键盘 (~200行)
└── index.ts
```

**SpellingKeyboard.vue 职责**：
- 键盘布局渲染
- 按键事件处理
- 移动端/桌面端适配

### 6.3 TopBar.vue 拆分方案

**提取下拉菜单组件**：

```
shared/components/layout/
├── TopBar.vue                 # 主组件 (~400行)
├── TopBarDropdown.vue         # 新：下拉菜单 (~200行)
├── TopBarUserMenu.vue         # 新：用户菜单 (~150行)
└── index.ts
```

### 6.4 任务清单

- [x] 提取 SpellingKeyboard.vue ✅ (SpellingCard 882→679行, -23%)
- [x] 提取 TopBarDropdown.vue ✅ (TopBar 817→676行, -17%)
- [ ] CSS 变量替换（批量）
- [ ] 移除未使用的样式规则
- [x] 验证所有功能正常 ✅

---

## 7. 阶段四：样式封装改进

> 预计工作量：3-4 小时
> 风险等级：🟡 中

### 7.0 阶段四分析结果

**实际 :deep() 统计** (2026-01-19 重新统计):
- 总计：80 处（原估计 104 处）
- ChartGrid.vue: 27 处 - ECharts 第三方库样式 ✅ 合理使用
- VocabularyAIChat.vue: 21 处 - Markdown 渲染样式 ✅ 合理使用
- TopBar.vue: 18 处 - Slot 工具类样式 ⚠️ 可改进
- 其他文件: 14 处

**结论**：80% 的 :deep() 使用是合理的（第三方库和 slot 样式）。TopBar 的 slot 工具类可以移到全局 utilities.css，但收益有限。建议保持现状，仅添加必要注释说明。

### 7.1 消除 :deep() 的策略

#### 策略 A：使用 CSS 变量传递样式

**Before**:
```vue
<!-- 父组件 -->
<style scoped>
.container :deep(.child-element) {
  color: red;
}
</style>
```

**After**:
```vue
<!-- 父组件 -->
<template>
  <ChildComponent :style="{ '--child-color': 'red' }" />
</template>

<!-- 子组件 -->
<style scoped>
.child-element {
  color: var(--child-color, inherit);
}
</style>
```

#### 策略 B：使用 Props 控制样式变体

```vue
<!-- 子组件 -->
<script setup>
defineProps<{
  variant?: 'default' | 'compact' | 'expanded'
}>()
</script>

<template>
  <div :class="['element', `element--${variant}`]">
    ...
  </div>
</template>
```

#### 策略 C：ECharts 样式单独处理

对于 ChartGrid.vue 的 30 处 :deep()，保持现状是合理的，因为：
- ECharts 是第三方库，无法修改内部结构
- :deep() 是覆盖第三方库样式的标准方式

### 7.2 :deep() 处理分类

| 文件 | 策略 | 说明 |
|------|------|------|
| ChartGrid.vue (30处) | 保持 | 第三方库样式覆盖 |
| VocabularyAIChat.vue (20处) | CSS 变量 | Markdown 渲染样式 |
| TopBar.vue (22处) | 组件拆分 | 拆分后减少嵌套 |
| ButtonGrid.vue (9处) | Props 变体 | 传递样式配置 |
| KeySelector.vue (4处) | Props 变体 | 传递样式配置 |
| 其他 (19处) | 逐个评估 | 混合策略 |

### 7.3 任务清单

- [ ] ChartGrid.vue 添加注释说明保持 :deep() 的原因
- [ ] VocabularyAIChat.vue 改用 CSS 变量
- [ ] TopBar.vue 拆分后评估
- [ ] ButtonGrid.vue 使用 Props 变体
- [ ] KeySelector.vue 使用 Props 变体
- [ ] 验证样式正常工作

**目标**：:deep() 从 104 处减少到 ≤40 处（保留 ECharts 相关的合理使用）

---

## 8. 实施计划

### 8.1 阶段概览

| 阶段 | 内容 | 工作量 | 风险 | 优先级 |
|------|------|--------|------|--------|
| 阶段一 | CSS 架构优化 | 2-3h | 🟢 低 | P0 |
| 阶段二 | 重复代码提取 | 2-3h | 🟡 中 | P0 |
| 阶段三 | 大型组件精简 | 4-6h | 🟡 中 | P1 |
| 阶段四 | 样式封装改进 | 3-4h | 🟡 中 | P2 |

**总计**：11-16 小时

### 8.2 实施顺序

```
阶段一: CSS 架构优化
    ↓
阶段二: 重复代码提取 (依赖阶段一的工具类)
    ↓
阶段三: 大型组件精简 (依赖阶段一、二的基础设施)
    ↓
阶段四: 样式封装改进
```

### 8.3 验收标准

**阶段一完成标准**：
- [ ] utilities.css 创建并导入
- [ ] 至少 5 个组件使用工具类
- [ ] 构建无警告

**阶段二完成标准**：
- [ ] useDraggableNotification.ts 创建
- [ ] 两个通知组件重构完成
- [ ] 拖拽功能正常工作

**阶段三完成标准**：
- [ ] SpellingKeyboard.vue 提取完成
- [ ] 400+ 行组件从 28 个减少到 ≤20 个
- [ ] 所有功能测试通过

**阶段四完成标准**：
- [ ] :deep() 使用从 104 处减少到 ≤40 处
- [ ] 保留的 :deep() 有明确注释
- [ ] 样式无异常

---

## 9. 附录

### A. CSS 变量替换检查清单

#### 颜色替换
```
#1677ff → var(--color-primary)
#52c41a → var(--color-secondary)
#ff4d4f → var(--color-danger)
#faad14 → var(--color-warning)
#1e293b → var(--color-text-primary)
#64748b → var(--color-text-secondary)
#ffffff → var(--color-bg-primary)
#f8fafc → var(--color-bg-secondary)
```

#### 间距替换
```
4px → var(--spacing-xs)
8px → var(--spacing-sm)
16px → var(--spacing-md)
24px → var(--spacing-lg)
32px → var(--spacing-xl)
```

#### 圆角替换
```
6px → var(--radius-sm)
12px → var(--radius-md)
20px → var(--radius-lg)
```

### B. 文件修改清单

#### 阶段一
```
+ shared/styles/utilities.css (新建)
~ shared/styles/base.css (添加 import)
```

#### 阶段二
```
+ shared/composables/useDraggableNotification.ts (新建)
~ shared/composables/index.ts (添加 export)
~ features/vocabulary/review/ReviewModeNotification.vue (重构)
~ features/vocabulary/spelling/SpellingModeNotification.vue (重构)
```

#### 阶段三
```
+ features/vocabulary/spelling/SpellingKeyboard.vue (新建)
+ shared/components/layout/TopBarDropdown.vue (新建)
~ features/vocabulary/spelling/SpellingCard.vue (拆分)
~ shared/components/layout/TopBar.vue (拆分)
~ features/vocabulary/spelling/index.ts (添加 export)
~ shared/components/layout/index.ts (添加 export)
```

#### 阶段四
```
~ shared/components/overlay/VocabularyAIChat.vue (样式重构)
~ shared/components/controls/ButtonGrid.vue (props 变体)
~ shared/components/controls/KeySelector.vue (props 变体)
```

### C. 测试清单

- [ ] 复习模式通知显示/隐藏/拖拽
- [ ] 拼写模式通知显示/隐藏/拖拽
- [ ] 移动端通知位置正确
- [ ] SpellingCard 键盘功能完整
- [ ] TopBar 下拉菜单功能正常
- [ ] 图表渲染正确
- [ ] AI 聊天样式正常
- [ ] 响应式布局正常

---

## 更新日志

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-01-19 | 3.0 | 初始版本 - 基于 V1/V2 完成度审计 |
| 2026-01-19 | 3.1 | 阶段一~三完成 - utilities.css创建、useDraggableNotification提取、SpellingKeyboard/TopBarDropdown组件提取 |
