# 批量释义获取服务架构说明

## 问题背景

原先的实现中，批量插入单词时会为每个单词创建独立的线程去爬取释义，导致：
- 同时发起大量并发HTTP请求
- 触发API限流或网络波动
- 释义获取失败率高

## 解决方案

### 核心设计

使用**队列 + 单线程工作者**模式，结合**回调函数**避免循环引用。

### 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                         app.py                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │ 应用启动时初始化服务并注入回调函数                  │     │
│  │ get_batch_definition_service(                      │     │
│  │     db_update_callback=db_update_word_definition_only │  │
│  │ )                                                   │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│            batch_definition_service.py                       │
│  ┌────────────────────────────────────────────────────┐     │
│  │ BatchDefinitionService                             │     │
│  │                                                     │     │
│  │ • task_queue: Queue()  队列存储任务                │     │
│  │ • worker_thread: 单线程工作者                       │     │
│  │ • db_update_callback: 回调函数引用                 │     │
│  │                                                     │     │
│  │ add_task(word_id, word_text)                       │     │
│  │   └─> 添加到队列                                   │     │
│  │                                                     │     │
│  │ _worker()                                          │     │
│  │   └─> 顺序处理队列中的任务                         │     │
│  │       • 获取释义 (fetch_definition_from_web)       │     │
│  │       • 调用回调更新数据库 (db_update_callback)    │     │
│  │       • 发送WebSocket事件                          │     │
│  │       • 延迟0.5秒                                  │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                         │
                         │ 调用回调
                         ▼
┌─────────────────────────────────────────────────────────────┐
│               vocabulary_dao.py                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │ db_update_word_definition_only(word_id, definition)│     │
│  │   └─> 纯数据库操作，更新单词释义字段               │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### 关键特性

1. **避免循环引用**
   - Service层 不直接导入 DAO层
   - 通过回调函数注入的方式解耦
   - 在应用启动时（app.py）注入回调

2. **队列控制并发**
   - 所有任务进入统一队列
   - 单个工作线程顺序处理
   - 请求间隔0.5秒，避免API限流

3. **无限重试**
   - 失败后等待0.5秒再重试
   - 直到成功获取释义才停止
   - 确保每个单词都能获得释义

4. **职责分离**
   - `batch_definition_service.py`: 队列管理、爬虫调用、重试逻辑
   - `vocabulary_dao.py`: 数据库操作
   - `vocabulary_service.py`: 爬虫实现
   - `app.py`: 依赖注入

## 使用方式

### 1. 单个插入（API层）

```python
from web_app.services.batch_definition_service import get_batch_definition_service

batch_service = get_batch_definition_service()
batch_service.add_task(word_id, word_text)
```

### 2. 批量插入（API层）

```python
from web_app.services.batch_definition_service import get_batch_definition_service

batch_service = get_batch_definition_service()
for word in words:
    batch_service.add_task(word["id"], word["word"])
```

### 3. 批量填充（工具函数）

```python
# connection.py
from web_app.services.batch_definition_service import get_batch_definition_service

batch_service = get_batch_definition_service()
for word_id, word_text in words:
    batch_service.add_task(word_id, word_text)
```

## 数据流

```
用户请求
  ├─> API: POST /api/word
  │     └─> db_insert_word() 插入单词
  │     └─> batch_service.add_task() 添加到队列
  │     └─> 立即返回响应
  │
  └─> 后台工作线程 (daemon)
        └─> 从队列取任务
        └─> fetch_definition_from_web() 爬取释义
        └─> db_update_callback() 更新数据库
        └─> ws_events.emit_word_updated() WebSocket推送
        └─> time.sleep(0.5) 延迟
        └─> 处理下一个任务
```

## 优势

1. **稳定性高**: 避免并发请求导致的网络波动
2. **架构清晰**: 通过依赖注入避免循环引用
3. **职责明确**: Service层不直接操作数据库
4. **可扩展**: 可以轻松调整延迟、重试策略
5. **用户体验好**: API立即返回，后台异步处理

## 文件清单

- `web_app/services/batch_definition_service.py` - 队列服务实现
- `web_app/database/vocabulary_dao.py` - 数据库操作（含回调函数）
- `web_app/api/vocabulary.py` - API端点（使用队列服务）
- `web_app/database/connection.py` - 工具函数（使用队列服务）
- `web_app/app.py` - 应用启动（依赖注入）
