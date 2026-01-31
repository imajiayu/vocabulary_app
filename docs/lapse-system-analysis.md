# Lapse 字段与错题复习模式 - 系统分析

## 概述

Lapse 系统是本应用三大复习模式之一，专门用于管理答错的单词。核心思路是：普通复习中答错的单词自动进入"错题集"（lapse > 0），用户可以在 `mode_lapse` 模式下专门复习这些单词，直到连续答对足够次数后单词才会移出错题集。

**三大模式常量**（`backend/const.py`）：

```python
MODE_REVIEW   = "mode_review"    # 标准间隔重复复习
MODE_LAPSE    = "mode_lapse"     # 错题集复习
MODE_SPELLING = "mode_spelling"  # 拼写练习
```

---

## 一、Lapse 字段定义

### 1.1 数据库层

**表 `words`** 中的字段：

| 字段 | 类型 | 默认值 | 含义 |
|------|------|--------|------|
| `lapse` | integer | 0 | 错题计数器：0 = 不在错题集，>0 = 在错题集中 |

**视图 `word_source_stats`** 中统计错题数量：

```sql
count(*) FILTER (WHERE stop_review = 0 AND lapse > 0) AS lapse_count
```

**表 `current_progress`** 保存错题模式进度：

| 字段 | 含义 |
|------|------|
| `initial_lapse_count` | 开始复习时所有错题单词的 lapse 值之和 |
| `initial_lapse_word_count` | 开始复习时错题单词总数 |

### 1.2 后端模型

`backend/models/word.py:42`：

```python
class Word(Base):
    lapse = Column(Integer, default=0)
```

`to_dict()` 方法中 lapse 被序列化返回前端（`word.py:61`）。

### 1.3 前端类型

`frontend/src/shared/types/index.ts`：

```typescript
export interface Word {
  lapse: number;
  // ...
}

export interface LearningSettings {
  lapseQueueSize: number;         // 错题队列大小
  lapseMaxValue: number;          // lapse 最大值
  lapseInitialValue: number;      // 首次答错时的 lapse 初始值
  lapseFastExitEnabled: boolean;  // 是否启用加速退出
  lapseConsecutiveThreshold: number; // 加速退出门槛
}
```

---

## 二、Lapse 值的语义

| lapse 值 | 状态 | 含义 |
|-----------|------|------|
| 0 | 不在错题集 | 单词已掌握或从未答错 |
| 1 | 错题集中 | 再答对 1 次即可移出 |
| 2 | 错题集中 | 再答对 2 次（或加速模式下 1 次）即可移出 |
| 3 | 错题集中（默认初始值） | 首次答错时进入的状态 |
| 4 | 错题集中（默认最大值） | 多次答错累积到上限 |

---

## 三、Lapse 配置参数

### 3.1 后端默认配置

`backend/config.py:12-28`：

```python
DEFAULT_CONFIG = {
    "learning": {
        "lapseQueueSize": 25,            # 错题队列默认大小
        "lapseMaxValue": 4,              # lapse 最大值（上限）
        "lapseInitialValue": 3,          # 首次答错时设置的 lapse 值
        "lapseFastExitEnabled": True,    # 是否启用加速退出模式
        "lapseConsecutiveThreshold": 4,  # 加速退出触发门槛
    }
}
```

### 3.2 UserConfig 属性

`backend/config.py:133-151` 通过 `UserConfig` 类暴露为属性：

| 属性 | 含义 |
|------|------|
| `LAPSE_QUEUE_SIZE` | 错题队列大小 |
| `LAPSE_MAX_VALUE` | lapse 最大值 |
| `LAPSE_INITIAL_VALUE` | 首次答错初始值 |
| `LAPSE_FAST_EXIT_ENABLED` | 是否启用加速退出 |
| `LAPSE_CONSECUTIVE_THRESHOLD` | 加速退出门槛 |

### 3.3 前端设置页

`frontend/src/pages/settings/LapseSettings.vue` 提供 UI 配置：

| 设置项 | 范围 | 默认值 | 说明 |
|--------|------|--------|------|
| 错题队列默认大小 | 15-40 | 25 | 每次练习加载的错题数量 |
| 答错后需连续答对次数 | 1~maxValue | 3 | 首次答错时 lapse 的初始值 |
| 最大需要连续答对次数 | 3-5 | 4 | lapse 的绝对上限 |
| 加速退出模式 | 开/关 | 开启 | 高 lapse 单词答对时 -2 而非 -1 |
| 快速退出门槛 | 1~maxValue | 2（重置默认） | lapse >= 此值时触发加速退出 |

---

## 四、Lapse 值变更逻辑

### 4.1 进入错题集 —— 标准复习中答错

**触发位置**：`backend/core/review_repetition.py:167-176` 的 `calculate_srs_parameters()` 函数

当 score <= 2（答错）时：

```python
# 进入错题集：首次设为 LAPSE_INITIAL_VALUE，后续不超过 LAPSE_MAX_VALUE
lapse = max(config.LAPSE_INITIAL_VALUE, min(lapse, config.LAPSE_MAX_VALUE))
```

**逻辑解读**：
- 如果 lapse 当前为 0（首次答错）：设为 `LAPSE_INITIAL_VALUE`（默认 3）
- 如果 lapse 已经 > 0（已在错题集中又答错）：保持原值，但不超过 `LAPSE_MAX_VALUE`（默认 4）
- 同时重置 SRS 参数：`repetition = 0`，`interval = 1`

### 4.2 错题模式中的 Lapse 变更

**触发位置**：`backend/services/word_update_service.py:348-384` 的 `update_word_info_lapse()` 函数

#### 答错（remembered=False）：

```python
lapse = min(lapse + 1, config.LAPSE_MAX_VALUE)  # 渐进增加，上限为配置值
```

#### 答对（remembered=True）：

```python
if config.LAPSE_FAST_EXIT_ENABLED and lapse >= config.LAPSE_CONSECUTIVE_THRESHOLD:
    lapse = max(0, lapse - 2)  # 加速退出：-2
else:
    lapse = max(0, lapse - 1)  # 正常退出：-1
```

#### 前端同步逻辑

`frontend/src/features/vocabulary/stores/review.ts:274-317` 中**前端先行计算**（乐观更新），与后端保持一致：

```typescript
const LAPSE_MAX_VALUE = userSettings.value?.learning.lapseMaxValue ?? 4
const LAPSE_FAST_EXIT_THRESHOLD = userSettings.value?.learning.lapseConsecutiveThreshold ?? 4
const LAPSE_FAST_EXIT_ENABLED = userSettings.value?.learning.lapseFastExitEnabled ?? true

if (!result.remembered) {
  word.lapse = Math.min(word.lapse + 1, LAPSE_MAX_VALUE)
} else {
  if (LAPSE_FAST_EXIT_ENABLED && word.lapse >= LAPSE_FAST_EXIT_THRESHOLD) {
    word.lapse = Math.max(0, word.lapse - 2)
  } else {
    word.lapse = Math.max(0, word.lapse - 1)
  }
}
```

### 4.3 Lapse 变更示例

假设默认配置（initialValue=3, maxValue=4, fastExit=true, threshold=4）：

| 场景 | 操作 | lapse 变化 | 说明 |
|------|------|-----------|------|
| 标准复习中答错 | score <= 2 | 0 → 3 | 首次进入错题集 |
| 错题模式答错 | remembered=false | 3 → 4 | +1，到达上限 |
| 错题模式答对（加速） | remembered=true, lapse=4 | 4 → 2 | lapse >= 4，触发加速 -2 |
| 错题模式答对（正常） | remembered=true, lapse=2 | 2 → 1 | lapse < 4，正常 -1 |
| 错题模式答对（移出） | remembered=true, lapse=1 | 1 → 0 | 移出错题集 |

---

## 五、错题模式（mode_lapse）完整流程

### 5.1 获取错题单词

**后端 DAO**：`backend/database/vocabulary/word_review.py:76-100`

```python
def db_fetch_lapse_word_ids(limit=None, user_id=1):
    query = db.query(Word.id).filter(
        Word.user_id == user_id,
        Word.stop_review == 0,
        Word.lapse > 0,              # 核心筛选条件
        Word.source == current_source
    )
    if shuffle:
        query = query.order_by(func.random())
    else:
        query = query.order_by(Word.lapse.asc())  # 低 lapse 优先
```

**API 路由**：`GET /api/words/review?mode=mode_lapse`（`backend/api/vocabulary.py:415-481`）

调用链：`get_review_words()` → `fetch_word_ids_by_mode(MODE_LAPSE)` → `db_fetch_lapse_word_ids()`

**注意**：lapse 模式下 shuffle 逻辑由前端处理，后端 `apply_shuffle_logic()` 对 lapse 模式直接返回原始顺序（`vocabulary.py:400-403`）。

### 5.2 前端加载流程

`frontend/src/features/vocabulary/stores/review.ts:181-207`

```
switchMode('mode_lapse')
  └→ loadWords(resetQueue=true)
      ├→ api.words.getReviewWords({ mode: 'mode_lapse', limit, batch_id: 0 })
      ├→ sortByLapse(data.words, shuffle)   // 按 lapse 分组排序
      ├→ initialLapseCount = totalLapseSum  // 记录初始 lapse 总和
      └→ saveProgressDirect(...)            // 保存快照到 Supabase
```

**一次性加载**：与分页加载不同，lapse 模式一次性加载所有错题单词，`hasMore` 始终为 `false`。

### 5.3 循环队列机制

lapse 模式使用**循环队列**而非线性队列（`review.ts:83-86`）：

```typescript
// lapse 模式：循环队列
return wordQueue.value[currentIndex.value % wordQueue.value.length] || null
```

用户在所有错题上循环答题，直到全部 lapse 降为 0 并移出队列。

### 5.4 排序策略

`review.ts:128-162` 的 `sortByLapse()` 函数：

1. 按 lapse 值**分组**（低 lapse 在前，高 lapse 在后）
2. 每组内部按 `id` 排序（或 shuffle 启用时随机）
3. 在以下时机重新排序：
   - 初始加载后
   - 一轮循环结束时（`currentIndex >= wordQueue.length`）
   - 单词移出队列且 index 越界时

### 5.5 结果提交

**前端**（`review.ts:274-344`）：

```
submitResult(wordId, { remembered })
  ├→ 前端乐观更新 lapse 值
  ├→ 如果 lapse === 0：从队列中 splice 移除 + 更新快照
  ├→ 否则：currentIndex++ + 可能重新排序
  └→ api.words.submitWordResult(wordId, result)  // 异步提交后端
```

**后端**（`PATCH /api/words/<id>/result` → `update_word_info_lapse()`）：

```
update_word_info_lapse(word_id, remembered, user_id)
  ├→ 获取当前 lapse 值
  ├→ 根据 remembered 和配置计算新 lapse
  └→ db_update_word_for_lapse(word_id, lapse)  // 仅更新 lapse 字段
```

**关键区别**：lapse 模式使用同步的 `PATCH /result` API，而非 review/spelling 模式的分离式 `calculate-result` + `persist-result` API。原因是 lapse 模式不产生 notification 数据。

### 5.6 进度计算

`review.ts:94-100`：

```typescript
const progress = computed(() => {
  if (mode.value === 'mode_lapse') {
    if (initialLapseCount.value === 0) return 0
    return Math.round(
      ((initialLapseCount.value - totalLapseSum.value) / initialLapseCount.value) * 100
    )
  }
  return 0
})
```

进度 = `(初始lapse总和 - 当前lapse总和) / 初始lapse总和 × 100%`

### 5.7 完成条件

`review.ts:108-111`：

```typescript
const isCompleted = computed(() => {
  if (mode.value === 'mode_lapse') {
    return wordQueue.value.length === 0  // 所有单词的 lapse 都降为 0 并移出
  }
})
```

---

## 六、错题模式的 UI 差异

### 6.1 隐藏的 UI 元素

| 组件 | 隐藏内容 | 代码位置 |
|------|---------|---------|
| ReviewCard.vue | "停止复习"按钮 | `ReviewCard.vue:114` `v-if="!isLapseMode"` |
| ReviewRightPanel.vue | 参数变化通知区域 | `ReviewRightPanel.vue:15` `v-if="!isLapseMode"` |
| ReviewRightPanel.vue | 移动端通知徽章 | `ReviewRightPanel.vue:277` `v-if="... && !isLapseMode"` |
| ReviewSpeedIndicator.vue | 速度指示器 | `ReviewSpeedIndicator.vue:24` `mode !== 'mode_lapse'` |

### 6.2 原因

lapse 模式只更新 lapse 字段，不修改 SRS 核心参数（EF、interval、repetition 等），因此没有参数变化通知可以显示。

---

## 七、进度恢复

`review.ts:460-533` 的 `restoreFromProgress()`：

Lapse 模式恢复时：
1. 从 Supabase 读取保存的 `word_ids` 快照
2. 重新一次性加载所有单词
3. 用保存的 `initial_lapse_count` 恢复进度百分比
4. `currentIndex` 始终为 0（循环队列）

---

## 八、数据库操作对比

| 操作 | mode_review | mode_lapse |
|------|------------|------------|
| 数据库函数 | `db_update_word_for_review()` | `db_update_word_for_lapse()` |
| 更新字段 | 全量（EF, interval, repetition, lapse, 统计字段等） | **仅 lapse** |
| API 模式 | 分离式（calculate + persist） | 同步式（PATCH /result） |
| 有通知数据 | 是 | 否 |
| 修改 SRS 参数 | 是 | 否 |

`db_update_word_for_lapse()`（`word_review.py:174-178`）：

```python
def db_update_word_for_lapse(id, lapse, user_id=1):
    db.execute(
        update(Word).where(Word.id == id, Word.user_id == user_id)
        .values(lapse=lapse)
    )
```

对比 `db_update_word_for_review()`（`word_review.py:133-171`）更新 12 个字段。

---

## 九、文件索引

### 后端

| 文件 | 行号 | 内容 |
|------|------|------|
| `backend/const.py` | 4 | `MODE_LAPSE` 常量定义 |
| `backend/config.py` | 17-21 | lapse 默认配置 |
| `backend/config.py` | 133-151 | `UserConfig` lapse 属性 |
| `backend/models/word.py` | 42 | `lapse` 字段定义 |
| `backend/models/word.py` | 61 | `to_dict()` 中 lapse 序列化 |
| `backend/core/review_repetition.py` | 125-187 | `calculate_srs_parameters()` 中答错进入错题集 |
| `backend/database/vocabulary/word_review.py` | 76-100 | `db_fetch_lapse_word_ids()` 查询错题 |
| `backend/database/vocabulary/word_review.py` | 174-178 | `db_update_word_for_lapse()` 更新 lapse |
| `backend/services/word_update_service.py` | 348-384 | `update_word_info_lapse()` 错题模式核心逻辑 |
| `backend/api/vocabulary.py` | 44-53 | `fetch_word_ids_by_mode()` 路由到 lapse 查询 |
| `backend/api/vocabulary.py` | 398-412 | `apply_shuffle_logic()` lapse 模式不 shuffle |
| `backend/api/vocabulary.py` | 484-533 | `PATCH /result` 处理 lapse 模式 |
| `backend/api/vocabulary.py` | 579 | `calculate-result` 不支持 lapse 模式 |

### 前端

| 文件 | 行号 | 内容 |
|------|------|------|
| `frontend/src/shared/types/index.ts` | 14 | `Word.lapse` 类型 |
| `frontend/src/shared/types/index.ts` | 108-112 | `LearningSettings` lapse 配置类型 |
| `frontend/src/shared/types/index.ts` | 171-182 | 进度类型中的 lapse 字段 |
| `frontend/src/features/vocabulary/stores/review.ts` | 22 | `ReviewMode` 类型 |
| `frontend/src/features/vocabulary/stores/review.ts` | 83-86 | 循环队列取词 |
| `frontend/src/features/vocabulary/stores/review.ts` | 94-100 | 进度百分比计算 |
| `frontend/src/features/vocabulary/stores/review.ts` | 108-111 | 完成判断 |
| `frontend/src/features/vocabulary/stores/review.ts` | 116-118 | `totalLapseSum` 计算 |
| `frontend/src/features/vocabulary/stores/review.ts` | 128-162 | `sortByLapse()` 排序 |
| `frontend/src/features/vocabulary/stores/review.ts` | 181-207 | lapse 模式加载逻辑 |
| `frontend/src/features/vocabulary/stores/review.ts` | 274-344 | lapse 模式结果提交 |
| `frontend/src/features/vocabulary/stores/review.ts` | 398-431 | lapse 模式停止复习 |
| `frontend/src/features/vocabulary/stores/review.ts` | 484-503 | lapse 模式进度恢复 |
| `frontend/src/features/vocabulary/review/ReviewCard.vue` | 114, 248 | 隐藏停止按钮 |
| `frontend/src/features/vocabulary/review/ReviewRightPanel.vue` | 15, 277, 551 | 隐藏通知区域 |
| `frontend/src/features/vocabulary/review/ReviewSpeedIndicator.vue` | 24 | 隐藏速度指示器 |
| `frontend/src/features/vocabulary/review/context.ts` | 11-21 | ReviewContext 接口 |
| `frontend/src/pages/settings/LapseSettings.vue` | 全文 | 错题设置页面 |
