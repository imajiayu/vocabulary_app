# CLAUDE.md

IELTS学习应用 - Vue3前端 + 最小化Flask后端，实现间隔重复记忆、口语练习和写作练习。

## 部署架构

- **前端**: 阿里云（Vue3 静态构建）
- **后端**: 阿里云（Flask，关系图查询 + 关系生成）
- **数据库**: Supabase PostgreSQL
- **认证**: Supabase Auth (Google OAuth)
- **存储**: Supabase Storage (音频、图片)
- **Edge Functions**: Supabase Edge Functions

## Supabase 项目信息

| 项目 | 值 |
|------|------|
| Project Ref | `oilcmmlkkmikmftqjlih` |
| Project URL | `https://oilcmmlkkmikmftqjlih.supabase.co` |
| OAuth Callback | `https://oilcmmlkkmikmftqjlih.supabase.co/auth/v1/callback` |

> **开发理念**: 虽然已从 Vercel 迁移至阿里云部署，但几乎所有业务逻辑都在 Vue 前端实现，仍按 Serverless 模式开发（前端直连 Supabase，后端仅保留关系专用服务），便于后续迁移至其他平台。

## 认证架构

- **登录方式**: Google OAuth (通过 Supabase Auth)
- **用户标识**: UUID (来自 `auth.users.id`)
- **前端认证**: `useAuth.ts` 管理状态，路由守卫保护页面
- **后端认证**: JWT 验证 (ECC P-256 via JWKS + HS256 fallback)
- **数据隔离**: RLS 策略 + 前端 `user_id` 过滤 + 后端 `g.user_id`

## 前后端职责划分

| 功能 | 位置 | 原因 |
|------|------|------|
| 单词 CRUD | Frontend → Supabase | 直连，消除冷启动 |
| 释义爬取 | Frontend → Edge Function | CORS 代理 + 前端加粗 |
| 复习结果提交 | Frontend（本地 SM-2 算法）→ Supabase | 前端计算 + 直连持久化 |
| 拼写结果提交 | Frontend（本地拼写算法）→ Supabase | 前端计算 + 直连持久化 |
| 复习/拼写单词列表 | Frontend → Supabase | 前端获取 ID + 分页加载 |
| 关系图查询 | Backend | 递归深度查询（BFS） |
| 关系生成 | Backend（线程 + SSE） | CPU 密集 + NLTK 依赖 |
| 关系 CRUD | Frontend → Supabase | 双向插入/删除 |
| 关系清空 | Frontend → Supabase | 按类型批量删除 |
| 统计数据 | Frontend → Supabase Views | 直接查询视图 |
| 口语模块 | Frontend → Supabase | 纯 CRUD + Storage |
| 写作模块 | Frontend → Supabase | 纯 CRUD + Storage + AI |
| 设置读写 | Frontend → Supabase | 简单读写 |
| 设置复杂操作 | Frontend → Edge Functions | 级联删除、批量调整 |
| 进度追踪 | Frontend → Supabase | 简单 CRUD |

## 本地开发

```bash
# 后端（仅关系图查询需要）
source .venv/bin/activate && python -m backend.app  # :5001

# 前端
cd frontend && npm run dev
```

## 项目结构

### 后端 `backend/`（关系专用服务）

```
app.py                        # Flask 入口（CORS/请求限制/健康检查）
api/relations.py              # 关系图 BFS 查询 API
api/generation.py             # 关系生成/停止/进度 API（SSE 空闲超时 5min）
generators/                   # 5种关系生成器
  base.py                     # BaseGenerator（进度回调 + 停止信号 + 增量保存）
  data.py                     # 统一数据源（4885行常量 + IELTS主题）
  synonym_generator.py        # 同义词（WordNet + 语义相似度）
  antonym_generator.py        # 反义词（WordNet + 手工 + 形态学）
  root_generator.py           # 词根（拉丁/希腊词根 + 词干）
  confused_generator.py       # 易混淆（编辑距离 + 语义检查）
  topic_generator.py          # 主题（IELTS 预定义主题）
services/generation_service.py  # 生成任务管理（线程安全 + 优雅关闭）
database/relation_dao.py      # 关系图 DAO
models/word.py                # SQLAlchemy 模型
utils/response.py             # 统一 API 响应格式（api_success/api_error）
```

### 前端 `frontend/src/` (Feature-Sliced Design)

```
pages/              # 页面组件
features/           # 功能模块 (vocabulary, speaking, statistics, writing)
shared/
  api/              # Supabase 直连 + 后端 API（仅 relations）
  core/             # SM-2 算法、拼写强度算法、负荷均衡（TypeScript）
  services/         # 业务编排（wordResultService）
  types/            # TypeScript 类型
  composables/      # 可组合函数
  components/       # 通用组件
  styles/           # 样式系统
  utils/            # 工具函数
```

## 数据库

详见 **[docs/database-schema.md](docs/database-schema.md)**

**迁移规范**：`supabase/migrations/` 中 baseline 文件（`00000000000*`）记录初始状态，不可修改；Schema 变更只通过新增迁移文件（时间戳前缀）实现。二者不可混用。

- 13 张表：words, words_relations, current_progress, user_config, relation_generation_log, speaking_topics, speaking_questions, speaking_records, writing_folders, writing_prompts, writing_sessions, review_history, ai_prompt_cache
- 12 个视图：stats_words_raw, stats_next/spell_next_review_distribution, stats_elapsed_time/review_count/added_date/interval_distribution, stats_mastered_overview, stats_daily_activity, stats_hourly_distribution, word_source_stats, relation_stats
- 1 个函数：update_updated_at()
- 2 个 Storage Bucket：speaking-audios, writing-images
- 3 个 Edge Functions：adjust-max-prep-days, delete-source, fetch-definition

## 状态管理

| 类型 | 用途 |
|------|------|
| Pinia Store | 全局状态 (useWordEditorStore, useReviewStore) |
| Context | 组件树通信 (useReviewContext, useSpeakingContext, useWritingContext) |

## 样式系统

CSS 变量定义在 `shared/styles/tokens.css`，三层架构：Primitives → Semantic Tokens → Component Tokens

设计风格：Editorial Study — 温暖纸质感、墨水色调、铜褐强调色

## 环境变量

**后端 (`backend/.env`)**
```
DATABASE_URL=postgresql://...
SUPABASE_URL=https://oilcmmlkkmikmftqjlih.supabase.co
SUPABASE_JWT_SECRET=...  # 本地开发用 HS256 验证，生产环境用 JWKS
CORS_ORIGINS=*           # 生产环境设为前端域名（逗号分隔）
FLASK_DEBUG=0            # 仅开发环境设为 1
```

**前端 (`frontend/.env.local`)**
```
VITE_SUPABASE_URL=https://oilcmmlkkmikmftqjlih.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_DEEPSEEK_API_KEY=...
VITE_GOOGLE_STT_API_KEY=...  # 可选，用于语音转录
```

## 开发规范

- 前端日志使用 `logger.ts`，生产环境自动禁用
- 组件通信：浅层用 Props/Emit，深层用 Context，跨模块用 Pinia
- 样式优先使用 CSS 变量

## 核心算法（前端 TypeScript）

- **SM-2 间隔重复**: `shared/core/reviewRepetition.ts` — 评分、EF 更新、间隔计算
- **拼写强度**: `shared/core/spellRepetition.ts` — 输入准确性/流畅度/独立性分析
- **负荷均衡**: `shared/core/loadBalancer.ts` — best-fit + 评分公式，避免复习堆积
- **服务编排**: `shared/services/wordResultService.ts` — 算法调用 + 通知生成 + 持久化

## 核心文档

- **[数据库 Schema](docs/database-schema.md)** — 表、视图、函数、Storage、Edge Functions 完整定义

## 注意事项

- 后端定位为关系专用服务（图查询 + 关系生成）
- 关系生成通过后端 API 触发，前端设置页面提供 UI 控件
- 释义爬取通过 Edge Function (`fetch-definition`) 代理，前端加粗
- 当前版本号 `v1.0`，定义在 `frontend/src/shared/constants/version.ts`，每次 commit 须更新
