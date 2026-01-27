# frontend

Vue 3 + TypeScript 前端，使用 Vite 构建，采用 Feature-Sliced Design 架构。

## 运行

```bash
npm install
npm run dev    # HTTPS 开发服务器
npm run build  # 生产构建
```

## API 分层

| API 文件 | Backend 调用 | Supabase 直连 |
|----------|-------------|---------------|
| words.ts | getReviewWords, createWord, submitResult, calculateResult, persistResult | getWordDirect, getWordsPaginatedDirect |
| speaking.ts | - | 全部（Topics, Questions, Records, Storage） |
| settings-supabase.ts | - | 全部 |
| stats.ts | getIndexSummary | getStats（查询 Views） |
| relations.ts | getGraph | addDirect, deleteDirect, getStatsDirect |

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
│   ├── ReviewPage.vue
│   ├── VocabularyManagementPage.vue
│   ├── SpeakingPage.vue
│   ├── StatisticsPage.vue
│   └── SettingsPage.vue
│
├── features/               # 功能模块
│   ├── vocabulary/
│   │   ├── review/         # 复习功能
│   │   ├── spelling/       # 拼写功能
│   │   ├── editor/         # 编辑功能
│   │   ├── grid/           # 列表展示
│   │   ├── relations/      # 词汇关系
│   │   └── stores/         # Pinia Stores
│   ├── speaking/           # 口语练习
│   └── statistics/         # 统计图表
│
└── shared/                 # 公共资源
    ├── api/                # HTTP 客户端
    ├── components/         # 通用组件
    ├── composables/        # 可组合函数
    ├── config/             # 配置
    ├── styles/             # 样式系统
    ├── types/              # TypeScript 类型
    └── utils/              # 工具函数
```

## 状态管理

### Pinia Stores

| Store | 文件 | 用途 |
|-------|------|------|
| useReviewStore | `vocabulary/stores/review.ts` | 复习会话状态 |
| useWordEditorStore | `vocabulary/stores/wordEditor.ts` | 单词编辑器状态 |

### Context (Provide/Inject)

| Context | 文件 | 用途 |
|---------|------|------|
| ReviewContext | `vocabulary/review/context.ts` | 复习页组件通信 |
| SpeakingContext | `speaking/composables/useSpeakingContext.ts` | 口语页组件通信 |

## 样式系统

CSS 变量定义在 `shared/styles/tokens.css`：

```css
/* 颜色 */
--color-primary: #1677ff;
--color-secondary: #52c41a;
--color-danger: #ff4d4f;

/* 圆角 */
--radius-sm: 6px;
--radius-default: 8px;
--radius-md: 12px;

/* 间距 */
--spacing-sm: 8px;
--spacing-md: 16px;
--spacing-lg: 24px;
```

## 技术栈

- Vue 3 + Composition API
- TypeScript（严格模式）
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
