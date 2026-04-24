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
| AI TTS 合成 | Frontend → Backend `/api/ai/synthesize` → 上游 TTS | API key 服务端保管，MP3 base64 返回后前端写入 TTS 缓存 |
| AI STT 转录 | Frontend → Backend `/api/ai/transcribe` → 上游 Speech | API key 服务端保管，同步/异步轮询由后端处理 |
| 课程词汇添加 | Course Page → Supabase | 课程页面直连 Supabase（复用主站登录会话） |
| 关系清空 | Frontend → Supabase | 按类型批量删除 |
| 统计数据 | Frontend → Supabase Views | 直接查询视图 |
| 口语模块 | Frontend → Supabase | 纯 CRUD + Storage |
| 写作模块 | Frontend → Supabase + Flask `/api/ai/chat` | CRUD/Storage 直连；AI 反馈走后端代理 |
| LLM 调用（口语/写作/词汇助手/课程聊天/翻译批改/释义回退） | Frontend → Flask `/api/ai/chat` | API key 收敛到 backend/.env，OpenAI 兼容协议，用户可按 caller 选 model |
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
pages/              # 页面组件（10 个：Home, Review, VocabularyManagement, Speaking, Writing, Statistics, Settings, AiReview, Login, NotFound）
features/           # 功能模块 (vocabulary, speaking, statistics, writing)
shared/
  api/              # Supabase 直连 + 后端 API（仅 relations）
  core/             # SM-2 算法、拼写强度算法、负荷均衡（TypeScript）
  services/         # 业务编排（wordResultService）+ AI 服务（ai.ts / aiTranscription.ts 经 Flask /api/ai/*）
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

- 15 张表：words, words_relations, current_progress, user_config, relation_generation_log, speaking_topics, speaking_questions, speaking_records, writing_folders, writing_prompts, writing_sessions, review_history, ai_prompt_cache, course_progress, ai_review_sessions
- 12 个视图：stats_words_raw, stats_next/spell_next_review_distribution, stats_elapsed_time/review_count/added_date/interval_distribution, stats_mastered_overview, stats_daily_activity, stats_hourly_distribution, word_source_stats, relation_stats, stats_interval_distribution
- 6 个函数：update_updated_at(), get_daily_spell_loads(), handle_new_user(), delete_words_cascade(), batch_reschedule_review(), batch_reschedule_spell()
- 4 个触发器：trg_user_config_updated_at, on_auth_user_created, trg_course_progress_updated_at, trg_ai_review_sessions_updated_at
- 2 个 Storage Bucket：speaking-audios, writing-images
- 4 个 Edge Functions：adjust-max-prep-days, delete-source, fetch-definition, quick-add-word（LLM/STT/TTS 代理已迁到 Flask `/api/ai/*`）

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
VITE_API_BASE_URL=                     # 本地开发留空走 Vite 代理；生产填后端域名
```

**后端外部 AI 代理 env（backend/.env，见 backend/.env.example）**

上游采用 OpenAI 兼容网关（一把 key 覆盖 LLM + STT + TTS，通过 `model` 字段路由到具体供应商）：
```
AI_BASE_URL=https://llm-proxy.tapsvc.com/v1  # 网关 base
AI_API_KEY=sk-xxx                             # 唯一 key
AI_DEFAULT_MODEL=gemini-3-flash-preview       # LLM 兜底
AI_DEFAULT_STT_MODEL=gpt-4o-mini-transcribe   # STT 兜底
AI_DEFAULT_TTS_MODEL=elevenlabs/eleven_multilingual_v2  # TTS 兜底
AI_DEFAULT_TTS_VOICE=alloy                    # TTS 声音（OpenAI: alloy 系列；ElevenLabs: voice_id）
```

三条路径（全部 OpenAI 兼容）：
- `/api/ai/chat` → `{AI_BASE_URL}/chat/completions`（同步 + 流式）
- `/api/ai/transcribe` → `{AI_BASE_URL}/audio/transcriptions`（multipart file 上传）
- `/api/ai/synthesize` → `{AI_BASE_URL}/audio/speech`（JSON 输入，二进制音频输出）

用户级 model 覆盖存在 `user_config.config.aiModels[caller]` / `aiSttModel` / `aiTtsModel`，Settings 页 "AI 模型" tab 可视化管理；可选模型与价格元数据写死在 `frontend/src/shared/constants/ai-callers.ts`。

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

## 课程模块

两套语言课程已完全融入 Vue 前端，作为 `features/courses/` 模块。课时数据以 JSON 格式存储在 `frontend/public/{uk,legal}/*.json`，由 Vue 组件 `LessonRenderer` 渲染。

### 目录结构

```
frontend/
  public/
    uk/                 # 乌克兰语课时 JSON（21 个）
    legal/              # 法律英语课时 JSON（19 个）
  src/features/courses/
    components/         # LessonRenderer + sections/blocks/exercises/interactions
    composables/        # useLessonData / useCourseConfig / useCourseProgress / useExerciseState / useCourseExerciseSync / useCourseTts
    data/               # courses.ts（课程配置）+ lessons.ts（课时索引）
    types/              # lesson.ts + course.ts
    utils/              # grading.ts（Rubric 评分算法）
    styles/             # course.css + course-themes.css（映射到设计系统 token）

courses/                # 仅保留学习资料，不再作为页面源
  ukrainian/
    curriculum.md       # 12 周课程大纲
    progress.md         # 当前进度
    vocabulary/         # 推荐词汇表
  legal-english/
    curriculum.md
    progress.md
    mistakes.md         # 错题库
    vocabulary/         # 已学词汇库
```

### 课程访问

- 所有主 tab（含课程 index）共享 URL `/`，通过 `activeTab` + localStorage 持久化；进入"课程" tab 不会改变 URL，只改 `localStorage.activeTab`
- 仅课时页有独立 URL：`https://mieltsm.top/uk/w3d1` 和 `https://mieltsm.top/legal/w3d1`
- 兼容性 redirect：访问 `/uk/` 或 `/legal/` 时 vue-router 会写入对应 `activeTab` 后跳回 `/`（见 `router/index.ts`）
- 课时页返回目录（CourseTopBar `←` / brand / 面包屑）统一走 `returnToCourseIndex()`：写入 localStorage → `router.push('/')`

### Vue 组件架构

| 旧 Template（已废弃） | 新 Vue 组件/Composable |
|---|---|
| `auth.js` | 复用主站 `useAuth.ts` |
| `lesson.css` | `styles/course.css` + `styles/course-themes.css`（`data-course="ukrainian\|legal-english"` 切换主题色） |
| `nav.js` | Vue Router + `CourseLessonPage` 面包屑 |
| `progress.js` | `useCourseProgress.ts`（Supabase `course_progress` 表） |
| `tts.js` | `useCourseTts.ts` → `shared/utils/audio/audioPlayer.ts` |
| `exercise.js` | `QuizExercise` / `FillBlankExercise` / `TranslationExercise` + `useExerciseState.ts`（URL 无关 key + Supabase 同步）|
| `vocab.js` | `VocabPreloadSection.vue` |
| `renderer.js` | `LessonRenderer.vue`（JSON → Vue 组件树） |
| `wordInteraction.js` | 复用主站 `WordEditorModal`（store ghost 模式：未在当前 source 时显示"加入词本"按钮） |
| `chat.js` | `CourseChat.vue`（复用 `shared/services/ai.ts` 的 `streamAI`，经由 Flask `/api/ai/chat`） |

### 持久化架构

课程练习状态采用**URL 无关 + 向前兼容 + Supabase 真相源**设计：
- **Storage key**：`exercise.${courseId}.${lessonId}`（不与 URL 耦合，未来重构 URL 结构不丢数据）
- **Envelope 格式**：`{ schemaVersion, updatedAt, data, ...unknownFields }`，未知字段透传保存
- **Supabase 持久化**：完整练习状态（含 AI 批改结果）上行到 `course_progress.progress._exercises[lessonId]`
- **合并策略**：加载时比较 localStorage 与 Supabase 的 `updatedAt`，取较新的；同时保留较旧的一方被更新到最新
- 实现：`frontend/src/features/courses/composables/useExerciseState.ts` + `useCourseExerciseSync.ts`

### 课程生成

课程由 Claude Code 在本地生成，输出 JSON 到 `frontend/public/{uk,legal}/wXdY.json`，详见：
- **[乌克兰语课程生成指令](docs/course-ukrainian.md)**
- **[法律英语课程生成指令](docs/course-legal-english.md)**

新增课时需同步更新 `frontend/src/features/courses/data/lessons.ts` 的课时索引数据。

### 课程部署

课程 JSON 文件随前端构建进入 `dist/{uk,legal}/`，由标准 SPA `try_files` 伺服：
- 访问 `/uk/w3d1.json` → 直接返回 JSON 文件
- 访问 `/uk/w3d1` → fallback 到 `index.html` → Vue Router 接管

不需要任何课程专属的 nginx location 块。部署走 GitHub Actions（`.github/workflows/deploy.yml`）。

## 注意事项

- 后端定位为关系服务（图查询 + 关系生成）+ TTS 音频缓存服务 + 外部 AI 代理（LLM/STT/TTS）
- 关系生成通过后端 API 触发，前端设置页面提供 UI 控件
- 释义爬取通过 Edge Function (`fetch-definition`) 代理，前端加粗
- TTS 音频缓存：非英语单词首次播放经 Flask `/api/ai/synthesize` 合成后缓存到阿里云服务器（`/tts-cache/{source}/{sha256}.mp3`），后续直接从 nginx 静态文件获取
- 当前版本号 `v2.0.0`，定义在 `frontend/src/shared/constants/version.ts`，每次 commit 须更新
- 课程页面复用主站的 Supabase 登录会话，用户需先在主站登录；未登录仍可浏览但练习无法同步到云端
- 课时 JSON 的所有 `.uk-word` / `.term` 元素必须带 `data-def` 属性提供释义（单词点击气泡需要）
- 新增课时同步更新 `frontend/src/features/courses/data/lessons.ts` 的索引数据
