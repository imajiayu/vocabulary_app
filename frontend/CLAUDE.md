# frontend

Vue 3 + TypeScript 前端，使用 Vite 构建，采用 Feature-Sliced Design 架构。

## 运行

```bash
npm install
npm run dev    # HTTPS 开发服务器
npm run build  # 生产构建
```

## 目录结构

```
src/
├── app/                    # 应用入口
│   ├── main.ts
│   ├── App.vue
│   └── router/index.ts
│
├── pages/                  # 页面组件
│   ├── HomePage.vue
│   ├── ReviewPage.vue              # 复习页（复习/Lapse/拼写模式）
│   ├── VocabularyManagementPage.vue
│   ├── SpeakingPage.vue
│   ├── StatisticsPage.vue
│   └── SettingsPage.vue
│   └── settings/                   # 设置子页面
│
├── features/               # 功能模块 (Feature-Sliced Design)
│   ├── vocabulary/
│   │   ├── review/         # 复习功能
│   │   │   ├── ReviewCard.vue
│   │   │   ├── ReviewResult.vue
│   │   │   ├── ReviewModeNotification.vue
│   │   │   ├── ReviewParamsNotification.vue
│   │   │   ├── ReviewSpeedIndicator.vue
│   │   │   └── context.ts          # Review Context (provide/inject)
│   │   ├── spelling/       # 拼写功能
│   │   │   ├── SpellingCard.vue
│   │   │   ├── SpellingKeyboard.vue
│   │   │   └── SpellingModeNotification.vue
│   │   ├── editor/         # 编辑功能
│   │   │   ├── WordEditorModal.vue
│   │   │   ├── WordDetailsDisplay.vue
│   │   │   ├── WordDetailsEdit.vue
│   │   │   ├── WordActionsSidebar.vue
│   │   │   ├── WordInfoSection.vue
│   │   │   └── WordInsertForm.vue
│   │   ├── grid/           # 列表展示
│   │   │   ├── WordGrid.vue
│   │   │   ├── WordCard.vue
│   │   │   ├── WordTooltip.vue
│   │   │   └── SearchFilter.vue
│   │   ├── relations/      # 词汇关系
│   │   │   ├── RelatedWordsPanel.vue
│   │   │   ├── AddRelationDialog.vue
│   │   │   ├── RelationGraphCanvas.vue
│   │   │   ├── RelationGraphFilters.vue
│   │   │   ├── RelationGraphSearch.vue
│   │   │   ├── RelationGraphContextMenu.vue
│   │   │   └── useRelationGraph.ts
│   │   ├── sidebar/
│   │   │   └── WordSideBar.vue
│   │   ├── index/
│   │   │   └── WordIndex.vue
│   │   └── stores/
│   │       ├── review.ts           # useReviewStore
│   │       └── wordEditor.ts       # useWordEditorStore
│   │
│   ├── speaking/
│   │   ├── components/
│   │   │   ├── SpeakingSidebar.vue
│   │   │   ├── PartItem.vue
│   │   │   ├── TopicItem.vue
│   │   │   ├── QuestionItem.vue
│   │   │   ├── QuestionPractice.vue
│   │   │   ├── VoicePractice.vue
│   │   │   ├── RecordsList.vue
│   │   │   ├── RecordItem.vue
│   │   │   ├── RecordContent.vue
│   │   │   ├── AudioPlayer.vue
│   │   │   ├── RecordingStatusPanel.vue
│   │   │   └── SpeakingImportMenu.vue
│   │   └── composables/
│   │       ├── useSpeakingContext.ts   # Speaking Context (provide/inject)
│   │       ├── useSpeakingData.ts
│   │       └── useSpeakingImport.ts
│   │
│   └── statistics/
│       └── components/
│           └── ChartGrid.vue
│
└── shared/                 # 公共资源
    ├── api/                # HTTP 客户端
    │   ├── client.ts
    │   ├── words.ts
    │   ├── speaking.ts
    │   ├── settings.ts
    │   ├── stats.ts
    │   ├── relations.ts
    │   └── vocabulary-assistance.ts
    │
    ├── components/
    │   ├── layout/         # 布局组件
    │   │   ├── MainNavigation.vue
    │   │   ├── TopBar.vue
    │   │   └── TopBarDropdown.vue
    │   ├── controls/       # 交互控件
    │   │   ├── SwitchTab.vue
    │   │   ├── IOSSwitch.vue
    │   │   ├── CustomSelect.vue
    │   │   ├── WheelSelector.vue
    │   │   ├── IndexButton.vue
    │   │   ├── ButtonGrid.vue
    │   │   └── KeySelector.vue
    │   ├── feedback/       # 反馈组件
    │   │   ├── ProgressBar.vue
    │   │   └── ProgressNotification.vue
    │   ├── overlay/        # 覆盖层组件
    │   │   ├── VocabularyAIChat.vue
    │   │   └── RelationGraphModal.vue
    │   └── charts/         # 图表组件
    │       ├── BarChart.vue
    │       ├── LineChart.vue
    │       ├── PieChart.vue
    │       └── HeatMap.vue
    │
    ├── composables/        # 可组合函数
    │   ├── useSettings.ts
    │   ├── useHotkeys.ts
    │   ├── useKeyboardManager.ts
    │   ├── useAudioAccent.ts
    │   ├── useTimer.ts
    │   ├── useTimerPause.ts
    │   ├── useShuffleSelection.ts
    │   ├── useSourceSelection.ts
    │   ├── useDraggableNotification.ts  # 拖拽通知逻辑
    │   └── useWordStats.ts
    │
    ├── config/
    │   └── chartColors.ts  # 图表颜色配置（使用 CSS 变量）
    │
    ├── styles/             # 样式系统
    │   ├── base.css        # 基础样式入口
    │   ├── tokens.css      # 设计变量（颜色/间距/圆角/阴影）
    │   ├── breakpoints.css # 响应式断点
    │   ├── animations.css  # 动画定义
    │   ├── utilities.css   # 工具类
    │   ├── buttons.css     # 按钮样式
    │   └── scrollbar.css   # 滚动条样式
    │
    ├── types/
    │   ├── index.ts        # TypeScript 类型定义
    │   └── global.d.ts     # 全局类型声明
    │
    └── utils/
        ├── logger.ts       # 统一日志工具（开发环境）
        ├── playWordAudio.ts
        ├── errorHandler.ts
        └── chatHistoryStorage.ts
```

## 状态管理

### Pinia Stores

| Store | 文件 | 用途 |
|-------|------|------|
| useReviewStore | `vocabulary/stores/review.ts` | 复习会话状态 |
| useWordEditorStore | `vocabulary/stores/wordEditor.ts` | 单词编辑器状态（Modal 控制） |

### Context (Provide/Inject)

| Context | 文件 | 用途 |
|---------|------|------|
| ReviewContext | `vocabulary/review/context.ts` | 复习页组件通信 |
| SpeakingContext | `speaking/composables/useSpeakingContext.ts` | 口语页组件通信 |

**使用示例**：
```typescript
// 提供者（页面层级）
provideSpeakingContext(context)

// 消费者（深层组件）
const { selectQuestion, editQuestion } = useSpeakingContext()
```

## 样式系统

使用 CSS 变量实现设计系统，定义在 `shared/styles/tokens.css`：

```css
/* 颜色 */
--color-primary: #1677ff;
--color-secondary: #52c41a;
--color-danger: #ff4d4f;
--color-warning: #faad14;

/* 圆角 */
--radius-xs: 4px;
--radius-sm: 6px;
--radius-default: 8px;
--radius-md: 12px;
--radius-lg: 16px;

/* 间距 */
--spacing-xs: 4px;
--spacing-sm: 8px;
--spacing-md: 16px;
--spacing-lg: 24px;
```

**采用率**：~71%（颜色/圆角/间距统一使用 CSS 变量）

## 技术栈

- Vue 3 + Composition API
- TypeScript（严格模式，any 类型仅 4 处合理使用）
- Pinia（状态管理）
- Vite + Tailwind CSS
- ECharts（图表）

## 开发规范

1. **日志输出**：使用 `logger.ts`，生产环境自动禁用
   ```typescript
   import { logger } from '@/shared/utils/logger'
   const log = logger.create('ComponentName')
   log.log('message')
   ```

2. **组件通信**：
   - 浅层嵌套：Props + Emit
   - 深层嵌套：Provide/Inject 或 Pinia Store
   - 跨模块：Pinia Store

3. **样式**：优先使用 CSS 变量，避免硬编码颜色/间距

## 重构历史

详见 `frontend/doc/REFACTOR_PLAN*.md`：
- V1：目录结构重组、组件命名规范
- V2：console 清理、类型强化、巨型组件拆分
- V3：拖拽逻辑提取、键盘组件提取
- V4：CSS 变量全面采用、Speaking 通信优化
