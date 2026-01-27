# 词汇复习系统深度分析

本文档详细分析了词汇学习应用中的复习、错题、拼写相关逻辑，包括前后端代码流程和潜在问题。

---

## 一、系统架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                        复习流程架构                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  前端 (Vue3 + Pinia)                                        │
│  ├─ ReviewCard.vue (复习界面)                              │
│  ├─ SpellingCard.vue (拼写界面)                            │
│  ├─ useReviewStore (状态管理)                             │
│  └─ useReviewContext (组件通信)                           │
│                                                             │
│  ↓ API 调用                                                │
│                                                             │
│  后端 Flask                                                 │
│  ├─ /api/words/<id>/result (提交结果)                     │
│  ├─ /api/words/<id>/calculate-result (计算)              │
│  ├─ /api/words/<id>/persist-result (持久化)              │
│  └─ /api/words/review (获取单词)                         │
│                                                             │
│  ↓ 核心业务逻辑                                            │
│                                                             │
│  业务层 (Services)                                         │
│  └─ word_update_service.py                               │
│                                                             │
│  ↓ 核心算法层                                              │
│                                                             │
│  算法层 (Core)                                             │
│  ├─ review_repetition.py (SM-2改进版)                   │
│  └─ spell_repetition.py (拼写强度)                      │
│                                                             │
│  ↓ 数据访问层                                              │
│                                                             │
│  DAO层 (Database)                                         │
│  └─ word_review.py                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、SM-2算法实现（改进版）

### 位置
`backend/core/review_repetition.py`

### 关键概念
- **EF（Ease Factor）**：难易因子，范围[1.3, 3.0]，影响间隔增长
- **Score**：评分1-5分，基于反应时间和是否记住
- **Interval**：下次复习距今天的天数
- **Repetition**：连续正确次数
- **Lapse**：错题次数

### 评分函数 `calculate_score()`

```python
def calculate_score(remembered, elapsed_time, threshold_fast=2, threshold_slow=5):
    """
    科学依据：认知心理学研究
    - 1.5秒：流利性阈值（Segalowitz & Hulstijn, 2005）
    - 4.0秒：认知负荷临界点

    逻辑：
    - 未记住 → 1分
    - ≤2秒 → 5分（流利掌握）
    - ≥5秒 → 3分（需要努力）
    - 2-5秒 → 对数映射到[3, 5]
    """
```

### EF更新函数 `sm2_update_ease_factor()`

调整幅度映射：
| Score | Delta | 说明 |
|-------|-------|------|
| 5 | +0.15 | 流利掌握，大幅奖励 |
| 4 | +0.08 | 良好表现，适度奖励 |
| 3 | -0.02 | 勉强掌握，轻微增加练习 |
| 2 | -0.20 | 困难回忆，明显增加练习 |
| 1 | -0.40 | 完全遗忘，大幅增加练习 |

额外优化：当EF ≤ 2.0且Score ≥ 4时，增幅乘以1.3倍

### SRS参数计算 `calculate_srs_parameters()`

**三种路径：**

1. **Score ≥ 4（流利记住）**
   - growth_factor = 1.0
   - interval按EF正常增长

2. **Score = 3（犹豫记住）**
   - growth_factor = 0.3（保守增长）

3. **Score ≤ 2（答错）**
   - repetition重置为0
   - interval重置为1
   - lapse计入错题

---

## 三、错题（Lapse）处理流程

### 触发条件
Score ≤ 2时，单词进入错题集

### Lapse值含义
- `lapse = 0`：已完成（不需要错题练习）
- `lapse = 1-4`：需要错题练习（值越高，优先级越高）

### 更新逻辑

**答错时：**
```python
lapse = min(lapse + 1, LAPSE_MAX_VALUE)  # 通常MAX=4
```

**答对时：**
```python
if LAPSE_FAST_EXIT_ENABLED and lapse >= LAPSE_FAST_EXIT_THRESHOLD:
    lapse = max(0, lapse - 2)  # 快速退出
else:
    lapse = max(0, lapse - 1)  # 正常退出
```

### 获取错题集
位置：`backend/database/vocabulary/word_review.py - db_fetch_lapse_word_ids()`

查询条件：
- stop_review = 0
- lapse > 0
- 按lapse升序或随机排序

---

## 四、拼写练习逻辑

### 位置
`backend/core/spell_repetition.py`

### 三层评估（权重组合）

| 层级 | 权重 | 说明 |
|------|------|------|
| 输入准确性 | 60% | 正确率 - 退格惩罚 |
| 输入流畅度 | 20% | 时间效率 + 节奏一致性 + 停顿惩罚 |
| 独立性 | 20% | 音频请求次数惩罚 |

### 层1：输入准确性 `_calculate_input_accuracy()`

- 基础准确率：word_length / typed_count
- 退格惩罚：
  - Cmd/Ctrl + Backspace：-0.50
  - ≥10次退格：-0.45
  - ≥6次退格：-0.35
  - ≥3次退格：-0.25
  - ≥1次退格：-0.15

### 层2：输入流畅度 `_analyze_input_fluency()`

- 时间效率(45%)：expected_time = 500ms + word_length * 180ms
- 节奏一致性(45%)：avg_interval ≤ 200ms → 1.0分
- 停顿惩罚(10%)：最长停顿 > 800ms 时扣分

### 层3：独立性 `_analyze_independence()`

每次音频请求 -20% 独立性

### 间隔计算公式

```python
interval = base_interval * (1.8 ** new_strength)
```

| 强度 | 间隔 |
|------|------|
| 0.0 | 1天 |
| 1.0 | 2天 |
| 2.0 | 3天 |
| 3.0 | 6天 |
| 4.0 | 10天 |
| 5.0 | 19天 |

---

## 五、前后端数据流

### 复习模式（分离式API）

```
前端提交 → POST /calculate-result（计算，无写入）
        → 立即显示通知
        → POST /persist-result（异步持久化）
```

### Lapse模式（同步API）

```
前端提交 → PATCH /result（直接写入）
        → 返回后更新队列
```

### 拼写模式

```
前端收集详细数据 → POST /calculate-result（三层评估）
                → POST /persist-result（异步持久化）
```

---

## 六、潜在Bug和逻辑不一致

### 🔴 严重问题

#### 1. Lapse快速退出与后端同步不一致

**位置：**
- 前端：`frontend/src/features/vocabulary/stores/review.ts` (line 251-267)
- 后端：`backend/services/word_update_service.py` (line 359)

**问题：** 前端UI立即更新lapse值，但网络延迟或失败时会与后端不同步

**修复建议：** 等待后端响应成功后再确认更新，失败时回滚

#### 2. 分离式API中word_data可能过时

**位置：**
- 前端：`frontend/src/features/vocabulary/stores/review.ts` (line 228-241)

**问题：** 多设备同时使用时，前端传递的word_data可能已被其他设备更新

**修复建议：** 后端始终查询最新数据，或使用乐观锁验证版本号

#### 3. avg_elapsed_time浮点精度累积误差

**位置：** `backend/core/review_repetition.py` (line 16-34)

**问题：** 多次更新后，浮点舍入误差累积

**修复建议：** 使用Welford's algorithm或定期重新计算

### 🟠 中等问题

#### 4. 低EF词优先级权重过于激进

**位置：** `backend/core/review_repetition.py` (line 191-196)

**问题：** 低EF词答错时，优先级权重达8.1，可能占据过多复习时间

#### 5. 拼写独立性权重过低

**位置：** `backend/core/spell_repetition.py` (line 86-96)

**问题：** 独立性仅占20%，用户可通过频繁播放音频"作弊"

**修复建议：** 增加独立性权重到30-40%

#### 6. maxPrepDays硬约束过于严格

**位置：** `backend/core/review_repetition.py` (line 351-353)

**问题：** 高强度词被强制限制在30天，可能导致单词堆积

### 🟡 轻微问题

#### 7. 移动端拼写数据收集不完整

**位置：** `frontend/src/features/vocabulary/spelling/SpellingCard.vue`

**问题：** 移动端无法收集KeyboardEvent，流畅度评分不准确

---

## 七、改进优先级

| 优先级 | 问题 | 影响 | 工作量 |
|--------|------|------|--------|
| P0 | word_data多设备不同步 | 数据不准确 | 中 |
| P0 | Lapse快速退出不同步 | 数据不一致 | 中 |
| P1 | avg_elapsed_time精度 | 长期漂移 | 低 |
| P1 | 拼写独立性权重过低 | 易作弊 | 低 |
| P2 | 低EF优先级过激进 | 负荷分配不均 | 中 |
| P2 | maxPrepDays软约束 | 用户体验 | 高 |

---

## 八、关键代码文件索引

### 后端
| 文件 | 职责 |
|------|------|
| `backend/core/review_repetition.py` | SM-2算法、负荷均衡 |
| `backend/core/spell_repetition.py` | 拼写强度算法 |
| `backend/services/word_update_service.py` | 业务逻辑层 |
| `backend/database/vocabulary/word_review.py` | 数据库查询 |
| `backend/api/vocabulary.py` | API路由 |

### 前端
| 文件 | 职责 |
|------|------|
| `frontend/src/features/vocabulary/stores/review.ts` | Pinia状态管理 |
| `frontend/src/features/vocabulary/review/ReviewCard.vue` | 复习卡片组件 |
| `frontend/src/features/vocabulary/spelling/SpellingCard.vue` | 拼写卡片组件 |
| `frontend/src/features/vocabulary/context/review.ts` | 组件间通信 |
