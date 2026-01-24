# 数据库查询优化清单

> 迁移到 Vercel + Supabase 后，数据库查询延迟明显增加。本文档记录需要优化的查询问题。

## 优化状态

### 后端优化

| 优先级 | 问题 | 状态 |
|--------|------|------|
| ✅ 完成 | word_stats.py 循环查询未来负荷 | 已优化（45-90次→1次）|
| ✅ 完成 | word_query.py 循环 count source | 已优化（8-20次→1次）|
| ✅ 完成 | word_query.py N+1 关联词查询 | 已优化（使用 joinedload）|
| ✅ 完成 | progress_service.py 重复查询 | 已优化（3次→1次）|
| ✅ 完成 | speaking_dao.py 删除时 N+1 | 已优化（批量查询）|
| ✅ 完成 | vocabulary.py fetch-definition 重复查询 | 已优化（轻量验证）|
| ✅ 完成 | word_update_service.py 分离式 API | 已优化 |
| ✅ 完成 | word_crud.py db_update_word 不必要查询 | 已删除无用的 original_word 查询 |

### 前端优化

| 优先级 | 问题 | 状态 |
|--------|------|------|
| ✅ 完成 | stopReview API 返回值未利用 | 前端现在使用 API 返回的 updated_word |
| ✅ 完成 | review.ts stopReviewWord 冗余 getWord | 已删除，直接使用 stopReview 返回值 |
| ✅ 完成 | wordEditor.ts markMastered 冗余 getWord | 已删除，直接使用 stopReview 返回值 |
| ✅ 完成 | QuestionPractice.vue fetchRecords 双重调用 | 已删除 onMounted 中的重复调用 |
| 🟠 待优化 | HomePage.vue getTopics 未共享缓存 | 需要重构 useSpeakingData 为全局单例 |
| 🟠 待优化 | getSettings 多处直接调用 | 建议统一使用 useSettings composable |

---

## 🔴 高优先级

### 1. 循环查询未来负荷（45-90次查询）

**文件**: `backend/database/vocabulary/word_stats.py:163-181`

**问题**: `get_daily_review_loads_by_source()` 在循环中执行独立的 count 查询

```python
# 当前代码（问题）
for i in range(1, days_ahead + 1):  # days_ahead 默认 45
    target_date = base_date + timedelta(days=i)
    count = db.query(Word).filter(
        Word.source == source,
        Word.stop_review == 0,
        Word.next_review == target_date
    ).count()  # 每次循环 1 次查询
    daily_loads[target_date] = count
```

**影响**: 每次调用执行 45-90 次独立查询

**优化方案**:
```python
# 优化后：单次分组查询
future_dates = [base_date + timedelta(days=i) for i in range(1, days_ahead + 1)]
results = db.query(Word.next_review, func.count(Word.id)).filter(
    Word.source == source,
    Word.stop_review == 0,
    Word.next_review.in_(future_dates)
).group_by(Word.next_review).all()

daily_loads = {date: 0 for date in future_dates}
for date, count in results:
    daily_loads[date] = count
```

**预期优化**: 45-90 次 → 1 次（-98%）

---

### 2. 循环 count 每个 source（8-20次查询）

**文件**: `backend/database/vocabulary/word_query.py:77-131`

**问题**: `db_fetch_word_info_paginated()` 对每个 source 执行多次 count 查询

```python
# 当前代码（问题）
total_count = db.query(Word).count()  # 查询 1
mastered_count = db.query(Word).filter(Word.stop_review == 1).count()  # 查询 2

for source in CUSTOM_SOURCES:  # 假设 3 个 source
    source_total = db.query(Word).filter(Word.source == source).count()  # 查询 3,5,7
    source_mastered = db.query(Word).filter(
        Word.source == source, Word.stop_review == 1
    ).count()  # 查询 4,6,8
```

**影响**: 2 + 2×N 次查询（N = source 数量）

**优化方案**:
```python
# 优化后：单次分组查询
from sqlalchemy import func, case

results = db.query(
    Word.source,
    func.count(Word.id).label('total'),
    func.sum(case((Word.stop_review == 1, 1), else_=0)).label('mastered')
).group_by(Word.source).all()

# 汇总
counts = {r.source: {'total': r.total, 'mastered': r.mastered} for r in results}
total_count = sum(c['total'] for c in counts.values())
mastered_count = sum(c['mastered'] for c in counts.values())
```

**预期优化**: 8-20 次 → 1 次（-75%~95%）

---

### 3. N+1 关联词查询

**文件**: `backend/database/vocabulary/word_query.py:28-49`

**问题**: `db_get_words_review_info_batch()` 批量获取单词后，循环中触发懒加载

```python
# 当前代码（问题）
words = db.query(Word).filter(Word.id.in_(word_ids)).all()  # 查询 1

for word in word_dict.values():
    word_dict[word.id]["related_words"] = word.get_all_related_words(db)
    # ↑ 每次调用触发：
    #   - self.related_words 懒加载（查询 2,3,4...N+1）
    #   - rel.related_word 懒加载（查询 N+2...）
```

**影响**: 1 + 4N 次查询（N = 单词数量）

**优化方案**:
```python
# 优化后：使用 eager loading
from sqlalchemy.orm import joinedload

words = db.query(Word).filter(Word.id.in_(word_ids)).options(
    joinedload(Word.related_words).joinedload(WordRelation.related_word)
).all()

# 现在访问 related_words 不会触发额外查询
for word in words:
    related = [
        {
            "id": rel.related_word.id,
            "word": rel.related_word.word,
            "relation_type": rel.relation_type.value,
            "confidence": rel.confidence,
        }
        for rel in word.related_words
    ]
```

**预期优化**: 1+4N 次 → 1 次（-80%+）

---

## 🟠 中优先级

### 4. 重复查询 progress

**文件**: `backend/database/progress_dao.py`

**问题**: `get_progress_info()` 中多次调用导致重复查询

```python
# 当前代码（问题）
def get_progress_info():
    if not db_has_valid_progress():  # 查询 1（调用 db_get_progress）
        return None
    summary = db_get_progress_summary()  # 查询 2（内部再调用 db_get_progress）
    progress = db_get_progress()  # 查询 3
```

**影响**: 同一数据查询 3 次

**优化方案**:
```python
# 优化后：单次查询，合并验证和获取
def get_progress_info():
    progress = db_get_progress()
    if not progress or not progress.get("word_ids_snapshot"):
        return None
    # 直接使用 progress 构建 summary
    return {
        "progress": progress,
        "summary": _build_summary_from_progress(progress)
    }
```

**预期优化**: 3 次 → 1 次（-66%）

---

### 5. 删除时 N+1 查询

**文件**: `backend/database/speaking_dao.py:181-211`

**问题**: `db_delete_topic()` 删除主题时循环查询记录

```python
# 当前代码（问题）
topic = db.query(SpeakingTopic).options(
    joinedload(SpeakingTopic.questions)
).filter(SpeakingTopic.id == topic_id).first()

for question in topic.questions:  # N 个问题
    records = db.query(SpeakingRecord).filter(
        SpeakingRecord.question_id == question.id
    ).all()  # 每个问题查询 1 次
```

**影响**: 1 + N 次查询（N = 问题数量）

**优化方案**:
```python
# 优化后：批量查询所有记录
question_ids = [q.id for q in topic.questions]
all_records = db.query(SpeakingRecord).filter(
    SpeakingRecord.question_id.in_(question_ids)
).all()

# 按 question_id 分组
records_by_question = defaultdict(list)
for record in all_records:
    records_by_question[record.question_id].append(record)
```

**预期优化**: 1+N 次 → 2 次（-50%+）

---

### 6. fetch-definition 重复查询

**文件**: `backend/api/vocabulary.py:900-939`

**问题**: 获取释义时查询同一单词 3 次

```python
# 当前代码（问题）
@api_bp.route("/words/<int:word_id>/fetch-definition")
def fetch_definition(word_id):
    word = db_get_word_review_info(word_id)  # 查询 1（验证存在）
    # ... 获取释义 ...
    db_update_word_definition_only(word_id, definition)  # 更新
    updated_word = db_get_word_review_info(word_id)  # 查询 2（获取最新数据）
    return updated_word
```

**影响**: 2 次查询（可减少为 1 次）

**优化方案**:
```python
# 优化后：验证使用轻量查询，或合并更新和返回
def fetch_definition(word_id):
    # 方案 A：轻量验证
    if not db.query(Word.id).filter(Word.id == word_id).first():
        return error("Word not found")

    # 方案 B：更新后直接返回（如果 ORM 支持）
    updated_word = db_update_and_return_word(word_id, definition)
```

**预期优化**: 2 次 → 1 次（-50%）

---

## ✅ 已完成优化

### 分离式 API（calculate + persist）

**文件**: `backend/services/word_update_service.py`

**问题**: 原 `submitWordResult` API 需要等待数据库写入后才返回通知

**解决方案**:
1. 新增 `calculate-result` API：前端传完整 word 数据，后端纯计算，跳过数据库查询
2. 新增 `persist-result` API：异步持久化，不阻塞用户

**优化效果**: 通知显示延迟从 3-5s 降低到 <500ms

---

## 优化实施建议

### 第一阶段（立即）
1. ✅ 分离式 API（已完成）
2. 🔴 `get_daily_review_loads_by_source()` - 影响最大
3. 🔴 `db_fetch_word_info_paginated()` - 管理页面性能

### 第二阶段（短期）
4. 🔴 `db_get_words_review_info_batch()` - 复习页面性能
5. 🟠 progress 相关查询合并

### 第三阶段（中期）
6. 🟠 speaking 删除优化
7. 🟠 fetch-definition 优化

---

## 通用优化原则

1. **避免循环查询**: 使用 `IN` 子句 + `GROUP BY` 替代循环
2. **使用 eager loading**: 对关联数据使用 `joinedload` / `selectinload`
3. **前端传数据**: 前端已有的数据直接传给后端，避免重复查询
4. **合并相关查询**: 多个相关查询合并为一次
5. **轻量验证**: 仅验证存在性时使用 `SELECT id` 而非 `SELECT *`
