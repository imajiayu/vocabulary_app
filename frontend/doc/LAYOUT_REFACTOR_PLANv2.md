# 布局系统重构计划 V2

基于 V1 完成后的全面审查，本文档记录进一步优化的方向。

## V1 完成回顾

### 已完成的优化
- ✅ 阶段 1：统一 CSS 变量（布局尺寸）
- ✅ 阶段 2：简化 HomePage 布局（JS → CSS）
- ✅ 阶段 3：统一 ReviewPage 布局模式
- ✅ 阶段 4：创建 PageLayout 组件

### 当前构建体积
- CSS: 210.40 kB
- JS: 1,459.41 kB

---

## 审查发现的问题

### 1. 硬编码值仍然存在（P0 - 高优先级）

#### 1.1 颜色硬编码

| 文件 | 问题代码 | 建议替换 |
|------|----------|----------|
| StatisticsPage.vue | `background: #fff` | `var(--color-bg-primary)` |
| StatisticsPage.vue | `background: white` | `var(--color-bg-primary)` |
| VocabularyManagementPage.vue | `background: white` | `var(--color-bg-primary)` |
| ReviewPage.vue | `color: #000` | `var(--color-text-primary)` |
| ReviewPage.vue | `color: #cbd5e1` | `var(--color-text-tertiary)` |
| SpeakingPage.vue | `linear-gradient(135deg, #a3bffa, #667eea)` | 新增 `--gradient-speaking` |

#### 1.2 尺寸硬编码

| 文件 | 问题代码 | 建议 |
|------|----------|------|
| HomePage.vue | `height: 56px` | 新增 `--mobile-tab-height` |
| SettingsPage.vue | `max-width: 900px` | 新增 `--content-max-width-narrow` |
| SpeakingPage.vue | `max-width: 1200px` | 新增 `--content-max-width-wide` |
| ReviewPage.vue | `max-width: 400px` | 使用 `--content-max-width-narrow` |

#### 1.3 间距硬编码

```css
/* 需要替换的常见硬编码 */
gap: 6px;           /* → var(--spacing-xs) 或新增 --spacing-2xs: 6px */
padding: 2em;       /* → var(--spacing-2xl) */
margin-bottom: 64px; /* → 新增 --spacing-3xl: 64px */
```

---

### 2. 媒体查询断点不统一（P0 - 高优先级）

#### 2.1 当前混乱的断点使用

```
480px  - tokens.css 定义的 --breakpoint-mobile
768px  - TopBar.vue 的 isMobile 检测（不一致！）
481px  - ReviewPage.vue 的桌面端检测
1440px - 超宽屏适配
```

#### 2.2 建议的断点体系

```css
:root {
  /* 断点定义（用于文档参考，CSS 媒体查询需硬编码） */
  --breakpoint-sm: 480px;   /* 小屏手机 */
  --breakpoint-md: 768px;   /* 平板/大手机 */
  --breakpoint-lg: 1024px;  /* 桌面 */
  --breakpoint-xl: 1440px;  /* 超宽屏 */
}
```

#### 2.3 需要修复的文件

| 文件 | 问题 | 建议 |
|------|------|------|
| TopBar.vue | `window.innerWidth <= 768` 判断 isMobile | 改为 480px 或创建统一的 useBreakpoint composable |
| base.css | `@media (min-width: 481px)` | 统一使用 `(min-width: 481px)` 或 `(min-width: 769px)` |

---

### 3. 重复的媒体查询块（P1 - 中优先级）

#### 3.1 HomePage.vue
当前已合并，但仍有改进空间。

#### 3.2 SpeakingPage.vue
```css
/* 存在两个 @media (max-width: 480px) 块需要合并 */
@media (max-width: 480px) { ... }
@media (max-width: 480px) { ... }  /* 重复！ */
```

#### 3.3 StatisticsPage.vue
存在分散的媒体查询，应合并到文件底部统一管理。

---

### 4. 过渡动画不统一（P1 - 中优先级）

#### 4.1 当前问题

```css
/* 同一个 cubic-bezier 函数在多处重复 */
transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);  /* HomePage */
transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);  /* MainNavigation */
transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1); /* MainNavigation */
```

#### 4.2 建议方案

在 tokens.css 中添加：
```css
:root {
  /* 缓动函数 */
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-decelerate: cubic-bezier(0, 0, 0.2, 1);
  --ease-accelerate: cubic-bezier(0.4, 0, 1, 1);

  /* 组合过渡 */
  --transition-standard: 0.3s var(--ease-standard);
  --transition-expand: 0.4s var(--ease-standard);
}
```

---

### 5. 布局模式选择指南缺失（P1 - 中优先级）

#### 5.1 当前存在的三种模式

| 模式 | 类/组件 | 适用场景 |
|------|---------|----------|
| flex-layout | `.app-container.flex-layout` | TopBar 固定 + 内容可滚动 |
| with-topbar | `.app-container.with-topbar` | 简单 padding 顶部 |
| PageLayout | `<PageLayout>` 组件 | 简单页面的快速布局 |

#### 5.2 建议创建文档

```markdown
## 布局模式选择指南

### 使用 PageLayout 组件
- 页面结构简单：TopBar + 内容
- 无额外的侧边栏或浮动组件
- 示例：StatisticsPage

### 使用 .flex-layout 类
- 需要固定 TopBar + 可滚动内容
- 有额外组件（侧边栏、通知等）
- 示例：ReviewPage

### 使用 .with-topbar 类
- 内容自然流动，不需要固定高度
- 页面可以有自然滚动
- 示例：VocabularyManagementPage
```

---

### 6. !important 过度使用（P2 - 低优先级）

#### 6.1 统计

共 14 个文件使用了 `!important`：
- TopBar.vue
- SettingsPage.vue
- RelationSettings.vue
- HotkeySettings.vue
- VocabularyAIChat.vue
- SwitchTab.vue
- ProgressBar.vue
- WordEditorModal.vue
- ReviewResult.vue
- ReviewCard.vue
- WordSideBar.vue
- TopicItem.vue
- SpeakingSidebar.vue
- ChartGrid.vue

#### 6.2 优先清理的文件

1. **ReviewCard.vue** - 已在 V1 中清理部分
2. **TopBar.vue** - 媒体查询中的 `!important`
3. **SettingsPage.vue** - 设置页面的样式覆盖

---

### 7. 字体大小体系不完整（P2 - 低优先级）

#### 7.1 当前定义

```css
--font-size-xs: 10px;
--font-size-sm: 12px;
--font-size-base: 14px;
--font-size-lg: 16px;
--font-size-xl: 18px;
--font-size-2xl: 24px;
--font-size-3xl: 28px;
```

#### 7.2 缺失的尺寸

```css
/* 页面中使用但未定义的 */
font-size: 32px;  /* SettingsPage 标题 */
font-size: 50px;  /* SpeakingPage 大标题 */
font-size: 20px;  /* SpeakingPage 副标题 */
```

#### 7.3 建议补充

```css
--font-size-4xl: 32px;
--font-size-5xl: 40px;
--font-size-6xl: 50px;
```

---

### 8. 圆角值映射不清晰（P2 - 低优先级）

#### 8.1 当前硬编码

```css
border-radius: 0.75rem;   /* 12px - 应为 --radius-md */
border-radius: 0.5rem;    /* 8px - 应为 --radius-default */
border-radius: 0.375rem;  /* 6px - 应为 --radius-sm */
border-radius: 0.25rem;   /* 4px - 应为 --radius-xs */
```

#### 8.2 建议

在 CLAUDE.md 或样式文档中添加映射表。

---

### 9. 阴影值不规范（P3 - 可选）

#### 9.1 自定义阴影

```css
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);      /* 未使用变量 */
box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4); /* 品牌色阴影 */
box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);    /* 未使用变量 */
```

#### 9.2 建议

添加品牌色阴影变量：
```css
--shadow-primary: 0 4px 15px rgba(102, 126, 234, 0.3);
--shadow-primary-lg: 0 8px 25px rgba(102, 126, 234, 0.4);
```

---

## 优化执行计划

### 阶段 5：颜色和尺寸统一（低风险）

**目标**：消除所有硬编码的颜色和关键尺寸

**任务**：
1. 在 tokens.css 添加缺失的颜色变量
2. 替换所有 `#fff`、`white`、`#000` 等硬编码
3. 添加 `--content-max-width-*` 系列变量
4. 添加 `--mobile-tab-height` 变量

**预期收益**：
- 主题切换更容易
- 尺寸修改只需改一处

---

### 阶段 6：媒体查询统一（中风险）

**目标**：统一断点标准，合并重复的媒体查询

**任务**：
1. 统一 isMobile 检测标准（480px 或 768px 二选一）
2. 合并 SpeakingPage.vue 的重复媒体查询
3. 整理 StatisticsPage.vue 的媒体查询到文件底部
4. 创建 useBreakpoint composable（可选）

**预期收益**：
- 响应式行为一致
- 代码更易维护

---

### 阶段 7：过渡动画统一（低风险）

**目标**：提取缓动函数为 CSS 变量

**任务**：
1. 在 tokens.css 添加 `--ease-*` 变量
2. 替换所有 `cubic-bezier(0.4, 0, 0.2, 1)`
3. 创建组合过渡变量 `--transition-expand`

**预期收益**：
- 动画风格统一
- 修改动画参数更方便

---

### 阶段 8：清理 !important（中风险）

**目标**：减少 `!important` 的使用

**任务**：
1. 分析每个 `!important` 的必要性
2. 通过提高选择器特异性替代 `!important`
3. 记录确实需要 `!important` 的场景

**预期收益**：
- CSS 优先级更可预测
- 样式覆盖更可控

---

### 阶段 9：补充字体和圆角变量（低风险）

**目标**：完善设计系统变量

**任务**：
1. 添加 `--font-size-4xl` 到 `--font-size-6xl`
2. 添加品牌色阴影变量
3. 创建变量映射文档

**预期收益**：
- 设计系统更完整
- 新组件开发更快

---

## 优先级总览

| 阶段 | 优先级 | 风险 | 工作量 | 状态 |
|------|--------|------|--------|------|
| 阶段 5 | P0 | 低 | 中 | 待执行 |
| 阶段 6 | P0 | 中 | 中 | 待执行 |
| 阶段 7 | P1 | 低 | 小 | 待执行 |
| 阶段 8 | P2 | 中 | 大 | 可选 |
| 阶段 9 | P2 | 低 | 小 | 可选 |

---

## 文件变更统计（V1 完成后）

```
frontend/src/pages/HomePage.vue                    | 182 行变更
frontend/src/pages/ReviewPage.vue                  |  89 行变更
frontend/src/pages/StatisticsPage.vue              | 155 行变更
frontend/src/shared/components/layout/MainNavigation.vue | 133 行变更
frontend/src/shared/components/layout/TopBar.vue   |   6 行变更
frontend/src/shared/components/layout/PageLayout.vue | 新增文件
frontend/src/shared/styles/base.css                |  24 行变更
frontend/src/shared/styles/tokens.css              |  17 行变更
```

---

## 附录：需要关注的页面

### 高优先级审查
1. **SpeakingPage.vue** - 大量硬编码渐变色和尺寸
2. **VocabularyManagementPage.vue** - 硬编码白色背景
3. **SettingsPage.vue** - 自定义布局，未使用通用容器

### 中优先级审查
1. **设置子页面（6个）** - 样式较分散
2. **Speaking 模块组件** - 媒体查询不统一

### 低优先级审查
1. **图表组件** - ChartGrid 等
2. **反馈组件** - Loading、ProgressBar 等
