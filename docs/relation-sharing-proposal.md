# 关系复用优化方案

> **状态**: 提案 (待实施)
> **日期**: 2026-02-06

## 问题背景

当前 `words_relations` 和 `relation_generation_log` 都是用户隔离的。但 IELTS 词汇大部分重合，每个新用户都需要重新跑生成器，浪费计算资源。

**核心难点**：
- `words` 表中相同单词对不同用户是不同 `word_id`
- 复用需要通过 `word` 字符串匹配，再映射到目标用户的 `word_id`

---

## 方案对比

| 方案 | 复杂度 | 性能 | 迁移成本 | RLS 兼容 |
|------|--------|------|----------|----------|
| A. 共享模板表 | 中 | 高 | 新建表 | ✅ |
| B. 跨用户实时 JOIN | 低 | 差 | 无 | ❌ 需 service role |
| C. 混合策略 | 高 | 最优 | 新建表 | ✅ |

---

## 推荐方案：共享模板表 + 懒惰回填

### 1. 新建模板表

```sql
CREATE TABLE word_relation_templates (
    id SERIAL PRIMARY KEY,
    word VARCHAR(255) NOT NULL,
    related_word VARCHAR(255) NOT NULL,
    relation_type relation_type_enum NOT NULL,
    confidence DOUBLE PRECISION DEFAULT 1.0,
    source_user_id UUID,  -- 首次贡献者（可选，用于追溯）
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (word, related_word, relation_type)
);

CREATE INDEX idx_wrt_word ON word_relation_templates (word);
CREATE INDEX idx_wrt_related_word ON word_relation_templates (related_word);
CREATE INDEX idx_wrt_relation_type ON word_relation_templates (relation_type);
```

**设计要点**：
- 无 `user_id` 字段 → 所有用户共享
- 存储 `(word, related_word)` 字符串对，不依赖 `word_id`
- 索引优化查询性能

### 2. 生成流程改造

```
原流程：
  _load_data() → generator.generate() → _save_batch()

新流程：
  _load_data()
       ↓
  _copy_from_templates()  ← 新增：从模板表复制已知关系
       ↓
  generator.generate()     ← 只处理模板中不存在的词
       ↓
  _save_batch()
       ↓
  _contribute_to_templates()  ← 新增：将新发现的关系写入模板表
```

### 3. 复制逻辑 `_copy_from_templates()`

```python
def _copy_from_templates(self, relation_type: str, user_id: str, words: List[Dict], word_index: Dict):
    """从模板表复制已知关系到用户的 words_relations"""

    # 1. 获取用户的所有单词字符串
    user_words = {w['word'].lower() for w in words}

    # 2. 查询模板表中，两端都在用户词汇表中的关系
    templates = session.execute(text("""
        SELECT word, related_word, confidence
        FROM word_relation_templates
        WHERE relation_type = :rt
          AND LOWER(word) IN :user_words
          AND LOWER(related_word) IN :user_words
    """), {"rt": relation_type, "user_words": tuple(user_words)}).fetchall()

    # 3. 映射到 word_id 并批量插入
    relations = []
    for word, related_word, confidence in templates:
        word_id = word_index.get(word.lower())
        related_id = word_index.get(related_word.lower())
        if word_id and related_id:
            relations.append({
                'user_id': user_id,
                'word_id': word_id,
                'related_word_id': related_id,
                'relation_type': relation_type,
                'confidence': confidence
            })

    # 4. 批量插入（ON CONFLICT DO NOTHING）
    _batch_insert_relations(relations)

    return len(relations) // 2  # 返回复制的关系对数
```

### 4. 回填逻辑 `_contribute_to_templates()`

```python
def _contribute_to_templates(self, relations: List[Dict], words: List[Dict], user_id: str):
    """将新发现的关系贡献到模板表"""

    # 构建 word_id → word 映射
    id_to_word = {w['id']: w['word'] for w in words}

    # 转换为字符串对
    templates = []
    seen = set()
    for rel in relations:
        word = id_to_word.get(rel['word_id'])
        related = id_to_word.get(rel['related_word_id'])
        if word and related:
            key = (word.lower(), related.lower(), rel['relation_type'])
            if key not in seen:
                seen.add(key)
                templates.append({
                    'word': word.lower(),
                    'related_word': related.lower(),
                    'relation_type': rel['relation_type'],
                    'confidence': rel['confidence'],
                    'source_user_id': user_id
                })

    # 批量 upsert（ON CONFLICT DO NOTHING）
    _batch_insert_templates(templates)
```

---

## 设计决策

1. **模板表 RLS**：无 RLS，通过后端 service role 访问（仅后端读写）
2. **confidence 值**：取首次贡献者的值（ON CONFLICT DO NOTHING）
3. **前端 UI**：不改，对用户透明
4. **初始填充**：迁移脚本从现有数据填充（快速冷启动）

---

## 实现步骤

### Phase 1: 数据库迁移
- [ ] 创建 `word_relation_templates` 表
- [ ] 添加索引

### Phase 2: 后端服务改造
- [ ] `generation_service.py`: 添加 `_copy_from_templates()`
- [ ] `generation_service.py`: 添加 `_contribute_to_templates()`
- [ ] 修改 `_run_generation()` 流程

### Phase 3: 初始数据填充
- [ ] 写迁移脚本从现有 `words_relations` 提取字符串对填充模板表

---

## 关键文件

| 文件 | 修改内容 |
|------|----------|
| `supabase/migrations/新迁移.sql` | 创建 `word_relation_templates` 表 |
| `backend/services/generation_service.py` | 添加复制和回填逻辑 |
| `backend/models/word.py` | 可选：添加模板表 ORM 模型 |

---

## 验证方式

1. 用户 A 生成 synonym 关系
2. 检查 `word_relation_templates` 表有数据
3. 用户 B 触发 synonym 生成
4. 观察日志：大部分关系通过复制获得，少量新词走生成器
