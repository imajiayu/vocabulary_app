# 布局系统重构计划

## 背景

当前前端布局存在以下问题：
- HTML 层级嵌套复杂，各容器样式分散在多个组件中
- JS 与 CSS 职责混乱（边距用 JS computed 计算，样式用 CSS 媒体查询）
- CSS 变量未充分利用（tokens.css 定义了变量但大量硬编码）
- 媒体查询重复且断点不统一（480px、481px、768px 混用）

## 目标

- 保持现有 UI 视觉效果不变
- 简化布局代码，提高可维护性
- 统一使用 CSS 变量
- 减少 JS 计算，让 CSS 处理响应式布局

---

## 阶段 1：统一 CSS 变量（低风险） ✅ 已完成

### 1.1 在 tokens.css 添加布局变量

```css
/* 导航栏尺寸 */
--nav-width: 48px;
--nav-width-expanded: 280px;
--nav-width-mobile: 40px;
--nav-width-expanded-mobile: 220px;

/* 侧边栏尺寸 */
--speaking-sidebar-width: 320px;
--speaking-sidebar-width-tablet: 280px;
--speaking-sidebar-width-mobile: 260px;

/* 断点值（用于文档，CSS 中仍需硬编码媒体查询） */
--breakpoint-mobile: 480px;
--breakpoint-tablet: 768px;
```

### 1.2 替换硬编码尺寸

| 文件 | 当前值 | 替换为 |
|------|--------|--------|
| MainNavigation.vue | `width: 48px` | `width: var(--nav-width)` |
| MainNavigation.vue | `width: 280px` | `width: var(--nav-width-expanded)` |
| TopBar.vue | `height: 48px` | `height: var(--topbar-height)` |
| ReviewPage.vue | `margin-top: 48px` | `margin-top: var(--topbar-height)` |
| base.css | `padding-top: var(--topbar-height)` | 已正确使用 ✓ |

### 1.3 预期收益

- 尺寸定义集中在 tokens.css
- 修改尺寸只需改一处
- 为后续阶段铺路

### 1.4 实施记录

**完成日期**: 2026-01-20

**变更文件**:
- `tokens.css`: 添加导航栏、侧边栏、按钮栏高度等布局变量
- `MainNavigation.vue`:
  - 替换 `width: 48px` → `var(--nav-width)`
  - 替换 `width: 280px` → `var(--nav-width-expanded)`
  - 替换 `height: 48px` → `var(--nav-width)`
  - 替换硬编码颜色 → CSS 变量
  - 合并两个重复的 `@media (max-width: 480px)` 块为一个
- `TopBar.vue`: 默认 height 改为 `var(--topbar-height)`
- `ReviewPage.vue`: 替换 `margin-top: 48px` → `var(--topbar-height)`

---

## 阶段 2：简化 HomePage 布局（中等风险） ✅ 已完成

### 2.1 当前问题

```javascript
// HomePage.vue - JS 计算边距（需要移除）
const navMargin = computed(() => {
  const isMobile = window.innerWidth <= 768
  const isSmallMobile = window.innerWidth <= 480
  if (navExpanded.value) {
    return isSmallMobile ? 220 : (isMobile ? 240 : 280)
  } else {
    return isSmallMobile ? 40 : (isMobile ? 44 : 48)
  }
})
```

### 2.2 解决方案

使用 CSS 变量 + 媒体查询替代 JS 计算：

```css
/* HomePage.vue scoped styles */
.main-container {
  --current-nav-width: var(--nav-width);
  --current-sidebar-width: 0px;
  margin-left: calc(var(--current-nav-width) + var(--current-sidebar-width));
  transition: margin-left var(--transition-slow);
}

/* 导航栏展开时 */
.app-container.nav-expanded .main-container {
  --current-nav-width: var(--nav-width-expanded);
}

/* 侧边栏展开时（仅 speaking 模式） */
.app-container.sidebar-expanded .main-container {
  --current-sidebar-width: var(--speaking-sidebar-width);
}

/* 移动端 */
@media (max-width: 768px) {
  .main-container {
    --current-nav-width: 0px; /* 移动端无左侧导航 */
    --current-sidebar-width: 0px; /* 移动端侧边栏是底部抽屉 */
    margin-left: 0;
    padding-top: 80px;
  }
}
```

### 2.3 合并重复媒体查询

当前有两个 `@media (max-width: 480px)` 块，合并为一个。

### 2.4 预期收益

- 移除 `navMargin`、`sidebarMargin` 的 JS computed
- 移除 inline style 的 `marginLeft` 绑定
- 响应式逻辑完全由 CSS 处理

### 2.5 实施记录

**完成日期**: 2026-01-20

**变更内容**:
- `HomePage.vue` 模板:
  - 给 `.app-container` 添加动态类: `nav-expanded`、`sidebar-expanded`、`is-mobile`
  - 移除 `main-container` 的 inline style (`:style="{ marginLeft, paddingTop }"`)
- `HomePage.vue` JS:
  - 移除 `navMargin` 和 `sidebarMargin` 的 computed 计算
  - 边距逻辑完全由 CSS 类选择器控制
- `HomePage.vue` CSS:
  - 定义 `--current-nav-width` 和 `--current-sidebar-width` 局部变量
  - 通过 `.nav-expanded`、`.sidebar-expanded`、`.is-mobile` 类切换变量值
  - 合并两个重复的 `@media (max-width: 480px)` 块为一个
  - 使用 CSS 变量替代硬编码值

**代码行数变化**: CSS 从 ~170 行简化为 ~170 行（结构更清晰），JS computed 减少 ~20 行

---

## 阶段 3：统一 ReviewPage 布局模式（中等风险） ✅ 已完成

### 3.1 当前问题

1. ReviewPage.vue 重复定义了 `.app-container` 样式（base.css 已有）
2. 使用 `!important` 覆盖 `.with-topbar` 的 `padding-top`
3. ReviewCard.vue 的底部按钮栏用 `position: fixed`，内容区需硬编码 `padding-bottom`

### 3.2 解决方案

**方案 A：CSS Grid 布局**

```css
/* ReviewPage.vue */
.app-container.with-topbar {
  display: grid;
  grid-template-rows: var(--topbar-height) 1fr auto;
  height: 100vh;
  height: 100dvh;
  padding-top: 0; /* 移除 base.css 的 padding-top */
}

.main-content {
  overflow-y: auto;
  /* 移除 margin-top，由 grid 处理 */
}

.button-bar {
  /* 移除 position: fixed，由 grid 固定在底部 */
  position: sticky;
  bottom: 0;
}
```

**方案 B：保持 fixed 但简化**

如果方案 A 影响范围太大，可以：
1. 移除 ReviewPage.vue 中重复的 `.app-container` 样式
2. 在 base.css 添加 `.app-container.review-page` 变体
3. 统一 `padding-bottom` 的计算方式

### 3.3 处理 ReviewCard 底部按钮栏

将 `padding-bottom` 改为 CSS 变量：

```css
:root {
  --button-bar-height: 120px;
  --button-bar-height-mobile: 140px;
}

.content-area {
  padding-bottom: var(--button-bar-height);
}

@media (max-width: 480px) {
  .content-area {
    padding-bottom: var(--button-bar-height-mobile);
  }
}
```

### 3.4 预期收益

- 移除 `!important` 覆盖
- 布局逻辑更清晰
- 底部按钮栏高度可配置

### 3.5 实施记录

**完成日期**: 2026-01-20

**实际采用方案**: 方案 B 的简化版 - 在 base.css 添加 `.flex-layout` 变体类

**变更内容**:
- `base.css`:
  - 新增 `.app-container.flex-layout` 类，提供 flex column + 可滚动内容的布局
  - 该类自动处理 `height: 100dvh`、`overflow: hidden`、子元素 `margin-top` 等
- `ReviewPage.vue`:
  - 将 `with-topbar` 改为 `flex-layout`
  - 移除重复的 `.app-container` 样式定义（~40 行）
  - 移除所有 `!important` 覆盖（共 12 处）
  - 移动端媒体查询简化，只保留组件样式调整

**CSS 体积变化**: 210.79 kB → 210.12 kB (减少 0.67 kB)

**注意**: ReviewCard.vue 的底部按钮栏仍使用 `position: fixed`，保持现有行为不变。如需进一步优化可在后续迭代中处理。

---

## 阶段 4：提取 PageLayout 组件（可选，高收益） ✅ 已完成

### 4.1 设计

创建 `shared/components/layout/PageLayout.vue`：

```vue
<template>
  <div class="page-layout" :class="layoutClasses">
    <TopBar v-if="showTopBar" v-bind="topBarProps">
      <template #left><slot name="topbar-left" /></template>
      <template #center><slot name="topbar-center" /></template>
      <template #right><slot name="topbar-right" /></template>
    </TopBar>

    <main class="page-content" :class="contentClass">
      <slot />
    </main>

    <footer v-if="$slots.footer" class="page-footer">
      <slot name="footer" />
    </footer>
  </div>
</template>

<script setup lang="ts">
interface Props {
  showTopBar?: boolean
  topBarProps?: Record<string, any>
  contentClass?: string
  scrollable?: boolean
}
</script>
```

### 4.2 使用方式

```vue
<!-- ReviewPage.vue 简化后 -->
<template>
  <PageLayout show-top-bar scrollable>
    <template #topbar-center>
      <ReviewProgress />
    </template>

    <ReviewCard :word="currentWord" />

    <template #footer>
      <ButtonBar />
    </template>
  </PageLayout>
</template>
```

### 4.3 预期收益

- 布局逻辑集中管理
- 新页面可快速复用
- TopBar + 内容 + 底部栏的关系封装在一处

### 4.4 实施记录

**完成日期**: 2026-01-20

**创建组件**:
- `shared/components/layout/PageLayout.vue`
  - 支持 `flex-layout` 和 `with-topbar` 两种布局模式
  - 透传 TopBar 的常用 props（showHomeButton、showManagementButton 等）
  - 提供 slots：`topbar-left`、`topbar-center`、`topbar-right`、default、`footer`
  - 支持 `maxWidth` 和 `contentClass` 配置

**迁移页面**:
- `StatisticsPage.vue`: 成功迁移，使用 `<Teleport>` 处理 modal
- `ReviewPage.vue`: **不迁移** - 结构复杂（含 WordSideBar、ReviewParamsNotification、VocabularyAIChat），保持使用 `.flex-layout` 类

**构建体积变化**:
- CSS: 210.12 kB → 210.40 kB (+0.28 kB，PageLayout 组件样式)
- JS: 1,457.86 kB → 1,459.41 kB (+1.55 kB，PageLayout 组件代码)

**注意**: 新页面建议优先使用 PageLayout；复杂页面（如 ReviewPage）可直接使用 `.flex-layout` 或 `.with-topbar` 类。

---

## 实施顺序

| 阶段 | 风险 | 工作量 | 优先级 |
|------|------|--------|--------|
| 阶段 1 | 低 | 小 | **高** |
| 阶段 2 | 中 | 中 | 高 |
| 阶段 3 | 中 | 中 | 中 |
| 阶段 4 | 高 | 大 | 低（可选） |

建议按顺序实施，每个阶段完成后测试验证再进入下一阶段。

---

## 测试检查清单

每个阶段完成后需验证：

- [ ] 首页：导航栏展开/收起，内容居中
- [ ] 首页：口语页面侧边栏展开/收起，内容居中
- [ ] 复习页面：TopBar 固定，内容可滚动
- [ ] 复习页面：底部按钮栏固定，不遮挡内容
- [ ] 拼写页面：同复习页面
- [ ] 移动端：所有页面响应式正常
- [ ] 移动端：底部安全区域正确处理

---

## 回滚策略

每个阶段的修改都应该是可独立回滚的。建议：
1. 每个阶段完成后创建 git commit
2. 如果某阶段出现问题，可以单独回滚该阶段
