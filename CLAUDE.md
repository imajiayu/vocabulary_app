# CLAUDE.md

IELTS词汇学习应用 - Flask后端 + Vue3前端，实现间隔重复记忆和口语练习。

## 部署架构

- **前端**: Vercel Static Build (Vue3)
- **后端**: Vercel Python Serverless (`api/index.py`)
- **数据库**: Supabase PostgreSQL
- **存储**: Supabase Storage (音频文件)
- **Edge Functions**: Supabase Edge Functions

## 前后端职责划分

| 功能 | 位置 | 原因 |
|------|------|------|
| 单词 CRUD | Backend | 需验证、爬取释义 |
| 复习/拼写结果提交 | Backend | SM-2 算法计算 |
| 关系图查询 | Backend | 递归深度查询 |
| 关系 CRUD | Frontend → Supabase | 双向插入/删除 |
| 统计数据 | Frontend → Supabase Views | 直接查询视图 |
| 口语模块 | Frontend → Supabase | 纯 CRUD + Storage |
| 设置读写 | Frontend → Supabase | 简单读写 |
| 设置复杂操作 | Frontend → Edge Functions | 级联删除、批量调整 |
| 进度追踪 | Frontend → Supabase | 简单 CRUD |

## 本地开发

```bash
# 后端
source .venv/bin/activate && python -m backend.app  # :5001

# 前端
cd frontend && npm run dev
```

## 项目结构

### 后端 `backend/`

```
app.py              # Flask 入口
api/                # 蓝图 (vocabulary, relations)
core/               # SM-2 算法、拼写强度算法
database/           # DAO 层
services/           # 业务逻辑
models/             # SQLAlchemy 模型
```

### 前端 `frontend/src/` (Feature-Sliced Design)

```
pages/              # 页面组件
features/           # 功能模块 (vocabulary, speaking, statistics)
shared/             # 公共资源 (api, types, composables, components, styles)
```

## 数据库

详见 **[docs/database-schema.md](docs/database-schema.md)**

- 8 张表：words, words_relations, current_progress, user_config, relation_generation_log, speaking_topics, speaking_questions, speaking_records
- 8 个视图：stats_* 系列 + word_source_stats + relation_stats
- 1 个 Storage Bucket：speaking-audios
- 2 个 Edge Functions：adjust-max-prep-days, delete-source

## 状态管理

| 类型 | 用途 |
|------|------|
| Pinia Store | 全局状态 (useWordEditorStore, useReviewStore) |
| Context | 组件树通信 (useReviewContext, useSpeakingContext) |

## 样式系统

CSS 变量定义在 `shared/styles/tokens.css`：颜色、圆角、间距

## 环境变量

**后端 (.env)**
```
DATABASE_URL=postgresql://...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=...
SECRET_KEY=...
```

**前端 (.env.local)**
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_DEEPSEEK_API_KEY=...
VITE_OPENAI_API_KEY=...  # 可选，用于语音转录
```

## 开发规范

- 前端日志使用 `logger.ts`，生产环境自动禁用
- 组件通信：浅层用 Props/Emit，深层用 Context，跨模块用 Pinia
- 样式优先使用 CSS 变量
- 输出终端命令时，长命令使用 `\` 续行，确保粘贴到终端后能正确执行

## 核心文档

- **[数据库 Schema](docs/database-schema.md)** - 表、视图、Edge Functions 完整定义
- **[复习系统分析](docs/review-system-analysis.md)** - SM-2算法、错题处理、拼写评分
- **[口语模块架构](docs/speaking-module.md)** - 前端直连架构

## 注意事项

- Vercel Serverless 不支持后台线程
- 词汇关系生成改为本地脚本 (`scripts/generate_relations_local.py`)
- 释义获取改为前端同步调用
