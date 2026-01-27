# backend

Flask 后端，部署于 Vercel Serverless Functions。

## 职责范围

**后端负责：**
- 单词 CRUD（含释义爬取、验证）
- 复习/拼写结果计算（SM-2 算法）
- 关系图递归查询

**后端不处理：**
- 设置读写（前端直连 Supabase）
- 口语模块（前端直连 Supabase + Storage）
- 进度追踪（前端直连 Supabase）
- 统计数据（前端直接查询 Supabase Views）
- 关系 CRUD（前端直连 Supabase 双向写入）

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
| `vocabulary.py` | `/api` | 单词 CRUD、复习结果提交 |
| `relations.py` | `/api/relations` | 关系图查询 |

## 关键服务

- `word_update_service.py`: 复习/Lapse/拼写更新（SM-2 算法）
- `vocabulary_service.py`: 释义格式化等工具函数

## 数据模型

详见 [docs/database-schema.md](../docs/database-schema.md)

后端操作的主要表：
- `words`: 单词表（SRS 字段、拼写字段、source）
- `words_relations`: 词汇关系表（仅读取用于图查询）

## 环境变量

```
DATABASE_URL=postgresql://...  # Supabase 连接串
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=...
SECRET_KEY=...
```

## 本地运行

```bash
source .venv/bin/activate && python -m backend.app
```

## 注意事项

- Serverless 不支持后台线程
- 关系生成改为本地 CSV 导入 (`scripts/generate_relations_local.py`)
- 释义获取改为前端同步调用 `POST /words/<id>/fetch-definition`
