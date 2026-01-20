# CLAUDE.md

IELTS词汇学习应用 - Flask后端 + Vue3前端，实现间隔重复记忆系统和口语练习。

## 快速启动

```bash
./start.sh start    # 启动前后端
./start.sh stop     # 停止服务
```

单独运行：
```bash
# 后端 (端口5001)
source .venv/bin/activate && python -m backend.app

# 前端
cd frontend && npm run dev
```

## 项目结构

### 后端 `backend/`

```
app.py                 # Flask入口，注册5个蓝图
config.py              # 用户配置（学习限制、Lapse设置等）
extensions.py          # SQLAlchemy初始化

api/
├── vocabulary.py      # 单词CRUD、复习结果提交
├── speaking.py        # 话题/问题管理、录音上传（转录TODO）
├── settings.py        # 用户设置读写
├── relations.py       # 词汇关系（含轮询进度接口）
└── vocabulary_assistance.py  # AI辅助

core/
├── review_repetition.py   # SM-2间隔重复算法 + 负荷均衡
└── spell_repetition.py    # 拼写强度算法

database/
├── vocabulary_dao.py  # 单词数据操作
├── speaking_dao.py    # 口语数据操作
├── progress_dao.py    # 学习进度
└── relation_dao.py    # 词汇关系

services/
├── word_update_service.py      # 复习/Lapse/拼写更新
├── relation_generation_manager.py  # 词汇关系生成（轮询进度）
└── relations/                  # 各类关系生成器

models/
├── word.py           # Word模型（SRS字段、拼写字段）
└── speaking.py       # Topic/Question/Record模型

utils/
└── ai_helper.py      # AI辅助工具
```

### 前端 `frontend/src/` (Feature-Sliced Design)

```
app/
├── main.ts           # Vue应用入口
└── router/index.ts   # 路由配置

pages/                # 页面组件
├── HomePage.vue
├── ReviewPage.vue            # 复习页（复习/Lapse/拼写三种模式）
├── VocabularyManagementPage.vue
├── SpeakingPage.vue
├── StatisticsPage.vue
└── SettingsPage.vue

features/             # 功能模块
├── vocabulary/
│   ├── review/       # ReviewCard, ReviewResult, ReviewModeNotification
│   ├── spelling/     # SpellingCard, SpellingKeyboard, SpellingModeNotification
│   ├── editor/       # WordEditorModal, WordDetailsEdit, WordInsertForm
│   ├── grid/         # WordGrid, WordCard, SearchFilter
│   ├── relations/    # RelatedWordsPanel, RelationGraph系列组件
│   ├── sidebar/      # WordSideBar
│   └── stores/       # useReviewStore, useWordEditorStore
├── speaking/
│   ├── components/   # SpeakingSidebar, PartItem, TopicItem, QuestionItem, VoicePractice
│   └── composables/  # useSpeakingContext, useSpeakingData
└── statistics/
    └── components/   # ChartGrid

shared/               # 公共资源
├── api/              # HTTP客户端（words/speaking/settings等）
├── types/index.ts    # TypeScript类型定义
├── composables/      # useSettings, useHotkeys, useDraggableNotification等
├── components/       # 通用UI组件（layout/controls/feedback/overlay/charts）
├── styles/           # 样式系统（tokens.css/utilities.css/animations.css）
├── config/           # chartColors.ts
└── utils/            # logger.ts, playWordAudio.ts
```

## 核心架构

### 状态管理

| 类型 | 实现 | 用途 |
|------|------|------|
| Pinia Store | `useWordEditorStore` | 单词编辑器状态（全局Modal控制） |
| Pinia Store | `useReviewStore` | 复习会话状态 |
| Context | `useReviewContext` | 复习页组件树通信 |
| Context | `useSpeakingContext` | 口语页组件树通信 |

### 样式系统

使用 CSS 变量统一设计，定义在 `shared/styles/tokens.css`：
- 颜色变量：`--color-primary`, `--color-secondary`, `--color-danger`
- 圆角变量：`--radius-xs`, `--radius-sm`, `--radius-md`, `--radius-lg`
- 间距变量：`--spacing-xs`, `--spacing-sm`, `--spacing-md`, `--spacing-lg`

**采用率**：~71%

## 核心算法

**SM-2复习算法** (`core/review_repetition.py`)
- `calculate_score()` - 基于反应时间评分(1-5)
- `sm2_update_ease_factor()` - EF值更新(1.3-3.0)
- `calculate_srs_parameters_with_load_balancing()` - 间隔计算 + 负荷均衡

**拼写算法** (`core/spell_repetition.py`)
- 分析输入行为（按键事件、退格次数、准确率）
- 考虑单词难度和长度计算拼写强度

## 数据流

```
复习流程:
前端请求 → db_fetch_review_word_ids() → 用户复习 → POST /review-result
→ calculate_srs_parameters_with_load_balancing() → 更新DB

关系生成进度:
启动生成 → 后台线程执行 → 前端轮询 /generate/progress → 显示进度
```

## 数据库

- **位置**: `vocabulary.db` (SQLite，不在git中) 或 Supabase PostgreSQL
- **Word模型**: word, definition(JSON), ease_factor, interval, repetition, lapse, spell_strength, next_review
- **Speaking模型**: SpeakingTopic, SpeakingQuestion, SpeakingRecord

## 技术栈

| 后端 | 前端 |
|------|------|
| Flask 3.1 | Vue 3 + TypeScript |
| SQLAlchemy | Pinia（状态管理） |
| OpenAI API | Vite + Tailwind CSS |
| | ECharts（图表） |

## 开发规范

### 前端日志
使用 `logger.ts`，生产环境自动禁用：
```typescript
import { logger } from '@/shared/utils/logger'
const log = logger.create('ComponentName')
log.log('message')
```

### 组件通信
- 浅层嵌套：Props + Emit
- 深层嵌套：Provide/Inject（Context 模式）
- 跨模块：Pinia Store

### 样式
优先使用 CSS 变量，避免硬编码颜色/间距/圆角

## 不在Git中的文件

- `vocabulary.db` - 数据库
- `.venv/` - Python虚拟环境
- `node_modules/` - NPM依赖

## 故障排除

```bash
# 重建Python环境
rm -rf .venv && python3 -m venv .venv && source .venv/bin/activate && pip install -r backend/requirements.txt

# 重建前端
cd frontend && rm -rf node_modules && npm install
```

## 重构历史

前端经历了4轮重构优化（详见 `frontend/doc/REFACTOR_PLAN*.md`）：

| 版本 | 主要内容 | 成果 |
|------|----------|------|
| V1 | 目录结构重组、组件命名规范 | Feature-Sliced Design |
| V2 | console清理、类型强化、巨型组件拆分 | any类型: 56→4 |
| V3 | 拖拽逻辑提取、键盘组件提取 | useDraggableNotification |
| V4 | CSS变量全面采用、Speaking通信优化 | 变量采用率: 7.5%→71% |

## TODO

- 语音转录功能：待接入在线API（如OpenAI Whisper API）
