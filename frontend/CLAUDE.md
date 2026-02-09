# frontend

Vue 3 + TypeScript 前端，使用 Vite 构建，采用 Feature-Sliced Design 架构。

## 运行

```bash
npm install
npm run dev         # 开发服务器
npm run build       # 生产构建（type-check + vite build）
npm run type-check  # 仅 TypeScript 类型检查
npm run lint        # ESLint（需安装 eslint）
npm run format      # Prettier（需安装 prettier）
```

## 认证

- **登录**: Google OAuth via Supabase Auth (`LoginPage.vue`)
- **状态管理**: `useAuth.ts` — 单例状态，`getCurrentUserId()` 获取用户 UUID
- **路由守卫**: `router/index.ts` — `meta.public` 标记公开路由，其他需认证
- **Supabase 配置**: `config/supabase.ts` — autoRefreshToken, persistSession, detectSessionInUrl
- **API 客户端**: `api/client.ts` — 自动附加 JWT Bearer token，SSE 使用 query param

## API 分层

| API 文件 | Backend 调用 | Supabase 直连 |
|----------|-------------|---------------|
| words.ts | — | 全部（CRUD、复习/拼写 ID 获取、负荷查询、结果持久化、fetchDefinition via Edge Function） |
| speaking.ts | — | 全部（Topics, Questions, Records, Storage） |
| writing.ts | — | 全部（Folders, Prompts, Sessions, Storage） |
| settings-supabase.ts | — | 全部 |
| stats.ts | getIndexSummary | getStats（查询 Views） |
| relations.ts | getGraph | addDirect, deleteDirect, getStatsDirect |

## 核心算法（前端 TypeScript）

| 文件 | 职责 |
|------|------|
| `shared/core/loadBalancer.ts` | 负荷均衡（best-fit + 评分公式） |
| `shared/core/reviewRepetition.ts` | SM-2 间隔重复算法 + 负荷均衡 |
| `shared/core/spellRepetition.ts` | 拼写强度算法 + 负荷均衡 |
| `shared/services/wordResultService.ts` | 编排：算法调用 → 通知生成 → 持久化 |

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
│   ├── WritingPage.vue
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
│   │       └── review/     # Review Store 子模块（5 个 composable）
│   ├── speaking/           # 口语练习
│   ├── writing/            # 写作练习
│   │   ├── components/     # WritingSidebar, EssayEditor, OutlineEditor 等
│   │   └── composables/    # useWritingData, useWritingContext, useWritingTimer
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
| useReviewStore | `vocabulary/stores/review.ts` | 复习会话状态（薄编排层） |
| useWordEditorStore | `vocabulary/stores/wordEditor.ts` | 单词编辑器状态 |

**Review Store 子模块**（`vocabulary/stores/review/`）：

| 模块 | 职责 |
|------|------|
| `useReviewQueue.ts` | 队列管理、分页加载、进度恢复 |
| `useReviewProgress.ts` | debounced index 持久化、beforeunload |
| `useReviewResult.ts` | 结果计算、通知、负荷缓存 |
| `useLapseSession.ts` | Expanding Retrieval Practice |
| `useAudioPreloader.ts` | 音频预加载、缓存清理 |

### Context (Provide/Inject)

| Context | 文件 | 用途 |
|---------|------|------|
| ReviewContext | `vocabulary/review/context.ts` | 复习页组件通信 |
| SpeakingContext | `speaking/composables/useSpeakingContext.ts` | 口语页组件通信 |
| WritingContext | `writing/composables/useWritingContext.ts` | 写作页组件通信 |

## 样式系统

三层 CSS 变量架构，定义在 `shared/styles/tokens.css`：

**设计风格**：Editorial Study — 温暖纸质感、墨水色调、铜褐强调

**色板**：
- Copper（铜褐）— 主色/强调色
- Olive（橄榄绿）— 成功/正确
- Brick（砖红）— 危险/错误
- Gold（金色）— 警告/次强调
- Azure（天蓝）— Writing 模块专用
- Ink（墨水灰）— 文本色系
- Paper（纸张）— 背景色系

**字体**：
- Serif: Crimson Pro（正文/标题）
- Sans: Inter（UI 控件）
- Mono: JetBrains Mono（数据/代码）

**间距**：8px 网格（--space-1 到 --space-16）

**圆角**：--radius-xs (4px) 到 --radius-full (9999px)

**响应式断点**：只维护两种布局
- **桌面端**：`min-width: 769px`
- **移动端**：`max-width: 768px`
- 不使用 480px、360px 等额外断点，其他尺寸设备继承对应端样式

## 技术栈

- Vue 3 + Composition API
- TypeScript（严格模式）
- Pinia（状态管理）
- Vite
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
