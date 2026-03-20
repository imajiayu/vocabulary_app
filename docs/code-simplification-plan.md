# 代码简化计划

> 2026-03-20 全项目审查结果，按优先级分步执行。
> 每个步骤独立可提交，不依赖后续步骤。

---

## 高优先级（影响大，改动小）

### Step 1 — 合并重复的 `_get_synsets()` 缓存

- **文件**：`backend/generators/synonym_generator.py:22-27`、`topic_generator.py:67-72`
- **问题**：两个生成器各自定义了相同的 `@lru_cache` 包装函数，各维护独立缓存，浪费内存且降低命中率
- **方案**：提取到 `backend/generators/wordnet_utils.py`，两个生成器共享同一缓存
- **实际方案**：共享函数缓存所有 synsets，topic 生成器调用时加 `[:1]` 切片保持只取首个义项
- [x] 完成

### Step 2 — 删除 `GenerationResult` 的废弃字段

- **文件**：`backend/generators/base.py:15-20`，以及所有 5 个生成器的 `generate()` 返回语句
- **问题**：`relations` 和 `logs` 字段在增量保存模式下**永远为空列表**，5 处返回都写 `relations=[], logs=[]`
- **方案**：`GenerationResult` 只保留 `stats: dict`，或重命名为 `GenerationStats`
- [x] 完成

### Step 3 — 提取生成器的通用完成逻辑

- **文件**：5 个生成器的 `generate()` 方法末尾（synonym:218、antonym:165、root:274、confused:181、topic:324）
- **问题**：每个生成器末尾都重复 `self._flush(force=True)` + 构造 stats + 返回 result
- **方案**：在 `BaseGenerator` 中添加 `_finalize(stats: dict) -> GenerationResult`
- **依赖**：Step 2 完成后执行更简洁
- [x] 完成

### Step 4 — 合并 Composable 的读写/只读版本

- **文件**：`frontend/src/shared/composables/useShuffleSelection.ts`、`useSourceSelection.ts`
- **问题**：每个都导出完整版 + ReadOnly 版，代码重复 85%（`initializeFromData` 逻辑完全相同）
- **方案**：合并为单一函数，返回值通过 `readonly()` 包装可写 ref，或增加 `readOnly` 参数
- **实际方案**：Shuffle 直接删除 ReadOnly 版本；Source 提取 `_loadSourceConfig()` 共享 helper 消除重复
- [x] 完成

### Step 5 — TTS 缓存 API 提取通用请求方法

- **文件**：`frontend/src/shared/utils/audio/ttsCacheApi.ts:9-55`
- **问题**：`uploadTtsCache()`、`deleteTtsCache()`、`deleteTtsCacheSource()` 重复相同的认证 + fetch + catch 逻辑
- **方案**：提取 `_ttsRequest(method, body)` 私有方法，三个公共方法调用它
- [x] 完成

### Step 6 — 合并 Review/Spelling 持久化函数

- **文件**：`frontend/src/shared/services/wordResultService.ts:136-150`、`224-239`
- **问题**：`persistReviewResult()` 和 `persistSpellingResult()` 结构完全相同（API 调用 + history 写入 + catch）
- **方案**：提取 `persistWordResult(type: 'review' | 'spelling', persistData, historyContext?)` 通用函数
- **实际方案**：提取 `_saveHistory()` 共享 helper，两个 persist 函数保留各自的 API 调用
- [x] 完成

### Step 7 — API 客户端错误处理去重

- **文件**：`frontend/src/shared/api/client.ts:48-62`、`98-112`
- **问题**：`get()` 和 `post()` 中 HTTP 错误处理代码重复 9 行
- **方案**：提取 `_handleHttpError(response: Response)` 私有函数
- **实际方案**：提取 `handleResponse<T>()` 统一处理错误检查 + 响应解析（比仅提取错误处理更彻底）
- [x] 完成

---

## 中优先级（维护性和一致性）

### Step 8 — 预计算数据集映射

- **文件**：`backend/generators/data.py`、`antonym_generator.py:38-53`、`confused_generator.py:58-64`
- **问题**：手工反义词对、假前缀对、经典混淆对在运行时重复构建双向映射
- **方案**：在 `data.py` 中直接导出预计算好的 dict/set，生成器直接使用
- [ ] 完成

### Step 9 — Speaking/Writing Context 提取通用工厂

- **文件**：`frontend/src/features/writing/composables/useWritingContext.ts`、`frontend/src/features/speaking/composables/useSpeakingContext.ts`
- **问题**：两个 Context 架构完全相同（create/inject + loading + selected + CRUD + confirm 删除）
- **方案**：提取 `createModuleContext<T>()` 工厂函数，传入数据源和配置，减少 50-100 行重复
- **注意**：需评估两个模块的差异点，确保抽象不会过度
- [ ] 完成

### Step 10 — 删除 Settings 的薄包装 Composables

- **文件**：`frontend/src/shared/composables/useAudioAccent.ts`、`useHotkeys.ts`
- **问题**：仅包装 `useSettings()` 的 computed 属性，无额外逻辑
- **方案**：删除这两个文件，调用方直接用 `useSettings()`；或合并到 `useSettings()` 导出
- **注意**：需全局搜索所有引用点并替换
- [ ] 完成

### Step 11 — ECharts 组件提取初始化 Composable

- **文件**：`frontend/src/shared/components/charts/PieChart.vue`、`BarChart.vue`、`LineChart.vue`、`HeatMap.vue`
- **问题**：4 个组件重复相同的 init/resize/dispose 模式（~20 行/组件）
- **方案**：提取 `useEcharts(elRef, options)` composable，返回 chart 实例
- [ ] 完成

### Step 12 — Review Store 子模块合并

- **文件**：`frontend/src/features/vocabulary/stores/review/`（5 个子模块）
- **问题**：子模块间耦合度高，`loadWords()` 需传递 4 个跨模块参数；主 Store 只是组合器
- **方案**：合并为 2-3 个边界清晰的模块（如 `useQueueAndProgress` + `useResultAndLapse` + `useAudioPreloader`）
- **风险**：改动范围较大，建议单独一个 PR
- [ ] 完成

---

## 低优先级（可选改进）

### Step 13 — Writing 编辑器组件合并

- **文件**：`frontend/src/features/writing/components/EssayEditor.vue`、`OutlineEditor.vue`、`PromptEditor.vue`
- **问题**：三个编辑器功能相似度高，可通过 `type` prop 区分
- **方案**：合并为 `WritingEditor.vue`
- [ ] 完成

### Step 14 — Speaking 录音组件合并

- **文件**：`frontend/src/features/speaking/components/RecordItem.vue`、`RecordContent.vue`、`RecordsList.vue`
- **问题**：录音列表过度拆分为 3 个组件
- **方案**：合并为 `RecordsList.vue`，`RecordItem` 作为内部组件
- [ ] 完成

### Step 15 — 统一展开/折叠状态管理

- **文件**：`PartItem.vue`、`TopicItem.vue`、`FolderItem.vue`、`PromptItem.vue`
- **问题**：有的用 Context 管理，有的用本地 ref，不一致
- **方案**：提取 `useExpandable()` composable，统一模式
- [ ] 完成

### Step 16 — 统一通知系统

- **文件**：跨模块（Review 自定义 notification、Speaking `alert()`、Writing 无通知）
- **问题**：三种不同的用户反馈方式
- **方案**：统一使用 Toast 组件
- [ ] 完成

### Step 17 — 批量插入 SQL 逻辑去重

- **文件**：`backend/services/generation_service.py:310-333`、`336-361`
- **问题**：relations 和 logs 的批量插入参数化逻辑几乎相同
- **方案**：提取 `_batch_insert(table, rows, columns)` 通用方法
- [ ] 完成

### Step 18 — 数值转换工具函数合并

- **文件**：`frontend/src/shared/utils/stats.ts:110-129`
- **问题**：`toNumber()`、`toInt()`、`roundTo()` 三个功能相似的函数
- **方案**：合并为 `coerceNumber(value, decimals?)` 统一函数
- [ ] 完成
