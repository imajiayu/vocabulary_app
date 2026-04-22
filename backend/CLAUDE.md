# backend

Flask 后端 — 关系生成 + TTS 缓存 + 外部 AI 代理（LLM/STT/TTS），部署于阿里云（systemd 管理）。

## 认证

- **JWT 验证**: `middleware/user_context.py` — 双算法支持
  - 优先：ES256 (ECC P-256) via Supabase JWKS endpoint
  - 回退：HS256 (Legacy) via `SUPABASE_JWT_SECRET`
- **Token 提取**: `Authorization: Bearer {token}` 或 `?token={token}`（SSE fallback）
- **用户上下文**: `g.user_id` — 请求周期内可用的 UUID 字符串
- **多用户隔离**: 生成任务以 `(user_id, relation_type)` 为键，每用户可独立运行 5 种生成器

## 职责范围

**后端负责：**
- 关系生成（5种生成器，线程化执行 + SSE 进度推送，多用户隔离）
- TTS 音频缓存（保存/删除 AI TTS 音频到文件系统，nginx 静态服务）
- 外部 AI 代理（LLM chat/completions、Speech-to-Text、Text-to-Speech 统一入口，API key 只留在后端）

**后端不处理（已迁移到前端）：**
- 单词 CRUD（前端直连 Supabase）
- 复习/拼写结果计算（前端本地 SM-2/拼写算法）
- 复习/拼写结果持久化（前端直连 Supabase）
- 复习/拼写单词列表获取（前端直连 Supabase）
- 设置读写（前端直连 Supabase）
- 口语模块（前端直连 Supabase + Storage）
- 写作模块（前端直连 Supabase + Storage + AI）
- 进度追踪（前端直连 Supabase）
- 统计数据（前端直接查询 Supabase Views）
- 关系 CRUD（前端直连 Supabase 双向写入）
- 关系清空（前端直连 Supabase 删除）

## 目录结构

| 文件/目录 | 职责 |
|------|------|
| `app.py` | Flask 入口（CORS 来源限制、请求体大小限制 10MB、健康检查含活跃任务数） |
| `api/ai.py` | 外部 AI 代理（LLM chat 同步+流式 / STT / TTS），上游 API key 只在本端 |
| `api/generation.py` | 关系生成/停止/进度 API（SSE 空闲 5min 超时断开） |
| `api/tts_cache.py` | TTS 音频缓存保存/删除（base64 → 文件系统，路径遍历防护） |
| `generators/` | 5种关系生成器（synonym, antonym, root, confused, topic） |
| `generators/base.py` | BaseGenerator 基类（进度回调 + 停止信号 + 增量保存，flush_threshold 可配置） |
| `generators/data.py` | 统一数据源（反义词对、词根、易混淆词） |
| `generators/wordnet_utils.py` | WordNet 公共工具函数（词形还原、同义词查询等） |
| `services/generation_service.py` | 生成任务管理（线程安全锁 + atexit 优雅关闭 + 已完成任务清理） |
| `models/word.py` | SQLAlchemy 模型（Word, WordRelation, RelationGenerationLog） |
| `extensions.py` | 数据库 session 管理（显式连接池参数） |
| `exceptions.py` | 自定义异常 |
| `middleware/user_context.py` | 用户上下文（JWKS 内置 1h TTL 缓存） |
| `utils/response.py` | 统一 API 响应：`api_success(data)` / `api_error(msg, status)` |

## API 端点

| 路径 | 方法 | 功能 |
|------|------|------|
| `/api/relations/generate` | POST | 启动关系生成 |
| `/api/relations/generate/stop` | POST | 停止关系生成 |
| `/api/relations/generate/status` | GET | 获取所有任务状态 |
| `/api/relations/generate/progress` | GET | SSE 实时进度流 |
| `/api/health` | GET | 健康检查 |
| `/api/tts/cache` | POST | 保存 TTS 音频缓存 |
| `/api/tts/cache` | DELETE | 删除 TTS 音频缓存 |
| `/api/ai/chat` | POST | LLM chat 代理（网关 /chat/completions，支持流式）；用户可按 caller 在前端覆盖 model |
| `/api/ai/transcribe` | POST | STT 代理（网关 /audio/transcriptions，multipart file 上传） |
| `/api/ai/synthesize` | POST | TTS 代理（网关 /audio/speech，JSON 输入→二进制音频 base64 返回） |

## 环境变量

```
DATABASE_URL=postgresql://...    # Supabase 连接串（pooler 模式 6543，密码已 URL-encode）
SUPABASE_URL=https://xxx.supabase.co  # JWKS endpoint base URL
SUPABASE_JWT_SECRET=...          # HS256 回退验证密钥
TTS_CACHE_DIR=/opt/vocabulary_app/tts-cache  # TTS 音频缓存目录
CORS_ORIGINS=*                   # 允许的来源（逗号分隔，默认 *）
FLASK_DEBUG=0                    # 调试模式（仅开发环境设为 1）

# --- 外部 AI 代理（OpenAI 兼容网关，一把 key 覆盖 LLM + STT + TTS）---
AI_BASE_URL=https://llm-proxy.tapsvc.com/v1
AI_API_KEY=sk-...
AI_DEFAULT_MODEL=gemini-3-flash-preview        # LLM 兜底；用户可在 Settings → AI 模型 按 caller 覆盖
AI_DEFAULT_STT_MODEL=gpt-4o-mini-transcribe
AI_DEFAULT_TTS_MODEL=elevenlabs/eleven_multilingual_v2
AI_DEFAULT_TTS_VOICE=alloy
```

`DATABASE_URL` 形如 `postgresql://postgres.{project_ref}:{password}@aws-0-us-west-2.pooler.supabase.com:6543/postgres`，从 Supabase Dashboard → Project Settings → Database → Connection string (Transaction pooler) 复制，密码即数据库密码。

## 本地运行

```bash
source .venv/bin/activate && python -m backend.app
```

## 本地直连数据库（运维 / 数据补录）

`backend/.env` 的 `DATABASE_URL` 在本机直接可用（pooler 模式），psycopg2 即可连接。一次性脚本模板：

```python
import psycopg2
from dotenv import dotenv_values
v = dotenv_values('backend/.env')
conn = psycopg2.connect(v['DATABASE_URL'], connect_timeout=10)
# ... cur.execute(...) ...
conn.close()
```

注意：写操作请显式 `conn.autocommit = False` 并手动 `commit()` / `rollback()`，避免误操作；批量写入前先 dry-run 打印预览。
