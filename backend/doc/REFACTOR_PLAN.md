# 后端重构计划

> 生成时间: 2026-01-19
> 代码审计范围: backend/ 全部43个Python文件，约14,781行代码
> **最后更新: 2026-01-19 - 阶段一、二已完成**

---

## 已完成的重构 (2026-01-19)

### 阶段一：基础设施改造

#### 1. 配置系统重构 ✅
- **新增** `user_config.json` - JSON格式配置持久化
- **重写** `config.py` - 单例模式 + 线程安全 + 原子写入
- **简化** `api/settings.py` - 从385行减至160行，移除全部正则表达式

#### 2. 事务管理增强 ✅
- **新增** `extensions.py` - `transaction()` 上下文管理器和 `@transactional` 装饰器
- **改造** `vocabulary_dao.py` - `db_batch_delete_words` 和 `db_batch_update_words` 使用事务保护

#### 3. 错误处理统一 ✅
- **新增** `exceptions.py` - 自定义异常类 (`AppError`, `NotFoundError`, `ValidationError`, `DatabaseError`, `ConfigError`)
- **重写** `app.py` - 应用工厂模式 + 全局错误处理器 + 日志配置

#### 4. 清理死代码 ✅
- **删除** `POST /api/switch_source` - 被 `/api/source` 替代
- **删除** `POST /api/speaking/speech-to-text` - 未实现的占位端点

### 阶段二：代码质量提升

#### 5. DAO层拆分 ✅
- **原文件**: `vocabulary_dao.py` (907行, 27个函数)
- **新结构**: `database/vocabulary/` 模块化目录

```
database/vocabulary/
├── __init__.py       # 重导出所有函数（向后兼容）
├── common.py         # 公共工具函数
├── word_crud.py      # 增删改操作
├── word_query.py     # 查询操作
├── word_batch.py     # 批量操作
├── word_review.py    # 复习相关
└── word_stats.py     # 统计查询
```

- **向后兼容**: 原 `vocabulary_dao.py` 保留为重导出模块，现有代码无需修改

---

## 一、现状概览

### 1.1 代码规模统计

| 模块 | 文件数 | 代码行数 | 函数/类数 |
|------|--------|----------|-----------|
| API层 (`api/`) | 5 | ~1,300 | 44个端点 |
| DAO层 (`database/`) | 4 | ~2,133 | 85个函数 |
| 服务层 (`services/`) | 7 | ~1,900 | 41个函数 |
| 核心算法 (`core/`) | 2 | ~851 | 16个函数 |
| 模型层 (`models/`) | 2 | ~280 | 6个类 |
| 工具层 (`utils/`) | 2 | ~150 | 5个函数 |
| 配置/入口 | 3 | ~290 | - |

### 1.2 API端点使用情况

| 蓝图 | 端点数 | 前端使用 | 未使用 |
|------|--------|----------|--------|
| vocabulary | 17 | 12 | 5 |
| settings | 5 | 2 | 3 |
| speaking | 8 | 5 | 3 |
| relations | 11 | 10 | 1 |
| vocabulary_assistance | 1 | 1 | 0 |
| **合计** | **44** | **30** | **14** |

---

## 二、关键问题清单

### 2.1 🔴 高优先级（安全/数据一致性风险）

#### P1-1: 配置文件直接操作风险
- **位置**: `api/settings.py:80-200`
- **问题**: 使用正则表达式直接修改 `config.py` 源文件
- **风险**: 文件损坏、注入攻击、并发写入冲突
- **当前代码示例**:
  ```python
  # 危险！直接修改源文件
  content = re.sub(
      r'DAILY_NEW_WORDS_LIMIT\s*=\s*\d+',
      f'DAILY_NEW_WORDS_LIMIT = {value}',
      content
  )
  ```

#### P1-2: 缺乏事务管理
- **位置**: `database/vocabulary_dao.py` 批量操作
- **问题**: `db_batch_insert_words()`, `db_batch_delete_words()` 无事务包装
- **风险**: 批量操作中途失败导致数据不一致

#### P1-3: 竞态条件
- **位置**:
  - `api/vocabulary.py` - session源切换
  - `database/progress_dao.py` - 进度更新
  - `services/relation_generation_manager.py` - 全局进度字典
- **问题**: 多线程/多请求并发时无锁保护

#### P1-4: AI API无限制调用
- **位置**: `utils/ai_helper.py`, `api/speaking.py`, `api/vocabulary_assistance.py`
- **问题**: 无速率限制、无重试机制、无成本控制
- **风险**: API费用失控、DoS攻击向量

### 2.2 🟡 中优先级（可维护性/性能）

#### P2-1: DAO层过于臃肿
- **位置**: `database/vocabulary_dao.py` (905行, 54个函数)
- **问题**: 单文件职责过多，难以测试和维护

#### P2-2: 错误处理不一致
- **现状**: 混合使用 `print()`, `Exception`, 结构化响应
- **示例**:
  ```python
  # 有的用print
  except Exception as e:
      print(f"Error: {e}")
      return None

  # 有的用结构化
  except SQLAlchemyError as e:
      return {"success": False, "message": str(e)}
  ```

#### P2-3: 硬编码魔法数字
- **位置**: `core/review_repetition.py`, `core/spell_repetition.py`
- **示例**:
  ```python
  # 这些阈值应该可配置
  if elapsed_time <= 2:
      score = 5
  elif elapsed_time >= 5:
      score = 3
  ```

#### P2-4: 缺乏输入验证
- **位置**: 所有API端点
- **问题**: 无统一的请求验证中间件/装饰器

#### P2-5: 线程管理问题
- **位置**: `services/batch_definition_service.py`, `services/relation_generation_manager.py`
- **问题**: Daemon线程无优雅关闭、进度数据不持久化

### 2.3 🟢 低优先级（代码清洁度）

#### P3-1: 死代码/占位代码
- `api/speaking.py:speech_to_text()` - 返回501未实现
- `api/config.py` 中多个前端从未调用的端点

#### P3-2: 重复的配置导入
- 多个文件同时导入 `UserConfig` 和 `Config`

#### P3-3: 类型注解不一致
- 部分函数有类型注解，部分没有
- Dict vs dict 混用

#### P3-4: 缺乏文档字符串
- 核心算法函数缺少详细docstring

---

## 三、未使用API清理计划

### 3.1 可直接删除（前端从未调用）

| 端点 | 文件位置 | 原因 |
|------|----------|------|
| `POST /api/switch_source` | `api/vocabulary.py` | 被 `/api/source` 替代 |
| `GET /api/speaking/stats` | `api/speaking.py` | 未实现前端调用 |
| `POST /api/settings/reset` | `api/settings.py` | UI未暴露 |
| `GET /api/health` | `app.py` | 仅内部使用，可简化 |

### 3.2 需与前端确认后决定

| 端点 | 文件位置 | 说明 |
|------|----------|------|
| `GET /api/stats/words` | `api/vocabulary.py` | 前端定义了但未调用 |
| `GET /api/stats/progress` | `api/vocabulary.py` | 前端定义了但未调用 |
| `GET /api/stats/heatmap` | `api/vocabulary.py` | 前端定义了但未调用 |
| `GET /api/stats/accuracy` | `api/vocabulary.py` | 前端定义了但未调用 |
| `GET /api/stats/streak` | `api/vocabulary.py` | 前端定义了但未调用 |
| `GET /api/stats/export` | `api/vocabulary.py` | 前端定义了但未调用 |

### 3.3 保留但标记为内部接口

| 端点 | 用途 |
|------|------|
| `POST /api/settings/restart` | 配置变更后重启（需要但应限制访问） |

---

## 四、重构方案

### 4.1 配置系统重构 [P1-1]

**目标**: 将配置持久化从源码操作改为JSON文件

**当前架构**:
```
用户修改设置 → 正则替换config.py → importlib.reload() → 重启服务
```

**目标架构**:
```
用户修改设置 → 写入config.json → 运行时读取 → 热加载（无需重启）
```

**实现步骤**:

1. 创建 `backend/user_config.json` 作为持久化文件
2. 修改 `config.py` 读取逻辑:
   ```python
   # config.py
   import json
   from pathlib import Path

   CONFIG_FILE = Path(__file__).parent / "user_config.json"

   def load_config():
       if CONFIG_FILE.exists():
           return json.loads(CONFIG_FILE.read_text())
       return DEFAULT_CONFIG

   class UserConfig:
       _instance = None

       def __new__(cls):
           if cls._instance is None:
               cls._instance = super().__new__(cls)
               cls._instance._load()
           return cls._instance

       def _load(self):
           config = load_config()
           for key, value in config.items():
               setattr(self, key, value)

       def save(self):
           CONFIG_FILE.write_text(json.dumps(self.to_dict(), indent=2))
   ```

3. 简化 `api/settings.py`:
   ```python
   @settings_bp.route('/api/settings', methods=['POST'])
   def update_settings():
       config = UserConfig()
       config.update_from_dict(request.json)
       config.save()  # 原子写入JSON
       return {"success": True}
   ```

**收益**:
- 消除正则表达式风险
- 支持热加载，无需重启
- 原子写入，避免文件损坏
- 易于备份和迁移

---

### 4.2 事务管理增强 [P1-2]

**目标**: 为批量操作添加事务支持

**实现方案**:

1. 创建事务装饰器 `extensions.py`:
   ```python
   from functools import wraps
   from contextlib import contextmanager

   @contextmanager
   def transaction():
       """事务上下文管理器"""
       session = Session()
       try:
           yield session
           session.commit()
       except Exception:
           session.rollback()
           raise
       finally:
           session.close()

   def transactional(func):
       """事务装饰器"""
       @wraps(func)
       def wrapper(*args, **kwargs):
           with transaction() as session:
               return func(session, *args, **kwargs)
       return wrapper
   ```

2. 改造批量操作 `vocabulary_dao.py`:
   ```python
   @transactional
   def db_batch_insert_words(session, words_data: list[dict]) -> dict:
       try:
           words = [Word(**data) for data in words_data]
           session.add_all(words)
           return {"success": True, "count": len(words)}
       except IntegrityError as e:
           raise  # 自动回滚
   ```

---

### 4.3 DAO层拆分 [P2-1]

**目标**: 将905行的vocabulary_dao.py拆分为职责单一的模块

**拆分方案**:

```
database/
├── vocabulary/
│   ├── __init__.py          # 导出所有函数
│   ├── word_crud.py         # 单词CRUD (150行)
│   ├── word_query.py        # 查询/过滤 (200行)
│   ├── word_batch.py        # 批量操作 (150行)
│   ├── word_review.py       # 复习相关 (200行)
│   └── word_stats.py        # 统计查询 (200行)
├── progress_dao.py          # 保持不变
├── speaking_dao.py          # 保持不变
└── relation_dao.py          # 保持不变
```

**拆分依据**:

| 新文件 | 包含函数 |
|--------|----------|
| word_crud.py | `db_get_word`, `db_create_word`, `db_update_word`, `db_delete_word` |
| word_query.py | `db_get_words_paginated`, `db_search_words`, `db_get_words_by_source` |
| word_batch.py | `db_batch_insert_words`, `db_batch_delete_words`, `db_batch_update_words` |
| word_review.py | `db_fetch_review_word_ids`, `db_update_word_for_review`, `db_fetch_lapse_word_ids`, `db_update_word_for_lapse`, `db_fetch_spelled_word_ids`, `db_update_word_for_spelling` |
| word_stats.py | `db_get_comprehensive_stats`, `db_get_daily_review_loads`, `db_get_daily_spell_loads`, `db_get_word_counts_by_source` |

**兼容性**: 在 `__init__.py` 中重新导出所有函数，保持现有调用不变

---

### 4.4 错误处理统一 [P2-2]

**目标**: 建立统一的错误处理和响应格式

**实现方案**:

1. 创建自定义异常 `exceptions.py`:
   ```python
   class AppError(Exception):
       """应用基础异常"""
       def __init__(self, message: str, code: int = 400):
           self.message = message
           self.code = code

   class NotFoundError(AppError):
       def __init__(self, resource: str):
           super().__init__(f"{resource} not found", 404)

   class ValidationError(AppError):
       def __init__(self, field: str, reason: str):
           super().__init__(f"Invalid {field}: {reason}", 400)

   class DatabaseError(AppError):
       def __init__(self, operation: str):
           super().__init__(f"Database error during {operation}", 500)
   ```

2. 创建全局错误处理器 `app.py`:
   ```python
   @app.errorhandler(AppError)
   def handle_app_error(error):
       return jsonify({
           "success": False,
           "message": error.message
       }), error.code

   @app.errorhandler(Exception)
   def handle_unexpected_error(error):
       app.logger.exception("Unexpected error")
       return jsonify({
           "success": False,
           "message": "Internal server error"
       }), 500
   ```

3. 替换所有 `print()` 为 `logging`:
   ```python
   import logging
   logger = logging.getLogger(__name__)

   # 替换
   # print(f"Error: {e}")
   logger.error(f"Error during operation: {e}", exc_info=True)
   ```

---

### 4.5 输入验证层 [P2-4]

**目标**: 为所有API添加统一的输入验证

**实现方案**: 使用Pydantic进行请求验证

1. 创建请求模型 `schemas/`:
   ```python
   # schemas/word.py
   from pydantic import BaseModel, Field, validator

   class WordCreateRequest(BaseModel):
       word: str = Field(..., min_length=1, max_length=100)
       definition: dict
       source: str = Field(default="default")

       @validator('word')
       def word_must_be_lowercase(cls, v):
           return v.lower().strip()

   class ReviewResultRequest(BaseModel):
       remembered: bool
       elapsed_time: float = Field(..., ge=0)
       mode: str = Field(..., pattern="^(review|lapse|spelling)$")
   ```

2. 创建验证装饰器:
   ```python
   def validate_request(schema: type[BaseModel]):
       def decorator(func):
           @wraps(func)
           def wrapper(*args, **kwargs):
               try:
                   data = schema(**request.json)
                   return func(data, *args, **kwargs)
               except ValidationError as e:
                   return jsonify({
                       "success": False,
                       "message": str(e)
                   }), 400
           return wrapper
       return decorator
   ```

3. 应用到API:
   ```python
   @api_bp.route('/api/word', methods=['POST'])
   @validate_request(WordCreateRequest)
   def create_word(data: WordCreateRequest):
       result = db_create_word(data.dict())
       return jsonify(result)
   ```

---

### 4.6 AI调用限流 [P1-4]

**目标**: 防止AI API滥用

**实现方案**:

1. 创建限流器 `utils/rate_limiter.py`:
   ```python
   from functools import wraps
   from time import time
   from collections import defaultdict
   import threading

   class RateLimiter:
       def __init__(self, calls_per_minute: int = 10):
           self.calls_per_minute = calls_per_minute
           self.calls = defaultdict(list)
           self.lock = threading.Lock()

       def is_allowed(self, key: str = "global") -> bool:
           with self.lock:
               now = time()
               minute_ago = now - 60

               # 清理过期记录
               self.calls[key] = [t for t in self.calls[key] if t > minute_ago]

               if len(self.calls[key]) >= self.calls_per_minute:
                   return False

               self.calls[key].append(now)
               return True

   ai_limiter = RateLimiter(calls_per_minute=20)

   def rate_limited(func):
       @wraps(func)
       def wrapper(*args, **kwargs):
           if not ai_limiter.is_allowed():
               return {"success": False, "message": "Rate limit exceeded"}, 429
           return func(*args, **kwargs)
       return wrapper
   ```

2. 应用到AI端点:
   ```python
   @speaking_bp.route('/api/speaking/ai-feedback', methods=['POST'])
   @rate_limited
   def get_ai_feedback():
       # ...
   ```

---

### 4.7 算法参数可配置化 [P2-3]

**目标**: 将硬编码的算法阈值移至配置

**实现方案**:

1. 在 `config.py` 添加算法配置:
   ```python
   class AlgorithmConfig:
       # SM-2 评分阈值
       SCORE_TIME_EXCELLENT = 2.0  # 秒，得分5
       SCORE_TIME_GOOD = 5.0       # 秒，得分3

       # EF调整幅度
       EF_ADJUSTMENT = {
           5: 0.15,
           4: 0.08,
           3: -0.02,
           2: -0.20,
           1: -0.40
       }

       # 拼写评分权重
       SPELL_WEIGHT_ACCURACY = 0.6
       SPELL_WEIGHT_FLUENCY = 0.2
       SPELL_WEIGHT_INDEPENDENCE = 0.2

       # 负荷均衡
       LOAD_BALANCE_SEARCH_RANGE = {
           "high": 1,
           "medium": 2,
           "low": 3
       }
   ```

2. 修改算法使用配置:
   ```python
   from config import AlgorithmConfig as AC

   def calculate_score(remembered: bool, elapsed_time: float) -> int:
       if not remembered:
           return 1
       if elapsed_time <= AC.SCORE_TIME_EXCELLENT:
           return 5
       if elapsed_time >= AC.SCORE_TIME_GOOD:
           return 3
       # ...
   ```

---

### 4.8 清理死代码 [P3-1]

**删除列表**:

| 文件 | 删除内容 | 原因 |
|------|----------|------|
| `api/speaking.py` | `speech_to_text()` 函数 | 返回501未实现，且TODO存在时间过长 |
| `api/vocabulary.py` | `switch_source()` 端点 | 被 `/api/source` 完全替代 |
| 前端 `api/config.ts` | 未使用的端点定义 | 清理前端死代码 |
| 前端 `api/stats.ts` | 6个未调用的端点 | 清理前端死代码 |

---

## 五、执行计划

### 阶段一：基础设施改造（安全优先）
**预计工作量**: 中等

| 任务 | 优先级 | 影响范围 |
|------|--------|----------|
| 4.1 配置系统重构 | P1 | `config.py`, `api/settings.py` |
| 4.2 事务管理增强 | P1 | `extensions.py`, `database/*.py` |
| 4.4 错误处理统一 | P2 | 全局 |

### 阶段二：代码质量提升
**预计工作量**: 中等

| 任务 | 优先级 | 影响范围 |
|------|--------|----------|
| 4.3 DAO层拆分 | P2 | `database/vocabulary_dao.py` |
| 4.5 输入验证层 | P2 | `api/*.py` |
| 4.7 算法参数配置化 | P2 | `core/*.py`, `config.py` |

### 阶段三：功能优化
**预计工作量**: 小

| 任务 | 优先级 | 影响范围 |
|------|--------|----------|
| 4.6 AI调用限流 | P1 | `utils/ai_helper.py`, `api/speaking.py` |
| 4.8 清理死代码 | P3 | 多处 |
| 三、未使用API清理 | P3 | `api/*.py` |

---

## 六、重构后目标架构

```
backend/
├── app.py                    # Flask入口（精简）
├── config.py                 # 配置定义（只读）
├── user_config.json          # 用户配置（持久化）【新增】
├── extensions.py             # DB + 事务管理【增强】
├── exceptions.py             # 自定义异常【新增】
│
├── api/
│   ├── __init__.py
│   ├── vocabulary.py         # 精简后
│   ├── speaking.py           # 精简后
│   ├── settings.py           # 大幅简化
│   ├── relations.py
│   └── vocabulary_assistance.py
│
├── schemas/                  # 请求验证【新增】
│   ├── __init__.py
│   ├── word.py
│   ├── speaking.py
│   └── settings.py
│
├── database/
│   ├── vocabulary/           # 拆分后【新结构】
│   │   ├── __init__.py
│   │   ├── word_crud.py
│   │   ├── word_query.py
│   │   ├── word_batch.py
│   │   ├── word_review.py
│   │   └── word_stats.py
│   ├── progress_dao.py
│   ├── speaking_dao.py
│   └── relation_dao.py
│
├── services/                 # 保持现有结构
│   └── ...
│
├── core/                     # 配置化算法
│   ├── review_repetition.py
│   └── spell_repetition.py
│
├── utils/
│   ├── ai_helper.py          # 增加重试
│   ├── rate_limiter.py       # 【新增】
│   └── logging_config.py     # 【新增】
│
└── doc/
    └── REFACTOR_PLAN.md      # 本文档
```

---

## 七、风险与回退策略

### 7.1 风险评估

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| 配置迁移数据丢失 | 中 | 高 | 编写迁移脚本，保留旧文件备份 |
| DAO拆分后调用中断 | 低 | 中 | 使用 `__init__.py` 重导出保持兼容 |
| 事务管理引入死锁 | 低 | 高 | 添加超时机制，监控慢查询 |
| 输入验证过于严格 | 中 | 低 | 逐步上线，先警告后拒绝 |

### 7.2 回退策略

- 所有重构使用Git分支进行
- 每个阶段完成后创建标签
- 保留原始 `config.py` 至少一个版本周期
- 数据库操作前备份 `vocabulary.db`

---

## 八、验收标准

### 8.1 功能验收
- [ ] 所有现有API行为不变
- [ ] 前端功能正常
- [ ] 复习/拼写算法结果一致

### 8.2 质量验收
- [ ] 无 `print()` 调试语句
- [ ] 所有API有输入验证
- [ ] 错误响应格式统一
- [ ] 单个文件不超过300行

### 8.3 安全验收
- [ ] 配置文件不再被正则替换
- [ ] AI API有速率限制
- [ ] 批量操作有事务保护

---

## 九、附录

### A. 删除的端点完整列表

```python
# 可直接删除
DELETE: POST /api/switch_source
DELETE: GET /api/speaking/stats
DELETE: POST /api/settings/reset
DELETE: POST /api/speaking/speech-to-text  # 或实现它

# 前端定义但未调用（确认后删除）
CONFIRM: GET /api/stats/words
CONFIRM: GET /api/stats/progress
CONFIRM: GET /api/stats/heatmap
CONFIRM: GET /api/stats/accuracy
CONFIRM: GET /api/stats/streak
CONFIRM: GET /api/stats/export
```

### B. 新增依赖

```txt
# requirements.txt 新增
pydantic>=2.0
```

### C. 配置迁移脚本草案

```python
# scripts/migrate_config.py
import re
import json
from pathlib import Path

def migrate_config():
    """将config.py中的值迁移到user_config.json"""
    config_py = Path("backend/config.py").read_text()

    # 提取所有配置值
    patterns = {
        "DAILY_NEW_WORDS_LIMIT": r"DAILY_NEW_WORDS_LIMIT\s*=\s*(\d+)",
        "MAX_PREP_DAYS": r"MAX_PREP_DAYS\s*=\s*(\d+)",
        # ... 更多模式
    }

    config = {}
    for key, pattern in patterns.items():
        match = re.search(pattern, config_py)
        if match:
            config[key] = int(match.group(1))

    # 写入JSON
    Path("backend/user_config.json").write_text(
        json.dumps(config, indent=2)
    )
    print(f"Migrated {len(config)} config values")

if __name__ == "__main__":
    migrate_config()
```
