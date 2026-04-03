# CLAUDE.md

IELTS学习应用 - Vue3前端 + 最小化Flask后端，实现间隔重复记忆、口语练习和写作练习。

## 部署架构

- **前端**: 阿里云（Vue3 静态构建）
- **后端**: 阿里云（Flask，关系生成 + TTS 缓存）
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

> **开发理念**: 虽然已从 Vercel 迁移至阿里云部署，但几乎所有业务逻辑都在 Vue 前端实现，仍按 Serverless 模式开发（前端直连 Supabase，后端仅保留关系生成 + TTS 缓存服务），便于后续迁移至其他平台。

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
| 关系生成 | Backend（线程 + SSE） | CPU 密集 + NLTK 依赖 |
| TTS 音频缓存 | Frontend → Backend → 文件系统 | nginx 静态服务 + 避免重复 API 调用 |
| 课程词汇添加 | Course Page → Supabase | 课程页面直连 Supabase（复用主站登录会话） |
| 关系清空 | Frontend → Supabase | 按类型批量删除 |
| 统计数据 | Frontend → Supabase Views | 直接查询视图 |
| 口语模块 | Frontend → Supabase | 纯 CRUD + Storage |
| 写作模块 | Frontend → Supabase | 纯 CRUD + Storage + AI |
| 设置读写 | Frontend → Supabase | 简单读写 |
| 设置复杂操作 | Frontend → Edge Functions | 级联删除、批量调整 |
| 进度追踪 | Frontend → Supabase | 简单 CRUD |

## 服务器与部署

- **SSH**: `ssh root@8.152.193.35`
- **域名**: `mieltsm.top`（HTTPS，Let's Encrypt）
- **部署目录**: `/opt/vocabulary_app/`
- **CI/CD**: GitHub Actions（`.github/workflows/deploy.yml`）— push 到 `main` 自动部署（git pull → pip install → npm ci + build → 重启后端 + reload nginx）
- **后端服务**: systemd `vocabulary-backend`，gunicorn 2 workers，端口 5001
- **nginx**: `www-data` 用户，配置文件 `/etc/nginx/sites-enabled/vocabulary-app`，静态文件 + `/api/` 反代 + `/tts-cache/` 静态服务
- **后端环境变量**: `backend/.env`（python-dotenv 加载）
- **运行环境**: Python 3.9.5、Node v24.13.0
- **部署策略**: 原子替换前端（dist_new → dist），后端 SIGHUP graceful reload，含健康检查 + 自动回滚

## 本地开发

```bash
# 后端（关系生成需要）
source .venv/bin/activate && python -m backend.app  # :5001

# 前端
cd frontend && npm run dev
```

## 项目结构

### 后端 `backend/`（关系专用服务）

```
app.py                        # Flask 入口（CORS/请求限制/健康检查）
extensions.py                 # SQLAlchemy 引擎 + session 管理
exceptions.py                 # 自定义异常类（AppError）
middleware/user_context.py    # JWT 验证（JWKS P-256 + HS256 fallback）
api/generation.py             # 关系生成/停止/进度 API（SSE 空闲超时 5min）
api/tts_cache.py              # TTS 音频缓存保存/删除（文件系统，SHA256 命名）
generators/                   # 5种关系生成器
  base.py                     # BaseGenerator（进度回调 + 停止信号 + 增量保存）
  data.py                     # 统一数据源（反义词对、词根、易混淆词）
  wordnet_utils.py            # WordNet 公共工具函数
  synonym_generator.py        # 同义词（WordNet + 语义相似度）
  antonym_generator.py        # 反义词（WordNet + 手工 + 形态学）
  root_generator.py           # 词根（拉丁/希腊词根 + 词干）
  confused_generator.py       # 易混淆（编辑距离 + 语义检查）
  topic_generator.py          # 主题（WordNet 语义层级聚类）
services/generation_service.py  # 生成任务管理（线程安全 + 优雅关闭）
models/word.py                # SQLAlchemy 模型
utils/response.py             # 统一 API 响应格式（api_success/api_error）
```

### 前端 `frontend/src/` (Feature-Sliced Design)

```
app/                # 入口（main.ts, App.vue, router/）
pages/              # 页面组件（9 个：Home, Review, VocabularyManagement, Speaking, Writing, Statistics, Settings, Login, NotFound）
features/           # 功能模块 (vocabulary, speaking, statistics, writing)
shared/
  api/              # Supabase 直连 + 后端 API（仅 relations）
  core/             # SM-2 算法、拼写强度算法、负荷均衡（TypeScript）
  services/         # 业务编排（wordResultService）+ AI 服务（DeepSeek, Google STT）
  types/            # TypeScript 类型
  composables/      # 可组合函数（15 个）
  components/       # 通用组件（base, charts, controls, feedback, layout）
  config/           # 配置（env, supabase, echarts, sourceLanguage）
  constants/        # 常量（version.ts）
  styles/           # 样式系统
  utils/            # 工具函数（含 audio/ 子目录）
```

## 数据库

详见 **[docs/database-schema.md](docs/database-schema.md)**

**迁移规范**：`supabase/migrations/` 中 baseline 文件（`00000000000*`）记录初始状态，不可修改；Schema 变更只通过新增迁移文件（时间戳前缀）实现。二者不可混用。

- 14 张表：words, words_relations, current_progress, user_config, relation_generation_log, speaking_topics, speaking_questions, speaking_records, writing_folders, writing_prompts, writing_sessions, review_history, ai_prompt_cache, course_progress
- 12 个视图：stats_words_raw, stats_next/spell_next_review_distribution, stats_elapsed_time/review_count/added_date/interval_distribution, stats_mastered_overview, stats_daily_activity, stats_hourly_distribution, word_source_stats, relation_stats, stats_interval_distribution
- 6 个函数：update_updated_at(), get_daily_spell_loads(), handle_new_user(), delete_words_cascade(), batch_reschedule_review(), batch_reschedule_spell()
- 3 个触发器：trg_user_config_updated_at, on_auth_user_created, trg_course_progress_updated_at
- 2 个 Storage Bucket：speaking-audios, writing-images
- 4 个 Edge Functions：adjust-max-prep-days, delete-source, fetch-definition, quick-add-word

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
TTS_CACHE_DIR=/opt/vocabulary_app/tts-cache  # TTS 音频缓存目录
CORS_ORIGINS=*           # 生产环境设为前端域名（逗号分隔）
FLASK_DEBUG=0            # 仅开发环境设为 1
```

**前端 (`frontend/.env.local`)**
```
VITE_SUPABASE_URL=https://oilcmmlkkmikmftqjlih.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_DEEPSEEK_API_KEY=...
VITE_GOOGLE_STT_API_KEY=...  # 可选，用于语音转录
VITE_GOOGLE_TTS_API_KEY=...  # 可选，用于非英语单词发音
```

## 开发规范

- 交流语言：始终使用中文与用户沟通
- 前端日志使用 `logger.ts`，生产环境自动禁用
- 组件通信：浅层用 Props/Emit，深层用 Context，跨模块用 Pinia
- 样式优先使用 CSS 变量
- **时区规范**：全栈统一使用 UTC 日期。前端用 `getUtcToday()`（`shared/utils/date.ts`），DB 函数用 `CURRENT_DATE`（Supabase 默认 UTC）。禁止使用 `getFullYear()/getMonth()/getDate()` 等本地时间方法处理业务日期。

## 核心算法（前端 TypeScript）

- **SM-2 间隔重复**: `shared/core/reviewRepetition.ts` — 评分、EF 更新、间隔计算
- **拼写强度**: `shared/core/spellRepetition.ts` — 输入准确性/流畅度/独立性分析
- **负荷均衡**: `shared/core/loadBalancer.ts` — best-fit + 评分公式，避免复习堆积
- **服务编排**: `shared/services/wordResultService.ts` — 算法调用 + 通知生成 + 持久化

## 核心文档

- **[数据库 Schema](docs/database-schema.md)** — 表、视图、函数、Storage、Edge Functions 完整定义

## 课程模块 `courses/`

本仓库还包含两套语言课程，通过 `courses/shared/` 共享 templates。新课时采用 **JSON 数据驱动**架构（JSON 数据 + 薄壳 HTML + 共享渲染器），已有课时为传统完整 HTML。

### 目录结构

```
courses/
  shared/               # 统一 templates（10 个文件）
  ukrainian/            # 乌克兰语语法课程
    lessons/            # 课程文件（.json + .html）+ templates 符号链接
    curriculum.md       # 12 周课程大纲
    progress.md         # 当前进度
    vocabulary/         # 推荐词汇表
  legal-english/        # 法律英语词汇课程
    lessons/            # 课程文件（.json + .html）+ templates 符号链接
    curriculum.md       # 12 周课程大纲
    progress.md         # 当前进度
    mistakes.md         # 错题库
    vocabulary/         # 已学词汇库
```

### 课程访问

- 乌克兰语：`https://mieltsm.top/uk/`
- 法律英语：`https://mieltsm.top/legal/`
- nginx 配置参考：`docs/nginx-courses.conf`

### 共享 Templates 机制

`courses/shared/` 下的 10 个文件被两套课程共用：
- **auth.js** — 从 localStorage 读取主站 Supabase 登录会话，提供 `CourseAuth.getAuth()` 和 `CourseAuth.supabaseFetch()` 封装
- **lesson.css** — 用 `:lang(uk)` / `:lang(en)` 切换主题色（乌克兰语蓝色、法律英语深蓝色），含单词交互气泡样式
- **nav.js** — 自动注入顶部导航栏（课程首页显示"← IELTS Study 主页"，课时页显示"← 课程名"+ 主页链接）
- **progress.js** — checkbox 进度跨设备同步（纯 Supabase `course_progress` 表读写，未登录时仅当前会话有效）
- **tts.js** — 双语音频源：英语走有道词典 API（免费），乌克兰语走服务器缓存（`/tts-cache/`）+ Google Cloud TTS + 自动上传缓存
- **exercise.js** — 选择题 + 填空题 + 翻译题 + AI 批改 + 渐进提示 + localStorage 持久化 + Supabase 练习结果持久化
- **vocab.js** — 从 Supabase 认证会话获取 user_id，用户可通过下拉框选择 source，直接调 Supabase REST API 添加词汇
- **renderer.js** — JSON 数据驱动渲染器，读取 `.json` 课时数据构建完整 DOM，自动加载所需脚本（tts/exercise/vocab/nav/chat）
- **wordInteraction.js** — 单词点击浮动气泡（释义、发音、source 选择、添加到单词库），释义从元素 `data-def` 属性读取（同步，零延迟）
- **chat.js** — AI 实时答疑浮动聊天窗口（DeepSeek 流式调用），两套课程使用不同 base prompt，支持选中页面文字作为上下文提问，感知课程词汇/语法/错题

每个课程的 `lessons/templates` 是指向 `../../shared` 的符号链接，确保本地预览和服务器部署路径一致。

### 课程生成

课程由 Claude Code 在本地生成，详见：
- **[乌克兰语课程生成指令](docs/course-ukrainian.md)**
- **[法律英语课程生成指令](docs/course-legal-english.md)**

### 课程部署

课程是纯静态文件，push 到 main 后由 GitHub Actions 自动部署（随 `git reset --hard` 拉取，无需构建步骤）。

## 注意事项

- 后端定位为关系服务（图查询 + 关系生成）+ TTS 音频缓存服务
- 关系生成通过后端 API 触发，前端设置页面提供 UI 控件
- 释义爬取通过 Edge Function (`fetch-definition`) 代理，前端加粗
- TTS 音频缓存：非英语单词首次播放从 Google TTS 获取后缓存到阿里云服务器（`/tts-cache/{source}/{sha256}.mp3`），后续直接从 nginx 静态文件获取
- 当前版本号 `v1.7.9`，定义在 `frontend/src/shared/constants/version.ts`，每次 commit 须更新
- 修改 `courses/shared/` 中的 templates 会同时影响两套课程
- 课程页面通过 `courses/shared/auth.js` 复用主站的 Supabase 登录会话（同域 localStorage 共享），用户需先在主站登录
- 新课时使用 JSON 数据驱动架构（详见各课程生成指令文档），所有 `.uk-word` / `.term` 元素必须带 `data-def` 属性提供释义
