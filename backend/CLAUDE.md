# backend

Flask 后端 — 关系专用服务 + TTS 缓存，部署于阿里云（systemd 管理）。

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
- TTS 音频缓存（保存/删除 Google TTS 音频到文件系统，nginx 静态服务）

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
| `app.py` | Flask 入口（CORS 来源限制、请求体大小限制、健康检查含活跃任务数） |
| `api/generation.py` | 关系生成/停止/进度 API（SSE 空闲 5min 超时断开） |
| `api/tts_cache.py` | TTS 音频缓存保存/删除（base64 → 文件系统，路径遍历防护） |
| `generators/` | 5种关系生成器（synonym, antonym, root, confused, topic） |
| `generators/base.py` | BaseGenerator 基类（进度回调 + 停止信号 + 增量保存，flush_threshold 可配置） |
| `generators/data.py` | 统一数据源（反义词对、词根、易混淆词、IELTS主题） |
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

## 环境变量

```
DATABASE_URL=postgresql://...    # Supabase 连接串
SUPABASE_URL=https://xxx.supabase.co  # JWKS endpoint base URL
SUPABASE_JWT_SECRET=...          # HS256 回退验证密钥
TTS_CACHE_DIR=/opt/vocabulary_app/tts-cache  # TTS 音频缓存目录
CORS_ORIGINS=*                   # 允许的来源（逗号分隔，默认 *）
FLASK_DEBUG=0                    # 调试模式（仅开发环境设为 1）
```

## 本地运行

```bash
source .venv/bin/activate && python -m backend.app
```
