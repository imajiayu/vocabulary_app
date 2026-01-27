# 多用户实现方案

> 目标：两人使用（你和女朋友），采用"信任前端"的轻量方案，无需正式认证系统。

## 当前数据库结构（实际查询结果）

通过 `information_schema` 直接查询数据库得到：

**表 (8 个)**
```
current_progress        relation_generation_log    speaking_questions
speaking_records        speaking_topics            user_config
words                   words_relations
```

**视图 (8 个)**
```
relation_stats                      stats_added_date_distribution
stats_elapsed_time_distribution     stats_next_review_distribution
stats_review_count_distribution     stats_spell_next_review_distribution
stats_words_raw                     word_source_stats
```

---

## 架构概览

```
┌─────────────────────────┐
│  用户切换 UI            │  ← localStorage 存储 userId
│  [用户1] [用户2]        │
└───────────┬─────────────┘
            │ X-User-ID: 1 或 2
            ▼
┌─────────────────────────┐
│  Flask 后端             │  ← 从请求头提取 user_id
│  所有查询加 user_id     │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  PostgreSQL + Supabase  │  ← 表加 user_id 列
│  Storage 按用户分目录    │
└─────────────────────────┘
```

---

## 第一部分：数据库改动

### 1.1 需要加 user_id 的表（6 个）

| 表名 | 说明 | 当前设计 |
|------|------|----------|
| `words` | 词汇库 | 全局共享 |
| `current_progress` | 复习进度 | 单行表 (id=1) |
| `user_config` | 用户配置 | 单行表 (id=1) |
| `words_relations` | 词汇关系 | 关联 words |
| `relation_generation_log` | 关系生成日志 | 关联 words |
| `speaking_records` | 口语录音 | Supabase 表 |

### 1.2 不需要改的表（2 个）

| 表名 | 说明 | 原因 |
|------|------|------|
| `speaking_topics` | 口语话题 | 全局题库共享 |
| `speaking_questions` | 口语问题 | 全局题库共享 |

### 1.3 SQL 迁移脚本

```sql
-- =============================================
-- 多用户迁移脚本
-- 执行前请备份数据库！
-- =============================================

-- 1. words 表
ALTER TABLE words ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;

-- 移除全局唯一约束，改为每用户唯一
ALTER TABLE words DROP CONSTRAINT IF EXISTS unique_word;
ALTER TABLE words DROP CONSTRAINT IF EXISTS words_word_source_key;
ALTER TABLE words ADD CONSTRAINT unique_word_per_user UNIQUE(word, user_id, source);

-- 添加索引
CREATE INDEX idx_words_user_id ON words(user_id);

-- 2. current_progress 表
-- 移除单行约束，改为每用户一行
ALTER TABLE current_progress DROP CONSTRAINT IF EXISTS single_row_constraint;
ALTER TABLE current_progress ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE current_progress ADD CONSTRAINT unique_progress_per_user UNIQUE(user_id);

-- 3. user_config 表
ALTER TABLE user_config DROP CONSTRAINT IF EXISTS user_config_single_row;
ALTER TABLE user_config ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE user_config ADD CONSTRAINT unique_config_per_user UNIQUE(user_id);

-- 4. words_relations 表
ALTER TABLE words_relations ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;
CREATE INDEX idx_words_relations_user_id ON words_relations(user_id);

-- 5. relation_generation_log 表
ALTER TABLE relation_generation_log ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;
CREATE INDEX idx_relation_generation_log_user_id ON relation_generation_log(user_id);

-- 6. speaking_records 表 (Supabase)
ALTER TABLE speaking_records ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1;
CREATE INDEX idx_speaking_records_user_id ON speaking_records(user_id);
```

### 1.4 视图重建（8 个）

所有视图需要加 `user_id` 列。以下是从数据库直接查询得到的完整视图列表：

| 视图名 | 基于表 | 用途 |
|--------|--------|------|
| `stats_words_raw` | words | 原始统计数据 |
| `stats_next_review_distribution` | words | 复习日期分布 |
| `stats_spell_next_review_distribution` | words | 拼写复习日期分布 |
| `stats_elapsed_time_distribution` | words | 响应时间分布 |
| `stats_review_count_distribution` | words | 复习次数分布 |
| `stats_added_date_distribution` | words | 添加日期分布 |
| `word_source_stats` | words | 词源统计汇总 |
| `relation_stats` | words_relations | 关系类型统计 |

```sql
-- stats_words_raw
CREATE OR REPLACE VIEW stats_words_raw AS
SELECT
    user_id,  -- 新增
    id,
    word,
    source,
    ease_factor,
    ROUND(ease_factor::numeric, 2) as ef_rounded,
    ROUND(avg_elapsed_time::numeric) as elapsed_time_rounded,
    next_review,
    spell_next_review,
    (COALESCE(remember_count, 0) + COALESCE(forget_count, 0)) as review_count,
    spell_strength,
    ROUND(spell_strength::numeric, 2) as spell_strength_rounded,
    COALESCE(repetition, 0) as repetition,
    date_added,
    (COALESCE(repetition, 0) >= 3) as spell_available
FROM words
WHERE stop_review = 0;

-- stats_next_review_distribution
CREATE OR REPLACE VIEW stats_next_review_distribution AS
SELECT
    user_id,  -- 新增
    source,
    next_review as date,
    COUNT(*) as count
FROM words
WHERE stop_review = 0 AND next_review IS NOT NULL
GROUP BY user_id, source, next_review
ORDER BY user_id, source, next_review;

-- stats_spell_next_review_distribution
CREATE OR REPLACE VIEW stats_spell_next_review_distribution AS
SELECT
    user_id,  -- 新增
    source,
    spell_next_review as date,
    COUNT(*) as count
FROM words
WHERE stop_review = 0
    AND spell_next_review IS NOT NULL
    AND (COALESCE(repetition, 0) >= 3 OR spell_strength IS NOT NULL)
GROUP BY user_id, source, spell_next_review
ORDER BY user_id, source, spell_next_review;

-- stats_elapsed_time_distribution
CREATE OR REPLACE VIEW stats_elapsed_time_distribution AS
SELECT
    user_id,  -- 新增
    source,
    ROUND(avg_elapsed_time::numeric) as elapsed_time,
    COUNT(*) as count
FROM words
WHERE stop_review = 0 AND avg_elapsed_time IS NOT NULL
GROUP BY user_id, source, ROUND(avg_elapsed_time::numeric)
ORDER BY user_id, source, elapsed_time;

-- stats_review_count_distribution
CREATE OR REPLACE VIEW stats_review_count_distribution AS
SELECT
    user_id,  -- 新增
    source,
    (COALESCE(remember_count, 0) + COALESCE(forget_count, 0)) as review_count,
    COUNT(*) as count
FROM words
WHERE stop_review = 0
GROUP BY user_id, source, (COALESCE(remember_count, 0) + COALESCE(forget_count, 0))
ORDER BY user_id, source, review_count;

-- stats_added_date_distribution
CREATE OR REPLACE VIEW stats_added_date_distribution AS
SELECT
    user_id,  -- 新增
    source,
    date_added as date,
    COUNT(*) as count
FROM words
WHERE stop_review = 0 AND date_added IS NOT NULL
GROUP BY user_id, source, date_added
ORDER BY user_id, source, date_added;

-- word_source_stats（词源统计汇总）
CREATE OR REPLACE VIEW word_source_stats AS
SELECT
    user_id,  -- 新增
    source,
    count(*) AS total,
    count(*) FILTER (WHERE stop_review = 1) AS remembered,
    count(*) FILTER (WHERE stop_review = 0) AS unremembered,
    count(*) FILTER (WHERE stop_review = 0 AND next_review IS NOT NULL AND next_review <= CURRENT_DATE) AS due_count,
    count(*) FILTER (WHERE stop_review = 0 AND lapse > 0) AS lapse_count,
    count(*) FILTER (WHERE stop_review = 0 AND (repetition >= 3 OR spell_strength IS NOT NULL)) AS spelling_count,
    count(*) FILTER (WHERE stop_review = 0 AND (repetition >= 3 OR spell_strength IS NOT NULL) AND (spell_next_review IS NULL OR spell_next_review <= CURRENT_DATE)) AS today_spell_count
FROM words
GROUP BY user_id, source;

-- relation_stats（关系类型统计）
CREATE OR REPLACE VIEW relation_stats AS
SELECT
    user_id,  -- 新增
    relation_type,
    count(*) / 2 AS count
FROM words_relations
GROUP BY user_id, relation_type;
```

---

## 第二部分：Storage 改动

### 2.1 当前结构

```
speaking-audios/
├── recording_1706123456789.wav
├── recording_1706123456790.wav
└── ...
```

### 2.2 改动后结构

按用户 ID 分目录：

```
speaking-audios/
├── user_1/
│   ├── recording_1706123456789.wav
│   └── ...
└── user_2/
    ├── recording_1706123456790.wav
    └── ...
```

### 2.3 前端改动

修改 `frontend/src/shared/services/supabase-storage.ts`：

```typescript
import { supabase } from '@/shared/config/supabase'
import { getCurrentUserId } from '@/shared/composables/useUserSelection'

const AUDIO_BUCKET = 'speaking-audios'

/**
 * 上传音频文件到 Supabase Storage
 * @param file 音频文件
 * @returns 公开访问 URL
 */
export async function uploadAudio(file: File): Promise<string> {
  const userId = getCurrentUserId()
  const timestamp = Date.now()
  const extension = file.name.split('.').pop() || 'wav'
  // 改为用户目录下的文件
  const filepath = `user_${userId}/recording_${timestamp}.${extension}`

  const { error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(filepath, file, {
      contentType: file.type || 'audio/wav',
      upsert: false
    })

  if (error) {
    throw new Error(`上传音频失败: ${error.message}`)
  }

  const { data } = supabase.storage
    .from(AUDIO_BUCKET)
    .getPublicUrl(filepath)

  return data.publicUrl
}

/**
 * 从 Supabase Storage 删除音频文件
 * @param url 音频文件的公开 URL
 */
export async function deleteAudio(url: string): Promise<void> {
  const filepath = extractFilepath(url)
  if (!filepath) {
    console.warn('无法从 URL 提取文件路径:', url)
    return
  }

  const { error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .remove([filepath])

  if (error) {
    console.error('删除音频失败:', error.message)
  }
}

/**
 * 从 Supabase Storage URL 提取文件路径
 * @param url 完整的 URL
 * @returns 文件路径（如 user_1/recording_xxx.wav）
 */
export function extractFilepath(url: string): string | null {
  if (!url) return null

  try {
    // URL 格式: https://xxx.supabase.co/storage/v1/object/public/speaking-audios/user_1/filename.wav
    const bucketIndex = url.indexOf(AUDIO_BUCKET)
    if (bucketIndex === -1) return null
    return url.slice(bucketIndex + AUDIO_BUCKET.length + 1)
  } catch {
    return null
  }
}
```

### 2.4 现有音频迁移（可选）

如果需要迁移现有音频到用户1目录：

```bash
# 使用 Supabase CLI 或在 Dashboard 中手动移动
# 将根目录的文件移动到 user_1/ 目录
```

或者直接在数据库中更新 URL：

```sql
UPDATE speaking_records
SET audio_file = REPLACE(audio_file, '/speaking-audios/', '/speaking-audios/user_1/')
WHERE audio_file IS NOT NULL AND audio_file NOT LIKE '%/user_%/%';
```

---

## 第三部分：后端改动

### 3.1 用户识别中间件

新建 `backend/middleware/user_context.py`：

```python
"""
用户上下文中间件
从请求头获取当前用户 ID
"""
from flask import request, g

VALID_USER_IDS = {1, 2}
DEFAULT_USER_ID = 1


def get_current_user_id() -> int:
    """从请求头获取当前用户 ID"""
    try:
        user_id = int(request.headers.get('X-User-ID', DEFAULT_USER_ID))
        if user_id not in VALID_USER_IDS:
            user_id = DEFAULT_USER_ID
    except (ValueError, TypeError):
        user_id = DEFAULT_USER_ID
    return user_id


def init_user_context():
    """在请求开始时初始化用户上下文"""
    g.user_id = get_current_user_id()
```

在 `backend/app.py` 中注册：

```python
from backend.middleware.user_context import init_user_context

@app.before_request
def before_request():
    init_user_context()
```

### 3.2 需要修改的 DAO 文件

| 文件 | 改动点 |
|------|--------|
| `database/vocabulary/word_query.py` | 所有查询加 `.filter(Word.user_id == user_id)` |
| `database/vocabulary/word_review.py` | 所有查询加 user_id 过滤 |
| `database/vocabulary/word_mutation.py` | 插入时设置 user_id |
| `database/progress_dao.py` | Progress 查询改为按 user_id |
| `database/config_dao.py` | UserConfig 查询改为按 user_id |
| `database/relations_dao.py` | 关系查询加 user_id 过滤 |

### 3.3 示例：修改 word_query.py

```python
# 修改前
def db_get_words_by_source(source):
    return db.query(Word).filter(Word.source == source).all()

# 修改后
def db_get_words_by_source(source, user_id):
    return db.query(Word).filter(
        Word.source == source,
        Word.user_id == user_id  # 新增
    ).all()
```

### 3.4 示例：修改 API 路由

```python
# backend/api/vocabulary.py

from flask import g

@api_bp.route("/words/review", methods=["GET"])
def get_review_words():
    user_id = g.user_id  # 从上下文获取

    mode = request.args.get("mode", "mode_review")
    all_ids = db_fetch_review_word_ids(user_id=user_id)  # 传递 user_id

    save_word_ids_snapshot(mode, all_ids, user_id=user_id)  # 传递 user_id
    # ...
```

### 3.5 需要修改的 API 路由清单

| 蓝图 | 路由 | 改动 |
|------|------|------|
| vocabulary.py | `GET /words` | 加 user_id 过滤 |
| vocabulary.py | `GET /words/review` | 加 user_id 过滤 |
| vocabulary.py | `POST /words` | 设置 user_id |
| vocabulary.py | `PUT /words/<id>` | 校验 user_id |
| vocabulary.py | `DELETE /words/<id>` | 校验 user_id |
| vocabulary.py | `POST /words/<id>/review` | 校验 user_id |
| vocabulary.py | `GET /words/progress` | 按 user_id 查询 |
| settings.py | `GET /settings` | 按 user_id 查询 |
| settings.py | `POST /settings` | 按 user_id 更新 |
| relations.py | `GET /relations/<word_id>` | 加 user_id 过滤 |

---

## 第四部分：前端改动

### 4.1 用户选择 Composable

新建 `frontend/src/shared/composables/useUserSelection.ts`：

```typescript
import { ref, readonly } from 'vue'

const STORAGE_KEY = 'vocabulary_user_id'
const DEFAULT_USER_ID = '1'

// 全局状态（模块级别）
const currentUserId = ref(localStorage.getItem(STORAGE_KEY) || DEFAULT_USER_ID)

export function useUserSelection() {
  const switchUser = (userId: string) => {
    if (userId !== '1' && userId !== '2') {
      userId = DEFAULT_USER_ID
    }
    currentUserId.value = userId
    localStorage.setItem(STORAGE_KEY, userId)
    // 刷新页面以重新加载数据
    window.location.reload()
  }

  return {
    currentUserId: readonly(currentUserId),
    switchUser
  }
}

// 导出给非组件代码使用（如 API client）
export function getCurrentUserId(): string {
  return currentUserId.value
}
```

### 4.2 用户切换组件

新建 `frontend/src/shared/components/layout/UserSelector.vue`：

```vue
<template>
  <div class="user-selector">
    <button
      v-for="id in ['1', '2']"
      :key="id"
      :class="['user-btn', { active: currentUserId === id }]"
      @click="switchUser(id)"
    >
      {{ id === '1' ? '用户1' : '用户2' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { useUserSelection } from '@/shared/composables/useUserSelection'

const { currentUserId, switchUser } = useUserSelection()
</script>

<style scoped>
.user-selector {
  display: flex;
  gap: var(--spacing-xs);
}

.user-btn {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-secondary);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
}

.user-btn:hover {
  border-color: var(--color-primary);
}

.user-btn.active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}
</style>
```

### 4.3 修改 API Client

修改 `frontend/src/shared/api/client.ts`：

```typescript
import axios from 'axios'
import { getCurrentUserId } from '@/shared/composables/useUserSelection'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || ''
})

// 请求拦截器：自动添加 X-User-ID
client.interceptors.request.use((config) => {
  config.headers['X-User-ID'] = getCurrentUserId()
  return config
})

export default client
```

### 4.4 修改 Supabase 查询

修改 `frontend/src/shared/api/speaking.ts` 中涉及 `speaking_records` 的查询：

```typescript
import { getCurrentUserId } from '@/shared/composables/useUserSelection'

// 获取录音时加 user_id 过滤
static async getRecordsDirect(questionId: number) {
  const userId = getCurrentUserId()
  const { data, error } = await supabase
    .from('speaking_records')
    .select('*')
    .eq('question_id', questionId)
    .eq('user_id', parseInt(userId))  // 新增
    .order('created_at', { ascending: false })
  // ...
}

// 创建录音时设置 user_id
static async createRecordDirect(record: Partial<SpeakingRecord>) {
  const userId = getCurrentUserId()
  const { data, error } = await supabase
    .from('speaking_records')
    .insert({
      ...record,
      user_id: parseInt(userId)  // 新增
    })
    .select()
    .single()
  // ...
}
```

### 4.5 修改统计页面查询

修改 `frontend/src/pages/StatisticsPage.vue` 中的 Supabase 视图查询：

```typescript
import { getCurrentUserId } from '@/shared/composables/useUserSelection'

// 查询视图时加 user_id 过滤
const { data } = await supabase
  .from('stats_words_raw')
  .select('*')
  .eq('user_id', parseInt(getCurrentUserId()))  // 新增
  .eq('source', currentSource.value)
```

### 4.6 在 TopBar 中添加用户切换

修改 `frontend/src/shared/components/layout/TopBar.vue`：

```vue
<template>
  <div class="topbar">
    <!-- 现有内容 -->
    <UserSelector />
  </div>
</template>

<script setup>
import UserSelector from './UserSelector.vue'
</script>
```

---

## 第五部分：实施顺序

### Phase 1：数据库层（1-2小时）

1. 备份数据库
2. 执行 SQL 迁移脚本（添加 user_id 列到 6 个表）
3. 重建 8 个视图

### Phase 2：后端层（3-4小时）

1. 创建用户上下文中间件
2. 修改所有 DAO 函数添加 user_id 参数
3. 修改 API 路由传递 user_id
4. 本地测试

### Phase 3：前端层（2-3小时）

1. 创建 useUserSelection composable
2. 修改 API client 添加请求头
3. 创建用户切换组件
4. 修改 Supabase 查询添加 user_id 过滤
5. 修改 Storage 上传路径

### Phase 4：测试（1-2小时）

1. 测试用户切换
2. 测试数据隔离（词汇、进度、配置、口语）
3. 测试音频上传/播放

---

## 改动文件清单

### 新建文件

| 文件 | 说明 |
|------|------|
| `backend/middleware/user_context.py` | 用户上下文中间件 |
| `frontend/src/shared/composables/useUserSelection.ts` | 用户选择逻辑 |
| `frontend/src/shared/components/layout/UserSelector.vue` | 用户切换组件 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `backend/app.py` | 注册中间件 |
| `backend/api/vocabulary.py` | 传递 user_id |
| `backend/api/settings.py` | 传递 user_id |
| `backend/api/relations.py` | 传递 user_id |
| `backend/database/vocabulary/word_query.py` | 加 user_id 过滤 |
| `backend/database/vocabulary/word_review.py` | 加 user_id 过滤 |
| `backend/database/vocabulary/word_mutation.py` | 设置 user_id |
| `backend/database/progress_dao.py` | 按 user_id 查询 |
| `backend/database/config_dao.py` | 按 user_id 查询 |
| `backend/models/word.py` | 添加 user_id 字段 |
| `backend/models/config_models.py` | 添加 user_id 字段 |
| `frontend/src/shared/api/client.ts` | 添加请求头 |
| `frontend/src/shared/api/speaking.ts` | 添加 user_id 过滤 |
| `frontend/src/shared/services/supabase-storage.ts` | 用户目录 |
| `frontend/src/pages/StatisticsPage.vue` | 添加 user_id 过滤 |
| `frontend/src/shared/components/layout/TopBar.vue` | 添加切换组件 |

---

## 注意事项

1. **数据备份**：执行迁移前务必备份数据库
2. **现有数据**：迁移后现有数据自动归属 user_id=1
3. **Storage 迁移**：现有音频可以保持原位，或手动迁移到 user_1 目录
4. **测试覆盖**：确保所有 DAO 函数都添加了 user_id 过滤
5. **无认证**：此方案无真正认证，仅适合信任环境使用
