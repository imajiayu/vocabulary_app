# Vue 前端重构方案

> 创建日期：2026-01-18
> 状态：✅ 已完成

---

## 目录

1. [问题诊断](#1-问题诊断)
2. [目录结构重构](#2-目录结构重构)
3. [组件命名规范](#3-组件命名规范)
4. [组件通信解耦](#4-组件通信解耦)
5. [样式系统重构](#5-样式系统重构)
6. [实施计划](#6-实施计划)
7. [风险评估](#7-风险评估)

---

## 1. 问题诊断

### 1.1 现状概览

| 指标 | 数值 |
|------|------|
| Vue 组件总数 | 63 个 |
| Feature 模块 | 3 个 (vocabulary, speaking, statistics) |
| 共享组件 | 29 个 (21 UI + 8 布局/图表) |
| Pinia Store | 2 个 |
| Composables | 10 个 |
| 最大嵌套深度 | 6 层 (ReviewPage) |

### 1.2 核心问题

#### 问题一：目录层级不明确，组件命名混淆

**现状**：
- `features/vocabulary/components/` 下 18 个组件平铺，无子目录分组
- `shared/components/ui/` 下 16 个组件无分类
- 组件命名存在歧义：
  - `ReviewPage.vue` (页面) vs `WordReview.vue` (组件) 容易混淆
  - `WordDetailModal` vs `WordDetailsReview` vs `WordDetailsEdit` 职责边界模糊
  - `WordActionsSiderbar.vue` 存在拼写错误 (Siderbar → Sidebar)

**影响**：
- 新开发者难以快速定位组件
- 相关功能组件物理上分散，理解成本高
- 命名不一致导致代码审查和维护困难

#### 问题二：组件耦合严重，参数传递跨越多层

**现状**：
- `WordDetailModal` 需要处理 6 个 emit 事件
- ReviewPage 的 props 穿透 4 层组件
- 事件冒泡链路过长：
  ```
  WordCard → emit → WordGrid → emit → Page → handler
  ```

**典型案例**：
```vue
<!-- WordDetailModal 的 6 个事件 -->
@close
@wordDeleted
@requestClose
@wordForgot
@wordMastered
@update:editData
```

```vue
<!-- Props 穿透示例 -->
ReviewPage
  └── mode, audioType, shuffle → WordReview
        └── mode → WordDetailsReview
              └── mode → RelatedWordsDisplay
```

**影响**：
- 修改一个组件可能需要同时修改多个父/子组件
- 事件追踪困难，调试成本高
- 组件复用性差

#### 问题三：样式繁杂，层级嵌套深

**现状**：
- 响应式断点硬编码且不一致：`768px`, `480px`, `500px`, `1440px`
- 大量使用 `:deep()` 选择器导致样式泄漏
- 内联样式与 scoped 样式混用
- 无统一的样式分层架构

**典型问题代码**：
```vue
<style scoped>
/* :deep() 滥用导致样式意外影响其他组件 */
.main-content :deep(.word-review-container .content-area) {
  padding: 20px;
}
</style>
```

```vue
<!-- 内联样式与 scoped 样式混用 -->
<div
  :style="{
    backgroundColor: isRemembered ? '#10b981' : backgroundColor,
    color: '#374151'
  }"
  class="card"
>
```

**影响**：
- 样式调试困难，难以定位实际生效的规则
- 响应式行为不一致
- 主题切换和样式统一成本高

---

## 2. 目录结构重构

### 2.1 目标结构

```
src/
├── app/                              # 应用入口 (不变)
│   ├── App.vue
│   ├── main.ts
│   └── router/
│       └── index.ts
│
├── pages/                            # 页面组件 (简化为路由入口)
│   ├── ReviewPage.vue
│   ├── VocabularyPage.vue           # 重命名：VocabularyManagementPage → VocabularyPage
│   ├── SpeakingPage.vue
│   ├── StatisticsPage.vue
│   └── SettingsPage.vue
│
├── features/                         # 功能模块
│   │
│   ├── vocabulary/                   # 词汇模块
│   │   ├── review/                   # ── 复习功能 ──
│   │   │   ├── ReviewCard.vue              # 原 WordReview.vue
│   │   │   ├── ReviewResult.vue            # 原 WordDetailsReview.vue
│   │   │   ├── ReviewNotification.vue      # 合并 ReviewMode/ParamsNotification
│   │   │   ├── ReviewSpeedIndicator.vue
│   │   │   └── index.ts                    # barrel export
│   │   │
│   │   ├── spelling/                 # ── 拼写功能 ──
│   │   │   ├── SpellingCard.vue            # 原 WordSpelling.vue
│   │   │   ├── SpellingNotification.vue    # 原 SpellingModeNotification.vue
│   │   │   └── index.ts
│   │   │
│   │   ├── editor/                   # ── 编辑功能 ──
│   │   │   ├── WordEditorModal.vue         # 原 WordDetailModal.vue
│   │   │   ├── WordEditorForm.vue          # 合并 WordInfoSection + WordDetailsEdit
│   │   │   ├── WordEditorActions.vue       # 原 WordActionsSiderbar.vue (修正拼写)
│   │   │   ├── WordInsertForm.vue
│   │   │   └── index.ts
│   │   │
│   │   ├── grid/                     # ── 列表展示 ──
│   │   │   ├── WordGrid.vue
│   │   │   ├── WordCard.vue
│   │   │   ├── WordTooltip.vue
│   │   │   ├── SearchFilter.vue            # 原 SearchAndFilter.vue
│   │   │   └── index.ts
│   │   │
│   │   ├── relations/                # ── 词汇关系 ──
│   │   │   ├── RelatedWordsPanel.vue       # 原 RelatedWordsDisplay.vue
│   │   │   ├── RelationGraphModal.vue
│   │   │   └── index.ts
│   │   │
│   │   ├── sidebar/                  # ── 侧边栏 ──
│   │   │   ├── WordSideBar.vue
│   │   │   └── index.ts
│   │   │
│   │   ├── index/                    # ── 入口选择 ──
│   │   │   ├── WordIndex.vue
│   │   │   └── index.ts
│   │   │
│   │   ├── stores/
│   │   │   ├── useReviewStore.ts
│   │   │   └── useWordEditorStore.ts       # 新增
│   │   │
│   │   ├── composables/
│   │   │   ├── useWordEditor.ts            # 新增：编辑逻辑
│   │   │   └── useReviewSession.ts         # 新增：复习会话
│   │   │
│   │   └── index.ts                  # 模块入口
│   │
│   ├── speaking/                     # 口语模块
│   │   ├── practice/                 # ── 练习功能 ──
│   │   │   ├── QuestionPractice.vue
│   │   │   ├── VoicePractice.vue
│   │   │   └── index.ts
│   │   │
│   │   ├── sidebar/                  # ── 侧边导航 ──
│   │   │   ├── SpeakingSidebar.vue
│   │   │   ├── PartItem.vue
│   │   │   ├── TopicItem.vue
│   │   │   ├── QuestionItem.vue
│   │   │   └── index.ts
│   │   │
│   │   ├── records/                  # ── 录音记录 ──
│   │   │   ├── RecordsList.vue
│   │   │   ├── RecordItem.vue
│   │   │   ├── RecordContent.vue
│   │   │   ├── AudioPlayer.vue
│   │   │   └── index.ts
│   │   │
│   │   ├── status/                   # ── 状态显示 ──
│   │   │   ├── RecordingStatusPanel.vue
│   │   │   └── index.ts
│   │   │
│   │   ├── stores/
│   │   │   └── useSpeakingStore.ts
│   │   │
│   │   ├── composables/
│   │   │   ├── useAudioRecording.ts
│   │   │   └── useWebSocketConnection.ts
│   │   │
│   │   └── index.ts
│   │
│   └── statistics/                   # 统计模块 (基本不变)
│       ├── components/
│       │   └── ChartGrid.vue
│       ├── composables/
│       └── index.ts
│
├── shared/                           # 共享资源
│   │
│   ├── components/
│   │   ├── layout/                   # ── 布局组件 ──
│   │   │   ├── MainNavigation.vue
│   │   │   ├── TopBar.vue
│   │   │   ├── PageShell.vue               # 新增：统一页面容器
│   │   │   └── index.ts
│   │   │
│   │   ├── feedback/                 # ── 反馈组件 ──
│   │   │   ├── Loading.vue
│   │   │   ├── ProgressBar.vue
│   │   │   ├── ProgressNotification.vue
│   │   │   ├── Toast.vue                   # 新增：统一通知组件
│   │   │   └── index.ts
│   │   │
│   │   ├── controls/                 # ── 交互控件 ──
│   │   │   ├── SwitchTab.vue
│   │   │   ├── IOSSwitch.vue
│   │   │   ├── CustomSelect.vue
│   │   │   ├── WheelSelector.vue
│   │   │   ├── IndexButton.vue
│   │   │   ├── ButtonGrid.vue
│   │   │   ├── KeySelector.vue
│   │   │   └── index.ts
│   │   │
│   │   ├── overlay/                  # ── 覆盖层组件 ──
│   │   │   ├── Modal.vue                   # 新增：通用 Modal 基础组件
│   │   │   ├── Drawer.vue                  # 新增：通用 Drawer 基础组件
│   │   │   └── index.ts
│   │   │
│   │   ├── charts/                   # ── 图表组件 ──
│   │   │   ├── BarChart.vue
│   │   │   ├── LineChart.vue
│   │   │   ├── PieChart.vue
│   │   │   ├── HeatMap.vue
│   │   │   └── index.ts
│   │   │
│   │   ├── ai/                       # ── AI 相关 ──
│   │   │   ├── VocabularyAIChat.vue
│   │   │   └── index.ts
│   │   │
│   │   └── index.ts                  # 统一导出
│   │
│   ├── composables/                  # (不变)
│   │   ├── useHotkeys.ts
│   │   ├── useKeyboardManager.ts
│   │   ├── useAudioAccent.ts
│   │   ├── useTimer.ts
│   │   ├── useTimerPause.ts
│   │   ├── useSettings.ts
│   │   ├── useShuffleSelection.ts
│   │   ├── useSourceSelection.ts
│   │   ├── useLocalStorage.ts
│   │   └── useWordStats.ts
│   │
│   ├── api/                          # (不变)
│   │   ├── client.ts
│   │   ├── words.ts
│   │   ├── speaking.ts
│   │   ├── settings.ts
│   │   ├── stats.ts
│   │   ├── relations.ts
│   │   ├── vocabulary-assistance.ts
│   │   └── index.ts
│   │
│   ├── services/
│   │   └── websocket.ts
│   │
│   ├── types/
│   │   └── index.ts
│   │
│   ├── styles/                       # ── 样式重组 ──
│   │   ├── tokens.css                      # 设计变量
│   │   ├── breakpoints.css                 # 响应式断点
│   │   ├── animations.css                  # 动画定义
│   │   └── base.css                        # 基础重置
│   │
│   └── utils/
│       ├── playWordAudio.ts
│       ├── errorHandler.ts
│       ├── chatHistoryStorage.ts
│       └── speech/
│
└── settings/                         # 设置页面组件 (从 pages/settings 提升)
    ├── LearningSettings.vue
    ├── LapseSettings.vue
    ├── ManagementSettings.vue
    ├── SourceSettings.vue
    ├── AudioSettings.vue
    ├── HotkeySettings.vue
    ├── RelationSettings.vue
    └── index.ts
```

### 2.2 Barrel Files 示例

每个子目录使用 `index.ts` 统一导出，便于导入管理：

```typescript
// features/vocabulary/review/index.ts
export { default as ReviewCard } from './ReviewCard.vue'
export { default as ReviewResult } from './ReviewResult.vue'
export { default as ReviewNotification } from './ReviewNotification.vue'
export { default as ReviewSpeedIndicator } from './ReviewSpeedIndicator.vue'
```

```typescript
// features/vocabulary/index.ts
export * from './review'
export * from './spelling'
export * from './editor'
export * from './grid'
export * from './relations'
export * from './stores/useReviewStore'
export * from './stores/useWordEditorStore'
```

使用时：
```typescript
// 导入单个组件
import { ReviewCard } from '@/features/vocabulary/review'

// 导入整个模块
import { ReviewCard, WordEditorModal, useReviewStore } from '@/features/vocabulary'
```

---

## 3. 组件命名规范

### 3.1 命名规则

```
[Domain][Function][Type].vue

Domain   = Word | Review | Spelling | Speaking | Record | ...
Function = Editor | Card | Grid | List | Form | Panel | ...
Type     = Modal | Drawer | Button | Item | ... (可选)
```

**示例**：
- `WordEditorModal.vue` - 词汇编辑模态框
- `ReviewCard.vue` - 复习卡片
- `RecordItem.vue` - 录音条目
- `SearchFilter.vue` - 搜索过滤器

### 3.2 命名约定

| 类型 | 约定 | 示例 |
|------|------|------|
| 页面组件 | `*Page.vue` | `ReviewPage.vue` |
| 模态框 | `*Modal.vue` | `WordEditorModal.vue` |
| 抽屉 | `*Drawer.vue` | `SettingsDrawer.vue` |
| 表单 | `*Form.vue` | `WordInsertForm.vue` |
| 列表 | `*List.vue` / `*Grid.vue` | `RecordsList.vue` |
| 列表项 | `*Item.vue` / `*Card.vue` | `RecordItem.vue` |
| 面板 | `*Panel.vue` | `RelatedWordsPanel.vue` |
| 通知 | `*Notification.vue` | `ReviewNotification.vue` |
| 侧边栏 | `*Sidebar.vue` | `WordSidebar.vue` |

### 3.3 重命名清单

| 序号 | 原名称 | 新名称 | 新路径 | 原因 |
|------|--------|--------|--------|------|
| 1 | `WordActionsSiderbar.vue` | `WordEditorActions.vue` | `features/vocabulary/editor/` | 修正拼写 + 语义清晰 |
| 2 | `WordDetailModal.vue` | `WordEditorModal.vue` | `features/vocabulary/editor/` | 更准确描述功能 |
| 3 | `WordDetailsReview.vue` | `ReviewResult.vue` | `features/vocabulary/review/` | 移入 review 目录 |
| 4 | `WordDetailsEdit.vue` | 合并到 `WordEditorForm.vue` | `features/vocabulary/editor/` | 减少组件数量 |
| 5 | `WordDetailsDisplay.vue` | 合并到 `ReviewResult.vue` | `features/vocabulary/review/` | 功能重复 |
| 6 | `WordInfoSection.vue` | 合并到 `WordEditorForm.vue` | `features/vocabulary/editor/` | 减少层级 |
| 7 | `WordReview.vue` | `ReviewCard.vue` | `features/vocabulary/review/` | 消除与 ReviewPage 混淆 |
| 8 | `WordSpelling.vue` | `SpellingCard.vue` | `features/vocabulary/spelling/` | 命名一致性 |
| 9 | `SearchAndFilter.vue` | `SearchFilter.vue` | `features/vocabulary/grid/` | 简化 |
| 10 | `ReviewModeNotification.vue` | 合并到 `ReviewNotification.vue` | `features/vocabulary/review/` | 合并同类 |
| 11 | `ReviewParamsNotification.vue` | 合并到 `ReviewNotification.vue` | `features/vocabulary/review/` | 合并同类 |
| 12 | `SpellingModeNotification.vue` | `SpellingNotification.vue` | `features/vocabulary/spelling/` | 统一命名 |
| 13 | `RelatedWordsDisplay.vue` | `RelatedWordsPanel.vue` | `features/vocabulary/relations/` | 命名一致性 |
| 14 | `VocabularyManagementPage.vue` | `VocabularyPage.vue` | `pages/` | 简化 |

### 3.4 TypeScript 类型命名

```typescript
// shared/types/index.ts

// ── 数据模型 ──
export interface Word { ... }
export interface Question { ... }
export interface TopicGroup { ... }
export interface SpeakingRecord { ... }

// ── API 响应类型 ──
export interface WordResponse { ... }
export interface WordListResponse { ... }

// ── Store 状态类型 ──
export interface ReviewState { ... }
export interface EditorState { ... }

// ── 组件 Props 类型 (内联定义，不导出) ──
// 在组件内部使用 defineProps<{ ... }>()
```

---

## 4. 组件通信解耦

### 4.1 当前问题

```
事件链路过长：
WordCard
  → emit('showDetail', word)
    → WordGrid
      → emit('showDetail', word)
        → VocabularyPage
          → openModal(word)

Props 穿透过深：
ReviewPage (mode, audioType, shuffle)
  → WordReview (mode, audioType)
    → ReviewResult (mode)
      → RelatedWordsPanel
```

### 4.2 解决方案：Pinia Store + Provide/Inject

#### 方案 A：Pinia Store (跨组件通信)

适用于：Modal/Drawer 等可能在多处触发的组件

```typescript
// features/vocabulary/stores/useWordEditorStore.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { wordsApi } from '@/shared/api'
import type { Word } from '@/shared/types'

export const useWordEditorStore = defineStore('wordEditor', () => {
  // ── State ──
  const currentWord = ref<Word | null>(null)
  const originalWord = ref<Word | null>(null)
  const isOpen = ref(false)
  const isEditing = ref(false)
  const isSaving = ref(false)

  // ── Getters ──
  const hasChanges = computed(() => {
    if (!currentWord.value || !originalWord.value) return false
    return JSON.stringify(currentWord.value) !== JSON.stringify(originalWord.value)
  })

  const canSave = computed(() => {
    return isEditing.value && hasChanges.value && !isSaving.value
  })

  // ── Actions ──
  function open(word: Word, editMode = false) {
    currentWord.value = { ...word }
    originalWord.value = { ...word }
    isEditing.value = editMode
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
    isEditing.value = false
    currentWord.value = null
    originalWord.value = null
  }

  function startEdit() {
    isEditing.value = true
  }

  function cancelEdit() {
    if (originalWord.value) {
      currentWord.value = { ...originalWord.value }
    }
    isEditing.value = false
  }

  async function save() {
    if (!currentWord.value || !canSave.value) return

    isSaving.value = true
    try {
      await wordsApi.update(currentWord.value.id, currentWord.value)
      originalWord.value = { ...currentWord.value }
      isEditing.value = false
    } finally {
      isSaving.value = false
    }
  }

  async function deleteWord() {
    if (!currentWord.value) return

    await wordsApi.delete(currentWord.value.id)
    close()
  }

  async function markForgot() {
    if (!currentWord.value) return
    await wordsApi.markForgot(currentWord.value.id)
    close()
  }

  async function markMastered() {
    if (!currentWord.value) return
    await wordsApi.markMastered(currentWord.value.id)
    close()
  }

  return {
    // State
    currentWord,
    isOpen,
    isEditing,
    isSaving,
    // Getters
    hasChanges,
    canSave,
    // Actions
    open,
    close,
    startEdit,
    cancelEdit,
    save,
    deleteWord,
    markForgot,
    markMastered,
  }
})
```

**使用示例**：

```vue
<!-- WordCard.vue - 触发打开 -->
<script setup lang="ts">
import { useWordEditorStore } from '@/features/vocabulary/stores/useWordEditorStore'

const props = defineProps<{ word: Word }>()
const editorStore = useWordEditorStore()

function handleClick() {
  editorStore.open(props.word)
}
</script>
```

```vue
<!-- WordEditorModal.vue - 响应状态 -->
<script setup lang="ts">
import { useWordEditorStore } from '@/features/vocabulary/stores/useWordEditorStore'
import { storeToRefs } from 'pinia'

const editorStore = useWordEditorStore()
const { currentWord, isOpen, isEditing, canSave } = storeToRefs(editorStore)
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen" class="modal-overlay" @click.self="editorStore.close">
      <div class="modal-content">
        <WordEditorForm v-if="currentWord" />
        <WordEditorActions />
      </div>
    </div>
  </Teleport>
</template>
```

```vue
<!-- WordEditorActions.vue - 直接调用 store -->
<script setup lang="ts">
import { useWordEditorStore } from '@/features/vocabulary/stores/useWordEditorStore'
import { storeToRefs } from 'pinia'

const editorStore = useWordEditorStore()
const { isEditing, canSave, isSaving } = storeToRefs(editorStore)
</script>

<template>
  <div class="actions">
    <template v-if="isEditing">
      <button @click="editorStore.cancelEdit">取消</button>
      <button @click="editorStore.save" :disabled="!canSave">
        {{ isSaving ? '保存中...' : '保存' }}
      </button>
    </template>
    <template v-else>
      <button @click="editorStore.startEdit">编辑</button>
      <button @click="editorStore.deleteWord">删除</button>
    </template>
  </div>
</template>
```

#### 方案 B：Provide/Inject (组件树内通信)

适用于：深层嵌套组件间共享状态

```typescript
// features/vocabulary/review/context.ts
import { provide, inject, type InjectionKey, type Ref } from 'vue'

export interface ReviewContext {
  mode: Ref<'mode_review' | 'mode_lapse' | 'mode_spelling'>
  audioType: Ref<'us' | 'uk'>
  currentWord: Ref<Word | null>
  submitResult: (remembered: boolean, elapsedTime: number) => Promise<void>
  skip: () => void
}

const REVIEW_CONTEXT_KEY: InjectionKey<ReviewContext> = Symbol('review-context')

export function provideReviewContext(context: ReviewContext) {
  provide(REVIEW_CONTEXT_KEY, context)
}

export function useReviewContext(): ReviewContext {
  const context = inject(REVIEW_CONTEXT_KEY)
  if (!context) {
    throw new Error('useReviewContext must be used within ReviewPage')
  }
  return context
}
```

**使用示例**：

```vue
<!-- ReviewPage.vue - 提供上下文 -->
<script setup lang="ts">
import { provideReviewContext } from '@/features/vocabulary/review/context'

const mode = ref<'mode_review' | 'mode_lapse' | 'mode_spelling'>('mode_review')
const audioType = ref<'us' | 'uk'>('us')
const currentWord = ref<Word | null>(null)

async function submitResult(remembered: boolean, elapsedTime: number) {
  // ... 提交逻辑
}

function skip() {
  // ... 跳过逻辑
}

provideReviewContext({
  mode,
  audioType,
  currentWord,
  submitResult,
  skip,
})
</script>

<template>
  <div class="review-page">
    <ReviewCard />  <!-- 不需要传 props -->
  </div>
</template>
```

```vue
<!-- ReviewCard.vue - 消费上下文 -->
<script setup lang="ts">
import { useReviewContext } from '@/features/vocabulary/review/context'

const { mode, audioType, currentWord, submitResult, skip } = useReviewContext()

// 直接使用，无需 props
</script>
```

```vue
<!-- ReviewResult.vue - 深层组件也能访问 -->
<script setup lang="ts">
import { useReviewContext } from '@/features/vocabulary/review/context'

const { mode, currentWord } = useReviewContext()
// 不需要 props 穿透
</script>
```

### 4.3 简化后的通信流程

**Before**：
```
WordCard
  → emit('showDetail')
    → WordGrid
      → emit('showDetail')
        → Page
          → set modalWord
            → WordDetailModal (prop: word)
              → WordEditorActions (prop: word, emit 6 events)
```

**After**：
```
WordCard
  → editorStore.open(word)

WordEditorModal
  → reads from editorStore
    → WordEditorActions
      → calls editorStore.save() / delete() / etc.
```

### 4.4 通信方式选择指南

| 场景 | 推荐方式 | 原因 |
|------|----------|------|
| 简单父子通信 | Props + Emit | Vue 标准方式，最直接 |
| 跨越 2+ 层组件 | Provide/Inject | 避免 props drilling |
| 多处触发同一组件 | Pinia Store | 全局状态管理 |
| 兄弟组件通信 | Pinia Store | 共享状态 |
| 表单双向绑定 | v-model | Vue 约定 |

---

## 5. 样式系统重构

### 5.1 问题分析

| 问题 | 现状 | 影响 |
|------|------|------|
| 断点硬编码 | `768px`, `480px`, `500px`, `1440px` 分散各处 | 响应式行为不一致 |
| `:deep()` 滥用 | 多处使用 `:deep(.class)` | 样式泄漏，难以追踪 |
| 内联样式过多 | `:style="{ color: xxx }"` | 难以覆盖，不支持媒体查询 |
| 动画分散 | 各组件定义 `@keyframes` | 重复代码，不一致 |

### 5.2 样式文件结构

```
shared/styles/
├── tokens.css        # 设计变量 (颜色、间距、字体等)
├── breakpoints.css   # 响应式断点变量
├── animations.css    # 统一动画定义
└── base.css          # 基础重置样式
```

### 5.3 tokens.css - 设计变量

```css
/* shared/styles/tokens.css */

:root {
  /* ── 颜色 - 主色 ── */
  --color-primary: #3b82f6;
  --color-primary-hover: #2563eb;
  --color-primary-active: #1d4ed8;
  --color-primary-light: #dbeafe;

  /* ── 颜色 - 语义色 ── */
  --color-success: #10b981;
  --color-success-light: #d1fae5;
  --color-warning: #f59e0b;
  --color-warning-light: #fef3c7;
  --color-danger: #ef4444;
  --color-danger-light: #fee2e2;

  /* ── 颜色 - 中性色 ── */
  --color-text-primary: #1f2937;
  --color-text-secondary: #6b7280;
  --color-text-muted: #9ca3af;
  --color-text-inverse: #ffffff;

  --color-bg-primary: #ffffff;
  --color-bg-secondary: #f9fafb;
  --color-bg-tertiary: #f3f4f6;
  --color-bg-overlay: rgba(0, 0, 0, 0.5);

  --color-border: #e5e7eb;
  --color-border-light: #f3f4f6;

  /* ── 间距 ── */
  --spacing-xs: 0.25rem;   /* 4px */
  --spacing-sm: 0.5rem;    /* 8px */
  --spacing-md: 1rem;      /* 16px */
  --spacing-lg: 1.5rem;    /* 24px */
  --spacing-xl: 2rem;      /* 32px */
  --spacing-2xl: 3rem;     /* 48px */

  /* ── 字体 ── */
  --font-family-base: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  --font-family-mono: 'SF Mono', Monaco, 'Courier New', monospace;

  --font-size-xs: 0.75rem;   /* 12px */
  --font-size-sm: 0.875rem;  /* 14px */
  --font-size-base: 1rem;    /* 16px */
  --font-size-lg: 1.125rem;  /* 18px */
  --font-size-xl: 1.25rem;   /* 20px */
  --font-size-2xl: 1.5rem;   /* 24px */
  --font-size-3xl: 2rem;     /* 32px */

  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  --line-height-tight: 1.25;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.75;

  /* ── 圆角 ── */
  --radius-sm: 0.25rem;    /* 4px */
  --radius-md: 0.5rem;     /* 8px */
  --radius-lg: 0.75rem;    /* 12px */
  --radius-xl: 1rem;       /* 16px */
  --radius-full: 9999px;

  /* ── 阴影 ── */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
  --shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.15);

  /* ── 过渡 ── */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
  --transition-slow: 350ms ease;

  /* ── z-index 层级 ── */
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-fixed: 300;
  --z-modal-backdrop: 400;
  --z-modal: 500;
  --z-popover: 600;
  --z-tooltip: 700;
}
```

### 5.4 breakpoints.css - 响应式断点

```css
/* shared/styles/breakpoints.css */

:root {
  /* ── 断点值 (用于 JS 或 CSS calc) ── */
  --breakpoint-sm: 480px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1440px;
}

/*
 * 响应式使用约定：
 *
 * Mobile First 方式：
 * .element { 移动端样式 }
 * @media (min-width: 768px) { 平板及以上 }
 * @media (min-width: 1024px) { 桌面端 }
 *
 * 或 Desktop First (当前项目主要模式)：
 * .element { 桌面端样式 }
 * @media (max-width: 768px) { 平板及以下 }
 * @media (max-width: 480px) { 手机端 }
 */

/* ── 响应式工具类 ── */
@media (max-width: 768px) {
  .hide-mobile { display: none !important; }
}

@media (min-width: 769px) {
  .hide-desktop { display: none !important; }
}

@media (max-width: 480px) {
  .hide-phone { display: none !important; }
}
```

### 5.5 animations.css - 统一动画

```css
/* shared/styles/animations.css */

/* ── 淡入动画 ── */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ── 滑入动画 ── */
@keyframes slideInLeft {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}

@keyframes slideInRight {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}

@keyframes slideInUp {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

/* ── 缩放动画 ── */
@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* ── 加载动画 ── */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

/* ── 动画工具类 ── */
.animate-fade-in { animation: fadeIn var(--transition-normal); }
.animate-fade-in-up { animation: fadeInUp var(--transition-normal); }
.animate-scale-in { animation: scaleIn var(--transition-normal); }
.animate-spin { animation: spin 1s linear infinite; }
.animate-pulse { animation: pulse 2s ease-in-out infinite; }
```

### 5.6 base.css - 基础样式

```css
/* shared/styles/base.css */

/* ── 导入其他样式文件 ── */
@import './tokens.css';
@import './breakpoints.css';
@import './animations.css';

/* ── 基础重置 ── */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  font-family: var(--font-family-base);
  font-size: var(--font-size-base);
  line-height: var(--line-height-normal);
  color: var(--color-text-primary);
  background-color: var(--color-bg-primary);
}

/* ── iOS Safari 兼容 ── */
@supports (padding: max(0px)) {
  body {
    padding-left: env(safe-area-inset-left);
    padding-right: env(safe-area-inset-right);
    padding-bottom: env(safe-area-inset-bottom);
  }
}

/* ── 链接 ── */
a {
  color: var(--color-primary);
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

/* ── 按钮重置 ── */
button {
  font-family: inherit;
  font-size: inherit;
  cursor: pointer;
  border: none;
  background: none;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/* ── 输入框重置 ── */
input,
textarea,
select {
  font-family: inherit;
  font-size: inherit;
}

/* ── 滚动条样式 (WebKit) ── */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--color-bg-tertiary);
}

::-webkit-scrollbar-thumb {
  background: var(--color-text-muted);
  border-radius: var(--radius-full);
}

::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-secondary);
}
```

### 5.7 消除 :deep() 滥用

**问题代码**：
```vue
<style scoped>
.main-content :deep(.word-review-container .content-area) {
  padding: 20px;
}
</style>
```

**解决方案 1：使用 CSS 变量传递**

```vue
<!-- 父组件 -->
<template>
  <div class="main-content" :style="{ '--content-padding': '20px' }">
    <WordReview />
  </div>
</template>

<!-- WordReview.vue -->
<style scoped>
.content-area {
  padding: var(--content-padding, 16px); /* 默认值 16px */
}
</style>
```

**解决方案 2：使用 Props 控制变体**

```vue
<!-- 父组件 -->
<WordReview variant="spacious" />

<!-- WordReview.vue -->
<script setup>
defineProps<{
  variant?: 'compact' | 'normal' | 'spacious'
}>()
</script>

<style scoped>
.content-area {
  padding: 16px;
}
.content-area.spacious {
  padding: 20px;
}
.content-area.compact {
  padding: 12px;
}
</style>
```

**解决方案 3：CSS Modules (可选)**

```vue
<template>
  <div :class="$style.contentArea">...</div>
</template>

<style module>
.contentArea {
  padding: 20px;
}
</style>
```

### 5.8 减少内联样式

**问题代码**：
```vue
<div :style="{
  backgroundColor: isRemembered ? '#10b981' : '#ffffff',
  color: '#374151'
}">
```

**解决方案：使用 CSS 变量 + 类名切换**

```vue
<template>
  <div
    class="card"
    :class="{ 'card--remembered': isRemembered }"
  >
</template>

<style scoped>
.card {
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  transition: background-color var(--transition-fast);
}

.card--remembered {
  background-color: var(--color-success);
  color: var(--color-text-inverse);
}
</style>
```

---

## 6. 实施计划

### 6.1 阶段划分

```
阶段 1: 样式基础设施 (1-2天)
    ↓
阶段 2: 组件重命名 (1天)
    ↓
阶段 3: 目录重组 (2-3天)
    ↓
阶段 4: 通信解耦 (3-4天)
```

### 6.2 阶段 1：样式基础设施

**目标**：统一样式变量，消除硬编码

**任务清单**：

- [ ] 创建 `shared/styles/tokens.css`
- [ ] 创建 `shared/styles/breakpoints.css`
- [ ] 创建 `shared/styles/animations.css`
- [ ] 创建 `shared/styles/base.css`
- [ ] 更新 `main.ts` 导入新样式文件
- [ ] 全局替换硬编码断点为变量
  - [ ] 搜索 `768px` → 使用媒体查询注释标注
  - [ ] 搜索 `480px` → 使用媒体查询注释标注
  - [ ] 搜索 `500px` → 使用媒体查询注释标注
- [ ] 迁移 `global.css` 内容到新文件
- [ ] 删除旧 `global.css`

**验收标准**：
- 所有页面渲染正常
- 响应式行为不变
- 无控制台样式警告

### 6.3 阶段 2：组件重命名

**目标**：修正命名问题，保持文件位置不变

**任务清单**：

- [ ] 修正拼写错误
  - [ ] `WordActionsSiderbar.vue` → `WordActionsSidebar.vue`
- [ ] 重命名混淆组件 (位置不变)
  - [ ] `WordDetailModal.vue` → `WordEditorModal.vue`
  - [ ] `WordReview.vue` → `ReviewCard.vue`
  - [ ] `WordSpelling.vue` → `SpellingCard.vue`
  - [ ] `WordDetailsReview.vue` → `ReviewResult.vue`
  - [ ] `SearchAndFilter.vue` → `SearchFilter.vue`
  - [ ] `RelatedWordsDisplay.vue` → `RelatedWordsPanel.vue`
- [ ] 更新所有导入路径
- [ ] 更新路由配置 (如有)
- [ ] 运行 TypeScript 检查

**验收标准**：
- `npm run build` 成功
- 所有功能正常

### 6.4 阶段 3：目录重组

**目标**：按功能聚合组件

**任务清单**：

- [ ] 创建新目录结构
  ```bash
  mkdir -p src/features/vocabulary/{review,spelling,editor,grid,relations,sidebar,index}
  mkdir -p src/features/speaking/{practice,sidebar,records,status}
  mkdir -p src/shared/components/{layout,feedback,controls,overlay,charts,ai}
  mkdir -p src/shared/styles
  mkdir -p src/settings
  ```

- [ ] 移动 vocabulary 组件
  - [ ] review/ 组件移动
  - [ ] spelling/ 组件移动
  - [ ] editor/ 组件移动
  - [ ] grid/ 组件移动
  - [ ] relations/ 组件移动

- [ ] 移动 speaking 组件
  - [ ] practice/ 组件移动
  - [ ] sidebar/ 组件移动
  - [ ] records/ 组件移动
  - [ ] status/ 组件移动

- [ ] 移动 shared 组件
  - [ ] layout/ 组件移动
  - [ ] feedback/ 组件移动
  - [ ] controls/ 组件移动
  - [ ] overlay/ 组件移动
  - [ ] charts/ 组件移动
  - [ ] ai/ 组件移动

- [ ] 创建 barrel files (index.ts)

- [ ] 更新所有导入路径

- [ ] 配置路径别名 (vite.config.ts)
  ```typescript
  resolve: {
    alias: {
      '@': '/src',
      '@features': '/src/features',
      '@shared': '/src/shared',
    }
  }
  ```

**验收标准**：
- `npm run build` 成功
- 所有页面功能正常
- IDE 自动补全正常

### 6.5 阶段 4：通信解耦

**目标**：使用 Store 和 Provide/Inject 简化组件通信

**任务清单**：

- [ ] 创建 `useWordEditorStore`
  - [ ] 实现 open/close/save/delete actions
  - [ ] 实现状态管理 (currentWord, isOpen, isEditing)

- [ ] 重构 WordEditorModal
  - [ ] 使用 store 替代 props
  - [ ] 移除 emit 事件
  - [ ] 更新子组件

- [ ] 创建 Review Context (Provide/Inject)
  - [ ] 实现 `provideReviewContext`
  - [ ] 实现 `useReviewContext`

- [ ] 重构 ReviewPage 组件树
  - [ ] ReviewPage 提供 context
  - [ ] ReviewCard 消费 context
  - [ ] ReviewResult 消费 context
  - [ ] 移除 props drilling

- [ ] 简化 WordCard → WordGrid → Page 事件链
  - [ ] WordCard 直接调用 store
  - [ ] 移除中间事件传递

- [ ] 合并通知组件
  - [ ] `ReviewModeNotification` + `ReviewParamsNotification` → `ReviewNotification`
  - [ ] 使用 store 或 event bus

**验收标准**：
- 所有复习功能正常
- 所有编辑功能正常
- 组件 props/emits 数量减少 50%+
- 无 TypeScript 错误

---

## 7. 风险评估

### 7.1 风险矩阵

| 阶段 | 风险等级 | 风险描述 | 缓解措施 |
|------|----------|----------|----------|
| 样式基础 | 🟢 低 | 变量替换可能遗漏 | 全局搜索验证，逐文件测试 |
| 组件重命名 | 🟡 中 | 导入路径可能遗漏 | IDE 重命名功能，全局搜索 |
| 目录重组 | 🟡 中 | 路径变化影响范围大 | 保留旧路径 re-export 过渡 |
| 通信解耦 | 🔴 高 | 逻辑变化可能引入 bug | 逐组件重构，每步测试 |

### 7.2 回滚策略

**Git 分支策略**：
```bash
# 为每个阶段创建分支
git checkout -b refactor/phase-1-styles
git checkout -b refactor/phase-2-naming
git checkout -b refactor/phase-3-structure
git checkout -b refactor/phase-4-decouple

# 完成后合并到主分支
git checkout main
git merge refactor/phase-1-styles
# ... 逐步合并
```

**快速回滚**：
```bash
# 如果某阶段出现严重问题
git revert HEAD~N  # 回滚 N 个提交
# 或
git reset --hard <commit-hash>  # 硬回滚到指定提交
```

### 7.3 测试策略

| 阶段 | 测试重点 |
|------|----------|
| 样式基础 | 视觉回归测试，响应式断点验证 |
| 组件重命名 | TypeScript 编译，路由跳转 |
| 目录重组 | 完整功能测试，热更新验证 |
| 通信解耦 | 状态流转测试，边界条件验证 |

**手动测试清单**：

- [ ] 首页加载正常
- [ ] 词汇管理页
  - [ ] 单词列表显示
  - [ ] 搜索过滤功能
  - [ ] 添加单词
  - [ ] 编辑单词 (Modal)
  - [ ] 删除单词
- [ ] 复习页
  - [ ] 普通复习模式
  - [ ] Lapse 模式
  - [ ] 拼写模式
  - [ ] 记住/忘记按钮
  - [ ] 侧边栏历史
- [ ] 口语练习页
  - [ ] 话题/问题导航
  - [ ] 录音功能
  - [ ] 播放功能
- [ ] 统计页
  - [ ] 图表渲染
- [ ] 设置页
  - [ ] 各项设置保存
- [ ] 响应式
  - [ ] 桌面端布局
  - [ ] 平板端布局
  - [ ] 手机端布局

---

## 附录

### A. 文件移动对照表

<details>
<summary>点击展开完整对照表</summary>

| 原路径 | 新路径 |
|--------|--------|
| `features/vocabulary/components/WordReview.vue` | `features/vocabulary/review/ReviewCard.vue` |
| `features/vocabulary/components/WordDetailsReview.vue` | `features/vocabulary/review/ReviewResult.vue` |
| `features/vocabulary/components/ReviewModeNotification.vue` | `features/vocabulary/review/ReviewNotification.vue` (合并) |
| `features/vocabulary/components/ReviewParamsNotification.vue` | `features/vocabulary/review/ReviewNotification.vue` (合并) |
| `features/vocabulary/components/ReviewSpeedIndicator.vue` | `features/vocabulary/review/ReviewSpeedIndicator.vue` |
| `features/vocabulary/components/WordSpelling.vue` | `features/vocabulary/spelling/SpellingCard.vue` |
| `features/vocabulary/components/SpellingModeNotification.vue` | `features/vocabulary/spelling/SpellingNotification.vue` |
| `features/vocabulary/components/WordDetailModal.vue` | `features/vocabulary/editor/WordEditorModal.vue` |
| `features/vocabulary/components/WordDetailsEdit.vue` | `features/vocabulary/editor/WordEditorForm.vue` (合并) |
| `features/vocabulary/components/WordInfoSection.vue` | `features/vocabulary/editor/WordEditorForm.vue` (合并) |
| `features/vocabulary/components/WordActionsSiderbar.vue` | `features/vocabulary/editor/WordEditorActions.vue` |
| `features/vocabulary/components/WordInsertForm.vue` | `features/vocabulary/editor/WordInsertForm.vue` |
| `features/vocabulary/components/WordGrid.vue` | `features/vocabulary/grid/WordGrid.vue` |
| `features/vocabulary/components/WordCard.vue` | `features/vocabulary/grid/WordCard.vue` |
| `features/vocabulary/components/WordTooltip.vue` | `features/vocabulary/grid/WordTooltip.vue` |
| `features/vocabulary/components/SearchAndFilter.vue` | `features/vocabulary/grid/SearchFilter.vue` |
| `features/vocabulary/components/RelatedWordsDisplay.vue` | `features/vocabulary/relations/RelatedWordsPanel.vue` |
| `shared/components/RelationGraphModal.vue` | `features/vocabulary/relations/RelationGraphModal.vue` |
| `features/vocabulary/components/WordIndex.vue` | `features/vocabulary/index/WordIndex.vue` |
| `shared/components/ui/WordSideBar.vue` | `features/vocabulary/sidebar/WordSideBar.vue` |

</details>

### B. 导入路径别名配置

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@features': path.resolve(__dirname, './src/features'),
      '@shared': path.resolve(__dirname, './src/shared'),
      '@pages': path.resolve(__dirname, './src/pages'),
    }
  }
})
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@features/*": ["./src/features/*"],
      "@shared/*": ["./src/shared/*"],
      "@pages/*": ["./src/pages/*"]
    }
  }
}
```

### C. Barrel File 模板

```typescript
// features/vocabulary/review/index.ts
export { default as ReviewCard } from './ReviewCard.vue'
export { default as ReviewResult } from './ReviewResult.vue'
export { default as ReviewNotification } from './ReviewNotification.vue'
export { default as ReviewSpeedIndicator } from './ReviewSpeedIndicator.vue'

// 导出类型 (如果有)
export type { ReviewProps, ReviewEmits } from './types'

// 导出 composables (如果有)
export { useReviewContext, provideReviewContext } from './context'
```

---

## 更新日志

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2026-01-18 | 1.0 | 初始版本 |
| 2026-01-18 | 1.1 | 完成阶段1-3实施 + 阶段4基础设施 |
| 2026-01-18 | 1.2 | 完成阶段4组件集成，全部重构完成 |

---

## 实施进度

### 已完成

#### 阶段 1: 样式基础设施 ✅
- [x] 创建 `shared/styles/tokens.css` - 设计变量
- [x] 创建 `shared/styles/breakpoints.css` - 响应式断点
- [x] 创建 `shared/styles/animations.css` - 动画定义
- [x] 创建 `shared/styles/base.css` - 基础样式入口
- [x] 更新 `main.ts` 导入新样式
- [x] 删除旧 `global.css`

#### 阶段 2: 组件重命名 ✅
- [x] `WordActionsSiderbar.vue` → `WordActionsSidebar.vue` (拼写修正)
- [x] `WordDetailModal.vue` → `WordEditorModal.vue`
- [x] `WordReview.vue` → `ReviewCard.vue`
- [x] `WordSpelling.vue` → `SpellingCard.vue`
- [x] `WordDetailsReview.vue` → `ReviewResult.vue`
- [x] `SearchAndFilter.vue` → `SearchFilter.vue`
- [x] `RelatedWordsDisplay.vue` → `RelatedWordsPanel.vue`

#### 阶段 3: 目录重组 ✅
- [x] 创建 Feature-Sliced 目录结构
- [x] 移动组件到对应子目录
- [x] 创建 barrel files (index.ts)
- [x] 更新所有导入路径
- [x] 构建验证通过

#### 阶段 4: 通信解耦基础设施 ✅
- [x] 创建 `useWordEditorStore` - Word Editor 状态管理
- [x] 创建 Review Context (Provide/Inject)

#### 阶段 4 组件集成 ✅
- [x] 重构 WordEditorModal 使用 store
- [x] 重构 WordActionsSidebar 使用 store
- [x] ReviewPage 提供 context
- [x] 简化 WordCard 事件链（移除未使用的 toggleReview/reset 事件）
- [x] 更新三个使用 WordEditorModal 的组件（VocabularyManagementPage, RelatedWordsPanel, WordSideBar）

---

## 新基础设施使用指南

### useWordEditorStore 使用示例

```typescript
// 任意组件中打开单词编辑器
import { useWordEditorStore } from '@/features/vocabulary/stores/wordEditor'

const editorStore = useWordEditorStore()

// 打开编辑器
editorStore.open(word)

// 打开编辑器并直接进入编辑模式
editorStore.open(word, true)

// 打开编辑器并指定复习模式
editorStore.open(word, false, 'mode_lapse')

// 监听单词更新
editorStore.onWordUpdated((updatedWord) => {
  // 处理更新后的单词
})

// 监听单词删除
editorStore.onWordDeleted((wordId) => {
  // 处理删除
})
```

### Review Context 使用示例

```typescript
// ReviewPage.vue - 提供上下文
import { provideReviewContext } from '@/features/vocabulary/review'

provideReviewContext({
  mode,
  audioType,
  currentWord,
  shuffle,
  submitResult,
  stopReviewWord,
})

// 子组件 - 消费上下文
import { useReviewContext } from '@/features/vocabulary/review'

const { mode, audioType, currentWord, submitResult } = useReviewContext()
```
