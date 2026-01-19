# backend

Flask 后端服务，提供 REST API。

## 运行

```bash
source ../.venv/bin/activate
python -m backend.app  # 端口 5001
```

## 目录结构

| 目录 | 职责 |
|------|------|
| `api/` | Flask 蓝图，处理 HTTP 请求 |
| `core/` | 核心算法（SM-2 间隔重复、拼写强度） |
| `database/` | DAO 层，数据库操作 |
| `services/` | 业务逻辑（复习更新、关系生成） |
| `models/` | SQLAlchemy 模型定义 |
| `utils/` | 工具类（AI 助手） |

## 关键文件

- `app.py` - Flask 入口，注册蓝图
- `config.py` - 用户配置（学习限制、Lapse 设置）
- `extensions.py` - SQLAlchemy 初始化

## API 蓝图

| 文件 | 路由前缀 | 功能 |
|------|----------|------|
| `vocabulary.py` | `/api` | 单词 CRUD、复习结果 |
| `speaking.py` | `/api/speaking` | 话题管理、录音上传（转录 TODO） |
| `settings.py` | `/api/settings` | 用户设置 |
| `relations.py` | `/api/relations` | 词汇关系（含轮询进度接口） |

## 核心算法

- **SM-2**: `core/review_repetition.py` - 间隔计算 + 负荷均衡
- **拼写**: `core/spell_repetition.py` - 基于输入行为的强度计算

## 依赖

```bash
pip install -r requirements.txt
```
