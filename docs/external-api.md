# External API

供 iOS 快捷指令等外部工具调用的 HTTP 接口，效果等同于网页操作。

## 基础信息

| 项目 | 值 |
|------|------|
| Base URL | `https://mieltsm.top` |
| 认证 | 无需认证 |
| Content-Type | `application/json` |
| 字符编码 | UTF-8 |

## 端点

### POST `/api/external/words` — 新增单词

**参数**（JSON body）：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `user_id` | string (UUID) | 是 | 用户 ID |
| `word` | string | 是 | 单词（自动 NFC + trim + lowercase） |
| `source` | string | 是 | 来源（如 `IELTS`） |

**自动设置的字段**：`definition='{}'`, `date_added=today(UTC)`, `next_review=today(UTC)`, `stop_review=0`

**成功响应** (201)：

```json
{
  "success": true,
  "data": { "word": "abandon", "source": "IELTS" },
  "error": null
}
```

**错误响应**：

| 状态码 | 场景 |
|--------|------|
| 400 | 缺少必填参数 |
| 409 | 同一 source 下单词已存在 |

---

### DELETE `/api/external/words` — 删除单词

**参数**（JSON body）：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `user_id` | string (UUID) | 是 | 用户 ID |
| `word` | string | 是 | 单词 |
| `source` | string | 是 | 来源 |

通过 `(word, user_id, source)` 唯一约束精确定位。数据库 FK `ON DELETE CASCADE` 自动清理关联数据（`words_relations`、`relation_generation_log`、`review_history`）。

**成功响应** (200)：

```json
{
  "success": true,
  "data": { "word": "abandon", "source": "IELTS" },
  "error": null
}
```

**错误响应**：

| 状态码 | 场景 |
|--------|------|
| 400 | 缺少必填参数 |
| 404 | 单词不存在 |

### GET `/api/external/words` — 查询单词列表

**参数**（Query string）：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `user_id` | string (UUID) | 是 | 用户 ID |
| `source` | string | 否 | 来源过滤（如 `Ukrainian`） |

- 有 `source` 时返回简洁字符串数组（供课程生成等场景使用）
- 无 `source` 时返回带 source 信息的对象数组

**成功响应 — 有 source** (200)：

```json
{
  "success": true,
  "data": {
    "words": ["книга", "молоко", "стіл"],
    "count": 3
  },
  "error": null
}
```

**成功响应 — 无 source** (200)：

```json
{
  "success": true,
  "data": {
    "words": [
      { "word": "abandon", "source": "IELTS" },
      { "word": "стіл", "source": "Ukrainian" }
    ],
    "count": 2
  },
  "error": null
}
```

**错误响应**：

| 状态码 | 场景 |
|--------|------|
| 400 | 缺少 user_id |

---

## curl 示例

```bash
# 查询指定来源的单词列表
curl -s "https://mieltsm.top/api/external/words?\
user_id=<your-uuid>&source=Ukrainian"

# 查询所有单词
curl -s "https://mieltsm.top/api/external/words?\
user_id=<your-uuid>"

# 新增单词
curl -X POST https://mieltsm.top/api/external/words \
  -H "Content-Type: application/json" \
  -d '{"user_id":"<your-uuid>","word":"abandon","source":"IELTS"}'

# 删除单词
curl -X DELETE https://mieltsm.top/api/external/words \
  -H "Content-Type: application/json" \
  -d '{"user_id":"<your-uuid>","word":"abandon","source":"IELTS"}'
```

## iOS 快捷指令使用

1. 在快捷指令中添加"获取 URL 内容"操作
2. URL 填写 `https://mieltsm.top/api/external/words`
3. 方法选择 `POST`（新增）或自定义请求方法 `DELETE`（删除）
4. 请求体选择 JSON，填入 `user_id`、`word`、`source` 三个字段
5. `user_id` 可硬编码你的 UUID，`source` 通常固定为 `IELTS`
6. `word` 可从剪贴板、输入框或其他操作获取
