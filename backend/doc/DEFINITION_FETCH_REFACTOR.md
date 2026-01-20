# 释义获取重构方案

> 将异步队列+轮询模式重构为同步请求模式，以适配 Serverless 架构。

## 目录

- [背景](#背景)
- [当前实现分析](#当前实现分析)
- [重构目标](#重构目标)
- [详细方案](#详细方案)
  - [场景1: 单个单词添加](#场景1-单个单词添加)
  - [场景2: 批量单词导入](#场景2-批量单词导入)
  - [场景3: 编辑单词时修改 word 字段](#场景3-编辑单词时修改-word-字段)
  - [场景4: 手动刷新释义](#场景4-手动刷新释义)
- [代码变更清单](#代码变更清单)
- [废弃代码清理](#废弃代码清理)
- [API 变更](#api-变更)
- [迁移步骤](#迁移步骤)

---

## 背景

### 当前问题

在 Serverless 环境下，以下机制无法正常工作：

| 机制 | 问题 |
|------|------|
| `BatchDefinitionService` | 后台线程在请求结束后被终止 |
| `task_queue` | 内存队列，函数冻结后丢失 |
| `/api/words/definition-updates` 轮询 | `updated_words` 字典在不同实例间不共享 |

### 解决思路

将 **异步队列 + 轮询** 模式改为 **同步请求** 模式：

```
【旧模式】
添加单词 → 返回(无释义) → 后台获取 → 前端轮询 → 更新UI

【新模式】
添加单词 → 返回(无释义) → 前端请求获取释义 → 等待响应 → 更新UI
```

---

## 当前实现分析

### 后端

| 文件 | 功能 | 状态 |
|------|------|------|
| `api/vocabulary.py:280-299` | `POST /word` 添加单词 | 需修改 |
| `api/vocabulary.py:302-386` | `POST /words/batch` 批量导入 | 需修改 |
| `api/vocabulary.py:798-816` | `GET /words/definition-updates` 轮询 | **废弃** |
| `services/batch_definition_service.py` | 队列服务 | **废弃** |
| `services/vocabulary_service.py:32-79` | `fetch_definition_from_web()` | **保留** |

### 前端

| 文件 | 功能 | 状态 |
|------|------|------|
| `shared/api/words.ts:213-220` | `getDefinitionUpdates()` | **废弃** |
| `pages/VocabularyManagementPage.vue:122-267` | 释义轮询逻辑 | **删除** |
| `pages/VocabularyManagementPage.vue:56-60` | 进度条 UI | **删除** |
| `features/vocabulary/stores/wordEditor.ts:90-107` | `save()` 保存单词 | 需修改 |
| `features/vocabulary/editor/WordEditorModal.vue:57-98` | 释义轮询逻辑（遗留代码） | **删除** |
| `features/vocabulary/editor/WordEditorModal.vue:105-112` | 保存后启动轮询（遗留代码） | **删除** |
| `features/vocabulary/editor/WordEditorModal.vue:137-150` | 打开时检查队列（遗留代码） | **删除** |

> **注意**: `WordEditorModal.vue` 中的轮询代码是**遗留的不完整功能**。前端期望保存单词后能通过轮询获取新释义，但后端 `PATCH /word/<id>` 从未调用 `batch_service.add_task()`，所以这个功能从未工作过。

---

## 重构目标

1. **单个添加**: 添加后立即获取释义，前端显示 loading 状态
2. **批量导入**: 返回导入结果后，逐个获取释义，显示进度
3. **编辑单词**: 修改 word 字段时，保存后自动重新获取释义
4. **删除遗留代码**: 移除所有轮询相关代码（包括从未工作的 WordEditorModal 轮询）

---

## 详细方案

### 场景1: 单个单词添加

#### 流程

```
用户输入 "abandon" → 点击添加
          │
          ▼
    POST /api/word ────────────────► 插入数据库（无释义）
          │                                   │
          ▼                                   ▼
    返回 { id: 123, word: "abandon" }    ◄────┘
          │
          ▼
    前端显示单词（释义 loading）
          │
          ▼
    POST /api/words/123/fetch-definition ──► 爬取释义
          │                                   │
          ▼                                   ▼
    返回 { definition: {...} }          ◄────┘
          │
          ▼
    前端更新释义显示
```

#### 后端改动

```python
# api/vocabulary.py - 新增接口
@api_bp.route("/words/<int:word_id>/fetch-definition", methods=["POST"])
def fetch_word_definition(word_id):
    """同步获取单词释义"""
    word = db_get_word_by_id(word_id)
    if not word:
        return create_response(False, None, "Word not found"), 404

    definition = fetch_definition_from_web(word["word"])
    updated_word = db_update_word_definition(word_id, definition)

    return create_response(True, updated_word, "Definition fetched")
```

#### 前端改动

```typescript
// shared/api/words.ts - 新增方法
static async fetchDefinition(wordId: number): Promise<Word> {
  return post<Word>(`/api/words/${wordId}/fetch-definition`)
}
```

```typescript
// 添加单词的调用方式
async function addWord(wordText: string, source: string) {
  // 1. 添加单词
  const word = await api.words.createWord({ word: wordText, source, definition: {} })
  wordList.value.push({ ...word, isLoadingDefinition: true })

  // 2. 获取释义
  try {
    const updated = await api.words.fetchDefinition(word.id)
    const index = wordList.value.findIndex(w => w.id === word.id)
    if (index !== -1) {
      wordList.value[index] = { ...updated, isLoadingDefinition: false }
    }
  } catch (e) {
    // 标记获取失败，用户可手动重试
    const index = wordList.value.findIndex(w => w.id === word.id)
    if (index !== -1) {
      wordList.value[index].isLoadingDefinition = false
      wordList.value[index].definitionError = true
    }
  }
}
```

---

### 场景2: 批量单词导入

#### 流程

```
用户粘贴 100 个单词 → 点击导入
          │
          ▼
    POST /api/words/batch ──────────► 批量插入数据库
          │                                 │
          ▼                                 ▼
    返回 { inserted_words: [...] }    ◄────┘
          │
          ▼
    前端显示进度条: "正在获取释义 0/100"
          │
          ▼
    ┌─────────────────────────────────────────┐
    │  for word in inserted_words:            │
    │    POST /words/{id}/fetch-definition    │
    │    更新进度: "正在获取释义 1/100"        │
    │    更新列表中对应单词的释义              │
    └─────────────────────────────────────────┘
          │
          ▼
    完成，隐藏进度条
```

#### 前端实现

```typescript
async function batchImportWords(words: string[], source: string) {
  // 1. 批量导入
  const result = await api.words.batchImportWords({ words, source })

  // 2. 添加到列表（标记为 loading）
  const insertedWords = result.inserted_words.map(w => ({
    ...w,
    isLoadingDefinition: true
  }))
  wordList.value.push(...insertedWords)

  // 3. 显示进度并逐个获取释义
  definitionProgress.value = { current: 0, total: insertedWords.length }

  for (const word of insertedWords) {
    try {
      const updated = await api.words.fetchDefinition(word.id)
      updateWordInList(updated)
    } catch (e) {
      markWordDefinitionError(word.id)
    }
    definitionProgress.value.current++
  }

  // 4. 完成
  definitionProgress.value = null
}
```

---

### 场景3: 编辑单词时修改 word 字段

#### 流程

```
用户编辑单词 "abandn" → "abandon" → 点击保存
          │
          ▼
    保存单词到数据库
          │
          ▼
    检测到 word 字段变化，自动调用 fetch-definition API
          │
          ▼
    返回新释义，自动更新前端 store
          │
          ▼
    编辑窗口 / hover 预览自动显示新释义
```

#### 前端实现

```typescript
// features/vocabulary/stores/wordEditor.ts
async function save(): Promise<boolean> {
  if (!currentWord.value || !canSave.value) return false

  const wordChanged = originalWord.value?.word !== currentWord.value.word

  isSaving.value = true
  try {
    // 1. 保存单词
    const updatedWord = await api.words.updateWord(currentWord.value.id, currentWord.value)

    // 2. 如果 word 字段变化，自动重新获取释义
    if (wordChanged) {
      try {
        const withDefinition = await api.words.fetchDefinition(updatedWord.id)
        currentWord.value = withDefinition
        originalWord.value = { ...withDefinition }
      } catch (e) {
        // 释义获取失败不影响保存结果，只记录日志
        log.warn('获取新释义失败:', e)
        currentWord.value = updatedWord
        originalWord.value = { ...updatedWord }
      }
    } else {
      currentWord.value = updatedWord
      originalWord.value = { ...updatedWord }
    }

    isEditing.value = false
    onWordUpdatedCallbacks.value.forEach(cb => cb(currentWord.value!))
    return true
  } catch (error) {
    log.error('保存单词失败:', error)
    return false
  } finally {
    isSaving.value = false
  }
}
```

#### 用户体验

```
用户修改 "abandn" → "abandon" → 点击保存
          │
          ▼
    ┌─────────────────────────┐
    │  ⏳ 正在保存...          │  (保存 + 获取释义)
    └─────────────────────────┘
          │
          ▼ (约 2-5 秒)
    ┌─────────────────────────┐
    │  abandon                │
    │  /əˈbændən/  ← 新释义    │
    │  v. 放弃，抛弃           │
    └─────────────────────────┘

    hover 预览和列表也会自动更新（通过 onWordUpdatedCallbacks）
```

---

## 代码变更清单

### 后端

| 文件 | 操作 | 说明 |
|------|------|------|
| `api/vocabulary.py` | 新增 | `POST /words/<id>/fetch-definition` 接口 |
| `api/vocabulary.py` | 修改 | `POST /word` 移除 `batch_service.add_task()` |
| `api/vocabulary.py` | 修改 | `POST /words/batch` 移除 `batch_service.add_task()` |
| `api/vocabulary.py` | 删除 | `GET /words/definition-updates` 接口 |
| `database/vocabulary_dao.py` | 新增 | `db_update_word_definition()` 函数 |
| `app.py` | 修改 | 移除 `batch_definition_service` 初始化 |

### 前端

| 文件 | 操作 | 说明 |
|------|------|------|
| `shared/api/words.ts` | 新增 | `fetchDefinition()` 方法 |
| `shared/api/words.ts` | 删除 | `getDefinitionUpdates()` 方法 |
| `pages/VocabularyManagementPage.vue` | 删除 | 轮询逻辑、旧进度条 UI |
| `pages/VocabularyManagementPage.vue` | 修改 | 添加/批量导入后调用 `fetchDefinition()` |
| `features/vocabulary/stores/wordEditor.ts` | 修改 | `save()` 检测 word 变化，自动获取释义 |
| `features/vocabulary/editor/WordEditorModal.vue` | 删除 | 遗留的轮询逻辑（从未工作） |

---

## 废弃代码清理

### 后端待删除

```
services/batch_definition_service.py  # 整个文件
```

### 后端待修改（移除引用）

```
app.py                          # 移除 batch_definition_service 初始化
api/vocabulary.py               # 移除 get_batch_definition_service 调用
database/vocabulary/word_crud.py  # 检查是否有引用
```

### 前端待删除

```typescript
// pages/VocabularyManagementPage.vue
- definitionQueueSize
- definitionPollingTimer
- pollDefinitionUpdates()
- startDefinitionPolling()
- stopDefinitionPolling()
- 相关 CSS (.definition-loading-progress)

// features/vocabulary/editor/WordEditorModal.vue（遗留代码）
- definitionPollingTimer
- pollDefinitionUpdates()
- startDefinitionPolling()
- stopDefinitionPolling()
- watch(isSaving, ...) 中的轮询启动逻辑
- watch(isOpen, ...) 中的队列检查逻辑

// shared/api/words.ts
- getDefinitionUpdates()
```

---

## API 变更

### 新增

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/words/<id>/fetch-definition` | 同步获取单词释义 |

### 废弃

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/words/definition-updates` | 轮询接口，不再需要 |

### 不变

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/word` | 添加单词（移除队列调用，其他不变） |
| POST | `/api/words/batch` | 批量导入（移除队列调用，其他不变） |
| PATCH | `/api/word/<id>` | 更新单词（不变） |

---

## 迁移步骤

### Phase 1: 后端改造 ✅ 完成

1. [x] 新增 `db_update_word_definition()` DAO 函数（已存在于 `word_crud.py`）
2. [x] 新增 `POST /words/<id>/fetch-definition` 接口
3. [x] 修改 `POST /word` 移除队列调用
4. [x] 修改 `POST /words/batch` 移除队列调用
5. [x] 删除 `GET /words/definition-updates` 接口
6. [x] 删除 `services/batch_definition_service.py`
7. [x] 清理 `app.py` 中的初始化代码

### Phase 2: 前端改造 ✅ 完成

1. [x] 新增 `fetchDefinition()` API 方法
2. [x] 删除 `getDefinitionUpdates()` API 方法
3. [x] 修改 `VocabularyManagementPage.vue` 添加单词逻辑
4. [x] 删除 `VocabularyManagementPage.vue` 轮询逻辑和旧进度条
5. [x] 删除 `WordEditorModal.vue` 遗留的轮询逻辑
6. [x] 修改 `wordEditor.ts` save() 函数（检测 word 变化自动获取释义）

### Phase 3: 更新文档 ✅ 完成

1. [x] 更新 `SERVERLESS_ISSUES.md` 标记问题已解决
2. [x] 更新本文档迁移步骤（标记为完成）

> **重构完成日期**: 2026-01-20

---

## 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 释义获取超时 | 用户等待时间长 | 设置合理超时(10秒)，失败时允许重试 |
| 批量导入时间长 | 100个单词需要较长时间 | 显示进度条，允许后台继续 |
| 爬虫被封 | 释义获取失败 | 添加请求延迟，失败时友好提示 |

---

## 时间线

| 阶段 | 预计完成 |
|------|----------|
| Phase 1 后端改造 | - |
| Phase 2 前端改造 | - |
| Phase 3 文档更新 | - |
