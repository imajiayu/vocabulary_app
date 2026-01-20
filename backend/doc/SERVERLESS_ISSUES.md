# Vercel Serverless 架构问题分析

> 本文档记录了将 Flask 后端部署到 Vercel Serverless 架构后存在的兼容性问题。

## 目录

- [问题概述](#问题概述)
- [问题分类](#问题分类)
  - [1. 后台线程/长时任务失效](#1-后台线程长时任务失效)
  - [2. 内存状态无法跨请求共享](#2-内存状态无法跨请求共享)
  - [3. 文件系统只读/临时](#3-文件系统只读临时)
  - [4. 执行时间限制](#4-执行时间限制)
  - [5. 数据库连接池问题](#5-数据库连接池问题)
- [受影响的功能清单](#受影响的功能清单)
- [受影响的 API 端点](#受影响的-api-端点)
- [解决方案建议](#解决方案建议)

---

## 问题概述

Serverless 架构的核心特性与传统服务器架构的根本差异：

| 特性 | 传统服务器 | Serverless |
|------|-----------|------------|
| 进程生命周期 | 持续运行 | 请求结束后冻结/销毁 |
| 内存状态 | 跨请求保持 | 每次冷启动重置 |
| 文件系统 | 可读写持久化 | 只读（除 `/tmp`） |
| 后台任务 | 支持守护进程 | 不支持 |
| 执行时间 | 无限制 | 10-60秒限制 |

---

## 问题分类

### 1. 后台线程/长时任务失效

**严重程度**: ✅ **已解决**

Serverless 函数在响应返回后会被冻结或销毁，所有后台线程会被终止。

#### 受影响的代码（全部已删除）

| 文件 | 状态 | 说明 |
|------|------|------|
| ~~`services/relation_generation_manager.py`~~ | ✅ **已删除** | 改为本地 CSV 工作流 |
| ~~`services/batch_definition_service.py`~~ | ✅ **已删除** | 改为前端同步调用 |

> 所有依赖后台线程的功能已通过重构解决：关系生成改为本地 CSV 工作流，批量释义改为前端同步调用。

---

### 2. 内存状态无法跨请求共享

**严重程度**: ✅ **已解决**

全局变量和单例实例在不同请求间无法共享，每次冷启动都会创建新实例。

#### 受影响的代码（全部已解决或删除）

| 文件 | 变量 | 状态 | 说明 |
|------|------|------|------|
| ~~`services/relation_generation_manager.py`~~ | ~~全部~~ | ✅ **已删除** | 整个服务已删除，改为本地 CSV 工作流 |
| ~~`services/batch_definition_service.py`~~ | ~~全部~~ | ✅ **已删除** | 整个服务已删除，改为同步获取 |
| ~~`config.py`~~ | ~~`UserConfig._instance`~~ | ✅ 已解决 | 配置已迁移到数据库 `user_config` 表 |

#### 已解决的场景

```
请求A: GET /api/relations/generate/progress/synonym
       → 从数据库 task_progress 表读取进度
       → 返回正确状态 ✅

请求B: POST /api/settings {"learning": {...}}
       → 保存到数据库 user_config 表
       → 配置持久化成功 ✅
```

---

### 3. 文件系统只读/临时

**严重程度**: ✅ **已解决**

Vercel 的文件系统是只读的（除了 `/tmp` 目录，但也是临时的，实例销毁后丢失）。

#### 受影响的代码

| 文件 | 位置 | 状态 | 操作 |
|------|------|------|------|
| ~~`config.py`~~ | - | ✅ 已解决 | 配置已迁移到数据库，不再写文件 |
| ~~`api/settings.py`~~ | - | ✅ 已解决 | `config.save()` 现在写入数据库 |
| ~~`api/speaking.py`~~ | - | ✅ 已解决 | 音频文件已迁移到 Supabase Storage |

#### 已解决的场景

```python
# config.py - 已修复
def save(self):
    # 现在保存到数据库 user_config 表 ✅
    if not _save_config_to_db(self._config):
        raise IOError("Failed to save config to database")
```

```python
# speaking.py - 已修复
# 音频文件上传到 Supabase Storage ✅
from backend.services.storage_service import upload_audio
audio_url = upload_audio(file_data, filename)
```

---

### 4. 执行时间限制

**严重程度**: ⚠️ **中等**

| Vercel 计划 | 超时限制 |
|-------------|----------|
| Hobby | 10秒 |
| Pro | 60秒 |

#### 受影响的场景

| 场景 | 原因 | 状态 |
|------|------|------|
| 关系生成 | 处理大量单词，可能需要数分钟 | ⚠️ 待解决 |
| ~~批量释义获取~~ | ~~无限重试循环~~ | ✅ **已解决** - 改为同步单次请求 |
| AI 反馈生成 | OpenAI API 调用可能较慢 | ⚠️ 待解决 |

> 释义获取已改为前端同步调用 `POST /words/<id>/fetch-definition`，单次请求有 10 秒超时，不会无限循环。

---

### 5. 数据库连接池问题

**严重程度**: ✅ **已解决**

#### 现有配置

```python
# extensions.py:22
engine = create_engine(DATABASE_URL, echo=False, future=True, pool_pre_ping=True)
```

#### 已解决

已使用 Supabase **Transaction Pooler**（端口 6543），配合 `pool_pre_ping=True`：

| 原问题 | 状态 | 说明 |
|--------|------|------|
| 连接过期 | ✅ 已解决 | Pooler 在服务端管理连接，客户端无感知 |
| 连接数限制 | ✅ 已解决 | Pooler 复用连接，不会耗尽连接数 |
| 冷启动延迟 | ✅ 已缓解 | Pooler 减少连接建立开销 |

---

## 受影响的功能清单

### 已修复 ✅

| 功能 | 解决方案 | 涉及文件 |
|------|----------|----------|
| 用户配置保存 | 迁移到数据库 `user_config` 表 | `config.py`, `config_dao.py` |
| 口语录音上传 | 迁移到 Supabase Storage | `speaking.py`, `storage_service.py` |
| 单词释义获取 | 改为前端同步调用 API | `vocabulary.py`, `words.ts`, `wordEditor.ts` |
| 释义更新轮询 | **已删除** - 不再需要轮询 | 已删除相关代码 |

### 已删除（改为本地工作流）🗑️

| 功能 | 说明 |
|------|------|
| 词汇关系生成 | 改为本地 CSV 工作流：从 Supabase 下载 CSV → 本地运行生成脚本 → 导入 CSV 到 Supabase |
| 关系生成进度查询 | 随关系生成功能一起删除 |
| 服务器重启 | 该功能仅用于使"释义获取线程数"配置生效，因批量释义服务在 Serverless 下失效，此功能已删除 |

### 部分受影响 ⚠️

| 功能 | 影响 | 涉及文件 |
|------|------|----------|
| AI 口语反馈 | 可能超时（依赖 OpenAI 响应速度） | `speaking.py:98-101` |

### 正常工作 ✅

| 功能 | 说明 |
|------|------|
| 单词 CRUD | 同步数据库操作 |
| 添加单词（含释义获取） | 前端同步调用释义获取 API |
| 批量添加单词（含释义获取） | 前端逐个同步获取释义 |
| 单词复习 | 同步操作 |
| 拼写练习 | 同步操作 |
| 统计查询 | 同步数据库查询 |
| 关系图查询 | 同步数据库查询 |
| 设置读取 | 从数据库/内存读取 |

---

## 受影响的 API 端点

### 关系相关

| 方法 | 端点 | 状态 | 原因 |
|------|------|------|------|
| GET | `/api/relations/graph` | ✅ 正常 | 同步查询 |
| GET | `/api/relations/stats` | ✅ 正常 | 同步查询 |
| POST | `/api/relations` | ✅ 正常 | 添加单条关系 |
| DELETE | `/api/relations` | ✅ 正常 | 删除单条关系 |
| POST | `/api/relations/clear` | ✅ 正常 | 清空关系 |
| ~~POST~~ | ~~`/api/relations/generate`~~ | 🗑️ **已删除** | 改为本地 CSV 工作流 |
| ~~GET~~ | ~~`/api/relations/generate/progress/*`~~ | 🗑️ **已删除** | 改为本地 CSV 工作流 |
| ~~POST~~ | ~~`/api/relations/generate/stop`~~ | 🗑️ **已删除** | 改为本地 CSV 工作流 |

> 关系生成已改为本地工作流：从 Supabase 下载单词表和生成记录的 CSV，本地运行生成脚本，再将结果 CSV 导入到 Supabase。

### 设置相关

| 方法 | 端点 | 状态 | 原因 |
|------|------|------|------|
| GET | `/api/settings` | ✅ 正常 | 从数据库读取 |
| POST | `/api/settings` | ✅ **已修复** | 保存到数据库 `user_config` 表 |
| DELETE | `/api/settings/sources/<name>` | ✅ **已修复** | 保存到数据库 `user_config` 表 |
| GET | `/api/settings/sources/stats` | ✅ 正常 | 只读操作 |

> 注：`POST /api/settings/restart` 端点已删除，该功能在 Serverless 环境下无意义。

### 单词管理相关

| 方法 | 端点 | 状态 | 原因 |
|------|------|------|------|
| GET | `/api/words` | ✅ 正常 | 同步查询 |
| POST | `/api/word` | ✅ **已修复** | 单词添加，释义改为前端同步获取 |
| POST | `/api/words/batch` | ✅ **已修复** | 批量添加，释义改为前端同步获取 |
| POST | `/api/words/<id>/fetch-definition` | ✅ **新增** | 同步获取单词释义 |
| ~~GET~~ | ~~`/api/words/definition-updates`~~ | 🗑️ **已删除** | 不再需要轮询 |
| POST | `/api/words/review-result` | ✅ 正常 | 同步操作 |
| POST | `/api/words/spell-result` | ✅ 正常 | 同步操作 |

### 口语练习相关

| 方法 | 端点 | 状态 | 原因 |
|------|------|------|------|
| GET | `/api/speaking/topics` | ✅ 正常 | 同步查询 |
| POST | `/api/speaking/topics` | ✅ 正常 | 同步写入 |
| POST | `/api/speaking/records` | ✅ **已修复** | 音频上传到 Supabase Storage |
| POST | `/api/speaking/ai-feedback` | ⚠️ 可能超时 | 依赖 OpenAI 响应 |

---

## 解决方案建议

### 1. 后台任务替代方案

| 方案 | 适用场景 | 实现难度 |
|------|----------|----------|
| Vercel Cron Jobs | 定时批量处理 | 低 |
| Vercel Serverless Background Functions | 长时任务 | 中 |
| 外部队列服务（SQS, Redis Queue） | 复杂任务流 | 高 |
| 单独的后台服务（Railway, Render） | 保持原有架构 | 中 |

### 2. 状态存储替代方案

| 方案 | 适用场景 | 状态 |
|------|----------|------|
| Vercel KV (Redis) | 进度状态、轻量缓存 | 可选 |
| **Supabase 表** | **持久化状态** | ✅ **已实现** |
| Upstash Redis | 进度状态 | 可选 |

> **已完成**：用户配置和任务进度已迁移到 Supabase 数据库表（`user_config`、`task_progress`）

### 3. 文件存储替代方案

| 方案 | 适用场景 | 状态 |
|------|----------|------|
| ~~Vercel Blob~~ | ~~音频文件存储~~ | - |
| **Supabase Storage** | **音频文件存储** | ✅ **已实现** |
| ~~数据库存储配置~~ | ~~用户配置~~ | ✅ **已实现** |

> **已完成**：音频文件已迁移到 Supabase Storage（bucket: `speaking-audios`）

### 4. 架构建议

```
┌─────────────────────────────────────────────────────────────┐
│                        Vercel                                │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  Frontend   │    │ API (Flask) │    │  Cron Jobs  │     │
│  │   (Vue 3)   │    │ (Serverless)│    │  (批量任务)  │     │
│  └─────────────┘    └──────┬──────┘    └──────┬──────┘     │
└─────────────────────────────┼─────────────────┼─────────────┘
                              │                 │
                    ┌─────────┴─────────────────┴─────────┐
                    │                                      │
              ┌─────┴─────┐                        ┌───────┴───────┐
              │ Supabase  │                        │  Vercel KV    │
              │ PostgreSQL│ ✅                     │ (Redis 状态)  │
              │ + Storage │ ✅                     └───────────────┘
              └───────────┘
```

> **当前实现**：已使用 Supabase PostgreSQL（数据库）+ Supabase Storage（音频文件）

---

## 总结

| 类别 | 数量 | 影响范围 |
|------|------|----------|
| **已修复** | **5** | **用户配置、录音上传、释义获取、释义轮询、数据库连接池** |
| 已删除（改为本地） | 3 | 关系生成、关系生成进度、服务器重启 |
| 部分受影响 | 1 | AI 口语反馈（可能超时） |
| 正常工作 | 15+ | 基础 CRUD、复习、查询、设置读写、添加单词、关系查询/清空 |

**核心问题**：该应用大量使用了后台线程和内存状态存储，这与 Serverless 架构根本不兼容。

**已解决**（2026-01-20）：
- ✅ 用户配置存储：迁移到数据库 `user_config` 表
- ✅ 音频文件存储：迁移到 Supabase Storage（bucket: `speaking-audios`）
- ✅ 单词释义获取：改为前端同步调用 `POST /words/<id>/fetch-definition`
- ✅ 释义更新轮询：**已删除** - 不再需要，前端直接获取响应
- ✅ 数据库连接池：使用 Supabase Transaction Pooler（端口 6543）
- ✅ 词汇关系生成：**已删除** - 改为本地 CSV 工作流
- 参考重构文档：`backend/doc/DEFINITION_FETCH_REFACTOR.md`
- 参考迁移脚本：`backend/doc/migration_config_progress.sql`

**待解决**：
- AI 口语反馈可能超时（依赖 OpenAI 响应速度）
