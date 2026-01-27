# CLAUDE.md

IELTS词汇学习应用 - Flask后端 + Vue3前端，实现间隔重复记忆和口语练习。

## 部署架构

- **前端**: Vercel Static Build (Vue3)
- **后端**: Vercel Python Serverless (`api/index.py`)
- **数据库**: Supabase PostgreSQL
- **存储**: Supabase Storage (音频文件)

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
api/                # 蓝图 (vocabulary, settings, relations)
core/               # SM-2 算法、拼写强度算法
database/           # DAO 层
services/           # 业务逻辑 (progress_service, word_update_service)
models/             # SQLAlchemy 模型
```

> 注：口语模块已迁移到前端直连 Supabase，不再经过后端

### 前端 `frontend/src/` (Feature-Sliced Design)

```
pages/              # 页面组件
features/           # 功能模块 (vocabulary, speaking, statistics)
shared/             # 公共资源 (api, types, composables, components, styles)
```

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

## 核心文档

- **[复习系统深度分析](docs/review-system-analysis.md)** - SM-2算法、错题处理、拼写评分的完整逻辑
- **[口语模块架构](docs/speaking-module.md)** - 前端直连架构、在线转录 API 接入计划

## 注意事项

- Vercel Serverless 不支持后台线程
- 词汇关系生成改为本地脚本 (`scripts/generate_relations_local.py`)
- 释义获取改为前端同步调用
- 口语模块前端直连 Supabase（DB + Storage）和 DeepSeek（AI 评分）
- 语音转录待接入在线 API（推荐 gpt-4o-mini-transcribe，$0.003/分钟）
