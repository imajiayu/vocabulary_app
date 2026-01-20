# backend

Flask 后端，部署于 Vercel Serverless Functions。

## 架构

**数据库**: Supabase PostgreSQL (环境变量 `DATABASE_URL`)
**存储**: Supabase Storage (音频文件)
**部署**: Vercel Python Runtime (`api/index.py`)

## 目录结构

| 目录 | 职责 |
|------|------|
| `api/` | Flask 蓝图 |
| `core/` | SM-2 间隔重复、拼写强度算法 |
| `database/` | DAO 层 |
| `services/` | 业务逻辑 |
| `models/` | SQLAlchemy 模型 |

## API 蓝图

| 文件 | 前缀 | 功能 |
|------|------|------|
| `vocabulary.py` | `/api` | 单词 CRUD、复习、进度 |
| `speaking.py` | `/api/speaking` | 话题/问题/录音管理 |
| `settings.py` | `/api/settings` | 用户设置 |
| `relations.py` | `/api/relations` | 词汇关系 |

## 数据模型

**words**: 单词表 (SRS字段、拼写字段、source)
**words_relations**: 词汇关系表
**current_progress**: 学习进度 (单行表)
**user_config**: 用户配置 (JSON存储)
**speaking_topics/questions/records**: 口语练习

## 关键服务

- `storage_service.py`: Supabase Storage 音频上传/删除
- `word_update_service.py`: 复习/Lapse/拼写更新
- `progress_service.py`: 学习进度管理

## 环境变量

```
DATABASE_URL=postgresql://...  # Supabase 连接串
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=...
SECRET_KEY=...
OPENAI_API_KEY=...
```

## 本地运行

```bash
source .venv/bin/activate && python -m backend.app
```

## 注意事项

- Serverless 不支持后台线程
- 关系生成改为本地 CSV 导入 (`scripts/generate_relations_local.py`)
- 释义获取改为前端同步调用 `POST /words/<id>/fetch-definition`
